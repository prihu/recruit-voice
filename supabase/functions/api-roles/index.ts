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
    const roleId = pathSegments[1]

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (roleId) {
          // Get specific role
          const { data, error } = await supabaseClient
            .from('roles')
            .select('*')
            .eq('id', roleId)
            .eq('organization_id', orgMember.organization_id)
            .single()

          if (error) throw error
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // List all roles
          const { data, error } = await supabaseClient
            .from('roles')
            .select('*')
            .eq('organization_id', orgMember.organization_id)
            .order('created_at', { ascending: false })

          if (error) throw error
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      case 'POST':
        const body = await req.json()
        const { data, error } = await supabaseClient
          .from('roles')
          .insert({
            ...body,
            organization_id: orgMember.organization_id,
            user_id: user.id
          })
          .select()
          .single()

        if (error) throw error
        return new Response(JSON.stringify(data), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'PUT':
        if (!roleId) {
          throw new Error('Role ID required for update')
        }
        const updateBody = await req.json()
        const { data: updateData, error: updateError } = await supabaseClient
          .from('roles')
          .update(updateBody)
          .eq('id', roleId)
          .eq('organization_id', orgMember.organization_id)
          .select()
          .single()

        if (updateError) throw updateError
        return new Response(JSON.stringify(updateData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'DELETE':
        if (!roleId) {
          throw new Error('Role ID required for deletion')
        }
        const { error: deleteError } = await supabaseClient
          .from('roles')
          .delete()
          .eq('id', roleId)
          .eq('organization_id', orgMember.organization_id)

        if (deleteError) throw deleteError
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        })

      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: corsHeaders
        })
    }
  } catch (error) {
    console.error('Error in api-roles:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})