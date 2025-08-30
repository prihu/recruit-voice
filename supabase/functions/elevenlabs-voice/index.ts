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

    // Handle different endpoints
    switch (endpoint) {
      case 'get-signed-url': {
        const { screenId, agentId } = await req.json();
        
        console.log('Getting signed URL for agent:', agentId, 'screen:', screenId);

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
        console.log('Successfully got signed URL');

        // Update the screen record with conversation ID
        await supabase
          .from('screens')
          .update({ 
            status: 'scheduled',
            scheduledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .eq('id', screenId);

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