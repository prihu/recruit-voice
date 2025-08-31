import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get organization ID for the user
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgMember) {
      throw new Error('User not associated with any organization')
    }

    const url = new URL(req.url)
    const { searchParams } = url
    
    // Date range filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const roleId = searchParams.get('roleId')
    
    // Build query
    let query = supabaseClient
      .from('screens')
      .select(`
        *,
        candidates (name, phone, email, skills, location_pref, preferred_language),
        roles (title, location)
      `)
      .eq('organization_id', orgMember.organization_id)

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (roleId) {
      query = query.eq('role_id', roleId)
    }

    const { data: screens, error } = await query

    if (error) throw error

    // Calculate comprehensive analytics
    const analytics = {
      summary: {
        total_screenings: screens.length,
        total_candidates: new Set(screens.map(s => s.candidate_id)).size,
        total_roles: new Set(screens.map(s => s.role_id)).size
      },
      by_status: {
        pending: screens.filter(s => s.status === 'pending').length,
        scheduled: screens.filter(s => s.status === 'scheduled').length,
        in_progress: screens.filter(s => s.status === 'in_progress').length,
        completed: screens.filter(s => s.status === 'completed').length,
        failed: screens.filter(s => s.status === 'failed').length,
        incomplete: screens.filter(s => s.status === 'incomplete').length
      },
      by_outcome: {
        passed: screens.filter(s => s.outcome === 'pass').length,
        failed: screens.filter(s => s.outcome === 'fail').length,
        incomplete: screens.filter(s => s.outcome === 'incomplete').length,
        pending_evaluation: screens.filter(s => !s.outcome && s.status === 'completed').length
      },
      response_quality: {
        full_responses: screens.filter(s => s.response_completeness === 100).length,
        partial_responses: screens.filter(s => 
          s.response_completeness > 0 && s.response_completeness < 100
        ).length,
        no_responses: screens.filter(s => 
          s.response_completeness === 0 && s.status === 'completed'
        ).length
      },
      performance_metrics: {
        avg_score: screens
          .filter(s => s.score !== null)
          .reduce((acc, s) => acc + Number(s.score), 0) / 
          screens.filter(s => s.score !== null).length || 0,
        avg_duration_seconds: screens
          .filter(s => s.duration_seconds !== null)
          .reduce((acc, s) => acc + s.duration_seconds, 0) / 
          screens.filter(s => s.duration_seconds !== null).length || 0,
        avg_attempts: screens
          .reduce((acc, s) => acc + (s.attempts || 0), 0) / screens.length || 0
      },
      by_language: screens.reduce((acc, s) => {
        const lang = s.candidates?.preferred_language || 'English'
        acc[lang] = (acc[lang] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      by_location: screens.reduce((acc, s) => {
        const loc = s.candidates?.location_pref || 'Not specified'
        acc[loc] = (acc[loc] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      top_rejection_reasons: screens
        .filter(s => s.reasons && s.reasons.length > 0)
        .flatMap(s => s.reasons)
        .reduce((acc, reason) => {
          acc[reason] = (acc[reason] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      timeline: {
        today: screens.filter(s => {
          const created = new Date(s.created_at)
          const today = new Date()
          return created.toDateString() === today.toDateString()
        }).length,
        this_week: screens.filter(s => {
          const created = new Date(s.created_at)
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return created >= weekAgo
        }).length,
        this_month: screens.filter(s => {
          const created = new Date(s.created_at)
          const monthAgo = new Date()
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          return created >= monthAgo
        }).length
      }
    }

    return new Response(JSON.stringify({ 
      analytics,
      screens: searchParams.get('includeDetails') === 'true' ? screens : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in api-analytics:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})