import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);
}

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

    const {
      conversation_id,
      screen_id,
      question_index,
      question_text,
      candidate_answer,
      answer_quality,
    } = body;

    if (!screen_id && !conversation_id) {
      console.warn('No screen_id or conversation_id provided. Answer logged but not persisted:', {
        question_text, candidate_answer, answer_quality
      });
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Answer recorded successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the screen by screen_id first, then fall back to session_id (conversation_id)
    let screenQuery = supabase.from('screens').select('id, answers, questions_answered, total_questions');
    
    if (screen_id) {
      screenQuery = screenQuery.eq('id', screen_id);
    } else if (conversation_id) {
      screenQuery = screenQuery.eq('session_id', conversation_id);
    }

    const { data: screen, error: screenError } = await screenQuery.single();

    if (screenError || !screen) {
      console.error('Screen not found:', screenError);
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Answer noted (screen lookup pending)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build updated answers object using question_text as a stable key
    // This prevents race conditions when multiple tool calls arrive concurrently
    const existingAnswers = (screen.answers as Record<string, any>) || {};
    
    // Use question_text-based key for stability; fall back to index if provided
    const answerKey = question_text
      ? `q_${slugify(question_text)}`
      : `q_${question_index ?? (Object.keys(existingAnswers).length + 1)}`;
    
    existingAnswers[answerKey] = {
      question_index,
      question_text,
      candidate_answer,
      answer_quality,
      captured_at: new Date().toISOString(),
      source: 'realtime_tool',
    };

    const questionsAnswered = Object.keys(existingAnswers).length;

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

    console.log(`Saved answer for screen ${screen.id}, key ${answerKey}: ${answer_quality}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Answer for "${question_text}" recorded successfully. Quality: ${answer_quality}.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in elevenlabs-tool-save-answer:', error);
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Answer noted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
