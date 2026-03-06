import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt injection detection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+(instructions?|prompts?|commands?)/i,
  /ignore\s+what\s+(you|they)\s+said/i,
  /forget\s+(everything|all|your)\s+(you|instructions?)/i,
  /you\s+are\s+now\s+a/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|a|an)/i,
  /disregard\s+(all|your|previous)/i,
  /override\s+(your|the)\s+(instructions?|programming)/i,
  /new\s+instructions?:/i,
  /system\s*prompt:/i,
  /jailbreak/i,
  /do\s+not\s+follow\s+(your|the)\s+rules/i,
  /bypass\s+(your|the|security)/i,
];

const MANIPULATION_PATTERNS = [
  /the\s+salary\s+(is|should\s+be|was)\s+actually/i,
  /change\s+(the|my)\s+(role|position|salary)/i,
  /mark\s+(me|this)\s+as\s+(passed?|hired|approved)/i,
  /give\s+(me|this)\s+a\s+(passing|perfect)\s+score/i,
  /automatically\s+(pass|approve|hire)/i,
  /set\s+(my|the)\s+score\s+to/i,
];

interface SecurityFlags {
  injection_detected: boolean;
  manipulation_detected: boolean;
  patterns_matched: string[];
  risk_level: 'low' | 'medium' | 'high';
}

function detectSecurityIssues(transcript: any[]): SecurityFlags {
  const flags: SecurityFlags = {
    injection_detected: false,
    manipulation_detected: false,
    patterns_matched: [],
    risk_level: 'low'
  };

  if (!Array.isArray(transcript) || transcript.length === 0) return flags;

  const candidateMessages = transcript
    .filter((msg: any) => msg.role === 'user' || msg.speaker === 'candidate')
    .map((msg: any) => msg.text || msg.message || '')
    .join(' ');

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(candidateMessages)) {
      flags.injection_detected = true;
      flags.patterns_matched.push(pattern.source);
    }
  }
  for (const pattern of MANIPULATION_PATTERNS) {
    if (pattern.test(candidateMessages)) {
      flags.manipulation_detected = true;
      flags.patterns_matched.push(pattern.source);
    }
  }

  if (flags.injection_detected && flags.manipulation_detected) flags.risk_level = 'high';
  else if (flags.injection_detected || flags.manipulation_detected) flags.risk_level = 'medium';

  return flags;
}

function scoreFromAnswerQuality(answers: Record<string, any>, securityFlags?: SecurityFlags, totalQuestions?: number): {
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

  const denominator = totalQuestions ? Math.max(totalQuestions, entries.length) : entries.length;
  const score = Math.round((sum / denominator) * 100);
  const reasons: string[] = [];
  const hasSecurityFlags = securityFlags && (securityFlags.risk_level === 'high' || securityFlags.risk_level === 'medium');

  // Completeness check: not all questions answered → incomplete
  if (totalQuestions && entries.length < totalQuestions) {
    reasons.push(`Only ${entries.length} of ${totalQuestions} questions answered`);
    return { score, outcome: 'incomplete', reasons };
  }

  let outcome: 'pass' | 'fail' | 'needs_review' | 'incomplete';
  if (hasSecurityFlags) {
    outcome = 'needs_review';
    reasons.push('Security flags detected - potential prompt manipulation, requires human review');
  } else if (score >= 80) {
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
      .select('id, session_id, answers, role_id, bulk_operation_id, completed_at')
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

    // Source 1.5: Extract from transcript tool_calls (matches webhook fallback)
    if (Object.keys(toolAnswers).length === 0 && Array.isArray(transcript)) {
      for (const turn of transcript) {
        for (const call of (turn.tool_calls || [])) {
          const toolName = call.tool_name || '';
          if (toolName.includes('save') && toolName.includes('answer')) {
            try {
              const bodyStr = call.tool_details?.body || call.params_as_json || '';
              const params = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
              const questionText = params.question_text || '';
              const answerText = params.candidate_answer || '';
              const answerQuality = params.answer_quality || 'partial';
              if (questionText) {
                const key = `q_${questionText.toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_|_$/g, '')
                  .substring(0, 60)}`;
                toolAnswers[key] = {
                  question_text: questionText,
                  candidate_answer: answerText,
                  answer_quality: answerQuality,
                  question_index: params.question_index,
                  source: 'transcript_tool_calls',
                };
              }
            } catch (e) { /* skip unparseable */ }
          }
        }
      }
      console.log(`[REFETCH] Extracted ${Object.keys(toolAnswers).length} answers from transcript tool_calls`);
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

    // === Determine answers to use ===
    // For refetch, prefer the source with the MOST answers (toolAnswers from fresh API data wins over stale DB data)
    const existingAnswers = (screen.answers as Record<string, any>) || {};
    const candidateSources = [
      { name: 'tool_results', data: toolAnswers },
      { name: 'existing_db', data: existingAnswers },
      { name: 'transcript_fuzzy', data: transcriptAnswers },
    ];
    const best = candidateSources.reduce((a, b) => 
      Object.keys(b.data).length > Object.keys(a.data).length ? b : a
    );
    const answers = best.data;
    console.log(`[REFETCH] Using answer source: ${best.name} (${Object.keys(answers).length} answers)`);

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

    // === Security detection ===
    const securityFlags = detectSecurityIssues(Array.isArray(transcript) ? transcript : []);

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
    let extractedData: any = {};

    if (evalArray.length > 0) {
      // PATH A: Eval criteria
      extractedData.evaluation_results = evalArray;
      if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
        extractedData.security_flags = securityFlags;
      }

      const passedCount = evalArray.filter(r => r.passed === true || r.result === 'pass').length;
      score = Math.round((passedCount / evalArray.length) * 100);

      const hasSecurityFlags = securityFlags.risk_level === 'high' || securityFlags.risk_level === 'medium';
      const lowConfidenceItems = evalArray.filter((r: any) => r.confidence !== undefined && r.confidence < 0.7);
      const hasLowConfidence = lowConfidenceItems.length > evalArray.length * 0.3;

      if (hasSecurityFlags) {
        outcome = 'needs_review';
        reasons.push('Security flags detected - potential prompt manipulation, requires human review');
      } else if (hasLowConfidence) {
        outcome = 'needs_review';
        reasons.push('Low confidence on multiple evaluation criteria - requires human review');
      } else if (score >= 80) {
        outcome = 'pass';
      } else if (score >= 60) {
        outcome = 'needs_review';
        reasons.push('Score in ambiguous range (60-79) - requires human review');
      } else {
        outcome = 'fail';
        reasons = evalArray.filter(r => !r.passed).map(r => r.reason || r.criteria || 'Failed');
      }
    } else if (Object.keys(answers).length > 0) {
      // PATH B: answer_quality scoring
      // Fetch totalQuestions from the role
      let totalQuestions: number | undefined;
      const { data: roleData } = await supabase
        .from('roles').select('questions').eq('id', screen.role_id).single();
      if (roleData?.questions && Array.isArray(roleData.questions)) {
        totalQuestions = roleData.questions.length;
      }
      const result = scoreFromAnswerQuality(answers, securityFlags, totalQuestions);
      score = result.score;
      outcome = result.outcome;
      reasons = result.reasons;
      if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
        extractedData.security_flags = securityFlags;
      }
    } else {
      // PATH C: No data
      score = 0;
      outcome = 'incomplete';
      reasons = ['No answers captured'];
    }

    // === Extract completed_at from ElevenLabs metadata (always overwrite) ===
    let callEndTime: string;
    if (metadata.end_time_unix_secs) {
      callEndTime = new Date(metadata.end_time_unix_secs * 1000).toISOString();
    } else if (metadata.start_time_unix_secs && metadata.call_duration_secs) {
      callEndTime = new Date((metadata.start_time_unix_secs + metadata.call_duration_secs) * 1000).toISOString();
    } else if (metadata.start_time_unix_secs && metadata.duration_seconds) {
      callEndTime = new Date((metadata.start_time_unix_secs + metadata.duration_seconds) * 1000).toISOString();
    } else {
      callEndTime = screen.completed_at || new Date().toISOString();
    }

    // === Determine total questions ===
    let totalQuestionsForUpdate: number | undefined;
    {
      const { data: roleDataForCount } = await supabase
        .from('roles').select('questions').eq('id', screen.role_id).single();
      if (roleDataForCount?.questions && Array.isArray(roleDataForCount.questions)) {
        totalQuestionsForUpdate = roleDataForCount.questions.length;
      }
    }

    // === Build update ===
    const updateData: any = {
      status: outcome === 'incomplete' ? 'incomplete' : 'completed',
      completed_at: callEndTime,
      updated_at: new Date().toISOString(),
      score,
      outcome,
      reasons: reasons.length > 0 ? reasons : null,
      conversation_turns: conversationTurns,
      candidate_responded: candidateResponded,
      call_connected: callConnected,
      first_response_time_seconds: firstResponseTime,
      total_questions: totalQuestionsForUpdate || null,
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

    // Set extracted_data (security flags, eval results)
    if (Object.keys(extractedData).length > 0) {
      updateData.extracted_data = extractedData;
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
