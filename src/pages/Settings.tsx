import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { TestTube, Check, X, Loader2, AlertCircle, Key } from 'lucide-react';
import { useDemoAPI } from '@/hooks/useDemoAPI';

export default function Settings() {
  const demoAPI = useDemoAPI();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error' | 'missing-key'>('idle');

  const testElevenLabsConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Test the actual ElevenLabs API configuration
      const response = await fetch('https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1/demo-api-agent-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test-connection'
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setConnectionStatus('connected');
        toast({
          title: "✅ Connection Successful",
          description: "ElevenLabs API is configured and working correctly",
        });
      } else {
        const isMissingKey = data.error?.includes('API key not configured');
        setConnectionStatus(isMissingKey ? 'missing-key' : 'error');
        
        toast({
          title: isMissingKey ? "API Key Missing" : "Connection Failed",
          description: data.error || "Failed to connect to ElevenLabs API",
          variant: "destructive"
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Test Failed",
        description: "Could not test ElevenLabs connection. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
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

        {/* ElevenLabs Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>ElevenLabs Configuration</CardTitle>
            <CardDescription>
              Test your ElevenLabs API connection. Voice agents are configured per role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                • Voice settings are configured in your ElevenLabs agent dashboard
              </p>
              <p>
                • Each role can have its own voice agent with custom prompts and settings
              </p>
              <p>
                • Configure agent IDs in the Voice tab when editing a role
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Status Card */}
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
                  Configured in Supabase
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Webhook URL</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {window.location.origin}/functions/v1/elevenlabs-voice/phone-webhook
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}