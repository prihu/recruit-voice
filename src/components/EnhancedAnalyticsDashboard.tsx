import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Download, TrendingUp, Users, Phone, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDemoAPI } from "@/hooks/useDemoAPI";

interface AnalyticsData {
  summary: {
    total_screenings: number;
    total_candidates: number;
    total_roles: number;
  };
  by_status: Record<string, number>;
  by_outcome: Record<string, number>;
  response_quality: {
    full_responses: number;
    partial_responses: number;
    no_responses: number;
  };
  performance_metrics: {
    avg_score: number;
    avg_duration_seconds: number;
    avg_attempts: number;
    avg_time_to_first_interview_hours?: number;
  };
  by_language: Record<string, number>;
  by_location: Record<string, number>;
  timeline: {
    today: number;
    this_week: number;
    this_month: number;
  };
  needs_review_count?: number;
}

const normalizeAnalytics = (raw: any): AnalyticsData => {
  if (!raw) {
    return {
      summary: { total_screenings: 0, total_candidates: 0, total_roles: 0 },
      by_status: {},
      by_outcome: { passed: 0, failed: 0 },
      response_quality: { full_responses: 0, partial_responses: 0, no_responses: 0 },
      performance_metrics: { avg_score: 0, avg_duration_seconds: 0, avg_attempts: 0 },
      by_language: {},
      by_location: {},
      timeline: { today: 0, this_week: 0, this_month: 0 },
    };
  }

  const summarySrc = raw.summary || raw;
  const byOutcomeSrc = raw.by_outcome || raw.outcomeBreakdown || {};
  const responseQualitySrc = raw.response_quality || raw.responseQuality || {};
  const performanceSrc = raw.performance_metrics || raw.performance || {};
  const timelineSrc = raw.timeline || raw.timelineData || {};

  return {
    summary: {
      total_screenings: summarySrc.total_screenings ?? summarySrc.totalScreenings ?? 0,
      total_candidates: summarySrc.total_candidates ?? summarySrc.totalCandidates ?? 0,
      total_roles: summarySrc.total_roles ?? summarySrc.totalRoles ?? 0,
    },
    by_status: raw.by_status || (raw.statusBreakdown ?? {}),
    by_outcome: {
      passed: byOutcomeSrc.passed ?? byOutcomeSrc.pass ?? 0,
      failed: byOutcomeSrc.failed ?? byOutcomeSrc.fail ?? 0,
    },
    response_quality: {
      full_responses: responseQualitySrc.full_responses ?? responseQualitySrc.full ?? 0,
      partial_responses: responseQualitySrc.partial_responses ?? responseQualitySrc.partial ?? 0,
      no_responses: responseQualitySrc.no_responses ?? responseQualitySrc.none ?? 0,
    },
    performance_metrics: {
      avg_score: performanceSrc.avg_score ?? performanceSrc.averageScore ?? 0,
      avg_duration_seconds: performanceSrc.avg_duration_seconds ?? performanceSrc.averageDuration ?? 0,
      avg_attempts: performanceSrc.avg_attempts ?? performanceSrc.averageAttempts ?? 0,
      avg_time_to_first_interview_hours: performanceSrc.avg_time_to_first_interview_hours ?? performanceSrc.avgTimeToFirstInterview ?? null,
    },
    by_language: raw.by_language ?? raw.languageDistribution ?? {},
    by_location: raw.by_location ?? raw.locationDistribution ?? {},
    timeline: {
      today: timelineSrc.today ?? 0,
      this_week: timelineSrc.this_week ?? timelineSrc.thisWeek ?? 0,
      this_month: timelineSrc.this_month ?? timelineSrc.thisMonth ?? 0,
    },
    needs_review_count: raw.needs_review_count ?? (raw.by_outcome?.needs_review ?? 0),
  };
};

export function EnhancedAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const demoAPI = useDemoAPI();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const data = await demoAPI.getAnalytics();
      setAnalytics(normalizeAnalytics(data.analytics || data));
    } catch (err: any) {
      console.error('Analytics error:', err);
      // Set default analytics in case of error
      setAnalytics({
        summary: { total_screenings: 0, total_candidates: 0, total_roles: 0 },
        by_status: {},
        by_outcome: { passed: 0, failed: 0 },
        response_quality: { full_responses: 0, partial_responses: 0, no_responses: 0 },
        performance_metrics: { avg_score: 0, avg_duration_seconds: 0, avg_attempts: 0 },
        by_language: {},
        by_location: {},
        timeline: { today: 0, this_week: 0, this_month: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      await demoAPI.exportAnalytics('csv');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>No analytics data available</div>;

  const rq = analytics.response_quality ?? { full_responses: 0, partial_responses: 0, no_responses: 0 };

  const responseQualityData = [
    { name: 'Full Responses', value: rq.full_responses ?? 0, color: 'hsl(var(--success))' },
    { name: 'Partial Responses', value: rq.partial_responses ?? 0, color: 'hsl(var(--warning))' },
    { name: 'No Responses', value: rq.no_responses ?? 0, color: 'hsl(var(--destructive))' }
  ];

  const languageData = Object.entries(analytics.by_language).map(([lang, count]) => ({
    name: lang,
    count
  }));

  const totalScreenings = analytics.summary.total_screenings || 1; // Prevent division by zero

  // Calculate time saved (estimated 15 min per traditional phone screen)
  const timeSavedHours = Math.round((analytics.summary.total_screenings * 15) / 60);
  
  // Calculate time to first interview (if available, else estimate)
  const avgTimeToInterview = analytics.performance_metrics.avg_time_to_first_interview_hours;
  const traditionalTimeToInterview = 72; // Industry benchmark: 3 days
  const timeReductionPercent = avgTimeToInterview 
    ? Math.round(((traditionalTimeToInterview - avgTimeToInterview) / traditionalTimeToInterview) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Screenings</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.total_screenings}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.timeline.today} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalScreenings > 0 
                ? `${Math.round(((analytics.by_outcome.passed || 0) / totalScreenings) * 100)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.by_outcome.passed || 0} passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {analytics.needs_review_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting human review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {timeSavedHours}h
            </div>
            <p className="text-xs text-muted-foreground">
              vs. manual screening
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalScreenings > 0
                ? `${Math.round(((rq.full_responses ?? 0) / totalScreenings) * 100)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Complete responses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time to First Interview Card */}
      {(timeReductionPercent !== null || timeSavedHours > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Efficiency Metrics
            </CardTitle>
            <CardDescription>
              Impact of AI-powered phone screening on your hiring process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Recruiter Hours Saved</div>
                <div className="text-3xl font-bold text-primary">{timeSavedHours}h</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on 15 min per manual screen
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Avg. Score</div>
                <div className="text-3xl font-bold">{analytics.performance_metrics.avg_score.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Across all screenings
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {avgTimeToInterview ? 'Time-to-First-Interview' : 'Avg. Call Duration'}
                </div>
                <div className="text-3xl font-bold">
                  {avgTimeToInterview 
                    ? `${Math.round(avgTimeToInterview)}h`
                    : `${Math.round(analytics.performance_metrics.avg_duration_seconds / 60)}m`
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {timeReductionPercent !== null 
                    ? `${timeReductionPercent}% faster than industry avg`
                    : 'Average screening duration'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Response Quality Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Response Quality Analysis</CardTitle>
          <CardDescription>
            Breakdown of candidate response completeness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={responseQualityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {responseQualityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Full Responses</span>
                  <span className="text-sm font-medium">{rq.full_responses ?? 0}</span>
                </div>
                <Progress 
                  value={((rq.full_responses ?? 0) / totalScreenings) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Partial Responses</span>
                  <span className="text-sm font-medium">{rq.partial_responses ?? 0}</span>
                </div>
                <Progress 
                  value={((rq.partial_responses ?? 0) / totalScreenings) * 100} 
                  className="h-2 [&>div]:bg-warning"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">No Responses</span>
                  <span className="text-sm font-medium">{rq.no_responses ?? 0}</span>
                </div>
                <Progress 
                  value={((rq.no_responses ?? 0) / totalScreenings) * 100} 
                  className="h-2 [&>div]:bg-destructive"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Distribution */}
      {languageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Language Preferences</CardTitle>
            <CardDescription>
              Distribution of candidate language preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={languageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report (CSV)
        </Button>
      </div>
    </div>
  );
}