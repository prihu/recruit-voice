import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting recovery of stuck screens...');

    // Find screens stuck in 'in_progress' status for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckScreens, error: fetchError } = await supabase
      .from('screens')
      .select('id, session_id, bulk_operation_id, organization_id')
      .eq('status', 'in_progress')
      .not('session_id', 'is', null)
      .lt('started_at', fiveMinutesAgo);

    if (fetchError) {
      console.error('Error fetching stuck screens:', fetchError);
      throw fetchError;
    }

    if (!stuckScreens || stuckScreens.length === 0) {
      console.log('No stuck screens found');
      return new Response(
        JSON.stringify({ message: 'No stuck screens found', recovered: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stuckScreens.length} stuck screens to recover`);

    let recovered = 0;
    let failed = 0;

    // Process each stuck screen
    for (const screen of stuckScreens) {
      try {
        console.log(`Fetching conversation data for session: ${screen.session_id}`);

        // Fetch conversation data from ElevenLabs API
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${screen.session_id}`,
          {
            headers: {
              'xi-api-key': elevenLabsApiKey,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.error(`Conversation not found for session: ${screen.session_id}`);
            // Mark as failed - conversation doesn't exist
            await supabase
              .from('screens')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                ai_summary: 'Conversation data not found in ElevenLabs API',
              })
              .eq('id', screen.id);

            if (screen.bulk_operation_id) {
              await supabase.rpc('increment_bulk_operation_count', {
                operation_id: screen.bulk_operation_id,
                count_type: 'failed_count',
              });
            }

            failed++;
            continue;
          }
          throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
        }

        const conversationData = await response.json();
        console.log(`Retrieved conversation data for session: ${screen.session_id}`);

        // Extract data from conversation
        const transcript = conversationData.transcript || [];
        const analysis = conversationData.analysis || {};
        const metadata = conversationData.metadata || {};

        // Normalize and calculate score from evaluation criteria
        const evalRaw = analysis.evaluation_criteria_results;
        let evaluationResults: any[] = [];
        if (Array.isArray(evalRaw)) {
          evaluationResults = evalRaw;
        } else if (evalRaw && typeof evalRaw === 'object') {
          evaluationResults = Object.entries(evalRaw).map(([criteria, v]: [string, any]) => ({
            criteria,
            ...((v as any) || {}),
            result: (v as any)?.result ?? (((v as any)?.passed) ? 'pass' : 'fail'),
            passed: (v as any)?.passed ?? ((v as any)?.result === 'pass'),
            reason: (v as any)?.reason ?? (v as any)?.details ?? null,
          }));
        }
        console.log('[RECOVER] evaluation_criteria_results shape:', typeof evalRaw, 'items:', evaluationResults.length);

        const passedCriteria = evaluationResults.filter((r: any) => r.passed === true || r.result === 'pass').length;
        const totalCriteria = evaluationResults.length;
        const score = totalCriteria > 0 ? (passedCriteria / totalCriteria) * 100 : 0;

        // Determine outcome
        let outcome: 'pass' | 'fail';
        if (typeof analysis.call_successful === 'boolean') {
          outcome = analysis.call_successful ? 'pass' : 'fail';
        } else {
          outcome = score >= 60 ? 'pass' : 'fail';
        }

        // Extract reasons for failure
        const reasons = evaluationResults
          .filter((r: any) => r.passed === false || r.result === 'fail')
          .map((r: any) => r.reason || r.criteria || 'Unknown criteria failed');

        // Handle case where there's no evaluation data
        if (evaluationResults.length === 0 && transcript.length < 2) {
          reasons.push('Candidate did not respond to screening questions', 'Call completed without collecting answers');
        }

        // Calculate call quality metrics
        const conversationTurns = transcript.length;

        // Count candidate messages
        const candidateMessages = transcript.filter((msg: any) => 
          msg.role === 'user' || msg.speaker === 'candidate'
        ).length;

        const candidateResponded = candidateMessages > 0;

        // Calculate time to first candidate response
        let firstResponseTime: number | null = null;
        if (transcript.length > 1) {
          const firstCandidateMsg = transcript.find((msg: any) => 
            msg.role === 'user' || msg.speaker === 'candidate'
          );
          if (firstCandidateMsg?.time_in_call_secs !== undefined) {
            firstResponseTime = Math.round(firstCandidateMsg.time_in_call_secs);
          }
        }

        const callConnected = conversationTurns >= 2 && candidateResponded;

        console.log(`[RECOVER] Call quality for screen ${screen.id}:`, {
          conversationTurns,
          candidateResponded,
          callConnected,
          firstResponseTime
        });

        // Prepare update data
        const updateData = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          transcript: transcript.length > 0 ? transcript : null,
          ai_summary: analysis.transcript_summary || 'No summary available',
          answers: evaluationResults.length > 0 ? evaluationResults : null,
          score: score,
          outcome: outcome,
          reasons: reasons.length > 0 ? reasons : null,
          duration_seconds: metadata.duration_seconds || null,
          recording_url: metadata.recording_url || null,
          conversation_turns: conversationTurns,
          candidate_responded: candidateResponded,
          call_connected: callConnected,
          first_response_time_seconds: firstResponseTime,
        };

        // Update the screen
        const { error: updateError } = await supabase
          .from('screens')
          .update(updateData)
          .eq('id', screen.id);

        if (updateError) {
          console.error(`Error updating screen ${screen.id}:`, updateError);
          failed++;
          continue;
        }

        // Update bulk operation count
        if (screen.bulk_operation_id) {
          const count_type = outcome === 'pass' ? 'completed_count' : 'failed_count';
          await supabase.rpc('increment_bulk_operation_count', {
            operation_id: screen.bulk_operation_id,
            count_type: count_type,
          });
        }

        console.log(`Successfully recovered screen ${screen.id}`);
        recovered++;

      } catch (error) {
        console.error(`Error processing screen ${screen.id}:`, error);
        failed++;
      }
    }

    console.log(`Recovery complete: ${recovered} recovered, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Recovery complete',
        total: stuckScreens.length,
        recovered,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recovery script error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
