import { useState, useCallback } from 'react';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RoleWithAgent {
  id: string;
  title: string;
  questions?: any[];
  voice_agent_id?: string;
  [key: string]: any;
}

interface UseElevenLabsConversationProps {
  screenId: string;
  role: RoleWithAgent;
  candidate: any;
  onComplete?: (data: any) => void;
}

export function useElevenLabsConversation({
  screenId,
  role,
  candidate,
  onComplete
}: UseElevenLabsConversationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const totalQuestions = role.questions?.length || 0;

  const conversation = useConversation({
    onConnect: () => {
      console.log('ElevenLabs conversation connected');
      setTranscript(prev => [...prev, 'AI: Connected to voice agent']);
    },
    onDisconnect: () => {
      console.log('ElevenLabs conversation disconnected');
      handleConversationEnd();
    },
    onMessage: (message: any) => {
      console.log('ElevenLabs message:', message);
      
      // Handle messages from the conversation
      if (message.message && message.source) {
        const source = message.source === 'user' ? 'You' : 'AI';
        setTranscript(prev => [...prev, `${source}: ${message.message}`]);
        
        // Track question progress
        if (source === 'AI' && message.message.includes('Question')) {
          const match = message.message.match(/Question (\d+)/);
          if (match) {
            setCurrentQuestion(parseInt(match[1]) - 1);
          }
        }
      }
    },
    onError: (error: any) => {
      console.error('ElevenLabs conversation error:', error);
      toast({
        title: 'Conversation Error',
        description: typeof error === 'string' ? error : 'An error occurred during the conversation',
        variant: 'destructive',
      });
    }
  });

  const startScreening = useCallback(async () => {
    if (!role.voice_agent_id) {
      toast({
        title: 'Voice Agent Not Configured',
        description: 'Please configure the voice agent for this role first',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setTranscript([]);

    try {
      // Get signed URL from our edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice/get-signed-url', {
        body: {
          agentId: role.voice_agent_id,
          screenId,
          candidateId: candidate.id,
          metadata: {
            candidateName: candidate.name,
            candidatePhone: candidate.phone,
            roleTitle: role.title,
            roleId: role.id
          }
        }
      });

      if (error) throw error;
      if (!data.signedUrl) throw new Error('Failed to get conversation URL');

      console.log('Received signed URL and conversation ID:', { 
        hasSignedUrl: !!data.signedUrl, 
        conversationId: data.conversationId 
      });

      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the conversation with the signed URL
      const convId = await conversation.startSession({ 
        signedUrl: data.signedUrl 
      });
      
      // Store both the local session ID and the ElevenLabs conversation ID
      const elevenLabsConvId = data.conversationId || convId;
      setConversationId(elevenLabsConvId);
      console.log('Conversation started with ID:', elevenLabsConvId);
      
      // Update screen status with the ElevenLabs conversation ID
      await supabase
        .from('screens')
        .update({
          status: 'in_progress',
          conversation_id: elevenLabsConvId,
          started_at: new Date().toISOString()
        })
        .eq('id', screenId);
      
      console.log('Updated screen status to in_progress with conversation ID:', elevenLabsConvId);

      toast({
        title: 'Voice Interview Started',
        description: 'Please speak clearly into your microphone',
      });
    } catch (error: any) {
      console.error('Failed to start screening:', error);
      toast({
        title: 'Failed to Start Interview',
        description: error.message || 'Please check your microphone and try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [conversation, role.voice_agent_id, screenId, candidate]);

  const stopScreening = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const handleConversationEnd = async () => {
    if (!conversationId) return;

    try {
      // Save transcript and update screen status
      const { error } = await supabase.functions.invoke('elevenlabs-voice/save-transcript', {
        body: {
          screenId,
          conversationId,
          transcript: transcript.join('\n'),
          status: 'completed'
        }
      });

      if (error) throw error;

      // Update local screen status
      await supabase
        .from('screens')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          transcript: transcript.join('\n')
        })
        .eq('id', screenId);

      if (onComplete) {
        onComplete({
          conversationId,
          transcript,
          status: 'completed'
        });
      }

      toast({
        title: 'Interview Completed',
        description: 'The screening interview has been saved',
      });
    } catch (error: any) {
      console.error('Failed to save conversation:', error);
      toast({
        title: 'Failed to Save Interview',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return {
    startScreening,
    stopScreening,
    isLoading,
    isActive: conversation.status === 'connected',
    transcript,
    currentQuestion,
    totalQuestions,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status
  };
}