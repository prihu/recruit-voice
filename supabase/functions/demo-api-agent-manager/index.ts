import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DEMO_USER_ID = '59dc7810-80b7-4a31-806a-bb0533526fab';

// Advanced agent configuration generator
function generateAgentConfig(role: any, organization: any) {
  const questions = role.questions || [];
  const faq = role.faq || [];
  const evaluationCriteria = role.evaluation_criteria || role.rules || '';
  
  // Extract keywords from role for better ASR
  const keywords = extractKeywords(role);
  
  // Generate greeting based on context
  const firstMessage = `Hello! This is an automated screening call from ${organization.name || 'our company'} for the ${role.title} position. Is this a good time to talk for about 10-15 minutes?`;
  
  // Generate comprehensive prompt
  const prompt = `You are conducting a phone screening interview for ${role.title} at ${organization.name}.

ROLE DETAILS:
- Position: ${role.title}
- Location: ${role.location}
- Salary Range: ${role.salary_currency || 'INR'} ${role.salary_min || 'Not specified'} - ${role.salary_max || 'Not specified'}

ABOUT THE ROLE:
${role.summary || 'No summary provided'}

EVALUATION CRITERIA:
${evaluationCriteria || 'Assess general fit for the role'}

SCREENING QUESTIONS YOU MUST ASK:
${questions.map((q: any, i: number) => `${i + 1}. ${q.text || q}`).join('\n')}

FAQs YOU CAN ANSWER IF ASKED:
${faq.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}

CALL SETTINGS:
- Timezone: ${role.call_window?.timezone || organization.timezone || 'Asia/Kolkata'}
- Working Hours: ${role.call_window?.allowedHours?.start || '9:00'} - ${role.call_window?.allowedHours?.end || '18:00'}

INSTRUCTIONS:
1. Be professional, friendly, and conversational
2. Ask each screening question and listen carefully to responses
3. If the candidate speaks Hindi or a regional language, you may respond in the same language
4. Take notes on their answers for evaluation
5. Answer any questions they have about the role using the FAQs
6. Thank them for their time at the end
7. Do not make any hiring decisions during the call

IMPORTANT: Keep the conversation natural and engaging. Listen actively and ask follow-up questions when appropriate.`;

  return {
    name: `${role.title} - ${organization.name}`,
    conversation_config: {
      asr: {
        provider: "elevenlabs",
        quality: "high",
        user_input_audio_format: "pcm_16000",
        keywords: keywords
      },
      tts: {
        provider: "elevenlabs",
        voice_id: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female voice
        model_id: "eleven_turbo_v2_5"
      },
      llm: {
        provider: "openai",
        model_id: "gpt-4o",  // Changed from 'model' to 'model_id'
        prompt: {
          prompt: prompt
        },
        first_message: firstMessage,
        // Removed temperature as it's not supported by newer models
        max_completion_tokens: 150  // Changed from max_tokens
      },
      turn: {
        mode: "silence",  // ElevenLabs API expects "silence" or "turn"
        turn_timeout: 10,
        silence_duration_ms: 2000
      }
    },
    platform_settings: {
      max_duration: 1800, // 30 minutes max
      enable_backchannel: true,
      conversation_id_prefix: `role-${role.id}`
    },
    tags: [
      `org-${organization.id}`,
      `role-${role.id}`,
      'screening-agent',
      organization.country || 'IN'
    ]
  };
}

function extractKeywords(role: any): string[] {
  const keywords = [];
  
  // Add location-based keywords
  if (role.location) {
    keywords.push(...role.location.split(/[\s,]+/));
  }
  
  // Add common Indian names and terms
  keywords.push(
    'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune',
    'lakhs', 'crores', 'INR', 'rupees',
    'fresher', 'experienced', 'notice period'
  );
  
  // Add role-specific technical terms from title
  if (role.title) {
    keywords.push(...role.title.split(/[\s-]+/));
  }
  
  // Add skills if available
  if (role.required_skills) {
    keywords.push(...role.required_skills);
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

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

    // Get ElevenLabs API key (may be empty in demo; actions handle this)
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY') || '';


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

        // Generate comprehensive agent configuration
        const agentConfig = generateAgentConfig(role, {
          id: DEMO_ORG_ID,
          name: 'Demo Company',
          company_domain: 'demo.com',
          timezone: 'Asia/Kolkata',
          country: 'IN'
        });

        // Log the configuration being sent for debugging
        console.log('Sending agent configuration to ElevenLabs:', JSON.stringify(agentConfig, null, 2));

        // Create agent in ElevenLabs - no simulation, real API only
        const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentConfig),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to create ElevenLabs agent';
          let errorDetails = errorText;
          
          try {
            const errorJson = JSON.parse(errorText);
            // Handle ElevenLabs validation errors which come as an array
            if (Array.isArray(errorJson.detail)) {
              const validationErrors = errorJson.detail.map((err: any) => {
                const field = err.loc?.join('.') || 'unknown field';
                const msg = err.msg || 'validation error';
                const type = err.type || '';
                return `${field}: ${msg}${type ? ` (${type})` : ''}`;
              }).join('; ');
              errorMessage = `Configuration validation failed: ${validationErrors}`;
              console.error('Validation errors from ElevenLabs:', errorJson.detail);
            } else if (errorJson.status === 'invalid_agent_config') {
              errorMessage = `Invalid agent configuration: ${errorJson.message || 'Please check the configuration structure'}`;
            } else {
              errorMessage = errorJson.detail?.message || errorJson.detail || errorJson.message || errorMessage;
            }
            errorDetails = errorJson;
          } catch (parseError) {
            // errorText is not JSON, use as is
            console.error('Failed to parse error response:', parseError);
          }
          
          console.error('ElevenLabs API error:', {
            status: response.status,
            message: errorMessage,
            details: errorDetails
          });
          
          // Return detailed error response - no simulation
          return new Response(JSON.stringify({ 
            error: errorMessage,
            details: errorDetails,
            status: response.status,
            helpText: response.status === 401 
              ? 'Please check your ElevenLabs API key configuration' 
              : response.status === 429 
              ? 'ElevenLabs API rate limit exceeded. Please try again later.'
              : 'ElevenLabs API error. Check the details for more information.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status || 500,
          });
        }

        // Only process successful responses
        const agent = await response.json();
        const agentId = agent.agent_id;
        
        if (!agentId) {
          console.error('No agent_id in ElevenLabs response:', agent);
          return new Response(JSON.stringify({ 
            error: 'Invalid response from ElevenLabs API',
            details: 'No agent_id returned'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        // Update role with real agent ID only
        const { error: updateError } = await supabase
          .from('roles')
          .update({ 
            voice_agent_id: agentId,
            agent_sync_status: 'synced',
            agent_created_at: new Date().toISOString(),
            agent_error_message: null,
          })
          .eq('id', roleId)
          .eq('organization_id', DEMO_ORG_ID);

        if (updateError) {
          console.error('Failed to update role with agent ID:', updateError);
          return new Response(JSON.stringify({ 
            error: 'Failed to save agent configuration',
            details: updateError.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        // Log successful agent creation
        await supabase
          .from('agent_archive_log')
          .insert({
            role_id: roleId,
            organization_id: DEMO_ORG_ID,
            agent_id: agentId,
            reason: 'Agent created via demo API',
          });

        return new Response(JSON.stringify({
          success: true,
          agentId: agentId,
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

      case 'test-connection': {
        // Simple test to check if API key exists
        if (!elevenLabsApiKey) {
          return new Response(JSON.stringify({ 
            success: false,
            error: 'ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to Supabase secrets.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Return 200 with error in body for better error handling
          });
        }
        
        // Test the API key by fetching voices
        const testResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'xi-api-key': elevenLabsApiKey,
          },
        });
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          let errorMessage = 'Invalid ElevenLabs API key';
          
          if (testResponse.status === 401) {
            errorMessage = 'Invalid API key. Please check your ElevenLabs API key.';
          } else if (testResponse.status === 403) {
            errorMessage = 'API key lacks required permissions.';
          }
          
          return new Response(JSON.stringify({ 
            success: false,
            error: errorMessage,
            details: errorText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'ElevenLabs API connection successful',
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