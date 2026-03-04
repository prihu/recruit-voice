import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DEMO_USER_ID = '59dc7810-80b7-4a31-806a-bb0533526fab';

// ── Knowledge Base helpers ──────────────────────────────────────────

async function createKBDocument(apiKey: string, name: string, content: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, text: content }),
    });
    if (!response.ok) {
      console.error('Failed to create KB doc:', await response.text());
      return null;
    }
    const data = await response.json();
    return data.id || data.document_id || null;
  } catch (e) {
    console.error('KB document creation error:', e);
    return null;
  }
}

async function deleteKBDocument(apiKey: string, docId: string): Promise<void> {
  try {
    await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${docId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });
  } catch (e) {
    console.error('KB document deletion error:', e);
  }
}

function buildJDContent(role: any): string {
  const parts = [
    `Position: ${role.title}`,
    `Location: ${role.location}`,
    `Salary: ${role.salary_currency || 'INR'} ${role.salary_min || 'Not specified'} - ${role.salary_max || 'Not specified'}`,
  ];
  if (role.summary) parts.push(`\nAbout the Role:\n${role.summary}`);
  return parts.join('\n');
}

function buildFAQContent(faq: any[]): string {
  if (!faq || faq.length === 0) return '';
  return faq.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
}

// ── Tool registration helper ────────────────────────────────────────

async function ensureSaveAnswerTool(apiKey: string, supabaseUrl: string): Promise<string | null> {
  try {
    const toolUrl = `${supabaseUrl}/functions/v1/elevenlabs-tool-save-answer`;
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool_config: {
          name: 'save_screening_answer',
          description: 'Save the candidate\'s answer to a screening question. Call this after each screening question is answered.',
          type: 'webhook',
          api_schema: {
            url: toolUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            request_body_schema: {
              type: 'object',
              properties: {
                question_index: { type: 'integer', description: 'The 1-based index of the screening question' },
                question_text: { type: 'string', description: 'The screening question that was asked' },
                candidate_answer: { type: 'string', description: 'The candidate\'s answer summarized clearly' },
                answer_quality: { type: 'string', enum: ['good', 'partial', 'poor', 'skipped'], description: 'Quality assessment of the answer' },
              },
              required: ['question_index', 'question_text', 'candidate_answer', 'answer_quality'],
            },
          },
        },
      }),
    });
    if (!response.ok) {
      console.error('Failed to create tool:', await response.text());
      return null;
    }
    const data = await response.json();
    return data.tool_id || data.id || null;
  } catch (e) {
    console.error('Tool registration error:', e);
    return null;
  }
}

// ── Manage KB documents lifecycle ───────────────────────────────────

async function manageKBDocuments(
  apiKey: string,
  role: any,
  supabase: any
): Promise<{ jdDocId: string | null; faqDocId: string | null }> {
  // Delete old KB docs if they exist
  if (role.kb_jd_doc_id) await deleteKBDocument(apiKey, role.kb_jd_doc_id);
  if (role.kb_faq_doc_id) await deleteKBDocument(apiKey, role.kb_faq_doc_id);

  const jdContent = buildJDContent(role);
  const faqContent = buildFAQContent(role.faq || []);

  const jdDocId = jdContent ? await createKBDocument(apiKey, `JD - ${role.title}`, jdContent) : null;
  const faqDocId = faqContent ? await createKBDocument(apiKey, `FAQ - ${role.title}`, faqContent) : null;

  const updateData: any = {};
  if (jdDocId !== undefined) updateData.kb_jd_doc_id = jdDocId;
  if (faqDocId !== undefined) updateData.kb_faq_doc_id = faqDocId;

  if (Object.keys(updateData).length > 0) {
    await supabase.from('roles').update(updateData).eq('id', role.id);
  }

  return { jdDocId, faqDocId };
}

// ── Slim prompt generator (behavior-only) ───────────────────────────

function generateAgentConfig(
  role: any,
  organization: any,
  kbDocIds: { jdDocId: string | null; faqDocId: string | null },
  toolId: string | null
) {
  const companyName = role.company_name || organization.name;
  const questions = role.questions || [];
  const rules = role.rules || [];
  const evaluationCriteria = role.evaluation_criteria || '';

  const screeningQuestions = questions.length > 0
    ? questions.map((q: any, idx: number) => {
        let questionText = `${idx + 1}. ${q.text}`;
        if (q.type === 'multi_choice' && q.options) {
          questionText += ` (Options: ${q.options.join(', ')})`;
        }
        if (q.required) questionText += ' [REQUIRED]';
        if (q.match_config) {
          if (q.match_config.min_years) questionText += ` (Minimum ${q.match_config.min_years} years)`;
          if (q.match_config.expected_answer !== undefined) questionText += ` (Expected: ${q.match_config.expected_answer})`;
        }
        return questionText;
      }).join('\n')
    : 'General discussion about experience and background';

  const evaluationSection = evaluationCriteria
    ? evaluationCriteria
    : rules.length > 0
      ? rules.map((r: any) => {
          const isRequired = r.is_required ? ' [REQUIRED]' : '';
          const failureReason = r.failure_reason ? ` - ${r.failure_reason}` : '';
          return `- ${r.name}: ${r.condition.field} ${r.condition.operator} ${r.condition.value} (Weight: ${r.weight})${isRequired}${failureReason}`;
        }).join('\n')
      : 'Assess general fit for the role';

  // Slim prompt — NO JD content, NO FAQs (those live in Knowledge Base)
  const prompt = `# Personality

You are a professional phone screening specialist conducting interviews for ${companyName}.
You are friendly, attentive, and genuinely interested in understanding candidate qualifications.
You balance professionalism with warmth. You're naturally curious and empathetic.

# Environment

You are conducting a phone screening for the ${role.title} position at ${companyName}.
This is a voice-only interaction. The candidate may be in various environments.
Timezone: ${role.call_window?.timezone || organization.timezone || 'Asia/Kolkata'}.

# Tone

Professional yet conversational. Speak clearly at a moderate pace.
Use brief affirmations ("I see," "That's interesting") to show active listening.
If the candidate speaks Hindi or a regional language, respond in the same language.
Use strategic pauses to give candidates time to think.

# Goal

Screen candidates for ${role.title} through a structured interview:

1. Initial engagement:
   - Confirm identity and availability
   - Set expectations: 10-15 minutes
   - Briefly introduce the role and ${companyName}

2. Core screening — ask each question below, listen carefully, then call save_screening_answer:
${screeningQuestions}

3. Information exchange:
   - Answer any questions using the knowledge base
   - Gauge interest level and availability

4. Conclusion:
   - Thank the candidate
   - Explain next steps and timeline
   - End on a positive note

EVALUATION CRITERIA:
${evaluationSection}

After each screening question is answered, call the save_screening_answer tool with: question_index, question_text, candidate_answer, and answer_quality (good/partial/poor/skipped).

# Guardrails

- Do not make hiring decisions during the call.
- Never share other candidates' information.
- If asked about salary beyond what's provided, indicate it will be discussed later.
- Keep professional tone even if candidates express frustration.
- Do not reveal you are AI unless directly asked.
- Respect cultural sensitivities.`;

  const firstMessage = `Hello! This is a screening call from ${companyName} regarding your application for the ${role.title} position. Is this a good time to talk for about 10 to 15 minutes?`;

  // Build knowledge_base references (must be KnowledgeBaseLocator objects)
  const knowledgeBase: any[] = [];
  if (kbDocIds.jdDocId) knowledgeBase.push({ type: 'text', name: `JD - ${role.title}`, id: kbDocIds.jdDocId });
  if (kbDocIds.faqDocId) knowledgeBase.push({ type: 'text', name: `FAQ - ${role.title}`, id: kbDocIds.faqDocId });

   // Build tool_ids references
  const toolIds: string[] = [];
  if (toolId) toolIds.push(toolId);

  const config: any = {
    name: `${role.title} - ${companyName}`,
    conversation_config: {
      agent: {
        prompt: {
          prompt: prompt,
          ...(knowledgeBase.length > 0 ? { knowledge_base: knowledgeBase } : {}),
          ...(toolIds.length > 0 ? { tool_ids: toolIds } : {}),
        },
        first_message: firstMessage,
        language: "en",
      },
      tts: {
        voice_id: "21m00Tcm4TlvDq8ikWAM",
        model: "eleven_multilingual_v2",
      },
      asr: {
        model: "nova-2-general",
        language: "auto",
      },
      conversation: {
        max_duration_seconds: 1800,
        text_only: false,
      },
    },
    platform_settings: {
      max_duration: 1800,
    },
    tags: [
      `org-${organization.id}`,
      `role-${role.id}`,
      'screening-agent',
      'IN',
    ],
  };

  return config;
}

function extractKeywords(role: any): string[] {
  const keywords: string[] = [];
  if (role.location) keywords.push(...role.location.split(/[\s,]+/));
  keywords.push('Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune',
    'lakhs', 'crores', 'INR', 'rupees', 'fresher', 'experienced', 'notice period');
  if (role.title) keywords.push(...role.title.split(/[\s-]+/));
  if (role.required_skills) keywords.push(...role.required_skills);
  return [...new Set(keywords)];
}

// Helper to ensure demo setup is complete
async function ensureDemoSetup(supabase: any) {
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('organization_id', DEMO_ORG_ID)
    .single();

  if (!existingMember) {
    await supabase.from('organization_members').insert({
      user_id: DEMO_USER_ID,
      organization_id: DEMO_ORG_ID,
      role: 'admin',
    });
  }

  const { data: existingProfile } = await supabase
    .from('profiles').select('id').eq('user_id', DEMO_USER_ID).single();

  if (!existingProfile) {
    await supabase.from('profiles').insert({
      user_id: DEMO_USER_ID,
      full_name: 'Demo User',
      role: 'recruiter',
    });
  }

  return DEMO_USER_ID;
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY') || '';

    switch (action) {
      case 'create': {
        if (!roleId) {
          return new Response(JSON.stringify({ error: 'roleId is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data: role, error: roleError } = await supabase
          .from('roles').select('*').eq('id', roleId).eq('organization_id', DEMO_ORG_ID).single();

        if (roleError || !role) {
          return new Response(JSON.stringify({ error: 'Role not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }

        const { data: org } = await supabase
          .from('organizations').select('*').eq('id', DEMO_ORG_ID).single();

        const organization = org || {
          id: DEMO_ORG_ID,
          name: 'Demo Company',
          company_domain: 'demo.com',
          timezone: 'Asia/Kolkata',
          country: 'IN',
        };

        // 1. Create KB documents
        const kbDocIds = await manageKBDocuments(elevenLabsApiKey, role, supabase);
        console.log('KB docs created:', kbDocIds);

        // 2. Ensure save_answer tool exists
        let toolId = role.tool_save_answer_id;
        if (!toolId) {
          toolId = await ensureSaveAnswerTool(elevenLabsApiKey, supabaseUrl);
          if (toolId) {
            await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', roleId);
          }
        }

        // 3. Generate config with KB + tool references
        const agentConfig = generateAgentConfig(role, organization, kbDocIds, toolId);
        console.log('Sending agent config to ElevenLabs:', JSON.stringify(agentConfig, null, 2));

        // 4. Create agent in ElevenLabs
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

            if (errorJson.detail) {
              if (Array.isArray(errorJson.detail)) {
                const validationErrors = errorJson.detail.map((err: any) => {
                  const field = err.loc?.join('.') || 'unknown field';
                  const msg = err.msg || 'validation error';
                  return `${field}: ${msg}`;
                }).join('; ');
                errorMessage = `Configuration validation failed: ${validationErrors}`;
              } else if (typeof errorJson.detail === 'object') {
                errorMessage = errorJson.detail.message || JSON.stringify(errorJson.detail);
              } else {
                errorMessage = errorJson.detail;
              }
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            }
            errorDetails = errorJson;
          } catch {
            errorMessage = errorText || 'Unknown error from ElevenLabs API';
          }

          console.error('ElevenLabs API error:', { status: response.status, message: errorMessage });

          return new Response(JSON.stringify({
            error: errorMessage,
            details: errorDetails,
            status: response.status,
            helpText: response.status === 401
              ? 'Please check your ElevenLabs API key configuration'
              : response.status === 429
                ? 'Rate limit exceeded. Please try again later.'
                : 'ElevenLabs API error.',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status || 500,
          });
        }

        const agent = await response.json();
        console.log('Agent created:', agent.agent_id);

        const createdAgentId = agent.agent_id;
        if (!createdAgentId) {
          return new Response(JSON.stringify({
            error: 'Invalid response from ElevenLabs API',
            details: 'No agent_id returned',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        await supabase.from('roles').update({
          voice_agent_id: createdAgentId,
          agent_sync_status: 'synced',
          agent_created_at: new Date().toISOString(),
          agent_error_message: null,
        }).eq('id', roleId).eq('organization_id', DEMO_ORG_ID);

        return new Response(JSON.stringify({
          success: true,
          agentId: createdAgentId,
          message: 'Voice agent created successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        if (!agentId || !updates) {
          return new Response(JSON.stringify({ error: 'agentId and updates are required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        let updatePayload: any = {};

        if (updates.roleId) {
          const { data: role, error: roleError } = await supabase
            .from('roles').select('*').eq('id', updates.roleId).eq('organization_id', DEMO_ORG_ID).single();

          if (roleError || !role) {
            return new Response(JSON.stringify({ error: 'Role not found' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404,
            });
          }

          const { data: updateOrg } = await supabase
            .from('organizations').select('*').eq('id', DEMO_ORG_ID).single();

          const updateOrganization = updateOrg || {
            id: DEMO_ORG_ID,
            name: 'Demo Company',
            timezone: 'Asia/Kolkata',
            country: 'IN',
          };

          // Refresh KB documents
          const kbDocIds = await manageKBDocuments(elevenLabsApiKey, role, supabase);

          // Ensure tool
          let toolId = role.tool_save_answer_id;
          if (!toolId) {
            toolId = await ensureSaveAnswerTool(elevenLabsApiKey, supabaseUrl);
            if (toolId) {
              await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', updates.roleId);
            }
          }

          const agentConfig = generateAgentConfig(role, updateOrganization, kbDocIds, toolId);
          updatePayload = {
            conversation_config: agentConfig.conversation_config,
          };
        } else if (updates.conversation_config?.agent) {
          const agentUpdate: any = {};
          if (updates.conversation_config.agent.prompt !== undefined) {
            agentUpdate.prompt = { prompt: updates.conversation_config.agent.prompt };
          }
          if (updates.conversation_config.agent.first_message !== undefined) {
            agentUpdate.first_message = updates.conversation_config.agent.first_message;
          }
          if (Object.keys(agentUpdate).length > 0) {
            updatePayload = { conversation_config: { agent: agentUpdate } };
          }
        }

        console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          method: 'PATCH',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Update agent error:', errorText);
          throw new Error(`Failed to update agent: ${errorText}`);
        }

        const updatedAgent = await response.json();
        console.log('Agent updated:', updatedAgent.agent_id);

        if (updates.roleId) {
          await supabase.from('roles').update({
            agent_sync_status: 'synced',
            agent_error_message: null,
          }).eq('id', updates.roleId).eq('organization_id', DEMO_ORG_ID);
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
        if (!elevenLabsApiKey) {
          return new Response(JSON.stringify({
            success: false,
            error: 'ElevenLabs API key not configured.',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        const testResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: { 'xi-api-key': elevenLabsApiKey },
        });

        if (!testResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: testResponse.status === 401 ? 'Invalid API key.' : 'API key lacks permissions.',
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

        const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: agentId,
            customer: { number: phoneNumber },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to initiate test call:', error);
          return new Response(JSON.stringify({
            error: 'Failed to initiate test call',
            details: error,
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
