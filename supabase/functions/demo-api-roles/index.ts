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
    const roleId = pathParts[pathParts.length - 1];
    const isSpecificRole = pathParts.length > 1 && roleId !== 'demo-api-roles';

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
        
        // Add demo organization ID
        const roleData = {
          ...body,
          organization_id: DEMO_ORG_ID,
          user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // Using demo org ID as user ID
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