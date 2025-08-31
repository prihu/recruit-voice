import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const roleId = url.searchParams.get('roleId');
    const includeDetails = url.searchParams.get('includeDetails') === 'true';
    const format = url.searchParams.get('format'); // 'csv' or 'json'

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Build query
    let query = supabase
      .from('screens')
      .select(`
        *,
        candidate:candidates(name, email, phone, location_pref, preferred_language),
        role:roles(title, location)
      `)
      .eq('organization_id', DEMO_ORG_ID);

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    const { data: screens, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate analytics
    const total = screens.length;
    const completed = screens.filter(s => s.status === 'completed').length;
    const passed = screens.filter(s => s.outcome === 'pass').length;
    const failed = screens.filter(s => s.outcome === 'fail').length;

    // Status breakdown
    const statusBreakdown = {
      pending: screens.filter(s => s.status === 'pending').length,
      in_progress: screens.filter(s => s.status === 'in_progress').length,
      completed: screens.filter(s => s.status === 'completed').length,
      failed: screens.filter(s => s.status === 'failed').length,
    };

    // Outcome breakdown
    const outcomeBreakdown = {
      pass: passed,
      fail: failed,
      pending: screens.filter(s => !s.outcome).length,
    };

    // Response quality
    const responseQuality = {
      full: screens.filter(s => s.response_completeness === 100).length,
      partial: screens.filter(s => s.response_completeness > 0 && s.response_completeness < 100).length,
      none: screens.filter(s => s.response_completeness === 0 || s.response_completeness === null).length,
    };

    // Performance metrics
    const scores = screens.filter(s => s.score !== null).map(s => s.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const durations = screens.filter(s => s.duration_seconds !== null).map(s => s.duration_seconds);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const attempts = screens.map(s => s.attempts || 0);
    const avgAttempts = attempts.length > 0 ? attempts.reduce((a, b) => a + b, 0) / attempts.length : 0;

    // Language distribution
    const languageDistribution = screens.reduce((acc: any, screen) => {
      const lang = screen.candidate?.preferred_language || 'Unknown';
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    // Location distribution
    const locationDistribution = screens.reduce((acc: any, screen) => {
      const loc = screen.candidate?.location_pref || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    // Top rejection reasons
    const rejectionReasons = screens
      .filter(s => s.outcome === 'fail' && s.reasons && s.reasons.length > 0)
      .flatMap(s => s.reasons);
    
    const reasonCounts = rejectionReasons.reduce((acc: any, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    
    const topRejectionReasons = Object.entries(reasonCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // Timeline data
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const timelineData = {
      today: screens.filter(s => new Date(s.created_at) >= todayStart).length,
      thisWeek: screens.filter(s => new Date(s.created_at) >= weekStart).length,
      thisMonth: screens.filter(s => new Date(s.created_at) >= monthStart).length,
    };

    const analytics = {
      summary: {
        totalScreenings: total,
        totalCandidates: new Set(screens.map(s => s.candidate_id)).size,
        totalRoles: new Set(screens.map(s => s.role_id)).size,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        passRate: completed > 0 ? (passed / completed) * 100 : 0,
      },
      statusBreakdown,
      outcomeBreakdown,
      responseQuality,
      performance: {
        averageScore: avgScore,
        averageDuration: avgDuration,
        averageAttempts: avgAttempts,
      },
      languageDistribution,
      locationDistribution,
      topRejectionReasons,
      timelineData,
    };

    // Handle export formats
    if (format === 'csv') {
      // Convert to CSV
      const csvRows = ['Date,Candidate Name,Email,Phone,Role,Status,Outcome,Score,Duration,Attempts'];
      screens.forEach(screen => {
        const row = [
          new Date(screen.created_at).toISOString(),
          screen.candidate?.name || '',
          screen.candidate?.email || '',
          screen.candidate?.phone || '',
          screen.role?.title || '',
          screen.status || '',
          screen.outcome || '',
          screen.score || '',
          screen.duration_seconds || '',
          screen.attempts || '',
        ].join(',');
        csvRows.push(row);
      });
      
      return new Response(csvRows.join('\n'), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="screening-analytics.csv"'
        },
      });
    }

    // Return JSON response
    const response = includeDetails ? { analytics, screens } : analytics;

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in demo-api-analytics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});