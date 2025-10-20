import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Mic,
  Download,
  ThumbsUp,
  ThumbsDown,
  Send,
  FileJson,
  FileSpreadsheet,
  Loader2,
  PhoneCall,
  Activity
} from 'lucide-react';
import { VoiceScreening } from '@/components/VoiceScreening';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { toast } from '@/hooks/use-toast';
import { Screen, Role, Candidate, CallWindow, TranscriptEntry, ScreeningQuestion, FAQEntry, ScoringRule } from '@/types';
import { safeFormat, safeFormatDistance, parseToDate } from '@/lib/date';

export default function ScreenDetail() {
  const { id } = useParams();
  const demoAPI = useDemoAPI();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchScreenData();
  }, [id]);

  const fetchScreenData = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // Fetch screen data
      const screenData = await demoAPI.getScreen(id);

      // Fetch role data
      const roleData = await demoAPI.getRole(screenData.role_id);

      // Fetch candidate data
      const candidateData = await demoAPI.getCandidate(screenData.candidate_id);

      // Transform the data to match our types
      const transformedScreen: Screen = {
        id: screenData.id,
        roleId: screenData.role_id,
        candidateId: screenData.candidate_id,
        status: screenData.status as Screen['status'],
        attempts: screenData.attempts,
        transcript: Array.isArray(screenData.transcript) ? (screenData.transcript as any[]) : [],
        audioUrl: screenData.audio_url,
        answers: screenData.answers as Record<string, any> || {},
        score: screenData.score,
        outcome: screenData.outcome as Screen['outcome'],
        reasons: screenData.reasons,
        createdAt: new Date(screenData.created_at),
        updatedAt: new Date(screenData.updated_at),
        scheduledAt: screenData.scheduled_at ? new Date(screenData.scheduled_at) : undefined,
        conversation_turns: screenData.conversation_turns,
        candidate_responded: screenData.candidate_responded,
        call_connected: screenData.call_connected,
        first_response_time_seconds: screenData.first_response_time_seconds
      };

      const transformedRole: Role = {
        id: roleData.id,
        title: roleData.title,
        location: roleData.location,
        salaryBand: roleData.salary_min && roleData.salary_max ? {
          min: roleData.salary_min,
          max: roleData.salary_max,
          currency: roleData.salary_currency
        } : undefined,
        summary: roleData.summary,
        questions: Array.isArray(roleData.questions) ? (roleData.questions as any[]) : [],
        faq: Array.isArray(roleData.faq) ? (roleData.faq as any[]) : [],
        rules: Array.isArray(roleData.rules) ? (roleData.rules as any[]) : [],
        callWindow: typeof roleData.call_window === 'object' && roleData.call_window !== null 
          ? (roleData.call_window as any)
          : {
              timezone: 'UTC',
              allowedHours: { start: '09:00', end: '17:00' },
              allowedDays: [1, 2, 3, 4, 5],
              maxAttempts: 3,
              attemptSpacing: 30,
              smsReminder: false,
              emailReminder: false
            },
        status: roleData.status as Role['status'],
        createdAt: new Date(roleData.created_at),
        updatedAt: new Date(roleData.updated_at),
        voice_agent_id: roleData.voice_agent_id,
        agent_sync_status: roleData.agent_sync_status,
        voice_enabled: roleData.voice_enabled
      };

      const transformedCandidate: Candidate = {
        id: candidateData.id,
        externalId: candidateData.external_id,
        name: candidateData.name,
        phone: candidateData.phone,
        email: candidateData.email,
        skills: candidateData.skills,
        expYears: candidateData.exp_years,
        locationPref: candidateData.location_pref,
        salaryExpectation: candidateData.salary_expectation,
        language: candidateData.language,
        createdAt: new Date(candidateData.created_at)
      };

      setScreen(transformedScreen);
      setRole(transformedRole);
      setCandidate(transformedCandidate);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load screening data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceScreeningComplete = async (data: any) => {
    // Refresh the screen data after voice screening completes
    await fetchScreenData();
    toast({
      title: "Screening Complete",
      description: "The voice screening has been completed successfully",
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!screen || !role || !candidate) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Screen not found</h2>
          <Link to="/screens">
            <Button>Back to Screens</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'pass':
        return 'bg-success text-success-foreground';
      case 'fail':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/screens">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Screening Session</h1>
              <p className="text-muted-foreground mt-1">
                {candidate.name} - {role.title}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileJson className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Candidate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-semibold text-lg">{candidate.name}</p>
                <p className="text-sm text-muted-foreground">{candidate.externalId}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{candidate.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{candidate.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{candidate.locationPref}</span>
                </div>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-1">
                {candidate.skills?.map((skill, index) => (
                  <Badge key={index} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Screening Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Score</span>
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                  {screen.score || '-'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outcome</span>
                <Badge className={getOutcomeColor(screen.outcome)}>
                  {screen.outcome === 'pass' && <CheckCircle className="w-4 h-4 mr-1" />}
                  {screen.outcome === 'fail' && <XCircle className="w-4 h-4 mr-1" />}
                  {screen.outcome || 'Pending'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attempts</span>
                <span className="font-medium">{screen.attempts}/3</span>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{safeFormat(screen.createdAt, 'PPP')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{safeFormatDistance(screen.updatedAt, { addSuffix: true })}</span>
                </div>
              </div>
              {screen.reasons && screen.reasons.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Issues Identified</span>
                    <ul className="space-y-1">
                      {screen.reasons.map((reason, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2 text-destructive">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full bg-success hover:bg-success/90">
                <ThumbsUp className="w-4 h-4 mr-2" />
                Advance Candidate
              </Button>
              <Button variant="destructive" className="w-full">
                <ThumbsDown className="w-4 h-4 mr-2" />
                Reject Candidate
              </Button>
              <Button variant="outline" className="w-full">
                <Send className="w-4 h-4 mr-2" />
                Schedule Follow-up
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Recording
              </Button>
            </CardContent>
          </Card>

          {/* Call Quality Metrics Card */}
          {screen.status === 'completed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Call Quality Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Call Connected Status */}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Call Connected</div>
                    <div className="flex items-center gap-2">
                      {screen.call_connected ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">
                        {screen.call_connected ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Candidate Responded */}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Candidate Responded</div>
                    <div className="flex items-center gap-2">
                      {screen.candidate_responded ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">
                        {screen.candidate_responded ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Conversation Turns */}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Conversation Turns</div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-lg">
                        {screen.conversation_turns || 0}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total messages
                    </div>
                  </div>

                  {/* First Response Time */}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">First Response</div>
                    {screen.first_response_time_seconds !== null && screen.first_response_time_seconds !== undefined ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-lg">
                            {screen.first_response_time_seconds}s
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Time to engage
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>

                {/* Quality Indicator Bar */}
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">Call Quality</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          screen.call_connected && (screen.conversation_turns || 0) > 5
                            ? 'bg-success w-full'
                            : screen.call_connected
                            ? 'bg-warning w-2/3'
                            : 'bg-destructive w-1/3'
                        }`}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {screen.call_connected && (screen.conversation_turns || 0) > 5
                        ? 'Good'
                        : screen.call_connected
                        ? 'Fair'
                        : 'Poor'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="voice">
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="voice">
              <PhoneCall className="w-4 h-4 mr-1" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="answers">Answers</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="reasons">Analysis</TabsTrigger>
          </TabsList>

          {/* Voice Interview Tab */}
          <TabsContent value="voice" className="space-y-4">
            <VoiceScreening
              screenId={screen.id}
              role={role}
              candidate={candidate}
              onComplete={handleVoiceScreeningComplete}
            />
          </TabsContent>

          {/* Key Answers Tab */}
          <TabsContent value="answers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Screening Answers</CardTitle>
                <CardDescription>Candidate responses to screening questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {role.questions?.map((question, index) => (
                  <div key={question.id} className="space-y-2 p-4 border rounded-lg bg-card-hover">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {index + 1}. {question.text}
                        </p>
                        <div className="mt-2">
                          {screen.answers && screen.answers[question.id] !== undefined ? (
                            <div className="flex items-center gap-2">
                              {typeof screen.answers[question.id] === 'boolean' ? (
                                screen.answers[question.id] ? (
                                  <Badge className="bg-success text-success-foreground">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Yes
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    No
                                  </Badge>
                                )
                              ) : Array.isArray(screen.answers[question.id]) ? (
                                <div className="flex flex-wrap gap-1">
                                  {screen.answers[question.id].map((item: string, idx: number) => (
                                    <Badge key={idx} variant="secondary">{item}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm">{screen.answers[question.id]}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No answer provided</span>
                          )}
                        </div>
                      </div>
                      {question.required && (
                        <Badge variant="outline">Required</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Conversation Transcript</CardTitle>
                <CardDescription>Complete conversation with timestamps</CardDescription>
              </CardHeader>
              <CardContent>
                {screen.transcript && screen.transcript.length > 0 ? (
                  <div className="space-y-4">
                    {screen.transcript.map((entry, index) => {
                      const timestamp = parseToDate(entry.timestamp);
                      
                      return (
                        <div key={index} className={`flex gap-3 ${entry.speaker === 'agent' ? '' : 'flex-row-reverse'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            entry.speaker === 'agent' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {entry.speaker === 'agent' ? <Mic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                          </div>
                          <div className={`flex-1 ${entry.speaker === 'agent' ? '' : 'text-right'}`}>
                            <div className={`inline-block p-3 rounded-lg ${
                              entry.speaker === 'agent' 
                                ? 'bg-muted text-foreground' 
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              <p className="text-sm">{entry.text}</p>
                            </div>
                            {timestamp && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {safeFormat(timestamp, 'HH:mm:ss')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No transcript available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="reasons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Screening Analysis</CardTitle>
                <CardDescription>Detailed analysis and scoring breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {screen.reasons && screen.reasons.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">Key Findings</h4>
                    {screen.reasons.map((reason, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                        <p className="text-sm">{reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Rule Evaluation</h4>
                  {role.rules?.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{rule.name}</p>
                        {rule.isRequired && (
                          <Badge variant="outline" className="mt-1">Required</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Weight: {rule.weight}%</span>
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Pass
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}