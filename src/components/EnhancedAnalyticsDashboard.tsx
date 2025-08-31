import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Download, TrendingUp, Users, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";

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
  };
  by_language: Record<string, number>;
  by_location: Record<string, number>;
  timeline: {
    today: number;
    this_week: number;
    this_month: number;
  };
}

export function EnhancedAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('api-analytics');
      if (error) {
        console.error('Error fetching analytics:', error);
        // @ts-ignore - status is present on function error
        setErrorCode(error.status || 400);
        setAnalytics(null);
      } else {
        setAnalytics(data.analytics);
        setErrorCode(null);
      }
    } catch (err: any) {
      console.error('Unexpected analytics error:', err);
      setErrorCode(400);
    } finally {
      setLoading(false);
    }
  };

  const fixDemoSetup = async () => {
    try {
      await supabase.functions.invoke('provision-demo-user');
      setLoading(true);
      await fetchAnalytics();
    } catch (e) {
      console.error('Failed to fix demo setup:', e);
    }
  };

  const exportToCSV = async () => {
    const { data } = await supabase.functions.invoke('api-analytics', {
      body: { includeDetails: true }
    });
    
    // Convert to CSV format
    const csv = convertToCSV(data.screens);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screening_report_${new Date().toISOString()}.csv`;
    a.click();
  };

  const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  };

  if (loading) return <div>Loading analytics...</div>;
  if (errorCode === 401) {
    return (
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Authentication required</CardTitle>
          <CardDescription>Please start the demo to view analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/demo-login">
            <Button>Start Interactive Demo</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (errorCode === 403) {
    return (
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Organization not found</CardTitle>
          <CardDescription>We couldn't find your organization. Fix your demo setup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fixDemoSetup}>Fix demo setup</Button>
        </CardContent>
      </Card>
    );
  }
  if (!analytics) return <div>No analytics data available</div>;

  const responseQualityData = [
    { name: 'Full Responses', value: analytics.response_quality.full_responses, color: 'hsl(var(--success))' },
    { name: 'Partial Responses', value: analytics.response_quality.partial_responses, color: 'hsl(var(--warning))' },
    { name: 'No Responses', value: analytics.response_quality.no_responses, color: 'hsl(var(--destructive))' }
  ];

  const languageData = Object.entries(analytics.by_language).map(([lang, count]) => ({
    name: lang,
    count
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
              {analytics.summary.total_screenings > 0 
                ? `${Math.round((analytics.by_outcome.passed / analytics.summary.total_screenings) * 100)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.by_outcome.passed} passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.performance_metrics.avg_score.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Performance metric
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
              {analytics.summary.total_screenings > 0
                ? `${Math.round((analytics.response_quality.full_responses / analytics.summary.total_screenings) * 100)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Complete responses
            </p>
          </CardContent>
        </Card>
      </div>

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
                  <span className="text-sm font-medium">{analytics.response_quality.full_responses}</span>
                </div>
                <Progress 
                  value={(analytics.response_quality.full_responses / analytics.summary.total_screenings) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Partial Responses</span>
                  <span className="text-sm font-medium">{analytics.response_quality.partial_responses}</span>
                </div>
                <Progress 
                  value={(analytics.response_quality.partial_responses / analytics.summary.total_screenings) * 100} 
                  className="h-2 [&>div]:bg-warning"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">No Responses</span>
                  <span className="text-sm font-medium">{analytics.response_quality.no_responses}</span>
                </div>
                <Progress 
                  value={(analytics.response_quality.no_responses / analytics.summary.total_screenings) * 100} 
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