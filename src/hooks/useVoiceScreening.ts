import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { Role, Candidate } from '@/types';
import { toast } from '@/hooks/use-toast';

interface UseVoiceScreeningOptions {
  screenId: string;
  role: Role;
  candidate: Candidate;
  onComplete?: (data: any) => void;
}

export function useVoiceScreening({
  screenId,
  role,
  candidate,
  onComplete
}: UseVoiceScreeningOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isActive, setIsActive] = useState(false);

  // Use the default agent ID from the environment or a fixed one
  const agentId = 'agent_3301k3x4pgrre4nsv53xt1wz79r6';

  const handleScreeningComplete = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Calculate score based on answers
      const score = calculateScore(answers, role);
      const outcome = score >= 70 ? 'pass' : 'fail';
      const reasons = generateReasons(answers, role, outcome);

      // Save the transcript and results
      await supabase.functions.invoke('elevenlabs-voice/save-transcript', {
        body: {
          screenId,
          transcript: transcript.join('\n'),
          answers,
          outcome,
          score,
          reasons
        }
      });

      // Fetch updated screen data
      const { data: updatedScreen } = await supabase
        .from('screens')
        .select('*')
        .eq('id', screenId)
        .single();

      if (updatedScreen && onComplete) {
        onComplete(updatedScreen);
      }

      toast({
        title: "Screening completed",
        description: `Score: ${score}% - ${outcome === 'pass' ? 'Candidate passed' : 'Candidate did not pass'}`
      });
    } catch (error) {
      console.error('Error saving screening results:', error);
    }
  }, [conversationId, answers, role, screenId, transcript, onComplete]);

  const processAnswer = useCallback((text: string) => {
    // Process the answer based on the current question
    const currentQ = role.questions[currentQuestion];
    if (currentQ) {
      setAnswers(prev => ({
        ...prev,
        [currentQ.id]: text
      }));
    }
  }, [currentQuestion, role.questions]);

  const generatePrompt = (role: Role, candidate: Candidate) => {
    return `You are conducting a phone screening interview for the ${role.title} position.
    
Candidate Information:
- Name: ${candidate.name}
- Experience: ${candidate.expYears || 'Not specified'} years
- Location Preference: ${candidate.locationPref || 'Not specified'}
- Skills: ${candidate.skills?.join(', ') || 'Not specified'}

Role Requirements:
${role.summary}

Screening Questions:
${role.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Instructions:
1. Be professional and friendly
2. Ask each question clearly and wait for the candidate's response
3. For yes/no questions, confirm the answer if unclear
4. Allow candidates to ask clarifying questions
5. If they have questions about the role, refer to the FAQ section
6. After all questions, thank them and end the conversation
7. Use the provided tools to save answers and move between questions

FAQ for this role:
${role.faq.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}

Important: 
- Speak naturally and conversationally
- Be patient and give candidates time to think
- Clarify any ambiguous answers
- Call the appropriate tools to track progress`;
  };

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      setIsActive(true);
      toast({
        title: "Connected",
        description: "Voice screening session started"
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      setIsActive(false);
      handleScreeningComplete();
    },
    onMessage: (message: any) => {
      console.log('Message received:', message);
      
      // Handle different message types
      if (message.type === 'audio_transcript' || message.type === 'response.audio_transcript.delta') {
        const text = message.text || message.delta || '';
        if (text) {
          setTranscript(prev => [...prev, `AI: ${text}`]);
        }
      } else if (message.type === 'user_transcript') {
        const text = message.text || '';
        if (text) {
          setTranscript(prev => [...prev, `Candidate: ${text}`]);
          processAnswer(text);
        }
      }
    },
    onError: (error: any) => {
      console.error('Conversation error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during the screening",
        variant: "destructive"
      });
    },
    clientTools: {
      moveToNextQuestion: () => {
        setCurrentQuestion(prev => prev + 1);
        return "Moving to next question";
      },
      saveAnswer: (parameters: { questionId: string; answer: any }) => {
        setAnswers(prev => ({
          ...prev,
          [parameters.questionId]: parameters.answer
        }));
        return "Answer saved";
      },
      endScreening: () => {
        handleScreeningComplete();
        return "Screening ended";
      }
    },
    overrides: {
      agent: {
        prompt: {
          prompt: generatePrompt(role, candidate),
        },
        firstMessage: `Hello ${candidate.name}, I'm here to conduct your phone screening for the ${role.title} position. Before we begin, I need your verbal consent to record this conversation for evaluation purposes. Do you agree to proceed?`,
        language: (candidate.language || "en") as any,
      }
    }
  });

  const startScreening = async () => {
    try {
      setIsLoading(true);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get signed URL from our edge function
      const { data: { user } } = await supabase.auth.getUser();
      const response = await supabase.functions.invoke('elevenlabs-voice/get-signed-url', {
        body: { screenId, agentId }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { signedUrl, conversationId: convId } = response.data;
      setConversationId(convId);

      // Start the conversation
      await conversation.startSession({ 
        agentId: signedUrl 
      } as any);

      setIsLoading(false);

    } catch (error: any) {
      console.error('Failed to start screening:', error);
      toast({
        title: "Failed to start",
        description: error.message || "Could not start voice screening",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const stopScreening = async () => {
    try {
      await conversation.endSession();
      handleScreeningComplete();
    } catch (error) {
      console.error('Error stopping screening:', error);
    }
  };

  const calculateScore = (answers: Record<string, any>, role: Role): number => {
    let totalScore = 0;
    let maxScore = 0;

    role.questions.forEach(question => {
      const answer = answers[question.id];
      const rule = role.rules.find(r => r.condition.field === question.id);
      
      if (rule) {
        maxScore += rule.weight;
        
        if (answer && evaluateRule(answer, rule)) {
          totalScore += rule.weight;
        }
      } else {
        // Default scoring for questions without rules
        maxScore += 10;
        if (answer) {
          totalScore += 5; // Partial credit for answering
        }
      }
    });

    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  };

  const evaluateRule = (answer: any, rule: any): boolean => {
    const { operator, value } = rule.condition;
    
    switch (operator) {
      case 'equals':
        return answer === value;
      case 'greater_than':
        return Number(answer) > Number(value);
      case 'less_than':
        return Number(answer) < Number(value);
      case 'contains':
        return String(answer).toLowerCase().includes(String(value).toLowerCase());
      case 'in':
        return Array.isArray(value) && value.includes(answer);
      default:
        return false;
    }
  };

  const generateReasons = (answers: Record<string, any>, role: Role, outcome: string): string[] => {
    const reasons: string[] = [];

    if (outcome === 'pass') {
      reasons.push('Met minimum qualification requirements');
      
      // Check for standout answers
      role.questions.forEach(question => {
        const answer = answers[question.id];
        if (answer && question.matchConfig?.expectedAnswer === answer) {
          reasons.push(`Strong answer for: ${question.text}`);
        }
      });
    } else {
      reasons.push('Did not meet minimum qualification requirements');
      
      // Check for missing critical answers
      role.rules
        .filter(rule => rule.isRequired)
        .forEach(rule => {
          const answer = answers[rule.condition.field];
          if (!answer || !evaluateRule(answer, rule)) {
            reasons.push(rule.failureReason || `Failed requirement: ${rule.name}`);
          }
        });
    }

    return reasons;
  };

  return {
    startScreening,
    stopScreening,
    isLoading,
    isActive,
    transcript,
    currentQuestion,
    totalQuestions: role.questions.length,
    answers,
    conversationId,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status,
    setVolume: conversation.setVolume
  };
}