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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get organization ID for the user
    const { data: orgMember, error: orgError } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (orgError) {
      console.error('Error fetching organization membership:', orgError)
      throw new Error('Failed to verify organization membership')
    }

    if (!orgMember) {
      return new Response(
        JSON.stringify({ error: 'User not associated with any organization. Please contact support.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const action = pathSegments[1]

    switch (req.method) {
      case 'GET':
        // List candidates with optional filters
        const { searchParams } = url
        const query = supabaseClient
          .from('candidates')
          .select('*')
          .eq('organization_id', orgMember.organization_id)

        if (searchParams.get('skills')) {
          query.contains('skills', searchParams.get('skills')!.split(','))
        }
        if (searchParams.get('location')) {
          query.ilike('location_pref', `%${searchParams.get('location')}%`)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'POST':
        if (action === 'bulk') {
          // Bulk import candidates
          const { candidates } = await req.json()
          
          // Validate Indian phone numbers
          const validatedCandidates = candidates.map((candidate: any) => {
            let phone = candidate.phone.replace(/\D/g, '')
            if (!phone.startsWith('91') && phone.length === 10) {
              phone = '91' + phone
            }
            if (phone.length !== 12 || !phone.startsWith('91')) {
              throw new Error(`Invalid Indian phone number: ${candidate.phone}`)
            }
            
            return {
              ...candidate,
              phone: '+' + phone,
              organization_id: orgMember.organization_id,
              user_id: user.id,
              preferred_language: candidate.preferred_language || 'English'
            }
          })

          const { data, error } = await supabaseClient
            .from('candidates')
            .insert(validatedCandidates)
            .select()

          if (error) throw error
          return new Response(JSON.stringify({ 
            success: true, 
            imported: data.length,
            candidates: data 
          }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // Single candidate
          const body = await req.json()
          
          // Validate Indian phone number
          let phone = body.phone.replace(/\D/g, '')
          if (!phone.startsWith('91') && phone.length === 10) {
            phone = '91' + phone
          }
          if (phone.length !== 12 || !phone.startsWith('91')) {
            throw new Error('Invalid Indian phone number')
          }

          const { data, error } = await supabaseClient
            .from('candidates')
            .insert({
              ...body,
              phone: '+' + phone,
              organization_id: orgMember.organization_id,
              user_id: user.id,
              preferred_language: body.preferred_language || 'English'
            })
            .select()
            .single()

          if (error) throw error
          return new Response(JSON.stringify(data), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: corsHeaders
        })
    }
  } catch (error) {
    console.error('Error in api-candidates:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})