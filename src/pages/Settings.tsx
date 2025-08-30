import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Settings2, Key, Volume2, TestTube, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  // Default Agent ID for automatic voice functionality
  const DEFAULT_AGENT_ID = 'l4Z9P6hLLbN38pYqnm41';
  
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [agentId, setAgentId] = useState(localStorage.getItem('elevenlabs_agent_id') || DEFAULT_AGENT_ID);
  const [isSaving, setIsSaving] = useState(false);

  // Save default Agent ID on mount if not already saved
  useEffect(() => {
    if (!localStorage.getItem('elevenlabs_agent_id')) {
      localStorage.setItem('elevenlabs_agent_id', DEFAULT_AGENT_ID);
    }
  }, []);

  const testElevenLabsConnection = async () => {
    const testAgentId = agentId || DEFAULT_AGENT_ID;
    
    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Test the connection by attempting to get a signed URL with correct endpoint
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice/get-signed-url', {
        body: {
          agentId: testAgentId,
          screenId: 'test-connection'
        }
      });

      if (error) throw error;

      if (data?.signedUrl) {
        setConnectionStatus('connected');
        toast({
          title: "Success",
          description: "Successfully connected to ElevenLabs - Voice AI is ready",
        });
      } else {
        throw new Error('Invalid response from ElevenLabs');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to ElevenLabs",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Save settings to local storage for now
      // In production, you'd save this to the database
      localStorage.setItem('elevenlabs_agent_id', agentId);
      
      toast({
        title: "Settings Saved",
        description: "Your ElevenLabs settings have been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your AI phone screening system
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="elevenlabs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="elevenlabs">
              <Key className="w-4 h-4 mr-2" />
              ElevenLabs
            </TabsTrigger>
            <TabsTrigger value="voice">
              <Volume2 className="w-4 h-4 mr-2" />
              Voice Settings
            </TabsTrigger>
            <TabsTrigger value="general">
              <Settings2 className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
          </TabsList>

          {/* ElevenLabs Tab */}
          <TabsContent value="elevenlabs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ElevenLabs Configuration</CardTitle>
                <CardDescription>
                  Configure your ElevenLabs Conversational AI integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-id">Agent ID</Label>
                  <Input
                    id="agent-id"
                    placeholder={`Default: ${DEFAULT_AGENT_ID}`}
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Using default Agent ID for voice AI. You can replace with your own from ElevenLabs dashboard.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={testElevenLabsConnection}
                    disabled={isTestingConnection}
                    variant="outline"
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>

                  {connectionStatus === 'connected' && (
                    <Badge className="bg-success text-success-foreground">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  {connectionStatus === 'error' && (
                    <Badge variant="destructive">
                      <X className="w-3 h-3 mr-1" />
                      Connection Failed
                    </Badge>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Button onClick={saveSettings} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Status</CardTitle>
                <CardDescription>
                  Check the status of your ElevenLabs API connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">API Key</span>
                    <Badge variant="outline">
                      <Check className="w-3 h-3 mr-1" />
                      Configured
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Webhook URL</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {window.location.origin}/api/elevenlabs-webhook
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Settings Tab */}
          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Voice Configuration</CardTitle>
                <CardDescription>
                  Configure default voice settings for AI agents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voice-model">Voice Model</Label>
                  <select
                    id="voice-model"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="eleven_turbo_v2">Eleven Turbo v2 (Low latency)</option>
                    <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                    <option value="eleven_monolingual_v1">Eleven English v1</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice-id">Default Voice</Label>
                  <select
                    id="voice-id"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="9BWtsMINqrJLrRacOk9x">Aria</option>
                    <option value="CwhRBWXzGAHq8TQ4Fs17">Roger</option>
                    <option value="EXAVITQu4vr4xnSDxMaL">Sarah</option>
                    <option value="FGY2WhTYpPnrIDTdsKH5">Laura</option>
                    <option value="IKne3meq5aSn9XLyUdCD">Charlie</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Default Language</Label>
                  <select
                    id="language"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    placeholder="Your Company Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <select
                    id="timezone"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Asia/Kolkata">India Standard Time</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-attempts">Max Call Attempts</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="3"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of attempts to reach a candidate
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}