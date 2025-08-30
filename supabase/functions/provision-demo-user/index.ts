import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const demoEmail = 'demo@example.com';
    const demoPassword = 'DemoPassword123!';

    // Check if demo user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(
      'demo-user-id'
    ).catch(() => ({ data: null }));

    if (!existingUser) {
      // Create demo user using admin API (bypasses email verification)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: 'Demo User',
          is_demo: true
        }
      });

      if (createError) {
        console.error('Error creating demo user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create demo user', details: createError.message }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Demo user created successfully:', newUser?.id);
    } else {
      console.log('Demo user already exists');
    }

    // Sign in the demo user
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (signInError) {
      console.error('Error signing in demo user:', signInError);
      return new Response(
        JSON.stringify({ error: 'Failed to sign in demo user', details: signInError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: signInData.session,
        user: signInData.user
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Unexpected error in provision-demo-user:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});