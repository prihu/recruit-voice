import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StructuredScreeningData {
  // Candidate Basic Info
  candidate_name: string;
  candidate_phone: string;
  candidate_email: string | null;
  
  // Professional Profile (extracted from transcript)
  current_role: string | null;
  total_experience_years: number | null;
  relevant_experience_years: number | null;
  skills_primary: string[];
  skills_secondary: string[];
  education_level: string | null;
  education_details: string | null;
  
  // Location & Availability
  current_location: string | null;
  preferred_locations: string[];
  relocation_willing: boolean;
  notice_period_days: number | null;
  available_from: string | null;
  
  // Compensation
  current_salary: number | null;
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  salary_currency: string;
  
  // Screening Results
  screening_score: number;
  screening_outcome: 'pass' | 'fail' | 'maybe' | 'incomplete' | null;
  strengths: string[];
  areas_of_concern: string[];
  rejection_reasons: string[];
  
  // Technical Assessment (from Q&A)
  technical_skills_score: number | null;
  communication_score: number | null;
  cultural_fit_score: number | null;
  
  // Call Metadata
  call_duration_minutes: number | null;
  questions_asked: number;
  questions_answered: number;
  response_completeness: number;
  response_quality: 'excellent' | 'good' | 'average' | 'poor' | null;
  language_used: string;
  
  // AI Insights
  ai_summary: string | null;
  ai_recommendation: string | null;
  suggested_next_steps: string[];
  red_flags: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenId } = await req.json();
    
    if (!screenId) {
      throw new Error('Screen ID is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch screen data
    const { data: screen, error: screenError } = await supabase
      .from('screens')
      .select(`
        *,
        candidate:candidates(*),
        role:roles(*)
      `)
      .eq('id', screenId)
      .single();

    if (screenError || !screen) {
      throw new Error('Screen not found');
    }

    // Extract and structure data from the screen
    const structuredData: StructuredScreeningData = extractDataFromScreen(screen);

    // Update the screen with extracted data
    const { error: updateError } = await supabase
      .from('screens')
      .update({ extracted_data: structuredData })
      .eq('id', screenId);

    if (updateError) {
      throw updateError;
    }

    // Also update candidate profile with extracted information if needed
    if (screen.candidate_id && screen.transcript && screen.transcript.length > 0) {
      await updateCandidateProfile(supabase, screen.candidate_id, structuredData);
    }

    return new Response(
      JSON.stringify({ success: true, data: structuredData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function extractDataFromScreen(screen: any): StructuredScreeningData {
  const candidate = screen.candidate || {};
  const role = screen.role || {};
  const answers = screen.answers || {};
  const transcript = screen.transcript || [];
  
  // Parse transcript to extract additional information
  const transcriptAnalysis = analyzeTranscript(transcript);
  
  // Calculate response quality based on completeness and transcript
  const responseQuality = calculateResponseQuality(screen);
  
  return {
    // Candidate Basic Info
    candidate_name: candidate.name || 'Unknown',
    candidate_phone: candidate.phone || 'Unknown',
    candidate_email: candidate.email || null,
    
    // Professional Profile
    current_role: extractFromAnswers(answers, 'current_role') || transcriptAnalysis.current_role,
    total_experience_years: parseExperience(answers.experience) || candidate.exp_years,
    relevant_experience_years: parseExperience(answers.relevant_experience),
    skills_primary: extractSkills(answers.skills, candidate.skills, true),
    skills_secondary: extractSkills(answers.skills, candidate.skills, false),
    education_level: extractFromAnswers(answers, 'education_level'),
    education_details: extractFromAnswers(answers, 'education_details'),
    
    // Location & Availability
    current_location: answers.current_location || candidate.location_pref,
    preferred_locations: parseLocations(answers.preferred_locations || candidate.location_pref),
    relocation_willing: parseBoolean(answers.relocation_willing),
    notice_period_days: parseNotice(answers.notice_period),
    available_from: answers.available_from || null,
    
    // Compensation
    current_salary: parseNumber(answers.current_salary),
    expected_salary_min: parseNumber(answers.expected_salary_min) || candidate.salary_expectation,
    expected_salary_max: parseNumber(answers.expected_salary_max) || (candidate.salary_expectation ? candidate.salary_expectation * 1.2 : null),
    salary_currency: role.salary_currency || 'INR',
    
    // Screening Results
    screening_score: screen.score || 0,
    screening_outcome: screen.outcome,
    strengths: parseStrengths(screen.ai_recommendations),
    areas_of_concern: parseConcerns(screen.ai_recommendations),
    rejection_reasons: screen.reasons || [],
    
    // Technical Assessment
    technical_skills_score: calculateTechnicalScore(answers, role.questions),
    communication_score: transcriptAnalysis.communication_score,
    cultural_fit_score: calculateCulturalFit(answers, role.questions),
    
    // Call Metadata
    call_duration_minutes: screen.duration_seconds ? Math.round(screen.duration_seconds / 60) : null,
    questions_asked: screen.total_questions || 0,
    questions_answered: screen.questions_answered || 0,
    response_completeness: screen.response_completeness || 0,
    response_quality: responseQuality,
    language_used: candidate.preferred_language || 'English',
    
    // AI Insights
    ai_summary: screen.ai_summary,
    ai_recommendation: extractRecommendation(screen.ai_recommendations),
    suggested_next_steps: extractNextSteps(screen.ai_recommendations),
    red_flags: extractRedFlags(screen.ai_recommendations, screen.reasons)
  };
}

function analyzeTranscript(transcript: any[]): any {
  // Basic transcript analysis
  const analysis = {
    current_role: null,
    communication_score: null
  };
  
  if (!transcript || transcript.length === 0) {
    return analysis;
  }
  
  // Calculate communication score based on response length and clarity
  const candidateResponses = transcript.filter(t => t.speaker === 'candidate');
  if (candidateResponses.length > 0) {
    const avgResponseLength = candidateResponses.reduce((acc, r) => acc + (r.text?.length || 0), 0) / candidateResponses.length;
    analysis.communication_score = Math.min(100, Math.round((avgResponseLength / 100) * 100));
  }
  
  return analysis;
}

function calculateResponseQuality(screen: any): 'excellent' | 'good' | 'average' | 'poor' | null {
  if (!screen.response_completeness) return null;
  
  if (screen.response_completeness >= 90) return 'excellent';
  if (screen.response_completeness >= 70) return 'good';
  if (screen.response_completeness >= 50) return 'average';
  return 'poor';
}

function extractFromAnswers(answers: any, key: string): any {
  return answers[key] || null;
}

function parseExperience(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }
  return null;
}

function extractSkills(answersSkills: any, candidateSkills: any, primary: boolean): string[] {
  const skills: string[] = [];
  
  if (Array.isArray(candidateSkills)) {
    skills.push(...candidateSkills);
  }
  
  if (typeof answersSkills === 'string') {
    skills.push(...answersSkills.split(',').map((s: string) => s.trim()));
  }
  
  if (Array.isArray(answersSkills)) {
    skills.push(...answersSkills);
  }
  
  const uniqueSkills = [...new Set(skills)];
  return primary ? uniqueSkills.slice(0, 5) : uniqueSkills.slice(5, 10);
}

function parseLocations(locations: any): string[] {
  if (Array.isArray(locations)) return locations;
  if (typeof locations === 'string') {
    return locations.split(',').map(l => l.trim());
  }
  return [];
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  }
  return false;
}

function parseNotice(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }
  return null;
}

function parseNumber(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    return cleaned ? parseFloat(cleaned) : null;
  }
  return null;
}

function parseStrengths(recommendations: any): string[] {
  if (!recommendations) return [];
  if (recommendations.strengths) return recommendations.strengths;
  return [];
}

function parseConcerns(recommendations: any): string[] {
  if (!recommendations) return [];
  if (recommendations.concerns) return recommendations.concerns;
  return [];
}

function calculateTechnicalScore(answers: any, questions: any[]): number | null {
  if (!questions || questions.length === 0) return null;
  
  let score = 0;
  let technicalQuestions = 0;
  
  questions.forEach(q => {
    if (q.type === 'technical' && answers[q.id]) {
      technicalQuestions++;
      // Simple scoring logic - can be enhanced
      if (answers[q.id] === q.expectedAnswer) {
        score += 100;
      } else if (answers[q.id]) {
        score += 50;
      }
    }
  });
  
  return technicalQuestions > 0 ? Math.round(score / technicalQuestions) : null;
}

function calculateCulturalFit(answers: any, questions: any[]): number | null {
  // Placeholder for cultural fit calculation
  return null;
}

function extractRecommendation(recommendations: any): string | null {
  if (!recommendations) return null;
  if (typeof recommendations === 'string') return recommendations;
  if (recommendations.recommendation) return recommendations.recommendation;
  return null;
}

function extractNextSteps(recommendations: any): string[] {
  if (!recommendations) return [];
  if (Array.isArray(recommendations.next_steps)) return recommendations.next_steps;
  return [];
}

function extractRedFlags(recommendations: any, reasons: string[]): string[] {
  const flags: string[] = [];
  
  if (recommendations?.red_flags) {
    flags.push(...recommendations.red_flags);
  }
  
  if (reasons && reasons.length > 0) {
    flags.push(...reasons);
  }
  
  return [...new Set(flags)];
}

async function updateCandidateProfile(supabase: any, candidateId: string, data: StructuredScreeningData) {
  const updates: any = {};
  
  // Only update fields that were extracted and are not already present
  if (data.total_experience_years) {
    updates.exp_years = data.total_experience_years;
  }
  
  if (data.skills_primary.length > 0) {
    updates.skills = [...data.skills_primary, ...data.skills_secondary];
  }
  
  if (data.current_location) {
    updates.location_pref = data.current_location;
  }
  
  if (data.expected_salary_min) {
    updates.salary_expectation = data.expected_salary_min;
  }
  
  if (Object.keys(updates).length > 0) {
    await supabase
      .from('candidates')
      .update(updates)
      .eq('id', candidateId);
  }
}