import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const endpoint = pathSegments[pathSegments.length - 1];

    console.log('ElevenLabs Voice Function - Full path:', url.pathname, 'Endpoint:', endpoint);
    
    const apiKey = ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Handle different endpoints
    switch (endpoint) {
      case 'test-connection': {
        try {
          // Simple test to verify API key works
          const testResponse = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: {
              'xi-api-key': apiKey,
            },
          });

          if (!testResponse.ok) {
            throw new Error('Invalid API key or connection failed');
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Connection test failed:', error);
          return new Response(JSON.stringify({ 
            error: 'Connection test failed',
            message: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      case 'get-signed-url': {
        const { screenId, agentId, candidateId, metadata } = await req.json();
        
        console.log('Getting signed URL for agent:', agentId, 'screen:', screenId);
        
        // Validate required parameters
        if (!agentId || !screenId) {
          console.error('Missing required parameters:', { agentId, screenId });
          return new Response(
            JSON.stringify({ 
              error: 'Missing required parameters: agentId and screenId' 
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Get the signed URL from ElevenLabs
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
          {
            method: 'GET',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('ElevenLabs API error:', error);
          throw new Error(`Failed to get signed URL: ${error}`);
        }

        const data = await response.json();
        console.log('Successfully got signed URL, conversation ID:', data.conversation_id);

        // Update the screen record with conversation ID from ElevenLabs
        if (data.conversation_id) {
          const updateResult = await supabase
            .from('screens')
            .update({ 
              status: 'scheduled',
              conversation_id: data.conversation_id,
              scheduled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', screenId);
          
          if (updateResult.error) {
            console.error('Failed to update screen with conversation ID:', updateResult.error);
          } else {
            console.log('Updated screen with ElevenLabs conversation ID:', data.conversation_id);
          }
        }

        return new Response(
          JSON.stringify({ 
            signedUrl: data.signed_url,
            conversationId: data.conversation_id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save-transcript': {
        const { screenId, transcript, answers, outcome, score, reasons } = await req.json();
        
        console.log('Saving transcript for screen:', screenId);

        // Update the screen with results
        const { error } = await supabase
          .from('screens')
          .update({
            transcript,
            answers,
            outcome,
            score,
            reasons,
            status: 'completed',
            updatedAt: new Date().toISOString()
          })
          .eq('id', screenId);

        if (error) {
          console.error('Error saving transcript:', error);
          throw error;
        }

        console.log('Transcript saved successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-conversation-status': {
        const { conversationId } = await req.json();
        
        console.log('Getting conversation status for:', conversationId);

        // Get conversation details from ElevenLabs
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
          {
            method: 'GET',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('ElevenLabs API error:', error);
          throw new Error(`Failed to get conversation status: ${error}`);
        }

        const data = await response.json();
        console.log('Conversation status retrieved');

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'initiate-phone-call': {
        const { screenId, phoneNumber, agentId, candidateName } = await req.json();
        
        console.log('Initiating phone call to:', phoneNumber, 'for screen:', screenId);
        
        // Validate required parameters
        if (!phoneNumber || !agentId || !screenId) {
          console.error('Missing required parameters for phone call:', { phoneNumber, agentId, screenId });
          return new Response(
            JSON.stringify({ 
              error: 'Missing required parameters: phoneNumber, agentId, and screenId' 
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Update screen status to in_progress
        await supabase
          .from('screens')
          .update({ 
            status: 'in_progress',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', screenId);

        // Initiate phone call via ElevenLabs
        const response = await fetch(
          'https://api.elevenlabs.io/v1/convai/conversations/phone-call',
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agentId,
              customer: {
                number: phoneNumber,
                name: candidateName,
              },
              webhook_url: `${SUPABASE_URL}/functions/v1/elevenlabs-voice/phone-webhook`,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('ElevenLabs phone call API error:', error);
          
          // Update screen status to failed
          await supabase
            .from('screens')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', screenId);
            
          throw new Error(`Failed to initiate phone call: ${error}`);
        }

        const data = await response.json();
        console.log('Phone call initiated successfully:', data);

        // Store the phone conversation ID - use conversation_id field consistently
        const updateResult = await supabase
          .from('screens')
          .update({ 
            conversation_id: data.conversation_id,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', screenId);
        
        if (updateResult.error) {
          console.error('Failed to update screen with phone conversation ID:', updateResult.error);
        } else {
          console.log('Updated screen with phone conversation ID:', data.conversation_id);
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            conversationId: data.conversation_id,
            callId: data.call_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'phone-webhook': {
        const webhookData = await req.json();
        
        console.log('Received phone webhook:', webhookData);

        // Handle different webhook events
        if (webhookData.type === 'call.completed') {
          const { conversation_id, duration, recording_url, transcript } = webhookData;
          
          // Update screen with call results - use conversation_id field consistently
          const updateResult = await supabase
            .from('screens')
            .update({
              status: 'completed',
              duration_seconds: duration,
              recording_url: recording_url,
              transcript: transcript,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('conversation_id', conversation_id);
          
          if (updateResult.error) {
            console.error('Failed to update screen on call completion:', updateResult.error);
          }
            
          console.log('Call completed, screen updated');
        } else if (webhookData.type === 'call.failed') {
          const { conversation_id, error_message } = webhookData;
          
          const updateResult = await supabase
            .from('screens')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('conversation_id', conversation_id);
          
          if (updateResult.error) {
            console.error('Failed to update screen on call failure:', updateResult.error);
          }
            
          console.log('Call failed:', error_message);
        }

        return new Response(
          JSON.stringify({ received: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schedule-call': {
        const { screenId, scheduledTime } = await req.json();
        
        console.log('Scheduling call for screen:', screenId, 'at:', scheduledTime);

        // Create scheduled call record
        const { error } = await supabase
          .from('scheduled_calls')
          .insert({
            screen_id: screenId,
            scheduled_time: scheduledTime,
            status: 'pending',
            organization_id: (await supabase
              .from('screens')
              .select('organization_id')
              .eq('id', screenId)
              .single()).data?.organization_id
          });

        if (error) {
          console.error('Error scheduling call:', error);
          throw error;
        }

        // Update screen status
        await supabase
          .from('screens')
          .update({ 
            status: 'scheduled',
            scheduled_at: scheduledTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', screenId);

        console.log('Call scheduled successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in elevenlabs-voice function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});