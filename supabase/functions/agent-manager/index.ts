import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Knowledge Base helpers ──────────────────────────────────────────

async function createKBDocument(name: string, content: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
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

async function deleteKBDocument(docId: string): Promise<void> {
  try {
    await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${docId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
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

// ── Tool schema (single source of truth) ────────────────────────────

function getToolSchema(supabaseUrl: string) {
  const toolUrl = `${supabaseUrl}/functions/v1/elevenlabs-tool-save-answer`;
  return {
    name: 'save_screening_answer',
    description: 'Save the candidate\'s answer to a screening question. Call this after each screening question is answered.',
    type: 'webhook',
    api_schema: {
      url: toolUrl,
      method: 'POST',
      request_headers: [],
      request_body_schema: {
        type: 'object',
        properties: [
          {
            id: 'screen_id',
            type: 'string',
            value_type: 'dynamic_variable',
            dynamic_variable: 'screen_id',
            description: 'The screening session ID (auto-populated)',
            required: false,
          },
          {
            id: 'question_index',
            type: 'number',
            value_type: 'llm_prompt',
            description: 'The 1-based index of the screening question',
            required: false,
          },
          {
            id: 'question_text',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'The screening question that was asked',
            required: true,
          },
          {
            id: 'candidate_answer',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'The candidate\'s answer summarized clearly',
            required: true,
          },
          {
            id: 'answer_quality',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'Quality assessment of the answer: good, partial, poor, or skipped',
            enum: ['good', 'partial', 'poor', 'skipped'],
            required: true,
          },
        ],
      },
    },
    dynamic_variables: {
      dynamic_variable_placeholders: {
        screen_id: 'placeholder_screen_id',
      },
    },
  };
}

// ── Tool registration helper ────────────────────────────────────────

async function ensureSaveAnswerTool(supabaseUrl: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool_config: getToolSchema(supabaseUrl) }),
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

// ── Tool update helper (PATCH existing tool schema) ─────────────────

async function updateSaveAnswerTool(toolId: string, supabaseUrl: string): Promise<void> {
  try {
    const schema = getToolSchema(supabaseUrl);
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/tools/${toolId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool_config: schema }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to update tool ${toolId}:`, errText);
    } else {
      console.log(`Tool ${toolId} schema updated successfully`);
    }
  } catch (e) {
    console.error('Tool update error:', e);
  }
}

// ── Manage KB documents lifecycle ───────────────────────────────────

async function manageKBDocuments(
  role: any,
  supabase: any
): Promise<{ jdDocId: string | null; faqDocId: string | null }> {
  // Delete old KB docs if they exist
  if (role.kb_jd_doc_id) await deleteKBDocument(role.kb_jd_doc_id);
  if (role.kb_faq_doc_id) await deleteKBDocument(role.kb_faq_doc_id);

  // Create new KB documents
  const jdContent = buildJDContent(role);
  const faqContent = buildFAQContent(role.faq || []);

  const jdDocId = jdContent ? await createKBDocument(`JD - ${role.title}`, jdContent) : null;
  const faqDocId = faqContent ? await createKBDocument(`FAQ - ${role.title}`, faqContent) : null;

  // Save IDs back to role
  const updateData: any = {};
  if (jdDocId !== undefined) updateData.kb_jd_doc_id = jdDocId;
  if (faqDocId !== undefined) updateData.kb_faq_doc_id = faqDocId;

  if (Object.keys(updateData).length > 0) {
    await supabase.from('roles').update(updateData).eq('id', role.id);
  }

  return { jdDocId, faqDocId };
}

// ── Slim prompt generator (behavior-only) ───────────────────────────

function generateAgentConfig(role: any, organization: any, kbDocIds: { jdDocId: string | null; faqDocId: string | null }, toolId: string | null) {
  const companyName = role.company_name || organization.name;
  const questions = role.questions || [];
  const evaluationCriteria = role.evaluation_criteria || role.rules || '';

  const screeningQuestions = questions.length > 0
    ? questions.map((q: any, i: number) => {
        let text = `${i + 1}. ${q.text || q}`;
        if (q.type === 'multi_choice' && q.options) text += ` (Options: ${q.options.join(', ')})`;
        if (q.required) text += ' [REQUIRED]';
        return text;
      }).join('\n')
    : 'General discussion about experience and background';

  // Slim prompt — NO JD content, NO FAQs (those are in KB)
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

# Goal

Screen candidates for ${role.title} through a structured interview:

1. Confirm identity and availability. Set expectation: 10-15 minutes.
2. Ask each screening question below, listen carefully, and record the answer using the save_screening_answer tool.
3. Answer any questions the candidate has (use knowledge base).
4. Thank them and explain next steps.

SCREENING QUESTIONS:
${screeningQuestions}

EVALUATION CRITERIA:
${evaluationCriteria || 'Assess general fit for the role'}

After each question is answered, call the save_screening_answer tool with the question index, text, candidate answer, and quality assessment.

# Guardrails

- Do not make hiring decisions during the call.
- Never share other candidates' information.
- If asked about salary details beyond what's provided, indicate it will be discussed later.
- Keep professional tone even if candidates express frustration.
- Do not reveal you are AI unless directly asked.`;

  const firstMessage = `Hello! This is a screening call from ${companyName} for the ${role.title} position. Is this a good time to talk for about 10-15 minutes?`;

  // Build knowledge_base array (must be KnowledgeBaseLocator objects)
  const knowledgeBase: any[] = [];
  if (kbDocIds.jdDocId) knowledgeBase.push({ type: 'text', name: `JD - ${role.title}`, id: kbDocIds.jdDocId });
  if (kbDocIds.faqDocId) knowledgeBase.push({ type: 'text', name: `FAQ - ${role.title}`, id: kbDocIds.faqDocId });

  // Build tool_ids array
  const toolIds: string[] = [];
  if (toolId) {
    toolIds.push(toolId);
  }

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
      },
      conversation: {
        max_duration_seconds: 1800,
      },
    },
    platform_settings: {
      max_duration: 1800,
    },
    tags: [
      `org-${organization.id}`,
      `role-${role.id}`,
      'screening-agent',
      organization.country || 'IN',
    ],
  };

  // Extract keywords for ASR
  const keywords = extractKeywords(role);
  if (keywords.length > 0) {
    config.conversation_config.asr = {
      quality: "high",
      keywords: keywords,
    };
  }

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

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const action = pathSegments[pathSegments.length - 1];

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (authError || !authData.user) {
      throw new Error('Unauthorized');
    }

    const userId = authData.user.id;

    switch (action) {
      case 'create': {
        const { roleId } = await req.json();
        console.log(`Creating agent for role ${roleId}`);

        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('*, organization:organizations(*)')
          .eq('id', roleId)
          .single();

        if (roleError || !role) throw new Error('Role not found');

        // Verify access
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', role.organization_id)
          .single();

        if (memberError || !membership) throw new Error('Unauthorized: User not member of organization');

        // 1. Create KB documents
        const kbDocIds = await manageKBDocuments(role, supabase);
        console.log('KB docs created:', kbDocIds);

        // 2. Ensure save_answer tool exists and schema is up to date
        let toolId = role.tool_save_answer_id;
        if (toolId) {
          await updateSaveAnswerTool(toolId, SUPABASE_URL);
        } else {
          toolId = await ensureSaveAnswerTool(SUPABASE_URL);
          if (toolId) {
            await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', roleId);
          }
        }

        // 3. Generate config with KB + tool references
        const agentConfig = generateAgentConfig(role, role.organization, kbDocIds, toolId);

        // 4. Create agent in ElevenLabs
        const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentConfig),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('ElevenLabs API error:', errorText);
          throw new Error('Failed to create agent in ElevenLabs');
        }

        const agentData = await createResponse.json();
        console.log('Agent created:', agentData.agent_id);

        await supabase.from('roles').update({
          voice_agent_id: agentData.agent_id,
          agent_created_at: new Date().toISOString(),
          agent_sync_status: 'synced',
          agent_error_message: null,
        }).eq('id', roleId);

        return new Response(
          JSON.stringify({ success: true, agentId: agentData.agent_id, message: 'Agent created successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { roleId } = await req.json();
        console.log(`Updating agent for role ${roleId}`);

        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('*, organization:organizations(*)')
          .eq('id', roleId)
          .single();

        if (roleError || !role || !role.voice_agent_id) throw new Error('Role or agent not found');

        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', role.organization_id)
          .single();

        if (memberError || !membership) throw new Error('Unauthorized');

        // 1. Refresh KB documents
        const kbDocIds = await manageKBDocuments(role, supabase);

        // 2. Ensure tool and update schema
        let toolId = role.tool_save_answer_id;
        if (toolId) {
          await updateSaveAnswerTool(toolId, SUPABASE_URL);
        } else {
          toolId = await ensureSaveAnswerTool(SUPABASE_URL);
          if (toolId) {
            await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', roleId);
          }
        }

        // 3. Generate updated config
        const agentConfig = generateAgentConfig(role, role.organization, kbDocIds, toolId);

        const updateResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${role.voice_agent_id}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentConfig),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('ElevenLabs API error:', errorText);
          throw new Error('Failed to update agent in ElevenLabs');
        }

        await supabase.from('roles').update({
          agent_sync_status: 'synced',
          agent_error_message: null,
        }).eq('id', roleId);

        return new Response(
          JSON.stringify({ success: true, message: 'Agent updated successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'archive': {
        const { roleId, reason } = await req.json();
        console.log(`Archiving agent for role ${roleId}`);

        const { data: role, error: roleError } = await supabase
          .from('roles').select('*').eq('id', roleId).single();

        if (roleError || !role || !role.voice_agent_id) throw new Error('Role or agent not found');

        const { data: membership, error: memberError } = await supabase
          .from('organization_members').select('*')
          .eq('user_id', userId).eq('organization_id', role.organization_id).single();

        if (memberError || !membership) throw new Error('Unauthorized');

        // Clean up KB docs
        if (role.kb_jd_doc_id) await deleteKBDocument(role.kb_jd_doc_id);
        if (role.kb_faq_doc_id) await deleteKBDocument(role.kb_faq_doc_id);

        await supabase.from('agent_archive_log').insert({
          role_id: roleId,
          agent_id: role.voice_agent_id,
          reason: reason || 'Manually archived',
          organization_id: role.organization_id,
        });

        await supabase.from('roles').update({
          agent_sync_status: 'archived',
          voice_agent_id: null,
          kb_jd_doc_id: null,
          kb_faq_doc_id: null,
        }).eq('id', roleId);

        return new Response(
          JSON.stringify({ success: true, message: 'Agent archived successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cleanup': {
        console.log('Running agent cleanup job');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: staleRoles, error: fetchError } = await supabase
          .from('roles').select('*')
          .not('voice_agent_id', 'is', null)
          .not('agent_sync_status', 'eq', 'archived')
          .or(`agent_last_used_at.is.null,agent_last_used_at.lt.${sevenDaysAgo.toISOString()}`);

        if (fetchError) throw new Error('Failed to fetch stale roles');

        const errors: any[] = [];

        for (const role of staleRoles || []) {
          try {
            if (role.kb_jd_doc_id) await deleteKBDocument(role.kb_jd_doc_id);
            if (role.kb_faq_doc_id) await deleteKBDocument(role.kb_faq_doc_id);

            await supabase.from('agent_archive_log').insert({
              role_id: role.id,
              agent_id: role.voice_agent_id,
              reason: 'Inactive for 7+ days',
              organization_id: role.organization_id,
            });

            await supabase.from('roles').update({
              agent_sync_status: 'archived',
              voice_agent_id: null,
              kb_jd_doc_id: null,
              kb_faq_doc_id: null,
            }).eq('id', role.id);

            console.log(`Archived agent for role ${role.id}`);
          } catch (error: any) {
            console.error(`Failed to archive role ${role.id}:`, error);
            errors.push({ roleId: role.id, error: error.message });
          }
        }

        return new Response(
          JSON.stringify({ success: true, archivedCount: staleRoles?.length || 0, errors }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in agent-manager:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
