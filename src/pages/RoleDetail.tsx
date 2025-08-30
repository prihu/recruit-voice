import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Save
} from 'lucide-react';
import { mockRoles } from '@/lib/mockData';
import { Role, ScreeningQuestion } from '@/types';

export default function RoleDetail() {
  const { id } = useParams();
  const [role, setRole] = useState<Role | undefined>(
    mockRoles.find(r => r.id === id)
  );
  const [activeTab, setActiveTab] = useState('overview');

  if (!role) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Role not found</h2>
          <Link to="/roles">
            <Button>Back to Roles</Button>
          </Link>
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
                <h1 className="text-3xl font-bold tracking-tight">{role.title}</h1>
                <Badge 
                  variant={role.status === 'active' ? 'default' : 'secondary'}
                  className={role.status === 'active' ? 'bg-success text-success-foreground' : ''}
                >
                  {role.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {role.location}
                </span>
                {role.salaryBand && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {role.salaryBand.currency} {(role.salaryBand.min / 100000).toFixed(0)}L - {(role.salaryBand.max / 100000).toFixed(0)}L
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <TestTube className="w-4 h-4 mr-2" />
              Test Configuration
            </Button>
            <Button className="bg-gradient-primary border-0">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
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
                    <Label htmlFor="title">Role Title</Label>
                    <Input id="title" value={role.title} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" value={role.location} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Role Summary</Label>
                  <Textarea 
                    id="summary" 
                    value={role.summary}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="min-salary">Minimum Salary</Label>
                    <Input 
                      id="min-salary" 
                      type="number" 
                      value={role.salaryBand?.min || ''} 
                      placeholder="e.g., 2500000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-salary">Maximum Salary</Label>
                    <Input 
                      id="max-salary" 
                      type="number" 
                      value={role.salaryBand?.max || ''} 
                      placeholder="e.g., 4000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select defaultValue={role.salaryBand?.currency || 'INR'}>
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
                {role.questions.map((question, index) => (
                  <div key={question.id} className="flex gap-3 p-4 border rounded-lg bg-card-hover">
                    <div className="flex items-center">
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                      <span className="ml-2 font-medium text-sm w-6">{index + 1}.</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input 
                        value={question.text} 
                        placeholder="Enter question text..."
                        className="font-medium"
                      />
                      <div className="flex gap-3">
                        <Select defaultValue={question.type}>
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
                          <Switch id={`required-${question.id}`} checked={question.required} />
                          <Label htmlFor={`required-${question.id}`} className="text-sm">Required</Label>
                        </div>
                      </div>
                      {question.type === 'multi_choice' && question.options && (
                        <div className="space-y-2 pl-4 border-l-2">
                          {question.options.map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-2">
                              <Input value={option} placeholder="Option..." />
                              <Button variant="ghost" size="icon">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Option
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
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
                {role.faq.map((entry) => (
                  <div key={entry.id} className="space-y-3 p-4 border rounded-lg bg-card-hover">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input value={entry.question} placeholder="What do candidates often ask?" />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea 
                        value={entry.answer} 
                        placeholder="Your response..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        {entry.keywords?.map((keyword, index) => (
                          <Badge key={index} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
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
                {role.rules.map((rule) => (
                  <div key={rule.id} className="space-y-3 p-4 border rounded-lg bg-card-hover">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <Input value={rule.name} placeholder="Rule name..." className="font-medium" />
                        <div className="flex gap-2">
                          <Select defaultValue={rule.condition.field}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {role.questions.map(q => (
                                <SelectItem key={q.id} value={q.id}>{q.text.substring(0, 30)}...</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select defaultValue={rule.condition.operator}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="greater_than">Greater Than</SelectItem>
                              <SelectItem value="less_than">Less Than</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            value={rule.condition.value} 
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
                              className="w-20"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch id={`required-rule-${rule.id}`} checked={rule.isRequired} />
                            <Label htmlFor={`required-rule-${rule.id}`} className="text-sm">Required to pass</Label>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
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
                    <Select defaultValue={role.callWindow.timezone}>
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
                    <Input type="number" value={role.callWindow.maxAttempts} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={role.callWindow.allowedHours.start} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={role.callWindow.allowedHours.end} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Allowed Days</Label>
                  <div className="flex gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <Badge
                        key={day}
                        variant={role.callWindow.allowedDays.includes(index) ? 'default' : 'outline'}
                        className="cursor-pointer"
                      >
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-reminder">SMS Reminders</Label>
                    <Switch id="sms-reminder" checked={role.callWindow.smsReminder} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-reminder">Email Reminders</Label>
                    <Switch id="email-reminder" checked={role.callWindow.emailReminder} />
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
                <CardDescription>Simulate a screening conversation to test your configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-6 border-2 border-dashed rounded-lg text-center">
                    <PlayCircle className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Test</h3>
                    <p className="text-muted-foreground mb-4">
                      Click below to start a simulated conversation with your current configuration
                    </p>
                    <Button className="bg-gradient-primary border-0">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Test Conversation
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>The test will simulate:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All configured screening questions</li>
                      <li>FAQ handling based on your entries</li>
                      <li>Scoring and pass/fail determination</li>
                      <li>Complete conversation flow from start to finish</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}