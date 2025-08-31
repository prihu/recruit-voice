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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      bulk_operation_id,
      role_id,
      candidate_ids,
      scheduling_type,
      scheduled_time,
      batch_size = 10,
      action = 'start'
    } = await req.json();

    console.log('Processing bulk screening:', { 
      bulk_operation_id, 
      action, 
      candidate_count: candidate_ids?.length 
    });

    // Handle different actions
    if (action === 'resume') {
      // Resume a paused operation
      const { error } = await supabase
        .from('bulk_operations')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', bulk_operation_id);

      if (error) throw error;

      // Continue processing pending screens
      const { data: pendingScreens } = await supabase
        .from('screens')
        .select('*')
        .eq('bulk_operation_id', bulk_operation_id)
        .eq('status', 'pending');

      if (pendingScreens && pendingScreens.length > 0) {
        // Process in background
        processBatch(supabase, pendingScreens.slice(0, batch_size), bulk_operation_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Operation resumed',
          pending_count: pendingScreens?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'retry_failed') {
      // Retry failed screens
      const { data: failedScreens } = await supabase
        .from('screens')
        .select('*')
        .eq('bulk_operation_id', bulk_operation_id)
        .eq('status', 'failed')
        .in('candidate_id', candidate_ids);

      if (failedScreens && failedScreens.length > 0) {
        // Reset status to pending for retry
        await supabase
          .from('screens')
          .update({ 
            status: 'pending',
            attempts: 0,
            updated_at: new Date().toISOString()
          })
          .in('id', failedScreens.map(s => s.id));

        // Process in background
        processBatch(supabase, failedScreens.slice(0, batch_size), bulk_operation_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Retrying failed calls',
          retry_count: failedScreens?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start new bulk operation
    if (!bulk_operation_id || !role_id || !candidate_ids || candidate_ids.length === 0) {
      throw new Error('Missing required parameters');
    }

    // Update bulk operation status
    const { error: updateError } = await supabase
      .from('bulk_operations')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', bulk_operation_id);

    if (updateError) throw updateError;

    // Get organization ID from user
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) throw new Error('Organization not found');

    // Create screen records for each candidate
    const screens = candidate_ids.map((candidate_id: string) => ({
      candidate_id,
      role_id,
      user_id: user.id,
      organization_id: orgMember.organization_id,
      bulk_operation_id,
      status: 'pending',
      screening_type: 'voice',
      scheduled_at: scheduled_time || new Date().toISOString(),
      attempts: 0
    }));

    const { data: createdScreens, error: screenError } = await supabase
      .from('screens')
      .insert(screens)
      .select();

    if (screenError) throw screenError;

    // Process first batch immediately if immediate scheduling
    if (scheduling_type === 'immediate' && createdScreens) {
      const firstBatch = createdScreens.slice(0, batch_size);
      
      // Process in background
      processBatch(supabase, firstBatch, bulk_operation_id);
    } else if (scheduling_type === 'scheduled' && scheduled_time) {
      // Create scheduled call records
      const scheduledCalls = createdScreens?.map((screen: any) => ({
        screen_id: screen.id,
        organization_id: orgMember.organization_id,
        scheduled_time: scheduled_time,
        status: 'pending'
      })) || [];

      await supabase
        .from('scheduled_calls')
        .insert(scheduledCalls);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        bulk_operation_id,
        screens_created: createdScreens?.length || 0,
        message: `Started bulk screening for ${candidate_ids.length} candidates`
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
          session_id: callData.conversation_id || callData.session_id,
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
      await supabase.rpc('increment', {
        table_name: 'bulk_operations',
        column_name: 'failed_count',
        row_id: bulkOperationId
      });
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