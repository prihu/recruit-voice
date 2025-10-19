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

        // Extract evaluation criteria results
        if (analysis.evaluation_criteria_results) {
          const criteria = analysis.evaluation_criteria_results;
          
          // Store structured answers
          updateData.answers = criteria;

          // Calculate score (0-100 based on criteria pass rate)
          const criteriaKeys = Object.keys(criteria);
          if (criteriaKeys.length > 0) {
            const passedCriteria = criteriaKeys.filter(key => criteria[key]?.passed === true).length;
            updateData.score = (passedCriteria / criteriaKeys.length) * 100;
          }

          // Determine outcome
          if (analysis.call_successful !== undefined) {
            updateData.outcome = analysis.call_successful ? 'pass' : 'fail';
          } else if (updateData.score !== undefined) {
            updateData.outcome = updateData.score >= 60 ? 'pass' : 'fail';
          }

          // Extract failure reasons if any
          const reasons = criteriaKeys
            .filter(key => criteria[key]?.passed === false)
            .map(key => criteria[key]?.reason || key);
          
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
        const { error: bulkError } = await supabase.rpc('increment', {
          table_name: 'bulk_operations',
          row_id: screen.bulk_operation_id,
          field_name: 'completed_count'
        }).single();

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
        const { error: bulkError } = await supabase
          .from('bulk_operations')
          .update({
            failed_count: supabase.sql`failed_count + 1`
          })
          .eq('id', screen.bulk_operation_id);

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
