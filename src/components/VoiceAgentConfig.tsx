import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { toast } from '@/hooks/use-toast';

interface VoiceAgentConfigProps {
  roleId: string;
  currentAgentId?: string;
  onUpdate?: (agentId: string) => void;
}

export function VoiceAgentConfig({ roleId, currentAgentId, onUpdate }: VoiceAgentConfigProps) {
  const demoAPI = useDemoAPI();
  const [agentId, setAgentId] = useState(currentAgentId || '');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setAgentId(currentAgentId || '');
  }, [currentAgentId]);

  const testAgentConnection = async () => {
    if (!agentId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an Agent ID',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setTestStatus('idle');

    try {
      // In demo mode, always simulate success
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setTestStatus('success');
      toast({
        title: 'Success',
        description: 'Voice agent validated successfully (Demo Mode)'
      });
    } catch (error) {
      setTestStatus('error');
      toast({
        title: 'Error',
        description: 'Failed to validate agent',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const saveAgentId = async () => {
    setSaving(true);
    
    try {
      // Use demo API to update agent configuration
      await demoAPI.updateAgentConfig(roleId, agentId.trim());

      toast({
        title: 'Success',
        description: 'Voice agent configuration saved (Demo Mode)'
      });

      if (onUpdate) {
        onUpdate(agentId);
      }
    } catch (error) {
      console.error('Error saving agent ID:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Voice Agent Configuration
        </CardTitle>
        <CardDescription>
          Configure ElevenLabs voice agent for phone-based screening
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentAgentId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Voice agent not configured. Phone screening will not work until you configure a valid ElevenLabs agent ID.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="agent-id">ElevenLabs Agent ID</Label>
          <div className="flex gap-2">
            <Input
              id="agent-id"
              placeholder="Enter your ElevenLabs Agent ID"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={testAgentConnection}
              disabled={testing || !agentId.trim()}
            >
              {testing ? 'Testing...' : 'Test'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get this from your ElevenLabs Conversational AI dashboard
          </p>
        </div>

        {testStatus === 'success' && (
          <Alert className="border-success bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Agent validated successfully! Ready for phone screening.
            </AlertDescription>
          </Alert>
        )}

        {testStatus === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to validate agent. Please check your Agent ID and API key.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            {currentAgentId && (
              <Badge variant="outline" className="text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                Currently configured
              </Badge>
            )}
          </div>
          <Button
            onClick={saveAgentId}
            disabled={saving || !agentId.trim() || agentId === currentAgentId}
            className="bg-gradient-primary border-0"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>

        <div className="pt-4 border-t space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuration Tips
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Create an agent in ElevenLabs with your screening questions</li>
            <li>• Configure the agent's voice, language, and conversation flow</li>
            <li>• Test the agent in ElevenLabs before using it here</li>
            <li>• Ensure your ElevenLabs account has phone calling enabled</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}