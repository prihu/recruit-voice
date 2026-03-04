import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    console.log('Received save-answer tool call:', JSON.stringify(body));

    // ElevenLabs server tools send data in a specific format
    // The tool parameters are passed directly
    const {
      conversation_id,
      screen_id,
      question_index,
      question_text,
      candidate_answer,
      answer_quality, // "good" | "partial" | "poor" | "skipped"
    } = body;

    if (!screen_id && !conversation_id) {
      return new Response(JSON.stringify({ 
        error: 'screen_id or conversation_id is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Find the screen by session_id (conversation_id) or screen_id
    let screenQuery = supabase.from('screens').select('id, answers, questions_answered, total_questions');
    
    if (screen_id) {
      screenQuery = screenQuery.eq('id', screen_id);
    } else if (conversation_id) {
      screenQuery = screenQuery.eq('session_id', conversation_id);
    }

    const { data: screen, error: screenError } = await screenQuery.single();

    if (screenError || !screen) {
      console.error('Screen not found:', screenError);
      // Return success to ElevenLabs even if we can't find the screen
      // to avoid breaking the conversation flow
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Answer noted (screen lookup pending)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build updated answers object
    const existingAnswers = (screen.answers as Record<string, any>) || {};
    const effectiveIndex = question_index ?? (Object.keys(existingAnswers).length + 1);
    const answerKey = `q_${effectiveIndex}`;
    
    existingAnswers[answerKey] = {
      question_index,
      question_text,
      candidate_answer,
      answer_quality,
      captured_at: new Date().toISOString(),
      source: 'realtime_tool', // Distinguish from post-call extraction
    };

    const questionsAnswered = Object.keys(existingAnswers).length;

    // Update the screen with the new answer
    const { error: updateError } = await supabase
      .from('screens')
      .update({
        answers: existingAnswers,
        questions_answered: questionsAnswered,
        candidate_responded: true,
      })
      .eq('id', screen.id);

    if (updateError) {
      console.error('Failed to update screen answers:', updateError);
    }

    console.log(`Saved answer for screen ${screen.id}, question ${question_index}: ${answer_quality}`);

    // Return success - ElevenLabs expects a response the agent can use
    return new Response(JSON.stringify({ 
      success: true,
      message: `Answer for question ${question_index} recorded successfully. Quality: ${answer_quality}.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in elevenlabs-tool-save-answer:', error);
    // Always return 200 to ElevenLabs to avoid breaking the conversation
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Answer noted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
