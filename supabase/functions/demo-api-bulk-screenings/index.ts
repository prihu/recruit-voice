import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DEMO_USER_ID = '59dc7810-80b7-4a31-806a-bb0533526fab';

// Helper to ensure demo setup is complete
async function ensureDemoSetup(supabase: any) {
  // Check if user is already a member of the organization
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('organization_id', DEMO_ORG_ID)
    .single();
  
  if (!existingMember) {
    // Add user to organization as admin
    await supabase
      .from('organization_members')
      .insert({
        user_id: DEMO_USER_ID,
        organization_id: DEMO_ORG_ID,
        role: 'admin'
      });
  }
  
  // Ensure profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .single();
  
  if (!existingProfile) {
    await supabase
      .from('profiles')
      .insert({
        user_id: DEMO_USER_ID,
        full_name: 'Demo User',
        role: 'recruiter'
      });
  }
  
  return DEMO_USER_ID;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Ensure demo setup on every request
    const demoUserId = await ensureDemoSetup(supabase);
    
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const operationId = pathParts[pathParts.length - 1];
    
    // GET /bulk-operations - List all bulk operations
    if (req.method === 'GET' && !operationId) {
      console.log('Fetching all bulk operations');
      
      const { data: operations, error } = await supabase
        .from('bulk_operations')
        .select(`
          *,
          role:roles(id, title, location),
          screens(id, status)
        `)
        .eq('organization_id', DEMO_ORG_ID)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bulk operations:', error);
        throw error;
      }

      // Calculate counts for each operation
      const operationsWithCounts = operations?.map(op => {
        const screens = op.screens || [];
        return {
          ...op,
          total_count: screens.length,
          completed_count: screens.filter((s: any) => s.status === 'completed').length,
          in_progress_count: screens.filter((s: any) => s.status === 'in_progress').length,
          failed_count: screens.filter((s: any) => s.status === 'failed').length,
          screens: undefined // Remove screens array from response
        };
      }) || [];

      return new Response(
        JSON.stringify(operationsWithCounts),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /bulk-operations/:id - Get specific bulk operation
    if (req.method === 'GET' && operationId && operationId !== 'bulk-operations') {
      console.log('Fetching bulk operation:', operationId);
      
      const { data: operation, error } = await supabase
        .from('bulk_operations')
        .select(`
          *,
          role:roles(id, title, location),
          screens(id, status, candidate_id, candidates(name, phone))
        `)
        .eq('id', operationId)
        .eq('organization_id', DEMO_ORG_ID)
        .single();

      if (error) {
        console.error('Error fetching bulk operation:', error);
        throw error;
      }

      // Calculate counts
      const screens = operation?.screens || [];
      const result = {
        ...operation,
        total_count: screens.length,
        completed_count: screens.filter((s: any) => s.status === 'completed').length,
        in_progress_count: screens.filter((s: any) => s.status === 'in_progress').length,
        failed_count: screens.filter((s: any) => s.status === 'failed').length
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /bulk-operations/:id - Update bulk operation status
    if (req.method === 'PUT' && operationId) {
      console.log('Updating bulk operation:', operationId);
      
      const { action } = await req.json();
      
      let updateData: any = {};
      
      switch (action) {
        case 'pause':
          updateData.status = 'paused';
          break;
        case 'resume':
          updateData.status = 'in_progress';
          updateData.started_at = new Date().toISOString();
          break;
        case 'cancel':
          updateData.status = 'cancelled';
          updateData.completed_at = new Date().toISOString();
          break;
        case 'retry_failed':
          // Reset failed screens to pending
          const { error: resetError } = await supabase
            .from('screens')
            .update({ status: 'pending', attempts: 0 })
            .eq('bulk_operation_id', operationId)
            .eq('status', 'failed');
          
          if (resetError) {
            console.error('Error resetting failed screens:', resetError);
            throw resetError;
          }
          
          updateData.status = 'in_progress';
          updateData.failed_count = 0;
          break;
        default:
          throw new Error('Invalid action');
      }
      
      const { data: updatedOp, error: updateError } = await supabase
        .from('bulk_operations')
        .update(updateData)
        .eq('id', operationId)
        .eq('organization_id', DEMO_ORG_ID)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating bulk operation:', updateError);
        throw updateError;
      }
      
      // If resuming or retrying, trigger processing
      if (action === 'resume' || action === 'retry_failed') {
        console.log('Triggering bulk processing for operation:', operationId);
        
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-bulk-screenings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bulkOperationId: operationId
            })
          }
        );
        
        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          console.error('Failed to trigger bulk processing:', {
            status: processResponse.status,
            body: errorText
          });
        } else {
          console.log('Successfully triggered bulk processing for operation:', operationId);
        }
      }
      
      return new Response(
        JSON.stringify(updatedOp),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /bulk-operations - Create new bulk operation
    if (req.method === 'POST') {
      console.log('Creating new bulk operation');
      
      const { roleId, candidateIds, schedulingType, scheduledTime, priority, retryFailedCalls } = await req.json();
      
      if (!roleId || !candidateIds || !Array.isArray(candidateIds)) {
        throw new Error('roleId and candidateIds array are required');
      }

      // Validate Twilio configuration exists
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('twilio_config')
        .eq('id', DEMO_ORG_ID)
        .single();

      if (orgError || !org) {
        console.error('Organization fetch error:', orgError);
        return new Response(
          JSON.stringify({ 
            error: 'Organization not found' 
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const twilioConfig = org.twilio_config as { agent_phone_number_id?: string } | null;

      if (!twilioConfig?.agent_phone_number_id) {
        return new Response(
          JSON.stringify({ 
            error: 'Phone number not configured. Please go to Settings and add your ElevenLabs phone number ID before starting bulk screening.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Validate role has voice agent configured
      const { data: role } = await supabase
        .from('roles')
        .select('voice_agent_id')
        .eq('id', roleId)
        .single();

      if (!role?.voice_agent_id) {
        return new Response(
          JSON.stringify({ 
            error: 'Voice agent not configured for this role. Please configure the voice agent in the role settings before starting bulk screening.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Validate all candidates have phone numbers
      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('id, name, phone')
        .in('id', candidateIds);

      const candidatesWithoutPhone = candidatesData?.filter(c => !c.phone || c.phone.trim() === '') || [];
      if (candidatesWithoutPhone.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: `${candidatesWithoutPhone.length} candidate(s) missing phone numbers. Please add phone numbers before screening.`,
            candidates: candidatesWithoutPhone.map(c => ({ id: c.id, name: c.name }))
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Create new bulk operation
      const { data: bulkOp, error: bulkOpError } = await supabase
        .from('bulk_operations')
        .insert({
          organization_id: DEMO_ORG_ID,
          user_id: demoUserId,
          role_id: roleId,
          operation_type: 'bulk_screening',
          status: 'pending',
          total_count: candidateIds.length,
          completed_count: 0,
          failed_count: 0,
          settings: {
            schedulingType,
            scheduledTime,
            priority,
            retryFailedCalls
          }
        })
        .select()
        .single();
      
      if (bulkOpError) {
        console.error('Error creating bulk operation:', bulkOpError);
        throw bulkOpError;
      }
      
      // Create screening records for each candidate
      const screeningData = candidateIds.map((candidateId: string) => ({
        role_id: roleId,
        candidate_id: candidateId,
        user_id: demoUserId,
        organization_id: DEMO_ORG_ID,
        bulk_operation_id: bulkOp.id,
        status: 'pending',
        scheduled_at: scheduledTime || new Date().toISOString(),
        screening_type: 'voice',
        attempts: 0,
        total_questions: 0,
        questions_answered: 0,
        response_completeness: 0
      }));
      
      const { data: screens, error: screensError } = await supabase
        .from('screens')
        .insert(screeningData)
        .select();
      
      if (screensError) {
        console.error('Error creating screens:', screensError);
        throw screensError;
      }
      
      // If immediate scheduling, trigger processing
      if (schedulingType === 'immediate') {
        console.log('Triggering immediate bulk processing');
        
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-bulk-screenings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bulkOperationId: bulkOp.id
            })
          }
        );
        
        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          console.error('Failed to trigger bulk processing:', {
            status: processResponse.status,
            statusText: processResponse.statusText,
            body: errorText
          });
          
          return new Response(
            JSON.stringify({ 
              error: `Failed to start bulk processing: ${errorText}`,
              details: 'Check function logs for more information'
            }),
            { 
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        console.log('Successfully triggered bulk processing for operation:', bulkOp.id);
      }
      
      return new Response(
        JSON.stringify({
          ...bulkOp,
          screens
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      );
    }

    throw new Error('Method not allowed');
  } catch (error: any) {
    console.error('Error in demo-api-bulk-screenings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});