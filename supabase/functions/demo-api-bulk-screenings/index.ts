import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
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
      const now = new Date().toISOString();
      
      switch (action) {
        case 'pause':
          updateData = { status: 'paused', updated_at: now };
          break;
        case 'resume':
          updateData = { status: 'in_progress', updated_at: now };
          break;
        case 'cancel':
          updateData = { status: 'cancelled', updated_at: now, completed_at: now };
          break;
        case 'retry_failed':
          // Reset failed screens to pending
          const { data: failedScreens } = await supabase
            .from('screens')
            .select('id')
            .eq('bulk_operation_id', operationId)
            .eq('status', 'failed');
          
          if (failedScreens && failedScreens.length > 0) {
            await supabase
              .from('screens')
              .update({ status: 'pending', attempts: 0 })
              .in('id', failedScreens.map(s => s.id));
          }
          
          updateData = { status: 'in_progress', updated_at: now };
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }

      const { data, error } = await supabase
        .from('bulk_operations')
        .update(updateData)
        .eq('id', operationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating bulk operation:', error);
        throw error;
      }

      // If resuming or retrying, trigger the processing function
      if (action === 'resume' || action === 'retry_failed') {
        // Invoke the process-bulk-screenings function
        const { error: invokeError } = await supabase.functions.invoke('process-bulk-screenings', {
          body: { action, bulkOperationId: operationId }
        });
        
        if (invokeError) {
          console.error('Error invoking process-bulk-screenings:', invokeError);
        }
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /bulk-operations - Create new bulk operation
    if (req.method === 'POST') {
      console.log('Creating new bulk operation');
      
      const body = await req.json();
      const { roleId, candidateIds, schedulingType, scheduledTime, batchSize = 5 } = body;

      // Create bulk operation
      const { data: bulkOp, error: bulkOpError } = await supabase
        .from('bulk_operations')
        .insert({
          role_id: roleId,
          user_id: body.userId || 'demo-user-001',
          organization_id: body.organizationId || 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          status: 'pending',
          total_count: candidateIds.length,
          settings: {
            scheduling_type: schedulingType,
            scheduled_time: scheduledTime,
            batch_size: batchSize
          }
        })
        .select()
        .single();

      if (bulkOpError) {
        console.error('Error creating bulk operation:', bulkOpError);
        throw bulkOpError;
      }

      // Create screens for each candidate
      const screens = candidateIds.map((candidateId: string) => ({
        candidate_id: candidateId,
        role_id: roleId,
        user_id: body.userId || 'demo-user-001',
        organization_id: body.organizationId || 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        bulk_operation_id: bulkOp.id,
        status: 'pending',
        screening_type: 'voice',
        scheduled_at: schedulingType === 'scheduled' ? scheduledTime : null
      }));

      const { error: screensError } = await supabase
        .from('screens')
        .insert(screens);

      if (screensError) {
        console.error('Error creating screens:', screensError);
        throw screensError;
      }

      // If immediate, trigger processing
      if (schedulingType === 'immediate') {
        const { error: invokeError } = await supabase.functions.invoke('process-bulk-screenings', {
          body: { 
            bulkOperationId: bulkOp.id,
            roleId,
            candidateIds,
            batchSize
          }
        });
        
        if (invokeError) {
          console.error('Error invoking process-bulk-screenings:', invokeError);
        }

        // Update status to in_progress
        await supabase
          .from('bulk_operations')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', bulkOp.id);
      }

      return new Response(
        JSON.stringify({ ...bulkOp, message: 'Bulk screening initiated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in demo-api-bulk-screenings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});