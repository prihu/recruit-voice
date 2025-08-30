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

    // Try signing in first; if it fails, create user then sign in
    // Attempt to sign in the demo user
    const { data: initialSignIn, error: initialSignInError } = await supabaseAdmin.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (!initialSignInError && initialSignIn?.session) {
      return new Response(
        JSON.stringify({
          success: true,
          session: initialSignIn.session,
          user: initialSignIn.user
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // If sign-in failed, ensure the demo user exists
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Demo User', is_demo: true }
    });

    if (createError) {
      // If the user already exists, proceed to sign in
      const code = (createError as any).code || (createError as any).status;
      if (code === 'email_exists' || (typeof code === 'number' && code === 422)) {
        console.log('Demo user already exists, continuing to sign in');
      } else {
        console.error('Error creating demo user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create demo user', details: createError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      console.log('Demo user created successfully:', createdUser?.user?.id);
    }

    // Sign in (or re-try) the demo user
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (signInError) {
      console.error('Error signing in demo user after create/check:', signInError);
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