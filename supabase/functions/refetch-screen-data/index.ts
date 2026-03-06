import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function scoreFromAnswerQuality(answers: Record<string, any>): {
  score: number;
  outcome: 'pass' | 'fail' | 'needs_review' | 'incomplete';
  reasons: string[];
} {
  const entries = Object.values(answers);
  if (entries.length === 0) {
    return { score: 0, outcome: 'incomplete', reasons: ['No answers captured'] };
  }

  let sum = 0;
  for (const entry of entries) {
    const quality = (entry?.answer_quality || '').toLowerCase();
    if (quality === 'good') sum += 1.0;
    else if (quality === 'partial') sum += 0.5;
  }

  const score = Math.round((sum / entries.length) * 100);
  const reasons: string[] = [];

  let outcome: 'pass' | 'fail' | 'needs_review' | 'incomplete';
  if (score >= 80) {
    outcome = 'pass';
  } else if (score >= 60) {
    outcome = 'needs_review';
    reasons.push('Score in ambiguous range (60-79) - requires human review');
  } else {
    outcome = 'fail';
    for (const entry of entries) {
      const quality = (entry?.answer_quality || '').toLowerCase();
      if (quality === 'poor' || quality === 'skipped') {
        reasons.push(`${entry.question_text || 'Question'}: ${quality}`);
      }
    }
  }

  return { score, outcome, reasons };
}

Deno.serve(async (req) => {
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

    const { screen_id } = await req.json();
    if (!screen_id) {
      return new Response(
        JSON.stringify({ error: 'screen_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch screen record
    const { data: screen, error: screenError } = await supabase
      .from('screens')
      .select('id, session_id, answers, role_id, bulk_operation_id')
      .eq('id', screen_id)
      .single();

    if (screenError || !screen) {
      return new Response(
        JSON.stringify({ error: 'Screen not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!screen.session_id) {
      return new Response(
        JSON.stringify({ error: 'No session_id (conversation ID) on this screen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REFETCH] Fetching conversation ${screen.session_id} for screen ${screen_id}`);

    // Fetch from ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${screen.session_id}`,
      { headers: { 'xi-api-key': elevenLabsApiKey } }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[REFETCH] ElevenLabs API error: ${response.status}`, errText);
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conversationData = await response.json();
    const transcript = conversationData.transcript || [];
    const analysis = conversationData.analysis || {};
    const metadata = conversationData.metadata || {};

    console.log(`[REFETCH] Got transcript: ${transcript.length} turns, analysis keys: ${Object.keys(analysis)}`);

    // === Extract answers from multiple sources ===
    let toolAnswers: Record<string, any> = {};
    
    // Source 1: collected_tool_results (top-level)
    const collectedResults = conversationData.collected_tool_results || [];
    console.log(`[REFETCH] collected_tool_results count: ${collectedResults.length}`);
    
    for (const toolResult of collectedResults) {
      const toolName = toolResult.tool_name || toolResult.name || '';
      const params = toolResult.parameters || toolResult.params || toolResult.input || {};
      
      if (toolName.includes('save') && toolName.includes('answer')) {
        const questionText = params.question_text || params.question || '';
        const answerText = params.candidate_answer || params.answer || '';
        const answerQuality = params.answer_quality || 'partial';
        
        if (questionText) {
          const key = `q_${questionText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 60)}`;
          toolAnswers[key] = {
            question_text: questionText,
            candidate_answer: answerText,
            answer_quality: answerQuality,
            source: 'collected_tool_results'
          };
        }
      }
    }

    // Source 2: data_collection_results (in analysis)
    const dataCollectionResults = analysis.data_collection_results || {};
    const dataCollectionResultsList = analysis.data_collection_results_list || [];
    console.log(`[REFETCH] data_collection_results keys: ${Object.keys(dataCollectionResults).length}, list: ${dataCollectionResultsList.length}`);
    console.log(`[REFETCH] data_collection_results:`, JSON.stringify(dataCollectionResults).substring(0, 500));
    console.log(`[REFETCH] data_collection_results_list:`, JSON.stringify(dataCollectionResultsList).substring(0, 500));
    
    // data_collection_results is typically { "field_name": { value: "...", ... } }
    if (Object.keys(toolAnswers).length === 0) {
      // Try extracting from data_collection_results object
      if (typeof dataCollectionResults === 'object' && Object.keys(dataCollectionResults).length > 0) {
        for (const [fieldName, fieldData] of Object.entries(dataCollectionResults)) {
          const data = fieldData as any;
          const value = typeof data === 'string' ? data : (data?.value || data?.answer || JSON.stringify(data));
          const key = `q_${fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 60)}`;
          toolAnswers[key] = {
            question_text: fieldName,
            candidate_answer: value,
            answer_quality: 'good', // data_collection implies successful capture
            source: 'data_collection_results'
          };
        }
      }
      
      // Try extracting from data_collection_results_list array
      if (Object.keys(toolAnswers).length === 0 && Array.isArray(dataCollectionResultsList) && dataCollectionResultsList.length > 0) {
        for (const item of dataCollectionResultsList) {
          const name = item.data_collection_id || item.name || item.field || '';
          const value = item.value || item.result || item.answer || '';
          if (name) {
            const key = `q_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 60)}`;
            toolAnswers[key] = {
              question_text: name,
              candidate_answer: value,
              answer_quality: 'good',
              source: 'data_collection_results_list'
            };
          }
        }
      }
    }
    
    // Also log evaluation criteria for debugging
    console.log(`[REFETCH] evaluation_criteria_results:`, JSON.stringify(analysis.evaluation_criteria_results || {}).substring(0, 500));
    console.log(`[REFETCH] evaluation_criteria_results_list:`, JSON.stringify(analysis.evaluation_criteria_results_list || []).substring(0, 500));

    console.log(`[REFETCH] Extracted ${Object.keys(toolAnswers).length} answers from all sources`);

    // === Source 3: Extract from transcript by matching role questions ===
    let transcriptAnswers: Record<string, any> = {};
    if (Object.keys(toolAnswers).length === 0 && Array.isArray(transcript) && transcript.length > 0) {
      // Fetch role questions
      const { data: roleData } = await supabase
        .from('roles').select('questions').eq('id', screen.role_id).single();
      
      const questions = Array.isArray(roleData?.questions) ? roleData.questions : [];
      console.log(`[REFETCH] Attempting transcript extraction with ${questions.length} role questions`);
      
      for (const question of questions) {
        const qText = (question.text || '').toLowerCase();
        if (!qText || qText.length < 10) continue;
        
        // Find agent message containing this question (fuzzy: first 25 chars)
        const searchStr = qText.substring(0, 25);
        
        for (let i = 0; i < transcript.length; i++) {
          const msg = transcript[i];
          const msgRole = msg.role || msg.speaker || '';
          const msgText = (msg.message || msg.text || '').toLowerCase();
          
          if ((msgRole === 'agent' || msgRole === 'ai') && msgText.includes(searchStr)) {
            // Found the question - look for next candidate response
            for (let j = i + 1; j < transcript.length; j++) {
              const resp = transcript[j];
              const respRole = resp.role || resp.speaker || '';
              if (respRole === 'user' || respRole === 'candidate') {
                const answerText = resp.message || resp.text || '';
                const wordCount = answerText.trim().split(/\s+/).length;
                const quality = wordCount > 10 ? 'good' : wordCount >= 3 ? 'partial' : 'poor';
                
                const key = `q_${qText.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 60)}`;
                transcriptAnswers[key] = {
                  question_text: question.text,
                  candidate_answer: answerText,
                  answer_quality: quality,
                  source: 'transcript_extraction'
                };
                break;
              }
              // If next agent message appears before candidate response, skip
              if ((resp.role === 'agent' || resp.speaker === 'ai')) break;
            }
            break; // Found match for this question, move to next
          }
        }
      }
      console.log(`[REFETCH] Extracted ${Object.keys(transcriptAnswers).length} answers from transcript`);
    }

    // === Determine answers to use (priority: existing > tool > transcript) ===
    const existingAnswers = (screen.answers as Record<string, any>) || {};
    const answers = Object.keys(existingAnswers).length > 0 
      ? existingAnswers 
      : Object.keys(toolAnswers).length > 0 
        ? toolAnswers 
        : Object.keys(transcriptAnswers).length > 0
          ? transcriptAnswers
          : {};

    // === Call quality metrics ===
    const conversationTurns = Array.isArray(transcript) ? transcript.length : 0;
    const candidateMessageCount = Array.isArray(transcript)
      ? transcript.filter((msg: any) => msg.role === 'user' || msg.speaker === 'candidate').length
      : 0;
    const candidateResponded = candidateMessageCount > 0;
    let firstResponseTime: number | null = null;
    if (Array.isArray(transcript) && transcript.length > 1) {
      const firstCandidateMsg = transcript.find((msg: any) =>
        msg.role === 'user' || msg.speaker === 'candidate'
      );
      if (firstCandidateMsg?.time_in_call_secs !== undefined) {
        firstResponseTime = Math.round(firstCandidateMsg.time_in_call_secs);
      }
    }
    const callConnected = conversationTurns >= 1;

    // === Scoring ===
    const evalRaw = analysis.evaluation_criteria_results;
    const evalListRaw = analysis.evaluation_criteria_results_list;
    let evalArray: any[] = [];
    
    // Try the list format first (newer API)
    if (Array.isArray(evalListRaw) && evalListRaw.length > 0) {
      evalArray = evalListRaw.map((item: any) => ({
        criteria: item.criteria || item.name || item.evaluation_criteria_id || '',
        result: item.result || (item.passed ? 'pass' : 'fail'),
        passed: item.result === 'pass' || item.passed === true,
        reason: item.rationale || item.reason || item.details || null,
      }));
    } else if (Array.isArray(evalRaw)) {
      evalArray = evalRaw;
    } else if (evalRaw && typeof evalRaw === 'object') {
      evalArray = Object.entries(evalRaw).map(([criteria, v]: [string, any]) => ({
        criteria,
        ...((v as any) || {}),
        result: (v as any)?.result ?? (((v as any)?.passed) ? 'pass' : 'fail'),
        passed: (v as any)?.passed ?? ((v as any)?.result === 'pass'),
        reason: (v as any)?.reason ?? (v as any)?.details ?? null,
      }));
    }
    
    console.log(`[REFETCH] evalArray length: ${evalArray.length}`, JSON.stringify(evalArray).substring(0, 500));

    let score: number;
    let outcome: string;
    let reasons: string[] = [];

    if (evalArray.length > 0) {
      // PATH A: Eval criteria
      const passedCount = evalArray.filter(r => r.passed === true || r.result === 'pass').length;
      score = evalArray.length > 0 ? Math.round((passedCount / evalArray.length) * 100) : 0;

      if (score >= 80) outcome = 'pass';
      else if (score >= 60) { outcome = 'needs_review'; reasons.push('Score in ambiguous range'); }
      else { outcome = 'fail'; reasons = evalArray.filter(r => !r.passed).map(r => r.reason || r.criteria || 'Failed'); }
    } else if (Object.keys(answers).length > 0) {
      // PATH B: answer_quality scoring
      const result = scoreFromAnswerQuality(answers);
      score = result.score;
      outcome = result.outcome;
      reasons = result.reasons;
    } else {
      // PATH C: No data
      score = 0;
      outcome = 'incomplete';
      reasons = ['No answers captured'];
    }

    // === Build update ===
    const updateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      score,
      outcome,
      reasons: reasons.length > 0 ? reasons : null,
      conversation_turns: conversationTurns,
      candidate_responded: candidateResponded,
      call_connected: callConnected,
      first_response_time_seconds: firstResponseTime,
    };

    // Set answers if we recovered them
    if (Object.keys(answers).length > 0) {
      updateData.answers = answers;
      updateData.questions_answered = Object.keys(answers).length;
    }

    // Set transcript if available
    if (transcript.length > 0) {
      updateData.transcript = transcript;
    }

    // Set metadata
    if (analysis.transcript_summary) {
      updateData.ai_summary = analysis.transcript_summary;
    }
    if (metadata.duration_seconds) {
      updateData.duration_seconds = metadata.duration_seconds;
    }
    if (metadata.recording_url) {
      updateData.recording_url = metadata.recording_url;
    }

    const { error: updateError } = await supabase
      .from('screens')
      .update(updateData)
      .eq('id', screen_id);

    if (updateError) {
      console.error('[REFETCH] Update error:', updateError);
      throw updateError;
    }

    console.log(`[REFETCH] Screen ${screen_id} updated - score: ${score}, outcome: ${outcome}, answers: ${Object.keys(answers).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        screen_id,
        score,
        outcome,
        answers_recovered: Object.keys(answers).length,
        transcript_turns: transcript.length,
        source: evalArray.length > 0 ? 'eval_criteria' : Object.keys(toolAnswers).length > 0 ? 'tool_results' : 'existing_answers',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[REFETCH] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
