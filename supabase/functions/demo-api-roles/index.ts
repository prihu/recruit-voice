import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const roleId = pathParts[pathParts.length - 1];
    const isSpecificRole = pathParts.length > 1 && roleId !== 'demo-api-roles';

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Ensure demo setup on every request
    const demoUserId = await ensureDemoSetup(supabase);

    // Handle organization config endpoints
    if (url.pathname.endsWith('/organization-config')) {
      if (req.method === 'GET') {
        const { data: org } = await supabase
          .from('organizations')
          .select('twilio_config')
          .eq('id', DEMO_ORG_ID)
          .single();

        return new Response(
          JSON.stringify(org?.twilio_config || {}),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (req.method === 'PUT') {
        const { twilio_config } = await req.json();

        const { error } = await supabase
          .from('organizations')
          .update({ twilio_config })
          .eq('id', DEMO_ORG_ID);

        if (error) {
          console.error('Error updating organization config:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, twilio_config }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (isSpecificRole) {
          // Get specific role
          const { data: role, error } = await supabase
            .from('roles')
            .select('*')
            .eq('id', roleId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(role), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // List all roles
          const { data: roles, error } = await supabase
            .from('roles')
            .select('*')
            .eq('organization_id', DEMO_ORG_ID)
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(roles), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'POST': {
        const body = await req.json();
        
        // Add demo organization ID and user ID with proper defaults
        const roleData = {
          ...body,
          organization_id: DEMO_ORG_ID,
          user_id: demoUserId,
          questions: body.questions || [],
          faq: body.faq || [],
          call_window: body.call_window || {
            timezone: "UTC",
            allowedDays: [1, 2, 3, 4, 5],
            maxAttempts: 3,
            allowedHours: { start: "09:00", end: "17:00" }
          }
        };

        const { data: role, error } = await supabase
          .from('roles')
          .insert(roleData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify(role), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        });
      }

      case 'PUT': {
        if (!isSpecificRole) {
          return new Response(JSON.stringify({ error: 'Role ID required for update' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const body = await req.json();
        
        const { data: role, error } = await supabase
          .from('roles')
          .update(body)
          .eq('id', roleId)
          .eq('organization_id', DEMO_ORG_ID)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify(role), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        if (!isSpecificRole) {
          return new Response(JSON.stringify({ error: 'Role ID required for delete' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { error } = await supabase
          .from('roles')
          .delete()
          .eq('id', roleId)
          .eq('organization_id', DEMO_ORG_ID);

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    console.error('Error in demo-api-roles:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});