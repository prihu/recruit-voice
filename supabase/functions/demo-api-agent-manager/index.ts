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
  
  // Generate greeting based on context - personalized for the role
  const firstMessage = `Hello! This is an automated screening call from ${organization.name || 'our company'} for the ${role.title} position. Is this a good time to talk for about 10-15 minutes?`;
  
  // Build comprehensive prompt with all role information
  let prompt = `You are an AI phone screening agent conducting an interview for ${role.title} at ${organization.name}.

## COMPANY INFORMATION
Company: ${organization.name}
Domain: ${organization.company_domain || 'Not specified'}
Location: ${organization.country || 'India'}

## JOB DETAILS
Position: ${role.title}
Location: ${role.location || 'Not specified'}
Employment Type: ${role.employment_type || 'Full-time'}
Experience Required: ${role.experience_level || 'Not specified'}
Salary Range: ${role.salary_currency || 'INR'} ${role.salary_min ? role.salary_min.toLocaleString() : 'Not specified'} - ${role.salary_max ? role.salary_max.toLocaleString() : 'Not specified'}

## JOB DESCRIPTION
${role.summary || 'No job description provided'}`;

  // Add responsibilities if available
  if (role.responsibilities && role.responsibilities.length > 0) {
    prompt += `

## KEY RESPONSIBILITIES
${role.responsibilities.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`;
  }

  // Add required skills if available
  if (role.required_skills && role.required_skills.length > 0) {
    prompt += `

## REQUIRED SKILLS
${role.required_skills.map((s: string) => `- ${s}`).join('\n')}`;
  }

  // Add evaluation criteria/rules
  if (evaluationCriteria) {
    prompt += `

## EVALUATION CRITERIA AND RULES
${evaluationCriteria}

IMPORTANT: Use these criteria to evaluate candidate responses. Take note of any red flags or concerns based on these rules.`;
  }

  // Add screening questions
  prompt += `

## SCREENING QUESTIONS (ASK ALL OF THESE)
You must ask each of the following questions and carefully document the candidate's responses:

${questions.map((q: any, i: number) => {
  const questionText = q.text || q;
  const questionType = q.type || 'open';
  return `${i + 1}. ${questionText}${questionType === 'required' ? ' [REQUIRED - Must get a clear answer]' : ''}`;
}).join('\n')}`;

  // Add FAQs
  if (faq && faq.length > 0) {
    prompt += `

## FREQUENTLY ASKED QUESTIONS
If the candidate asks any of these questions, provide the following answers:

${faq.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`;
  }

  // Add call window settings
  const timezone = role.call_window?.timezone || organization.timezone || 'Asia/Kolkata';
  const startTime = role.call_window?.allowedHours?.start || '9:00';
  const endTime = role.call_window?.allowedHours?.end || '18:00';
  
  prompt += `

## CALL SETTINGS
- Timezone: ${timezone}
- Preferred Hours: ${startTime} - ${endTime}
- Max Duration: 15-20 minutes

## CONVERSATION GUIDELINES

### Your Approach
1. Be professional, warm, and conversational - this is the candidate's first interaction with the company
2. Speak clearly and at a moderate pace
3. Use active listening - acknowledge what the candidate says before moving to the next question
4. If the candidate speaks Hindi or another regional language, feel free to switch to that language
5. Be empathetic if the candidate mentions any concerns or challenges

### Interview Flow
1. Start with the greeting and confirm it's a good time to talk
2. If not a good time, offer to reschedule
3. Briefly introduce the purpose of the call
4. Ask each screening question systematically
5. Allow the candidate to ask questions
6. Thank them for their time and explain next steps

### Important Notes
- DO NOT make any hiring decisions or commitments during the call
- DO NOT discuss specific salary numbers unless asked directly (refer to the range provided)
- DO NOT share confidential company information beyond what's in the FAQ
- If asked something not in the FAQ, politely say you'll have the HR team follow up with that information

### Evaluation Focus
- Listen for relevant experience and skills
- Note communication skills and professionalism
- Assess cultural fit based on responses
- Document any concerns or red flags per the evaluation criteria
- Pay attention to the candidate's enthusiasm and interest in the role

Remember: Your goal is to gather information for the recruiting team while providing a positive candidate experience.`;

  // Create minimal valid configuration
  // Based on ElevenLabs API requirements, we use a simplified structure
  const agentConfig = {
    name: `${role.title} - ${organization.name}`,
    conversation_config: {
      // Move first_message to root of conversation_config
      first_message: firstMessage,
      
      // Minimal TTS configuration
      tts: {
        voice_id: "21m00Tcm4TlvDq8ikWAM" // Rachel - professional female voice
      },
      
      // Minimal LLM configuration with correct structure
      llm: {
        provider: "openai",
        model: "gpt-4o-mini", // Use widely supported model
        prompt: prompt,
        max_tokens: 150
      }
    }
  };

  // Add optional platform settings if needed
  const fullConfig = {
    ...agentConfig,
    platform_settings: {
      max_duration: 1800 // 30 minutes max
    },
    tags: [
      `org-${organization.id}`,
      `role-${role.id}`,
      'screening-agent',
      organization.country || 'IN'
    ]
  };

  return fullConfig;
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
            console.error('ElevenLabs API error JSON:', errorJson);
            
            // Handle different error response structures
            if (errorJson.detail) {
              if (Array.isArray(errorJson.detail)) {
                // Handle validation errors which come as an array
                const validationErrors = errorJson.detail.map((err: any) => {
                  const field = err.loc?.join('.') || 'unknown field';
                  const msg = err.msg || 'validation error';
                  const type = err.type || '';
                  return `${field}: ${msg}${type ? ` (${type})` : ''}`;
                }).join('; ');
                errorMessage = `Configuration validation failed: ${validationErrors}`;
              } else if (typeof errorJson.detail === 'object') {
                // Handle object-style error detail
                if (errorJson.detail.status === 'invalid_agent_config') {
                  errorMessage = errorJson.detail.message || 'Invalid agent configuration';
                } else {
                  errorMessage = errorJson.detail.message || JSON.stringify(errorJson.detail);
                }
              } else {
                // Handle string detail
                errorMessage = errorJson.detail;
              }
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            } else if (errorJson.error) {
              errorMessage = errorJson.error;
            } else {
              // If no standard error field, stringify the whole response
              errorMessage = JSON.stringify(errorJson);
            }
            
            errorDetails = errorJson;
          } catch (parseError) {
            // errorText is not JSON, use as is
            console.error('Failed to parse error response:', parseError);
            errorMessage = errorText || 'Unknown error from ElevenLabs API';
          }
          
          console.error('ElevenLabs API error:', {
            status: response.status,
            message: errorMessage,
            details: errorDetails,
            rawText: errorText
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