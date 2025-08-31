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
      // Check if user has organization
      const { data: orgMember } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', initialSignIn.user.id)
        .single();

      if (!orgMember) {
        console.log('Demo user exists but has no organization, setting up...');
        await setupDemoOrganization(supabaseAdmin, initialSignIn.user.id);
      }

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
    let userId: string | undefined;
    
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Demo User', is_demo: true }
    });

    if (createError) {
      // If the user already exists, get their ID
      const code = (createError as any).code || (createError as any).status;
      if (code === 'email_exists' || (typeof code === 'number' && code === 422)) {
        console.log('Demo user already exists, getting user ID...');
        
        // Try to get the existing user's ID
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email === demoEmail);
        userId = existingUser?.id;
        
        if (!userId) {
          console.error('Could not find existing demo user ID');
          return new Response(
            JSON.stringify({ error: 'Failed to get demo user', details: 'User exists but ID not found' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
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
      userId = createdUser?.user?.id;
    }

    // Setup demo organization and profile
    if (userId) {
      await setupDemoOrganization(supabaseAdmin, userId);
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

async function setupDemoOrganization(supabaseAdmin: any, userId: string) {
  const demoOrgName = 'Demo Company';
  
  // Check if demo organization exists
  const { data: existingOrg } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('name', demoOrgName)
    .single();

  let orgId: string;
  
  if (existingOrg) {
    orgId = existingOrg.id;
    console.log('Using existing demo organization:', orgId);
  } else {
    // Create demo organization
    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: demoOrgName,
        company_domain: 'demo.example.com',
        settings: {
          timezone: 'Asia/Kolkata',
          workingHours: {
            start: '09:00',
            end: '18:00'
          },
          maxConcurrentCalls: 10
        }
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating demo organization:', orgError);
      throw new Error('Failed to create demo organization');
    }

    orgId = newOrg.id;
    console.log('Created demo organization:', orgId);
  }

  // Check if user is already a member
  const { data: existingMember } = await supabaseAdmin
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();

  if (!existingMember) {
    // Add user to organization
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: orgId,
        role: 'admin'
      });

    if (memberError) {
      console.error('Error adding user to organization:', memberError);
      throw new Error('Failed to add user to organization');
    }
    console.log('Added user to organization');
  }

  // Check if profile exists
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!existingProfile) {
    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        full_name: 'Demo User',
        role: 'recruiter'
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw new Error('Failed to create profile');
    }
    console.log('Created user profile');
  }
}