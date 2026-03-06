import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ElevenLabsWebhookPayload {
  type: string;
  conversation_id: string;
  agent_id?: string;
  call_id?: string;
  conversation_initiation_metadata?: {
    custom_data?: {
      screen_id?: string;
      candidate_id?: string;
      role_id?: string;
      organization_id?: string;
    };
  };
  transcript?: any;
  analysis?: {
    evaluation_criteria_results?: Record<string, any>;
    transcript_summary?: string;
    call_successful?: boolean;
  };
  metadata?: {
    duration_seconds?: number;
    recording_url?: string;
    end_reason?: string;
  };
}

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
 * Returns { score, outcome, reasons }
 */
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

  // Completeness check: if not all questions answered → incomplete
  if (totalQuestions && entries.length < totalQuestions) {
    reasons.push(`Only ${entries.length} of ${totalQuestions} questions answered`);
    return { score, outcome: 'incomplete', reasons };
  }

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData: ElevenLabsWebhookPayload = await req.json();
    
    console.log('ElevenLabs Webhook received:', {
      type: webhookData.type,
      conversation_id: webhookData.conversation_id,
      call_id: webhookData.call_id
    });

    const customData = webhookData.conversation_initiation_metadata?.custom_data;
    let screenId = customData?.screen_id;

    if (!screenId) {
      console.warn('No screen_id in webhook data, attempting to find by conversation_id');
      const { data: screen } = await supabase
        .from('screens')
        .select('id')
        .eq('session_id', webhookData.conversation_id)
        .single();
      
      if (!screen) {
        console.error('Could not find screen for conversation_id:', webhookData.conversation_id);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      screenId = screen.id;
    }

    // Handle conversation completion
    if (webhookData.type === 'conversation_end' || webhookData.type === 'call_ended') {
      console.log('Processing conversation end for screen:', screenId);

      // Fetch existing screen to preserve save-answer data
      const { data: existingScreen } = await supabase
        .from('screens')
        .select('answers, questions_answered, bulk_operation_id')
        .eq('id', screenId)
        .single();

      const existingAnswers = (existingScreen?.answers as Record<string, any>) || {};
      console.log('[WEBHOOK] Existing answers from save-answer tool:', Object.keys(existingAnswers).length);

      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Extract duration
      if (webhookData.metadata?.duration_seconds) {
        updateData.duration_seconds = webhookData.metadata.duration_seconds;
      }

      // Extract recording URL
      if (webhookData.metadata?.recording_url) {
        updateData.recording_url = webhookData.metadata.recording_url;
      }

      // Extract transcript
      const transcript = webhookData.transcript || [];
      if (Array.isArray(transcript) && transcript.length > 0) {
        updateData.transcript = transcript;
      }

      // Extract AI summary
      if (webhookData.analysis?.transcript_summary) {
        updateData.ai_summary = webhookData.analysis.transcript_summary;
      }

      // === ALWAYS compute call quality metrics (moved outside eval criteria block) ===
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

      updateData.conversation_turns = conversationTurns;
      updateData.candidate_responded = candidateResponded;
      updateData.call_connected = callConnected;
      updateData.first_response_time_seconds = firstResponseTime;

      console.log('[WEBHOOK] Call quality metrics:', { conversationTurns, candidateResponded, callConnected, firstResponseTime });

      // === Run security detection on transcript ===
      const securityFlags = detectSecurityIssues(Array.isArray(transcript) ? transcript : []);

      // === Scoring: try eval criteria first, then fallback to answer_quality ===
      const evalRaw = webhookData.analysis?.evaluation_criteria_results;
      const evalListRaw = (webhookData.analysis as any)?.evaluation_criteria_results_list;
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
      console.log('[WEBHOOK] evaluation_criteria_results items:', evalArray.length);

      if (evalArray.length > 0) {
        // === PATH A: Score from ElevenLabs evaluation criteria (existing logic) ===
        const evaluationResults = evalArray;
        const extractedData: any = { evaluation_results: evaluationResults };

        if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
          extractedData.security_flags = securityFlags;
          console.log('[WEBHOOK] Security flags detected:', securityFlags);
        }
        updateData.extracted_data = extractedData;

        // Map eval criteria to question IDs for display
        const roleId = customData?.role_id;
        if (roleId) {
          const { data: roleData } = await supabase
            .from('roles').select('questions').eq('id', roleId).single();
          if (roleData?.questions) {
            const questions = Array.isArray(roleData.questions) ? roleData.questions : [];
            const answersMap: Record<string, any> = {};
            questions.forEach((q: any) => {
              const matchingEval = evalArray.find(e =>
                e.criteria?.toLowerCase().includes(q.text?.toLowerCase().substring(0, 20)) ||
                q.text?.toLowerCase().includes(e.criteria?.toLowerCase().substring(0, 20))
              );
              if (matchingEval) {
                answersMap[q.id] = {
                  answer: matchingEval.reason || matchingEval.result,
                  passed: matchingEval.passed,
                  reason: matchingEval.reason
                };
              }
            });
            updateData.answers = answersMap;
          }
        }

        // Score from pass/fail
        const passedCount = evalArray.filter(r => r.passed === true || r.result === 'pass').length;
        const total = evalArray.length;
        updateData.score = total > 0 ? (passedCount / total) * 100 : 0;

        // Determine outcome
        const score = updateData.score as number;
        const hasSecurityFlags = securityFlags.risk_level === 'high' || securityFlags.risk_level === 'medium';
        const lowConfidenceItems = evalArray.filter(r => r.confidence !== undefined && r.confidence < 0.7);
        const hasLowConfidence = lowConfidenceItems.length > evalArray.length * 0.3;

        if (hasSecurityFlags) {
          updateData.outcome = 'needs_review';
          updateData.reasons = ['Security flags detected - potential prompt manipulation, requires human review'];
        } else if (hasLowConfidence) {
          updateData.outcome = 'needs_review';
          updateData.reasons = ['Low confidence on multiple evaluation criteria - requires human review'];
        } else if (score >= 80) {
          updateData.outcome = 'pass';
        } else if (score >= 60) {
          updateData.outcome = 'needs_review';
          updateData.reasons = ['Score in ambiguous range (60-79) - requires human review'];
        } else {
          updateData.outcome = 'fail';
          const reasons = evalArray
            .filter(r => r.passed === false || r.result === 'fail')
            .map(r => r.reason || r.criteria || 'Unknown criteria failed');
          if (reasons.length > 0) updateData.reasons = reasons;
        }
      } else if (Object.keys(existingAnswers).length > 0) {
        // === PATH B: Fallback — score from save-answer tool's answer_quality ===
        console.log('[WEBHOOK] No eval criteria, falling back to answer_quality scoring');
        
        // Fetch totalQuestions from the role
        let totalQuestions: number | undefined;
        const roleId = customData?.role_id;
        if (roleId) {
          const { data: roleData } = await supabase
            .from('roles').select('questions').eq('id', roleId).single();
          if (roleData?.questions && Array.isArray(roleData.questions)) {
            totalQuestions = roleData.questions.length;
          }
        }
        
        const { score, outcome, reasons } = scoreFromAnswerQuality(existingAnswers, securityFlags, totalQuestions);
        updateData.score = score;
        updateData.outcome = outcome;
        updateData.questions_answered = Object.keys(existingAnswers).length;
        updateData.total_questions = totalQuestions || 0;
        if (reasons.length > 0) updateData.reasons = reasons;
        
        const extractedData: any = {};
        if (securityFlags.injection_detected || securityFlags.manipulation_detected) {
          extractedData.security_flags = securityFlags;
        }
        if (Object.keys(extractedData).length > 0) {
          updateData.extracted_data = extractedData;
        }

        console.log(`[WEBHOOK] answer_quality score: ${score}, outcome: ${outcome}`);
      } else {
        // === PATH B.5: Try extracting from transcript tool_calls ===
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
                      source: 'webhook_transcript_tool_calls',
                    };
                  }
                } catch (e) { /* skip unparseable */ }
              }
            }
          }
        }

        if (Object.keys(toolAnswers).length > 0) {
          // Fetch totalQuestions from the role
          let totalQuestions: number | undefined;
          const roleId = customData?.role_id;
          if (roleId) {
            const { data: roleData } = await supabase
              .from('roles').select('questions').eq('id', roleId).single();
            if (roleData?.questions && Array.isArray(roleData.questions)) {
              totalQuestions = roleData.questions.length;
            }
          }
          updateData.answers = toolAnswers;
          updateData.questions_answered = Object.keys(toolAnswers).length;
          updateData.total_questions = totalQuestions || 0;
          updateData.candidate_responded = true;
          const { score, outcome, reasons } = scoreFromAnswerQuality(toolAnswers, securityFlags, totalQuestions);
          updateData.score = score;
          updateData.outcome = outcome;
          if (reasons.length > 0) updateData.reasons = reasons;
          console.log(`[WEBHOOK] Recovered ${Object.keys(toolAnswers).length} answers from transcript tool_calls`);
        } else {
          // === PATH C: Truly no data ===
          updateData.outcome = 'incomplete';
          updateData.score = 0;
          updateData.reasons = ['Screening incomplete - no answers captured'];
          console.log('[WEBHOOK] No evaluation data and no saved answers - screening incomplete');
        }
      }

      // Update screen record
      const { error: updateError } = await supabase
        .from('screens')
        .update(updateData)
        .eq('id', screenId);

      if (updateError) {
        console.error('Error updating screen:', updateError);
        throw updateError;
      }

      // Update bulk operation count
      const bulkOpId = existingScreen?.bulk_operation_id;
      if (bulkOpId) {
        const count_type = updateData.outcome === 'pass' ? 'completed_count' : 'failed_count';
        await supabase.rpc('increment_bulk_operation_count', {
          operation_id: bulkOpId,
          count_type
        });
      }

      console.log('Screen updated successfully with analysis data');
    }
    // Handle call failure
    else if (webhookData.type === 'call_failed' || webhookData.type === 'conversation_error') {
      console.log('Processing call failure for screen:', screenId);

      await supabase
        .from('screens')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', screenId);

      const { data: screen } = await supabase
        .from('screens')
        .select('bulk_operation_id')
        .eq('id', screenId)
        .single();

      if (screen?.bulk_operation_id) {
        await supabase.rpc('increment_bulk_operation_count', {
          operation_id: screen.bulk_operation_id,
          count_type: 'failed_count'
        });
      }

      console.log('Screen marked as failed');
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
