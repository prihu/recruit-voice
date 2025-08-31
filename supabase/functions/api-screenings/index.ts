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
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const action = pathSegments[1]

    switch (req.method) {
      case 'GET':
        if (action === 'status') {
          // Get screening status with detailed analytics
          const screeningId = url.searchParams.get('id')
          
          if (screeningId) {
            // Get specific screening status
            const { data, error } = await supabaseClient
              .from('screens')
              .select(`
                *,
                candidates (*),
                roles (*)
              `)
              .eq('id', screeningId)
              .eq('organization_id', orgMember.organization_id)
              .single()

            if (error) throw error
            return new Response(JSON.stringify(data), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } else {
            // Get all screenings with analytics
            const { data, error } = await supabaseClient
              .from('screens')
              .select(`
                *,
                candidates (name, phone, email),
                roles (title)
              `)
              .eq('organization_id', orgMember.organization_id)
              .order('created_at', { ascending: false })

            if (error) throw error
            
            // Calculate analytics
            const analytics = {
              total: data.length,
              pending: data.filter(s => s.status === 'pending').length,
              scheduled: data.filter(s => s.status === 'scheduled').length,
              in_progress: data.filter(s => s.status === 'in_progress').length,
              completed: data.filter(s => s.status === 'completed').length,
              failed: data.filter(s => s.status === 'failed').length,
              incomplete: data.filter(s => s.status === 'incomplete').length,
              passed: data.filter(s => s.outcome === 'pass').length,
              rejected: data.filter(s => s.outcome === 'fail').length,
              partial_responses: data.filter(s => 
                s.response_completeness > 0 && s.response_completeness < 100
              ).length,
              full_responses: data.filter(s => s.response_completeness === 100).length,
              no_responses: data.filter(s => s.response_completeness === 0).length
            }

            return new Response(JSON.stringify({ screenings: data, analytics }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }
        break

      case 'POST':
        if (action === 'initiate') {
          // Initiate screening calls (single or bulk)
          const { roleId, candidateIds, scheduledTime } = await req.json()
          
          if (!roleId || !candidateIds || candidateIds.length === 0) {
            throw new Error('Role ID and at least one candidate ID required')
          }

          // Get role details
          const { data: role, error: roleError } = await supabaseClient
            .from('roles')
            .select('*')
            .eq('id', roleId)
            .eq('organization_id', orgMember.organization_id)
            .single()

          if (roleError || !role) throw new Error('Role not found')
          if (!role.voice_agent_id) throw new Error('Voice agent not configured for this role')

          // Create screening records
          const screenings = candidateIds.map((candidateId: string) => ({
            role_id: roleId,
            candidate_id: candidateId,
            organization_id: orgMember.organization_id,
            user_id: user.id,
            status: scheduledTime ? 'scheduled' : 'pending',
            scheduled_at: scheduledTime || null,
            total_questions: role.questions?.length || 0
          }))

          const { data: createdScreens, error: screenError } = await supabaseClient
            .from('screens')
            .insert(screenings)
            .select()

          if (screenError) throw screenError

          // If immediate execution (no scheduled time), trigger calls
          if (!scheduledTime) {
            // Create scheduled call records for immediate execution
            const scheduledCalls = createdScreens.map(screen => ({
              screen_id: screen.id,
              organization_id: orgMember.organization_id,
              scheduled_time: new Date().toISOString(),
              status: 'pending'
            }))

            await supabaseClient
              .from('scheduled_calls')
              .insert(scheduledCalls)

            // Trigger the edge function to process calls
            await supabaseClient.functions.invoke('process-scheduled-calls')
          } else {
            // Create scheduled call records for future execution
            const scheduledCalls = createdScreens.map(screen => ({
              screen_id: screen.id,
              organization_id: orgMember.organization_id,
              scheduled_time: scheduledTime,
              status: 'pending'
            }))

            await supabaseClient
              .from('scheduled_calls')
              .insert(scheduledCalls)
          }

          return new Response(JSON.stringify({ 
            success: true,
            initiated: createdScreens.length,
            screenings: createdScreens
          }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: corsHeaders
        })
    }
  } catch (error) {
    console.error('Error in api-screenings:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})