import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  MapPin,
  DollarSign,
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  HelpCircle,
  Settings,
  Clock,
  TestTube,
  PlayCircle,
  Save,
  Loader2,
  Bot,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Role, ScreeningQuestion, FAQEntry } from '@/types';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { useToast } from '@/components/ui/use-toast';

export default function RoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNewRole = id === 'new';
  const demoAPI = useDemoAPI();
  
  const [loading, setLoading] = useState(!isNewRole);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Form state
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('INR');
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [faq, setFaq] = useState<FAQEntry[]>([]);
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'pending' | 'synced' | 'failed' | 'archived'>('pending');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [callWindow, setCallWindow] = useState({
    timezone: 'Asia/Kolkata',
    allowedHours: { start: '09:00', end: '17:00' },
    allowedDays: [1, 2, 3, 4, 5],
    maxAttempts: 3,
    attemptSpacing: 60,
    smsReminder: false,
    emailReminder: false
  });

  useEffect(() => {
    if (!isNewRole && id) {
      fetchRole();
    }
  }, [id]);

  const fetchRole = async () => {
    try {
      const role = await demoAPI.getRole(id!);
      
      // Set form state from fetched role
      setTitle(role.title);
      setLocation(role.location);
      setSummary(role.summary || '');
      setStatus(role.status as 'draft' | 'active');
      setSalaryMin(role.salary_min?.toString() || '');
      setSalaryMax(role.salary_max?.toString() || '');
      setSalaryCurrency(role.salary_currency || 'INR');
      setQuestions((role.questions as any as ScreeningQuestion[]) || []);
      setFaq((role.faq as any as FAQEntry[]) || []);
      setEvaluationCriteria(role.evaluation_criteria || '');
      setAgentId(role.voice_agent_id || null);
      setAgentStatus((role.agent_sync_status || 'pending') as 'pending' | 'synced' | 'failed' | 'archived');
      setAgentError(role.agent_error_message || null);
      setCallWindow((role.call_window as any) || callWindow);
    } catch (error) {
      console.error('Error fetching role:', error);
      toast({
        title: "Error",
        description: "Failed to load role",
        variant: "destructive"
      });
      navigate('/roles');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title || !location) {
      toast({
        title: "Validation Error",
        description: "Title and location are required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const roleData = {
        title,
        location,
        summary,
        status,
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        salary_currency: salaryCurrency,
        questions: questions as any,
        faq: faq as any,
        evaluation_criteria: evaluationCriteria,
        call_window: callWindow as any,
      };

      if (isNewRole) {
        // Create new role
        const data = await demoAPI.createRole(roleData);
        toast({
          title: "Success",
          description: "Role created successfully"
        });
        navigate(`/roles/${data.id}`);
      } else {
        // Update existing role
        await demoAPI.updateRole(id!, roleData);
        toast({
          title: "Success",
          description: "Role updated successfully"
        });
      }
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        title: "Error",
        description: "Failed to save role",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: ScreeningQuestion = {
      id: `q-${Date.now()}`,
      text: '',
      type: 'yes_no',
      required: false,
      order: questions.length
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<ScreeningQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addFaqEntry = () => {
    const newEntry: FAQEntry = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: '',
      keywords: []
    };
    setFaq([...faq, newEntry]);
  };

  const updateFaqEntry = (index: number, updates: Partial<FAQEntry>) => {
    const updated = [...faq];
    updated[index] = { ...updated[index], ...updates };
    setFaq(updated);
  };

  const removeFaqEntry = (index: number) => {
    setFaq(faq.filter((_, i) => i !== index));
  };

  const createOrUpdateAgent = async () => {
    if (!id || isNewRole) {
      toast({
        title: "Info",
        description: "Please save the role first before creating an agent",
      });
      return;
    }

    setCreatingAgent(true);
    try {
      const data = await demoAPI.createAgent(id);
      
      if (data?.success) {
        setAgentId(data.agentId);
        setAgentStatus('synced');
        setAgentError(null);
        toast({
          title: "Success",
          description: data.message || "Agent configured successfully",
        });
        
        // Agent ID is already updated in the database by the edge function
        // No need for additional updateAgentConfig call
      }
    } catch (error: any) {
      console.error('Error with agent:', error);
      setAgentStatus('failed');
      setAgentError(error.message || 'Failed to configure agent');
      toast({
        title: "Error",
        description: "Failed to configure agent in demo mode",
        variant: "destructive"
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/roles">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {isNewRole ? 'Create New Role' : title || 'Untitled Role'}
                </h1>
                {!isNewRole && (
                  <Badge 
                    variant={status === 'active' ? 'default' : 'secondary'}
                    className={status === 'active' ? 'bg-success text-success-foreground' : ''}
                  >
                    {status}
                  </Badge>
                )}
              </div>
              {!isNewRole && location && (
                <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {location}
                  </span>
                  {salaryMin && salaryMax && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {salaryCurrency} {(parseInt(salaryMin) / 100000).toFixed(0)}L - {(parseInt(salaryMax) / 100000).toFixed(0)}L
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isNewRole && (
              <Button variant="outline">
                <TestTube className="w-4 h-4 mr-2" />
                Test Configuration
              </Button>
            )}
            <Button 
              className="bg-gradient-primary border-0"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isNewRole ? 'Create Role' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 max-w-3xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">
              <MessageSquare className="w-4 h-4 mr-1" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle className="w-4 h-4 mr-1" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Settings className="w-4 h-4 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="window">
              <Clock className="w-4 h-4 mr-1" />
              Window
            </TabsTrigger>
            <TabsTrigger value="test">
              <PlayCircle className="w-4 h-4 mr-1" />
              Test
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Define the role title, location, and compensation details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Role Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Bangalore, India"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Role Summary</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Provide a brief description of the role..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salaryMin">Min Salary (Annual)</Label>
                    <Input
                      id="salaryMin"
                      type="number"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="e.g., 1000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salaryMax">Max Salary (Annual)</Label>
                    <Input
                      id="salaryMax"
                      type="number"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="e.g., 2000000"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="status">Role Status</Label>
                    <div className="text-sm text-muted-foreground">
                      Active roles can receive applications
                    </div>
                  </div>
                  <Switch
                    id="status"
                    checked={status === 'active'}
                    onCheckedChange={(checked) => setStatus(checked ? 'active' : 'draft')}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Screening Questions</CardTitle>
                <CardDescription>
                  Define questions that will be asked during the phone screening
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="flex gap-2 items-start p-4 border rounded-lg">
                    <GripVertical className="w-5 h-5 text-muted-foreground mt-2 cursor-move" />
                    <div className="flex-1 space-y-3">
                      <div className="space-y-2">
                        <Label>Question {index + 1}</Label>
                        <Textarea
                          value={question.text}
                          onChange={(e) => updateQuestion(index, { text: e.target.value })}
                          placeholder="Enter your screening question..."
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Label>Type</Label>
                          <Select
                            value={question.type}
                            onValueChange={(value) => updateQuestion(index, { type: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes_no">Yes/No</SelectItem>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="scale">Scale (1-5)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                          <Switch
                            checked={question.required}
                            onCheckedChange={(checked) => updateQuestion(index, { required: checked })}
                          />
                          <Label>Required</Label>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={addQuestion}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  Prepare answers for common candidate questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {faq.map((entry, index) => (
                  <div key={entry.id} className="p-4 border rounded-lg space-y-3">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={entry.question}
                        onChange={(e) => updateFaqEntry(index, { question: e.target.value })}
                        placeholder="e.g., What is the work culture like?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea
                        value={entry.answer}
                        onChange={(e) => updateFaqEntry(index, { answer: e.target.value })}
                        placeholder="Provide a comprehensive answer..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFaqEntry(index)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={addFaqEntry}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Criteria</CardTitle>
                <CardDescription>
                  Define rules and criteria for evaluating candidates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="criteria">Evaluation Guidelines</Label>
                  <Textarea
                    id="criteria"
                    value={evaluationCriteria}
                    onChange={(e) => setEvaluationCriteria(e.target.value)}
                    placeholder="Define the criteria for passing the screening..."
                    className="min-h-[200px]"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call Window Tab */}
          <TabsContent value="window" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Window Settings</CardTitle>
                <CardDescription>
                  Configure when screening calls can be made
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={callWindow.allowedHours.start}
                      onChange={(e) => setCallWindow({
                        ...callWindow,
                        allowedHours: { ...callWindow.allowedHours, start: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={callWindow.allowedHours.end}
                      onChange={(e) => setCallWindow({
                        ...callWindow,
                        allowedHours: { ...callWindow.allowedHours, end: e.target.value }
                      })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select 
                    value={callWindow.timezone} 
                    onValueChange={(value) => setCallWindow({ ...callWindow, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                      <SelectItem value="America/New_York">US Eastern (EST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">US Pacific (PST)</SelectItem>
                      <SelectItem value="Europe/London">UK (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Attempts</Label>
                    <Input
                      type="number"
                      value={callWindow.maxAttempts}
                      onChange={(e) => setCallWindow({
                        ...callWindow,
                        maxAttempts: parseInt(e.target.value)
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Attempt Spacing (minutes)</Label>
                    <Input
                      type="number"
                      value={callWindow.attemptSpacing}
                      onChange={(e) => setCallWindow({
                        ...callWindow,
                        attemptSpacing: parseInt(e.target.value)
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>SMS Reminders</Label>
                      <div className="text-sm text-muted-foreground">
                        Send SMS reminders before scheduled calls
                      </div>
                    </div>
                    <Switch
                      checked={callWindow.smsReminder}
                      onCheckedChange={(checked) => setCallWindow({
                        ...callWindow,
                        smsReminder: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Reminders</Label>
                      <div className="text-sm text-muted-foreground">
                        Send email reminders before scheduled calls
                      </div>
                    </div>
                    <Switch
                      checked={callWindow.emailReminder}
                      onCheckedChange={(checked) => setCallWindow({
                        ...callWindow,
                        emailReminder: checked
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Voice Agent Configuration</CardTitle>
                <CardDescription>
                  Configure and test your AI voice agent for phone screenings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentStatus === 'synced' && agentId ? (
                  <Alert className="bg-success/10 border-success">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <AlertDescription className="text-success">
                      Voice agent is configured and ready. Agent ID: {agentId}
                    </AlertDescription>
                  </Alert>
                ) : agentStatus === 'failed' ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {agentError || 'Failed to configure voice agent'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <Bot className="h-4 w-4" />
                    <AlertDescription>
                      Voice agent not configured. Click below to set up the AI agent.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={createOrUpdateAgent}
                    disabled={creatingAgent}
                    className="flex-1"
                  >
                    {creatingAgent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Configuring...
                      </>
                    ) : agentId ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Update Agent
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2" />
                        Configure Agent
                      </>
                    )}
                  </Button>
                  
                  {agentId && (
                    <Button variant="outline">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Test Call
                    </Button>
                  )}
                </div>

                {agentId && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Agent Details</span>
                      <Badge variant="outline">Demo Mode</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent ID:</span>
                        <span className="font-mono">{agentId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          variant={agentStatus === 'synced' ? 'default' : 'secondary'}
                          className={agentStatus === 'synced' ? 'bg-success text-success-foreground' : ''}
                        >
                          {agentStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Questions:</span>
                        <span>{questions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">FAQs:</span>
                        <span>{faq.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}