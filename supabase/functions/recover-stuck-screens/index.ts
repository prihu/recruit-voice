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

    // Find screens stuck in 'in_progress' status for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: stuckScreens, error: fetchError } = await supabase
      .from('screens')
      .select('id, session_id, bulk_operation_id, organization_id')
      .eq('status', 'in_progress')
      .not('session_id', 'is', null)
      .lt('started_at', thirtyMinutesAgo);

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
              await supabase.rpc('increment', {
                table_name: 'bulk_operations',
                row_id: screen.bulk_operation_id,
                column_name: 'failed_count',
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

        // Calculate score from evaluation criteria
        const evaluationResults = analysis.evaluation_criteria_results || [];
        const passedCriteria = evaluationResults.filter((r: any) => r.result === 'pass').length;
        const totalCriteria = evaluationResults.length;
        const score = totalCriteria > 0 ? (passedCriteria / totalCriteria) * 100 : 0;

        // Determine outcome
        const callSuccessful = analysis.call_successful !== false;
        const outcome = callSuccessful && score >= 60 ? 'pass' : 'fail';

        // Extract reasons for failure
        const reasons = evaluationResults
          .filter((r: any) => r.result === 'fail')
          .map((r: any) => r.criteria || 'Unknown criteria failed');

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
          await supabase.rpc('increment', {
            table_name: 'bulk_operations',
            row_id: screen.bulk_operation_id,
            column_name: outcome === 'pass' ? 'completed_count' : 'failed_count',
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
