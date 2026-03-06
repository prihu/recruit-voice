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

// Salary/role manipulation patterns
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

  if (!Array.isArray(transcript) || transcript.length === 0) {
    return flags;
  }

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

  if (flags.injection_detected && flags.manipulation_detected) {
    flags.risk_level = 'high';
  } else if (flags.injection_detected || flags.manipulation_detected) {
    flags.risk_level = 'medium';
  }

  return flags;
}

/**
 * Score answers using answer_quality from the save-answer tool.
 * good=1.0, partial=0.5, poor/skipped=0.0
 */
function scoreFromAnswerQuality(answers: Record<string, any>, securityFlags?: SecurityFlags): {
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
  const hasSecurityFlags = securityFlags && (securityFlags.risk_level === 'high' || securityFlags.risk_level === 'medium');

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting recovery of stuck screens...');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckScreens, error: fetchError } = await supabase
      .from('screens')
      .select('id, session_id, bulk_operation_id, organization_id, answers')
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

    for (const screen of stuckScreens) {
      try {
        console.log(`Fetching conversation data for session: ${screen.session_id}`);

        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${screen.session_id}`,
          { headers: { 'xi-api-key': elevenLabsApiKey } }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.error(`Conversation not found for session: ${screen.session_id}`);
            await supabase.from('screens').update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              ai_summary: 'Conversation data not found in ElevenLabs API',
            }).eq('id', screen.id);

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
        const transcript = conversationData.transcript || [];
        const analysis = conversationData.analysis || {};
        const metadata = conversationData.metadata || {};

        // === Call quality metrics (always set) ===
        const conversationTurns = Array.isArray(transcript) ? transcript.length : 0;
        const candidateMessages = Array.isArray(transcript)
          ? transcript.filter((msg: any) => msg.role === 'user' || msg.speaker === 'candidate').length
          : 0;
        const candidateResponded = candidateMessages > 0;
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
        const securityFlags = detectSecurityIssues(transcript);

        // === Normalize evaluation criteria ===
        const evalRaw = analysis.evaluation_criteria_results;
        const evalListRaw = analysis.evaluation_criteria_results_list;
        let evaluationResults: any[] = [];
        
        // Try the list format first (newer API)
        if (Array.isArray(evalListRaw) && evalListRaw.length > 0) {
          evaluationResults = evalListRaw.map((item: any) => ({
            criteria: item.criteria || item.name || item.evaluation_criteria_id || '',
            result: item.result || (item.passed ? 'pass' : 'fail'),
            passed: item.result === 'pass' || item.passed === true,
            reason: item.rationale || item.reason || item.details || null,
          }));
        } else if (Array.isArray(evalRaw)) {
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

        // === Scoring logic ===
        const existingAnswers = (screen.answers as Record<string, any>) || {};
        let score: number;
        let outcome: 'pass' | 'fail' | 'incomplete' | 'needs_review';
        let reasons: string[] = [];
        let extractedData: any = {};

        if (evaluationResults.length > 0) {
          // PATH A: Score from eval criteria
          extractedData.evaluation_results = evaluationResults;
          if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
            extractedData.security_flags = securityFlags;
          }

          const passedCriteria = evaluationResults.filter((r: any) => r.passed === true || r.result === 'pass').length;
          score = evaluationResults.length > 0 ? (passedCriteria / evaluationResults.length) * 100 : 0;

          const hasSecurityFlags = securityFlags.risk_level === 'high' || securityFlags.risk_level === 'medium';
          const lowConfidenceItems = evaluationResults.filter((r: any) => r.confidence !== undefined && r.confidence < 0.7);
          const hasLowConfidence = lowConfidenceItems.length > evaluationResults.length * 0.3;

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
            reasons.push(...evaluationResults
              .filter((r: any) => r.passed === false || r.result === 'fail')
              .map((r: any) => r.reason || r.criteria || 'Unknown criteria failed'));
          }
        } else if (Object.keys(existingAnswers).length > 0) {
          // PATH B: Fallback to answer_quality scoring
          console.log(`[RECOVER] No eval criteria, falling back to answer_quality for screen ${screen.id}`);
          const result = scoreFromAnswerQuality(existingAnswers, securityFlags);
          score = result.score;
          outcome = result.outcome;
          reasons = result.reasons;
          
          if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
            extractedData.security_flags = securityFlags;
          }
        } else {
          // PATH B.5: Try extracting from transcript tool_calls
          const toolAnswers: Record<string, any> = {};
          if (Array.isArray(transcript)) {
            for (const turn of transcript) {
              for (const call of (turn.tool_calls || [])) {
                const toolName = call.tool_name || '';
                if (toolName.includes('save') && toolName.includes('answer')) {
                  try {
                    const bodyStr = call.tool_details?.body || call.params_as_json || '';
                    const params = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
                    const questionText = params.question_text || '';
                    if (questionText) {
                      const key = `q_${questionText.toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_|_$/g, '')
                        .substring(0, 60)}`;
                      toolAnswers[key] = {
                        question_text: questionText,
                        candidate_answer: params.candidate_answer || '',
                        answer_quality: params.answer_quality || 'partial',
                        question_index: params.question_index,
                        source: 'recover_transcript_tool_calls',
                      };
                    }
                  } catch (e) { /* skip unparseable */ }
                }
              }
            }
          }

          if (Object.keys(toolAnswers).length > 0) {
            // Score from recovered tool call data
            console.log(`[RECOVER] Recovered ${Object.keys(toolAnswers).length} answers from transcript tool_calls for screen ${screen.id}`);
            const result = scoreFromAnswerQuality(toolAnswers, securityFlags);
            score = result.score;
            outcome = result.outcome;
            reasons = result.reasons;

            // Store recovered answers in updateData
            updateData.answers = toolAnswers;
            updateData.questions_answered = Object.keys(toolAnswers).length;
            updateData.candidate_responded = true;

            if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
              extractedData.security_flags = securityFlags;
            }
          } else {
            // PATH C: No data at all
            score = 0;
            outcome = 'incomplete';
            reasons = ['Screening incomplete - no answers captured'];
          }
        }

        // Prepare update - don't overwrite answers if using PATH B
        const updateData: any = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          transcript: transcript.length > 0 ? transcript : null,
          ai_summary: analysis.transcript_summary || 'No summary available',
          score,
          outcome,
          reasons: reasons.length > 0 ? reasons : null,
          duration_seconds: metadata.duration_seconds || null,
          recording_url: metadata.recording_url || null,
          conversation_turns: conversationTurns,
          candidate_responded: candidateResponded,
          call_connected: callConnected,
          first_response_time_seconds: firstResponseTime,
        };

        // Only set answers if we have eval criteria results (PATH A)
        if (evaluationResults.length > 0) {
          updateData.answers = evaluationResults;
        }
        
        if (Object.keys(extractedData).length > 0) {
          updateData.extracted_data = extractedData;
        }

        const { error: updateError } = await supabase
          .from('screens').update(updateData).eq('id', screen.id);

        if (updateError) {
          console.error(`Error updating screen ${screen.id}:`, updateError);
          failed++;
          continue;
        }

        if (screen.bulk_operation_id) {
          const count_type = outcome === 'pass' ? 'completed_count' : 'failed_count';
          await supabase.rpc('increment_bulk_operation_count', {
            operation_id: screen.bulk_operation_id,
            count_type,
          });
        }

        console.log(`Successfully recovered screen ${screen.id} - score: ${score}, outcome: ${outcome}`);
        recovered++;

      } catch (error) {
        console.error(`Error processing screen ${screen.id}:`, error);
        failed++;
      }
    }

    console.log(`Recovery complete: ${recovered} recovered, ${failed} failed`);

    return new Response(
      JSON.stringify({ message: 'Recovery complete', total: stuckScreens.length, recovered, failed }),
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
