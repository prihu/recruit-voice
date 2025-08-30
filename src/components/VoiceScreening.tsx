import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useVoiceScreening } from '@/hooks/useVoiceScreening';
import { Role, Candidate } from '@/types';

interface VoiceScreeningProps {
  screenId: string;
  role: Role;
  candidate: Candidate;
  onComplete?: (data: any) => void;
}

export function VoiceScreening({ screenId, role, candidate, onComplete }: VoiceScreeningProps) {
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
  } = useVoiceScreening({ screenId, role, candidate, onComplete });

  const progress = totalQuestions > 0 ? (currentQuestion / totalQuestions) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Screening Interview</CardTitle>
        <CardDescription>
          {isActive ? `Question ${currentQuestion + 1} of ${totalQuestions}` : 'Click start to begin the interview'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">{status === 'connected' ? 'Connected' : 'Disconnected'}</span>
          </div>
          {isSpeaking && (
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-sm">AI Speaking</span>
            </div>
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
            <Button onClick={startScreening} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Interview
                </>
              )}
            </Button>
          ) : (
            <Button onClick={stopScreening} variant="destructive" className="flex-1">
              <MicOff className="mr-2 h-4 w-4" />
              End Interview
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}