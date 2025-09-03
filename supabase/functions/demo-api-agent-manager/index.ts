import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const { action, roleId, agentId, updates } = await req.json();

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get ElevenLabs API key
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      return new Response(JSON.stringify({ 
        error: 'ElevenLabs API key not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    switch (action) {
      case 'create': {
        if (!roleId) {
          return new Response(JSON.stringify({ error: 'roleId is required' }), {
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
          return new Response(JSON.stringify({ error: 'Role not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }

        // Create agent configuration
        const agentConfig = {
          name: `${role.title} Screening Agent`,
          first_message: `Hello! I'm calling from Demo Company regarding your application for the ${role.title} position. Do you have a few minutes to discuss the role?`,
          system_prompt: `You are a professional recruiter conducting a phone screening for the ${role.title} position at Demo Company, located in ${role.location}.

Role Summary: ${role.summary || 'No summary provided'}

Evaluation Criteria: ${role.evaluation_criteria || 'Standard evaluation'}

Your task is to:
1. Introduce yourself professionally
2. Ask the screening questions provided
3. Answer any questions the candidate may have using the FAQ information
4. Be conversational and natural
5. Evaluate the candidate based on the provided criteria

Screening Questions:
${role.questions ? JSON.stringify(role.questions, null, 2) : 'No specific questions'}

Salary Range: ${role.salary_currency} ${role.salary_min} - ${role.salary_max}

FAQs:
${role.faq ? JSON.stringify(role.faq, null, 2) : 'No FAQs provided'}

Evaluation Rules:
${role.rules ? JSON.stringify(role.rules, null, 2) : 'No specific rules'}

Remember to:
- Be professional and courteous
- Listen actively to responses
- Take note of important information
- Thank the candidate for their time`,
          language: 'en',
          voice_id: 'N2lVS1w4EtoT3dr4eOWO', // Callum voice
          temperature: 0.7,
          webhook_url: `${supabaseUrl}/functions/v1/elevenlabs-webhook`,
        };

        // Create agent in ElevenLabs
        const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentConfig),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to create ElevenLabs agent:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to create voice agent',
            details: error 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        const agent = await response.json();

        // Update role with agent ID
        const { error: updateError } = await supabase
          .from('roles')
          .update({ 
            voice_agent_id: agent.agent_id,
            agent_sync_status: 'synced',
            agent_created_at: new Date().toISOString(),
          })
          .eq('id', roleId)
          .eq('organization_id', DEMO_ORG_ID);

        if (updateError) {
          console.error('Failed to update role with agent ID:', updateError);
        }

        // Log agent creation
        await supabase
          .from('agent_archive_log')
          .insert({
            role_id: roleId,
            organization_id: DEMO_ORG_ID,
            agent_id: agent.agent_id,
            reason: 'Agent created via demo API',
          });

        return new Response(JSON.stringify({
          success: true,
          agentId: agent.agent_id,
          message: 'Voice agent created successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        if (!agentId || !updates) {
          return new Response(JSON.stringify({ 
            error: 'agentId and updates are required' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        // Update agent in ElevenLabs
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          method: 'PATCH',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to update ElevenLabs agent:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to update voice agent',
            details: error 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Voice agent updated successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'test-call': {
        if (!agentId) {
          return new Response(JSON.stringify({ error: 'agentId is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { phoneNumber } = await req.json();
        
        if (!phoneNumber) {
          return new Response(JSON.stringify({ error: 'phoneNumber is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        // Initiate test call via ElevenLabs
        const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: agentId,
            customer: {
              number: phoneNumber,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to initiate test call:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to initiate test call',
            details: error 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        const conversation = await response.json();

        return new Response(JSON.stringify({
          success: true,
          conversationId: conversation.conversation_id,
          message: 'Test call initiated',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default: {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }
  } catch (error: any) {
    console.error('Error in demo-api-agent-manager:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});