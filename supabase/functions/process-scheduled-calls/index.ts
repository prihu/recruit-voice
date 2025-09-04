import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get current time
    const now = new Date();

    // Find scheduled calls that are due
    const { data: scheduledCalls, error: fetchError } = await supabase
      .from('scheduled_calls')
      .select(`
        *,
        screen:screens(
          id,
          role_id,
          candidate_id,
          candidate:candidates(name, phone, email),
          role:roles(voice_agent_id)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_time', now.toISOString())
      .limit(10); // Process up to 10 calls at once

    if (fetchError) {
      console.error('Error fetching scheduled calls:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scheduled calls' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!scheduledCalls || scheduledCalls.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scheduled calls to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${scheduledCalls.length} scheduled calls...`);

    const results = [];

    for (const call of scheduledCalls) {
      const { screen } = call;
      
      if (!screen || !screen.candidate || !screen.role) {
        console.error(`Missing data for scheduled call ${call.id}`);
        continue;
      }

      const agentId = screen.role.voice_agent_id;
      const phoneNumber = screen.candidate.phone;

      if (!agentId || !phoneNumber) {
        console.error(`Missing agent ID or phone number for call ${call.id}`);
        
        // Update scheduled call status to failed
        await supabase
          .from('scheduled_calls')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', call.id);
        
        continue;
      }

      try {
        // Initiate the phone call via ElevenLabs
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/initiate_phone_call`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agentId,
              phone_number: phoneNumber,
              metadata: {
                screen_id: screen.id,
                candidate_name: screen.candidate.name,
                candidate_email: screen.candidate.email
              }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to initiate call for ${call.id}:`, errorText);
          
          // Check if we should retry
          const shouldRetry = call.retry_count < 3;
          
          if (shouldRetry) {
            // Calculate next retry time (exponential backoff)
            const nextRetryMinutes = Math.pow(2, call.retry_count + 1) * 15; // 30, 60, 120 minutes
            const nextRetryTime = new Date(now.getTime() + nextRetryMinutes * 60 * 1000);
            
            await supabase
              .from('scheduled_calls')
              .update({
                retry_count: call.retry_count + 1,
                next_retry_at: nextRetryTime.toISOString(),
                last_attempt_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', call.id);
          } else {
            // Mark as failed after max retries
            await supabase
              .from('scheduled_calls')
              .update({
                status: 'failed',
                last_attempt_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', call.id);
          }
          
          continue;
        }

        const result = await response.json();
        console.log(`Call initiated for ${call.id}:`, result);

        // Update scheduled call status to completed
        await supabase
          .from('scheduled_calls')
          .update({
            status: 'completed',
            last_attempt_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', call.id);

        // Update screen status
        await supabase
          .from('screens')
          .update({
            status: 'in_progress',
            started_at: now.toISOString(),
            session_id: result.conversation_id || result.id,
            updated_at: now.toISOString()
          })
          .eq('id', screen.id);

        results.push({
          call_id: call.id,
          screen_id: screen.id,
          status: 'initiated',
          conversation_id: result.conversation_id || result.id
        });

      } catch (error) {
        console.error(`Error processing call ${call.id}:`, error);
        
        // Update retry count
        await supabase
          .from('scheduled_calls')
          .update({
            retry_count: call.retry_count + 1,
            last_attempt_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', call.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} calls`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-scheduled-calls:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});