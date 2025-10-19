import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      bulkOperationId,
      action = 'start',
      batch_size = 10
    } = await req.json();

    console.log('Processing bulk screening:', { 
      bulkOperationId, 
      action
    });

    if (!bulkOperationId) {
      throw new Error('bulkOperationId is required');
    }

    // Fetch existing pending screens for this bulk operation
    const { data: pendingScreens, error: fetchError } = await supabase
      .from('screens')
      .select('*')
      .eq('bulk_operation_id', bulkOperationId)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching pending screens:', fetchError);
      throw fetchError;
    }

    if (!pendingScreens || pendingScreens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending screens to process'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update bulk operation to in_progress
    const { error: updateError } = await supabase
      .from('bulk_operations')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bulkOperationId);

    if (updateError) {
      console.error('Error updating bulk operation:', updateError);
      throw updateError;
    }

    console.log(`Starting to process ${pendingScreens.length} pending screens for bulk operation ${bulkOperationId}`);

    // Process first batch in background
    const firstBatch = pendingScreens.slice(0, batch_size);
    EdgeRuntime.waitUntil(
      processBatch(supabase, firstBatch, bulkOperationId)
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Started processing ${pendingScreens.length} screens`,
        bulk_operation_id: bulkOperationId,
        pending_count: pendingScreens.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-bulk-screenings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Process a batch of screens in the background
async function processBatch(supabase: any, screens: any[], bulkOperationId: string) {
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  
  if (!elevenLabsApiKey) {
    console.error('ElevenLabs API key not configured');
    return;
  }

  for (const screen of screens) {
    try {
      // Check if operation is still active (not paused/cancelled)
      const { data: bulkOp } = await supabase
        .from('bulk_operations')
        .select('status')
        .eq('id', bulkOperationId)
        .single();

      if (!bulkOp || ['paused', 'cancelled'].includes(bulkOp.status)) {
        console.log('Bulk operation paused or cancelled, stopping batch processing');
        break;
      }

      // Get candidate and role details
      const { data: candidate } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', screen.candidate_id)
        .single();

      const { data: role } = await supabase
        .from('roles')
        .select('*')
        .eq('id', screen.role_id)
        .single();

      if (!candidate || !role || !role.voice_agent_id) {
        console.error('Missing candidate or role data for screen:', screen.id);
        await supabase
          .from('screens')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', screen.id);
        continue;
      }

      // Initiate call via ElevenLabs
      console.log(`Initiating call for candidate ${candidate.name} with agent ${role.voice_agent_id}`);
      
      const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation/initiate_call', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: role.voice_agent_id,
          customer: {
            number: candidate.phone,
            name: candidate.name,
          },
          first_message: `Hello ${candidate.name}, this is an automated screening call for the ${role.title} position at ${role.location}. Are you available to answer a few questions?`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('ElevenLabs API error:', errorData);
        throw new Error(`Failed to initiate call: ${response.status}`);
      }

      const callData = await response.json();
      console.log('Call initiated successfully:', callData);

      // Update screen status
      await supabase
        .from('screens')
        .update({ 
          status: 'in_progress',
          conversation_id: callData.conversation_id || callData.session_id,
          started_at: new Date().toISOString(),
          attempts: screen.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', screen.id);

      // Add a small delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`Error processing screen ${screen.id}:`, error);
      
      // Update screen as failed
      await supabase
        .from('screens')
        .update({ 
          status: 'failed',
          attempts: screen.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', screen.id);

      // Update bulk operation failed count
      const { data: bulkOp } = await supabase
        .from('bulk_operations')
        .select('failed_count')
        .eq('id', bulkOperationId)
        .single();
      
      if (bulkOp) {
        await supabase
          .from('bulk_operations')
          .update({ 
            failed_count: (bulkOp.failed_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', bulkOperationId);
      }
    }
  }

  // Check if there are more screens to process
  const { data: pendingScreens } = await supabase
    .from('screens')
    .select('id')
    .eq('bulk_operation_id', bulkOperationId)
    .eq('status', 'pending');

  if (!pendingScreens || pendingScreens.length === 0) {
    // All screens processed, update bulk operation status
    await supabase
      .from('bulk_operations')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', bulkOperationId);

    console.log('Bulk operation completed:', bulkOperationId);
  } else {
    // Process next batch
    const { data: nextBatch } = await supabase
      .from('screens')
      .select('*')
      .eq('bulk_operation_id', bulkOperationId)
      .eq('status', 'pending')
      .limit(10);

    if (nextBatch && nextBatch.length > 0) {
      // Continue processing in background
      setTimeout(() => processBatch(supabase, nextBatch, bulkOperationId), 5000);
    }
  }
}