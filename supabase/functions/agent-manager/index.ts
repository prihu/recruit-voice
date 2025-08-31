import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
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

        // Fetch role data with organization info
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select(`
            *,
            organization:organizations(*)
          `)
          .eq('id', roleId)
          .single();

        if (roleError || !role) {
          throw new Error('Role not found');
        }

        // Verify user has access to this role
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', role.organization_id)
          .single();

        if (memberError || !membership) {
          throw new Error('Unauthorized: User not member of organization');
        }

        // Generate comprehensive agent configuration
        const agentConfig = generateAgentConfig(role, role.organization);

        // Create agent in ElevenLabs
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
        console.log('Agent created successfully:', agentData.agent_id);

        // Update role with agent ID and status
        const { error: updateError } = await supabase
          .from('roles')
          .update({
            voice_agent_id: agentData.agent_id,
            agent_created_at: new Date().toISOString(),
            agent_sync_status: 'synced',
            agent_error_message: null,
          })
          .eq('id', roleId);

        if (updateError) {
          console.error('Failed to update role:', updateError);
          throw new Error('Failed to update role with agent ID');
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            agentId: agentData.agent_id,
            message: 'Agent created successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { roleId } = await req.json();
        console.log(`Updating agent for role ${roleId}`);

        // Fetch role data with organization info
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select(`
            *,
            organization:organizations(*)
          `)
          .eq('id', roleId)
          .single();

        if (roleError || !role || !role.voice_agent_id) {
          throw new Error('Role or agent not found');
        }

        // Verify user has access
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', role.organization_id)
          .single();

        if (memberError || !membership) {
          throw new Error('Unauthorized');
        }

        // Generate updated configuration
        const agentConfig = generateAgentConfig(role, role.organization);

        // Update agent in ElevenLabs
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

        // Update sync status
        const { error: updateError } = await supabase
          .from('roles')
          .update({
            agent_sync_status: 'synced',
            agent_error_message: null,
          })
          .eq('id', roleId);

        if (updateError) {
          console.error('Failed to update role sync status:', updateError);
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Agent updated successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'archive': {
        const { roleId, reason } = await req.json();
        console.log(`Archiving agent for role ${roleId}`);

        // Fetch role data
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('*')
          .eq('id', roleId)
          .single();

        if (roleError || !role || !role.voice_agent_id) {
          throw new Error('Role or agent not found');
        }

        // Verify user has access
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', role.organization_id)
          .single();

        if (memberError || !membership) {
          throw new Error('Unauthorized');
        }

        // Log the archival
        const { error: logError } = await supabase
          .from('agent_archive_log')
          .insert({
            role_id: roleId,
            agent_id: role.voice_agent_id,
            reason: reason || 'Manually archived',
            organization_id: role.organization_id,
          });

        if (logError) {
          console.error('Failed to log archival:', logError);
        }

        // Update role status
        const { error: updateError } = await supabase
          .from('roles')
          .update({
            agent_sync_status: 'archived',
            voice_agent_id: null, // Clear the agent ID
          })
          .eq('id', roleId);

        if (updateError) {
          console.error('Failed to update role:', updateError);
          throw new Error('Failed to archive agent');
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Agent archived successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cleanup': {
        console.log('Running agent cleanup job');

        // Find agents not used in 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: staleRoles, error: fetchError } = await supabase
          .from('roles')
          .select('*')
          .not('voice_agent_id', 'is', null)
          .not('agent_sync_status', 'eq', 'archived')
          .or(`agent_last_used_at.is.null,agent_last_used_at.lt.${sevenDaysAgo.toISOString()}`);

        if (fetchError) {
          console.error('Failed to fetch stale roles:', fetchError);
          throw new Error('Failed to fetch stale roles');
        }

        const archivedCount = 0;
        const errors = [];

        for (const role of staleRoles || []) {
          try {
            // Log the archival
            await supabase
              .from('agent_archive_log')
              .insert({
                role_id: role.id,
                agent_id: role.voice_agent_id,
                reason: 'Inactive for 7+ days',
                organization_id: role.organization_id,
              });

            // Archive the agent
            await supabase
              .from('roles')
              .update({
                agent_sync_status: 'archived',
                voice_agent_id: null,
              })
              .eq('id', role.id);

            console.log(`Archived agent for role ${role.id}`);
          } catch (error) {
            console.error(`Failed to archive agent for role ${role.id}:`, error);
            errors.push({ roleId: role.id, error: error.message });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            archivedCount: staleRoles?.length || 0,
            errors
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in agent-manager:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'There is a problem in ElevenLabs, please contact support'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
        quality: "high",
        provider: "elevenlabs",
        user_input_audio_format: "pcm_16000",
        keywords: keywords
      },
      tts: {
        voice_id: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female voice
        model_id: "eleven_turbo_v2_5",
      },
      llm: {
        model: "gpt-4o",
        prompt: {
          prompt: prompt
        },
        first_message: firstMessage,
        temperature: 0.7,
        max_tokens: 150
      },
      turn: {
        turn_timeout: 10,
        mode: "silence_detection",
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