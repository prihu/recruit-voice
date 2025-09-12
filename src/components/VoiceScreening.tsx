import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2, AlertCircle, Settings } from 'lucide-react';
import { useElevenLabsConversation } from '@/hooks/useElevenLabsConversation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { validateIndianPhone } from '@/utils/indianPhoneValidator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface VoiceScreeningProps {
  screenId: string;
  role: any; // Using any to match the hook interface
  candidate: any;
  onComplete?: (data: any) => void;
}

export function VoiceScreening({ screenId, role, candidate, onComplete }: VoiceScreeningProps) {
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  
  // Use real ElevenLabs conversation if agent is configured
  const {
    startScreening,
    stopScreening,
    isLoading,
    isActive,
    transcript,
    currentQuestion,
    totalQuestions,
    isSpeaking,
    status
  } = useElevenLabsConversation({ screenId, role, candidate, onComplete });

  const initiatePhoneCall = async () => {
    if (!role.voice_agent_id) {
      toast({
        title: 'Voice Agent Not Configured',
        description: 'Please configure the voice agent for this role first',
        variant: 'destructive',
      });
      return;
    }

    if (!candidate.phone) {
      toast({
        title: 'Phone Number Missing',
        description: 'Candidate phone number is required for phone screening',
        variant: 'destructive',
      });
      return;
    }

    // Validate phone number
    const phoneValidation = validateIndianPhone(candidate.phone);
    if (!phoneValidation.isValid) {
      toast({
        title: 'Invalid Phone Number',
        description: phoneValidation.error || 'Please enter a valid 10-digit Indian mobile number',
        variant: 'destructive',
      });
      return;
    }

    setIsInitiatingCall(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice/initiate-phone-call', {
        body: {
          agentId: role.voice_agent_id,
          phoneNumber: phoneValidation.formatted,
          screenId,
          candidateId: candidate.id,
          metadata: {
            candidateName: candidate.name,
            roleTitle: role.title,
            roleId: role.id
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Phone Call Initiated',
        description: `Calling ${candidate.name} at ${candidate.phone}`,
      });

      // Update screen status
      await supabase
        .from('screens')
        .update({
          status: 'calling',
          call_initiated_at: new Date().toISOString()
        })
        .eq('id', screenId);

    } catch (error: any) {
      console.error('Failed to initiate phone call:', error);
      toast({
        title: 'Failed to Initiate Call',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const progress = totalQuestions > 0 ? (currentQuestion / totalQuestions) * 100 : 0;
  const hasVoiceAgent = role.voice_agent_id && role.voice_enabled !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Screening Interview</CardTitle>
        <CardDescription>
          {isActive ? `Question ${currentQuestion + 1} of ${totalQuestions}` : 
           hasVoiceAgent ? 'AI-powered screening interview' : 'Voice agent configuration required'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Agent Configuration Warning */}
        {!hasVoiceAgent && (
          <Alert className="border-warning">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="space-y-2">
              <p>Voice agent is not configured for this role. Configure it to enable voice interviews.</p>
              <Link to={`/roles/${role.id}`}>
                <Button variant="outline" size="sm" className="mt-2">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Voice Agent
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}
        {/* Progress Bar */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center gap-4">
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {status === 'connected' ? 'Connected' : isLoading ? 'Connecting...' : 'Ready'}
          </Badge>
          {isSpeaking && (
            <Badge variant="outline" className="animate-pulse">
              <Volume2 className="h-3 w-3 mr-1" />
              AI Speaking
            </Badge>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            <div className="space-y-2">
              {transcript.map((line, index) => (
                <p key={index} className={`text-sm ${line.startsWith('AI:') ? 'text-primary' : 'text-foreground'}`}>
                  {line}
                </p>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isActive ? (
            <>
              <Button 
                onClick={startScreening} 
                disabled={isLoading || !hasVoiceAgent} 
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Start Web Interview
                  </>
                )}
              </Button>
              <Button 
                onClick={initiatePhoneCall} 
                disabled={isInitiatingCall || !candidate.phone || !hasVoiceAgent}
                variant="outline"
                className="flex-1"
              >
                {isInitiatingCall ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Initiate Phone Call
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={stopScreening} variant="destructive" className="w-full">
              <MicOff className="mr-2 h-4 w-4" />
              End Interview
            </Button>
          )}
        </div>
        
        {/* Phone Number Display */}
        {candidate.phone && (
          <div className="text-sm text-muted-foreground text-center">
            Candidate Phone: {candidate.phone}
          </div>
        )}
      </CardContent>
    </Card>
  );
}