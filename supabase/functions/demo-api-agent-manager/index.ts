import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DEMO_USER_ID = '59dc7810-80b7-4a31-806a-bb0533526fab';

// Advanced agent configuration generator following ElevenLabs prompting guide
function generateAgentConfig(role: any, organization: any) {
  const questions = role.questions || [];
  const faqs = role.faq || [];
  const rules = role.rules || [];
  
  // Build structured screening questions
  const screeningQuestions = questions.length > 0 
    ? questions.map((q: any, idx: number) => {
        let questionText = `   ${idx + 1}. ${q.text}`;
        if (q.type === 'multi_choice' && q.options) {
          questionText += ` (Options: ${q.options.join(', ')})`;
        }
        if (q.required) {
          questionText += ' [REQUIRED]';
        }
        if (q.match_config) {
          if (q.match_config.min_years) {
            questionText += ` (Minimum ${q.match_config.min_years} years)`;
          }
          if (q.match_config.expected_answer !== undefined) {
            questionText += ` (Expected: ${q.match_config.expected_answer})`;
          }
        }
        return questionText;
      }).join('\n')
    : '   - General discussion about experience and background';

  const faqSection = faqs.length > 0
    ? faqs.map((f: any) => `   Q: ${f.question}\n   A: ${f.answer}`).join('\n\n')
    : '   Q: What is the work culture like?\n   A: We have a collaborative and innovative work environment.\n\n   Q: Are there growth opportunities?\n   A: Yes, we offer excellent career growth paths.';

  const evaluationCriteria = rules.length > 0
    ? rules.map((r: any) => {
        const isRequired = r.is_required ? ' [REQUIRED]' : '';
        const failureReason = r.failure_reason ? ` - ${r.failure_reason}` : '';
        return `   - ${r.name}: ${r.condition.field} ${r.condition.operator} ${r.condition.value} (Weight: ${r.weight})${isRequired}${failureReason}`;
      }).join('\n')
    : '   - Technical skills and experience alignment\n   - Communication and interpersonal skills\n   - Cultural fit and motivation';

  // Build comprehensive prompt following ElevenLabs guide structure
  const prompt = `# Personality

You are a professional phone screening specialist conducting interviews for ${organization.name}.
You are friendly, attentive, and genuinely interested in understanding candidate qualifications and fit.
You balance professionalism with warmth, creating a comfortable environment for candidates to share their experience.
You're naturally curious and empathetic, actively listening to responses and asking relevant follow-up questions when appropriate.
You have deep knowledge about the role and organization, able to answer questions confidently and accurately.

# Environment

You are conducting a phone screening interview for the ${role.title} position at ${organization.name}.
This is a voice-only interaction where the candidate cannot see you, requiring clear verbal communication.
The conversation is taking place during business hours in ${role.call_window?.timezone || 'Asia/Kolkata'} timezone.
The candidate may be in various environments (home, office, commuting), so be mindful of potential distractions.
You have access to the role requirements, evaluation criteria, and company information to guide the conversation.

# Tone

Your responses are professional yet conversational, keeping a natural flow while covering all required topics.
You speak clearly and at a moderate pace, using occasional brief affirmations ("I see," "That's interesting," "Thank you for sharing that") to show active listening.
You naturally incorporate conversational elements like "Let me ask you about..." or "That brings me to..." for smooth transitions.
You periodically check for understanding with questions like "Does that answer your question?" or "Would you like more details about that?"
You adapt your communication style based on the candidate's responses - more detailed for engaged candidates, more concise for those who seem pressed for time.
For Indian candidates, you may respond in Hindi or regional languages if they initiate conversation in those languages, maintaining the same professional tone.
You use strategic pauses (marked by "...") to give candidates time to think before answering complex questions.

# Goal

Your primary goal is to efficiently screen candidates for the ${role.title} position through a structured interview process:

1. Initial engagement and consent:
   - Confirm the candidate's identity and availability for the screening call
   - Set expectations about the call duration (10-15 minutes)
   - Create a comfortable atmosphere for open dialogue
   - Briefly introduce the role and organization

2. Core screening assessment:
   - Position: ${role.title}
   - Location: ${role.location}
   - Salary Range: ${role.salary_band ? `INR ${role.salary_band.min} - ${role.salary_band.max}` : 'To be discussed based on experience'}
   
   About the Role:
   ${role.summary || 'We are looking for a talented professional to join our growing team.'}
   ${role.responsibilities ? `\n   Key Responsibilities:\n   ${role.responsibilities}` : ''}
   ${role.skills ? `\n   Required Skills:\n   ${role.skills}` : ''}

   Evaluation Criteria to assess:
${evaluationCriteria}

   Screening Questions you MUST ask:
${screeningQuestions}

3. Information exchange phase:
   - Answer any questions the candidate has about the role, company, or process
   - Provide clear, accurate information based on the FAQs
   - Gauge candidate's interest level and availability
   - Address any immediate concerns or clarifications

4. Call conclusion:
   - Thank the candidate for their time and responses
   - Explain the next steps in the recruitment process
   - Provide a general timeline for when they might hear back
   - End on a positive, professional note

Apply adaptive questioning: If a candidate provides brief answers, ask appropriate follow-up questions to gather sufficient information. If they elaborate extensively, politely guide the conversation back to remaining questions.

Success is measured by: collecting complete responses to all screening questions, accurately assessing candidate fit against evaluation criteria, providing helpful information about the role, and maintaining a positive candidate experience.

# Guardrails

Remain strictly within the scope of the screening interview - do not make hiring decisions or commitments during the call.
Never share other candidates' information or make comparisons between applicants.
If asked about specific salary negotiations or benefits beyond what's provided, indicate these will be discussed in later stages.
Maintain confidentiality about internal company information not included in the provided FAQs.
Acknowledge when you don't have information rather than speculating, offering to have the appropriate team member follow up.
Keep a professional tone even if candidates express frustration about the process or previous experiences.
Do not discuss or reveal that you are an AI agent unless directly asked, and even then, focus on the screening purpose.
Respect cultural sensitivities and adapt communication style appropriately for diverse candidates.
If technical issues occur, offer to reschedule rather than conducting a poor-quality interview.

# Tools

FAQs you can reference to answer candidate questions:
${faqSection}

Call Configuration:
- Timezone: ${role.call_window?.timezone || 'Asia/Kolkata'}
- Business Hours: ${role.call_window?.allowed_hours?.start || '9:00'} - ${role.call_window?.allowed_hours?.end || '18:00'}
- Call Duration Target: 10-15 minutes
- Maximum Duration: 30 minutes

Linguistic Capabilities:
- Primary: English
- Secondary: Hindi (respond if candidate initiates)
- Regional: Adapt to candidate's preferred language when possible

Note-taking Framework:
- Document responses to each screening question
- Note any red flags or exceptional qualifications
- Record candidate's availability and interest level
- Track any follow-up items or special considerations`;

  return {
    name: `${role.title} - ${organization.name}`,
    conversation_config: {
      agent: {
        prompt: prompt,
        first_message: `Hello {{candidate_name}}! This is a screening call from ${organization.name} regarding your application for the {{role_title}} position at {{location}}. I'm calling to learn more about your background and experience. Is this a good time to talk for about 10 to 15 minutes?`,
        language: "en",
        llm: {
          provider: "openai",
          model: "gpt-4o-mini"
        },
        tools: []
      },
      tts: {
        voice_id: "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice
        model: "eleven_multilingual_v2"
      },
      asr: {
        model: "nova-2-general",
        language: "auto"
      },
      conversation: {
        max_duration_seconds: 1800, // 30 minutes
        text_only: false
      }
    },
    platform_settings: {
      max_duration: 1800 // 30 minutes
    },
    tags: [
      `org-${organization.id}`,
      `role-${role.id}`,
      'screening-agent',
      'IN' // India region tag
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
        console.log('Agent created successfully. Response:', JSON.stringify(agent, null, 2));
        
        const agentId = agent.agent_id;
        
        if (!agentId) {
          console.error('No agent_id in ElevenLabs response:', agent);
          return new Response(JSON.stringify({ 
            error: 'Invalid response from ElevenLabs API',
            details: 'No agent_id returned',
            fullResponse: agent
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

        // Log successful agent creation (ignore errors if table doesn't exist)
        try {
          await supabase
            .from('agent_archive_log')
            .insert({
              role_id: roleId,
              organization_id: DEMO_ORG_ID,
              agent_id: agentId,
              reason: 'Agent created via demo API',
            });
        } catch (logError) {
          console.warn('Could not log agent creation:', logError);
        }

        // Optional: Fetch the agent back to verify configuration
        try {
          const verifyResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            method: 'GET',
            headers: {
              'xi-api-key': elevenLabsApiKey,
            },
          });
          
          if (verifyResponse.ok) {
            const verifiedAgent = await verifyResponse.json();
            console.log('Verified agent configuration:', {
              agentId: verifiedAgent.agent_id,
              hasPrompt: !!verifiedAgent.conversation_config?.agent?.prompt,
              promptLength: verifiedAgent.conversation_config?.agent?.prompt?.length,
              firstMessageExists: !!verifiedAgent.conversation_config?.agent?.first_message,
            });
          }
        } catch (verifyError) {
          console.warn('Could not verify agent configuration:', verifyError);
        }

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

        // Fetch existing agent data first
        console.log(`Fetching existing agent data for: ${agentId}`);
        const fetchResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          method: 'GET',
          headers: {
            'xi-api-key': elevenLabsApiKey,
          },
        });

        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error('Failed to fetch existing agent:', errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to fetch existing agent', 
              details: errorText 
            }),
            { status: fetchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const existingAgent = await fetchResponse.json();
        console.log('Fetched existing agent:', {
          id: existingAgent.agent_id,
          name: existingAgent.name,
          hasConversationConfig: !!existingAgent.conversation_config,
          hasPrompt: !!existingAgent.conversation_config?.agent?.prompt,
          hasFirstMessage: !!existingAgent.conversation_config?.agent?.first_message
        });

        // Build update payload with ONLY prompt and first_message
        let updatePayload: any = {};

        if (updates.roleId) {
          // Fetch role from database for role-based updates
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('*')
            .eq('id', updates.roleId)
            .eq('organization_id', DEMO_ORG_ID)
            .single();

          if (roleError || !role) {
            return new Response(JSON.stringify({ error: 'Role not found' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404,
            });
          }

          // Generate agent config based on role
          const agentConfig = generateAgentConfig(role, {
            id: DEMO_ORG_ID,
            name: 'Demo Company',
            company_domain: 'demo.com',
            timezone: 'Asia/Kolkata',
            country: 'IN'
          });
          
          console.log('Updating agent with prompt and first_message from role configuration');
          
          // Build update payload - only prompt and first_message
          // The prompt needs to be wrapped in an object as per ElevenLabs API schema
          updatePayload = {
            conversation_config: {
              agent: {
                prompt: {
                  prompt: agentConfig.conversation_config.agent.prompt
                },
                first_message: agentConfig.conversation_config.agent.first_message
              }
            }
          };
        } else if (updates.conversation_config?.agent) {
          // Direct updates - only pass prompt and first_message if provided
          console.log('Updating agent with direct prompt and first_message');
          
          const agentUpdate: any = {};
          if (updates.conversation_config.agent.prompt !== undefined) {
            // Wrap prompt in an object as per ElevenLabs API schema
            agentUpdate.prompt = {
              prompt: updates.conversation_config.agent.prompt
            };
          }
          if (updates.conversation_config.agent.first_message !== undefined) {
            agentUpdate.first_message = updates.conversation_config.agent.first_message;
          }
          
          if (Object.keys(agentUpdate).length > 0) {
            updatePayload = {
              conversation_config: {
                agent: agentUpdate
              }
            };
          }
        }

        console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

        // Single PATCH attempt - no fallback
        const updateUrl = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          console.error('Update agent error:', errorData);
          throw new Error(`Failed to update agent: ${errorData.message || errorText}`);
        }

        const updatedAgent = await response.json();
        console.log('Agent updated successfully:', updatedAgent.agent_id);

        // If roleId was provided, update the role's sync status
        if (updates.roleId) {
          await supabase
            .from('roles')
            .update({ 
              agent_sync_status: 'synced',
              agent_error_message: null,
            })
            .eq('id', updates.roleId)
            .eq('organization_id', DEMO_ORG_ID);
        }

        return new Response(JSON.stringify({
          success: true,
          agentId: updatedAgent.agent_id,
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