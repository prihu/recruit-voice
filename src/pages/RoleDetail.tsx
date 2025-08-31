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
  Loader2
} from 'lucide-react';
import { Role, ScreeningQuestion, FAQEntry, ScoringRule } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function RoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNewRole = id === 'new';
  
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
  const [rules, setRules] = useState<ScoringRule[]>([]);
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
    if (!isNewRole) {
      fetchRole();
    }
  }, [id]);

  const fetchRole = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        navigate('/demo-login');
        return;
      }

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgMember) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive"
        });
        return;
      }

      const { data: role, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgMember.organization_id)
        .single();

      if (error || !role) {
        toast({
          title: "Error",
          description: "Role not found",
          variant: "destructive"
        });
        navigate('/roles');
        return;
      }

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
      setRules((role.rules as any as ScoringRule[]) || []);
      setCallWindow((role.call_window as any) || callWindow);
    } catch (error) {
      console.error('Error fetching role:', error);
      toast({
        title: "Error",
        description: "Failed to load role",
        variant: "destructive"
      });
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
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        navigate('/demo-login');
        return;
      }

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgMember) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive"
        });
        return;
      }

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
        rules: rules as any,
        call_window: callWindow as any,
        organization_id: orgMember.organization_id,
        user_id: userData.user.id
      };

      if (isNewRole) {
        // Create new role
        const { data, error } = await supabase
          .from('roles')
          .insert(roleData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Success",
          description: "Role created successfully"
        });
        navigate(`/roles/${data.id}`);
      } else {
        // Update existing role
        const { error } = await supabase
          .from('roles')
          .update(roleData)
          .eq('id', id);

        if (error) throw error;

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

  const addRule = () => {
    const newRule: ScoringRule = {
      id: `rule-${Date.now()}`,
      name: '',
      condition: {
        field: '',
        operator: 'equals',
        value: ''
      },
      weight: 1,
      isRequired: false
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (index: number, updates: Partial<ScoringRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    setRules(updated);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
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
                <CardTitle>Role Information</CardTitle>
                <CardDescription>Basic details about this screening role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                    rows={4}
                    className="resize-none"
                    placeholder="Brief description of the role and key responsibilities..."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="min-salary">Minimum Salary</Label>
                    <Input 
                      id="min-salary" 
                      type="number" 
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="e.g., 2500000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-salary">Maximum Salary</Label>
                    <Input 
                      id="max-salary" 
                      type="number" 
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="e.g., 4000000"
                    />
                  </div>
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
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'active')}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Screening Questions</CardTitle>
                <CardDescription>Configure the questions candidates will be asked during screening</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="flex gap-3 p-4 border rounded-lg bg-card-hover">
                    <div className="flex items-center">
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                      <span className="ml-2 font-medium text-sm w-6">{index + 1}.</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input 
                        value={question.text}
                        onChange={(e) => updateQuestion(index, { text: e.target.value })}
                        placeholder="Enter question text..."
                        className="font-medium"
                      />
                      <div className="flex gap-3">
                        <Select 
                          value={question.type}
                          onValueChange={(v) => updateQuestion(index, { type: v as ScreeningQuestion['type'] })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes_no">Yes/No</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="multi_choice">Multiple Choice</SelectItem>
                            <SelectItem value="free_text">Free Text</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch 
                            id={`required-${question.id}`} 
                            checked={question.required}
                            onCheckedChange={(checked) => updateQuestion(index, { required: checked })}
                          />
                          <Label htmlFor={`required-${question.id}`} className="text-sm">Required</Label>
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
                  className="w-full"
                  onClick={addQuestion}
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
                <CardDescription>Prepare answers for common candidate questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {faq.map((entry, index) => (
                  <div key={entry.id} className="space-y-3 p-4 border rounded-lg bg-card-hover">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input 
                        value={entry.question}
                        onChange={(e) => updateFaqEntry(index, { question: e.target.value })}
                        placeholder="What do candidates often ask?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea 
                        value={entry.answer}
                        onChange={(e) => updateFaqEntry(index, { answer: e.target.value })}
                        placeholder="Your response..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeFaqEntry(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={addFaqEntry}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ Entry
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scoring Rules</CardTitle>
                <CardDescription>Define pass/fail criteria and scoring weights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rules.map((rule, index) => (
                  <div key={rule.id} className="space-y-3 p-4 border rounded-lg bg-card-hover">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <Input 
                          value={rule.name}
                          onChange={(e) => updateRule(index, { name: e.target.value })}
                          placeholder="Rule name..."
                          className="font-medium"
                        />
                        <div className="flex gap-2">
                          <Input 
                            value={rule.condition.field}
                            onChange={(e) => updateRule(index, { 
                              condition: { ...rule.condition, field: e.target.value }
                            })}
                            placeholder="Field..."
                            className="w-32"
                          />
                          <Select 
                            value={rule.condition.operator}
                            onValueChange={(v) => updateRule(index, {
                              condition: { ...rule.condition, operator: v as ScoringRule['condition']['operator'] }
                            })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="greater_than">Greater Than</SelectItem>
                              <SelectItem value="less_than">Less Than</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="in">In</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            value={rule.condition.value}
                            onChange={(e) => updateRule(index, {
                              condition: { ...rule.condition, value: e.target.value }
                            })}
                            placeholder="Value..."
                            className="w-32"
                          />
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`weight-${rule.id}`} className="text-sm">Weight:</Label>
                            <Input 
                              id={`weight-${rule.id}`}
                              type="number" 
                              value={rule.weight}
                              onChange={(e) => updateRule(index, { weight: parseInt(e.target.value) || 0 })}
                              className="w-20"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              id={`required-rule-${rule.id}`} 
                              checked={rule.isRequired}
                              onCheckedChange={(checked) => updateRule(index, { isRequired: checked })}
                            />
                            <Label htmlFor={`required-rule-${rule.id}`} className="text-sm">Required to pass</Label>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeRule(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={addRule}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call Window Tab */}
          <TabsContent value="window" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Window Settings</CardTitle>
                <CardDescription>Configure when and how screening calls are made</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select 
                      value={callWindow.timezone}
                      onValueChange={(v) => setCallWindow({ ...callWindow, timezone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Attempts</Label>
                    <Input 
                      type="number" 
                      value={callWindow.maxAttempts}
                      onChange={(e) => setCallWindow({ 
                        ...callWindow, 
                        maxAttempts: parseInt(e.target.value) || 3 
                      })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
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
                <div className="space-y-4">
                  <Label>Allowed Days</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <Button
                        key={day}
                        variant={callWindow.allowedDays.includes(index) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const days = callWindow.allowedDays.includes(index)
                            ? callWindow.allowedDays.filter(d => d !== index)
                            : [...callWindow.allowedDays, index].sort();
                          setCallWindow({ ...callWindow, allowedDays: days });
                        }}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>SMS Reminders</Label>
                      <p className="text-sm text-muted-foreground">Send SMS reminders before calls</p>
                    </div>
                    <Switch 
                      checked={callWindow.smsReminder}
                      onCheckedChange={(checked) => setCallWindow({ ...callWindow, smsReminder: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Reminders</Label>
                      <p className="text-sm text-muted-foreground">Send email reminders before calls</p>
                    </div>
                    <Switch 
                      checked={callWindow.emailReminder}
                      onCheckedChange={(checked) => setCallWindow({ ...callWindow, emailReminder: checked })}
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
                <CardTitle>Test Conversation</CardTitle>
                <CardDescription>Simulate a screening conversation with your current configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <PlayCircle className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-semibold mb-2">Ready to test?</h3>
                  <p className="text-muted-foreground mb-4">
                    {isNewRole 
                      ? "Save the role first to test the conversation flow"
                      : "Start a simulated conversation to test your screening flow"}
                  </p>
                  <Button 
                    className="bg-gradient-primary border-0"
                    disabled={isNewRole}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Start Test Conversation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}