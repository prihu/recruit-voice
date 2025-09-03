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
    const lastPart = pathParts[pathParts.length - 1];
    const isBulkImport = lastPart === 'bulk';
    const candidateId = !isBulkImport && pathParts.length > 1 && lastPart !== 'demo-api-candidates' ? lastPart : null;

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Ensure demo setup on every request
    const demoUserId = await ensureDemoSetup(supabase);

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (candidateId) {
          // Get specific candidate
          const { data: candidate, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('id', candidateId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(candidate), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // List all candidates with optional filters
          let query = supabase
            .from('candidates')
            .select('*')
            .eq('organization_id', DEMO_ORG_ID);

          // Apply filters from query params
          const skills = url.searchParams.get('skills');
          const location = url.searchParams.get('location');

          if (skills) {
            const skillsArray = skills.split(',').map(s => s.trim());
            query = query.contains('skills', skillsArray);
          }

          if (location) {
            query = query.ilike('location_pref', `%${location}%`);
          }

          const { data: candidates, error } = await query
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(candidates), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'POST': {
        const body = await req.json();

        if (isBulkImport) {
          // Bulk import candidates
          const { candidates } = body;
          
          if (!Array.isArray(candidates)) {
            return new Response(JSON.stringify({ error: 'Candidates must be an array' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }

          // Add demo organization ID to all candidates
          const candidatesWithOrg = candidates.map(candidate => ({
            ...candidate,
            organization_id: DEMO_ORG_ID,
            user_id: demoUserId,
          }));

          const { data: insertedCandidates, error } = await supabase
            .from('candidates')
            .insert(candidatesWithOrg)
            .select();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify({ 
            success: true, 
            count: insertedCandidates.length,
            candidates: insertedCandidates 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          });
        } else {
          // Create single candidate
          const candidateData = {
            ...body,
            organization_id: DEMO_ORG_ID,
            user_id: demoUserId,
          };

          const { data: candidate, error } = await supabase
            .from('candidates')
            .insert(candidateData)
            .select()
            .single();

          if (error) {
            throw error;
          }

          return new Response(JSON.stringify(candidate), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201,
          });
        }
      }

      case 'PUT': {
        if (!candidateId) {
          return new Response(JSON.stringify({ error: 'Candidate ID required for update' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const body = await req.json();
        
        const { data: candidate, error } = await supabase
          .from('candidates')
          .update(body)
          .eq('id', candidateId)
          .eq('organization_id', DEMO_ORG_ID)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify(candidate), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        if (!candidateId) {
          return new Response(JSON.stringify({ error: 'Candidate ID required for delete' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { error } = await supabase
          .from('candidates')
          .delete()
          .eq('id', candidateId)
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
    console.error('Error in demo-api-candidates:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});