import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const action = pathParts.includes('initiate') ? 'initiate' : 
                   pathParts.includes('transcript') ? 'transcript' : 
                   pathParts.includes('bulk') ? 'bulk' : null;
    const screeningId = !action && pathParts.length > 1 && lastPart !== 'demo-api-screenings' ? lastPart : 
                       pathParts[pathParts.length - 2] === 'transcript' ? pathParts[pathParts.length - 2] : null;

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (action === 'transcript' && screeningId) {
          // Get screening transcript
          const { data: screen, error } = await supabase
            .from('screens')
            .select('transcript, ai_summary, score, outcome, reasons')
            .eq('id', screeningId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(screen), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (screeningId) {
          // Get specific screening with details
          const { data: screen, error } = await supabase
            .from('screens')
            .select(`
              *,
              candidate:candidates(*),
              role:roles(*)
            `)
            .eq('id', screeningId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(screen), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // List all screenings with analytics
          const { data: screens, error } = await supabase
            .from('screens')
            .select(`
              *,
              candidate:candidates(name, email, phone),
              role:roles(title)
            `)
            .eq('organization_id', DEMO_ORG_ID)
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          // Calculate analytics
          const total = screens.length;
          const statusCounts = {
            pending: screens.filter(s => s.status === 'pending').length,
            in_progress: screens.filter(s => s.status === 'in_progress').length,
            completed: screens.filter(s => s.status === 'completed').length,
            failed: screens.filter(s => s.status === 'failed').length,
          };
          const outcomeCounts = {
            pass: screens.filter(s => s.outcome === 'pass').length,
            fail: screens.filter(s => s.outcome === 'fail').length,
            pending: screens.filter(s => !s.outcome).length,
          };
          const responseCompleteness = {
            full: screens.filter(s => s.response_completeness === 100).length,
            partial: screens.filter(s => s.response_completeness > 0 && s.response_completeness < 100).length,
            none: screens.filter(s => s.response_completeness === 0 || s.response_completeness === null).length,
          };

          return new Response(JSON.stringify({
            screens,
            analytics: {
              total,
              statusCounts,
              outcomeCounts,
              responseCompleteness,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'POST': {
        if (action === 'initiate') {
          const { roleId, candidateIds, scheduledTime } = await req.json();

          if (!roleId || !candidateIds || !Array.isArray(candidateIds)) {
            return new Response(JSON.stringify({ 
              error: 'roleId and candidateIds array are required' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }

          // Get role details
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('*')
            .eq('id', roleId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (roleError || !role) {
            return new Response(JSON.stringify({ 
              error: 'Role not found' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404,
            });
          }

          // Create screens for each candidate
          const screensToInsert = candidateIds.map(candidateId => ({
            role_id: roleId,
            candidate_id: candidateId,
            user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            organization_id: DEMO_ORG_ID,
            status: 'pending',
            scheduled_at: scheduledTime || new Date().toISOString(),
            screening_type: 'voice',
          }));

          const { data: screens, error: screensError } = await supabase
            .from('screens')
            .insert(screensToInsert)
            .select();

          if (screensError) {
            throw screensError;
          }

          // If no scheduled time, initiate calls immediately
          if (!scheduledTime) {
            // Create scheduled calls for immediate processing
            const scheduledCalls = screens.map(screen => ({
              screen_id: screen.id,
              organization_id: DEMO_ORG_ID,
              scheduled_time: new Date().toISOString(),
              status: 'pending',
            }));

            const { error: callsError } = await supabase
              .from('scheduled_calls')
              .insert(scheduledCalls);

            if (callsError) {
              console.error('Error creating scheduled calls:', callsError);
            }

            // Trigger the process-scheduled-calls function
            try {
              const response = await fetch(
                `${supabaseUrl}/functions/v1/process-scheduled-calls`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (!response.ok) {
                console.error('Failed to trigger scheduled calls processing');
              }
            } catch (error) {
              console.error('Error triggering scheduled calls:', error);
            }
          } else {
            // Create scheduled calls for future
            const scheduledCalls = screens.map(screen => ({
              screen_id: screen.id,
              organization_id: DEMO_ORG_ID,
              scheduled_time: scheduledTime,
              status: 'pending',
            }));

            const { error: callsError } = await supabase
              .from('scheduled_calls')
              .insert(scheduledCalls);

            if (callsError) {
              console.error('Error creating scheduled calls:', callsError);
            }
          }

          return new Response(JSON.stringify({ 
            success: true,
            screens,
            message: scheduledTime ? 'Screenings scheduled' : 'Screenings initiated'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          });

        } else if (action === 'bulk') {
          // Handle bulk screening initiation
          const { roleId, candidateIds, settings } = await req.json();

          if (!roleId || !candidateIds || !Array.isArray(candidateIds)) {
            return new Response(JSON.stringify({ 
              error: 'roleId and candidateIds array are required' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }

          // Create bulk operation
          const { data: bulkOp, error: bulkError } = await supabase
            .from('bulk_operations')
            .insert({
              role_id: roleId,
              organization_id: DEMO_ORG_ID,
              user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              total_count: candidateIds.length,
              status: 'pending',
              settings: settings || {},
            })
            .select()
            .single();

          if (bulkError) {
            throw bulkError;
          }

          // Create screens
          const screensToInsert = candidateIds.map(candidateId => ({
            role_id: roleId,
            candidate_id: candidateId,
            user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            organization_id: DEMO_ORG_ID,
            bulk_operation_id: bulkOp.id,
            status: 'pending',
            screening_type: 'voice',
          }));

          const { data: screens, error: screensError } = await supabase
            .from('screens')
            .insert(screensToInsert)
            .select();

          if (screensError) {
            throw screensError;
          }

          // Trigger bulk processing
          try {
            const response = await fetch(
              `${supabaseUrl}/functions/v1/process-bulk-screenings`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  bulkOperationId: bulkOp.id,
                  action: 'start',
                })
              }
            );

            if (!response.ok) {
              console.error('Failed to trigger bulk processing');
            }
          } catch (error) {
            console.error('Error triggering bulk processing:', error);
          }

          return new Response(JSON.stringify({ 
            success: true,
            bulkOperationId: bulkOp.id,
            screens,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      default: {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        });
      }
    }
  } catch (error: any) {
    console.error('Error in demo-api-screenings:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});