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

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Extract screen_id from custom_data
    const customData = webhookData.conversation_initiation_metadata?.custom_data;
    const screenId = customData?.screen_id;

    if (!screenId) {
      console.warn('No screen_id in webhook data, attempting to find by conversation_id');
      
      // Try to find screen by conversation_id
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
    }

    // Handle conversation completion
    if (webhookData.type === 'conversation_end' || webhookData.type === 'call_ended') {
      console.log('Processing conversation end for screen:', screenId);

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
      if (webhookData.transcript) {
        updateData.transcript = webhookData.transcript;
      }

      // Extract AI analysis and summary
      if (webhookData.analysis) {
        const analysis = webhookData.analysis;
        
        // Store transcript summary as AI summary
        if (analysis.transcript_summary) {
          updateData.ai_summary = analysis.transcript_summary;
        }

        // Extract evaluation criteria results (normalize array/object)
        if (analysis.evaluation_criteria_results !== undefined) {
          const evalRaw = analysis.evaluation_criteria_results as any;
          let evalArray: any[] = [];
          if (Array.isArray(evalRaw)) {
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
          console.log('[WEBHOOK] evaluation_criteria_results shape:', Array.isArray(evalRaw) ? 'array' : typeof evalRaw, 'items:', evalArray.length);

          // Store structured answers
          if (evalArray.length > 0) {
            updateData.answers = evalArray;
          }

          // Calculate score (0-100 based on criteria pass rate)
          const passedCount = evalArray.filter(r => r.passed === true || r.result === 'pass').length;
          const total = evalArray.length;
          if (total > 0) {
            updateData.score = (passedCount / total) * 100;
          }

          // Determine outcome
          if (typeof analysis.call_successful === 'boolean') {
            updateData.outcome = analysis.call_successful ? 'pass' : 'fail';
          } else if (updateData.score !== undefined) {
            updateData.outcome = (updateData.score as number) >= 60 ? 'pass' : 'fail';
          }

          // Extract failure reasons if any
          const reasons = evalArray
            .filter(r => r.passed === false || r.result === 'fail')
            .map(r => r.reason || r.criteria || 'Unknown criteria failed');
          if (reasons.length > 0) {
            updateData.reasons = reasons;
          }
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

      // Update bulk operation completed count if part of bulk operation
      const { data: screen } = await supabase
        .from('screens')
        .select('bulk_operation_id')
        .eq('id', screenId)
        .single();

      if (screen?.bulk_operation_id) {
        const count_type = updateData.outcome === 'pass' ? 'completed_count' : 'failed_count';
        const { error: bulkError } = await supabase.rpc('increment_bulk_operation_count', {
          operation_id: screen.bulk_operation_id,
          count_type
        });
        if (bulkError) {
          console.warn('Could not increment bulk operation count:', bulkError);
        }
      }

      console.log('Screen updated successfully with analysis data');
    } 
    // Handle call failure
    else if (webhookData.type === 'call_failed' || webhookData.type === 'conversation_error') {
      console.log('Processing call failure for screen:', screenId);

      const { error: updateError } = await supabase
        .from('screens')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', screenId);

      if (updateError) {
        console.error('Error updating screen on failure:', updateError);
      }

      // Increment failed count for bulk operation
      const { data: screen } = await supabase
        .from('screens')
        .select('bulk_operation_id')
        .eq('id', screenId)
        .single();

      if (screen?.bulk_operation_id) {
        const { error: bulkError } = await supabase.rpc('increment_bulk_operation_count', {
          operation_id: screen.bulk_operation_id,
          count_type: 'failed_count'
        });
        if (bulkError) {
          console.warn('Could not increment failed count:', bulkError);
        }
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
