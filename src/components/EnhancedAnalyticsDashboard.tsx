import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Download, TrendingUp, Users, Phone, CheckCircle } from "lucide-react";
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
  const demoAPI = useDemoAPI();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const data = await demoAPI.getAnalytics();
      setAnalytics(data.analytics || data);
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

  const responseQualityData = [
    { name: 'Full Responses', value: analytics.response_quality.full_responses, color: 'hsl(var(--success))' },
    { name: 'Partial Responses', value: analytics.response_quality.partial_responses, color: 'hsl(var(--warning))' },
    { name: 'No Responses', value: analytics.response_quality.no_responses, color: 'hsl(var(--destructive))' }
  ];

  const languageData = Object.entries(analytics.by_language).map(([lang, count]) => ({
    name: lang,
    count
  }));

  const totalScreenings = analytics.summary.total_screenings || 1; // Prevent division by zero

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
              {totalScreenings > 0
                ? `${Math.round((analytics.response_quality.full_responses / totalScreenings) * 100)}%`
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
                  value={(analytics.response_quality.full_responses / totalScreenings) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Partial Responses</span>
                  <span className="text-sm font-medium">{analytics.response_quality.partial_responses}</span>
                </div>
                <Progress 
                  value={(analytics.response_quality.partial_responses / totalScreenings) * 100} 
                  className="h-2 [&>div]:bg-warning"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">No Responses</span>
                  <span className="text-sm font-medium">{analytics.response_quality.no_responses}</span>
                </div>
                <Progress 
                  value={(analytics.response_quality.no_responses / totalScreenings) * 100} 
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