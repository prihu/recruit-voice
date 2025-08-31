import { useState, useCallback } from 'react';
import { Role, Candidate } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useDemoAPI } from '@/hooks/useDemoAPI';

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
  const demoAPI = useDemoAPI();

  const handleScreeningComplete = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Calculate score based on answers
      const score = calculateScore(answers, role);
      const outcome = score >= 70 ? 'pass' : 'fail';
      const reasons = generateReasons(answers, role, outcome);

      // Save the screening results via demo API
      await demoAPI.updateScreen(screenId, {
        transcript: transcript.join('\n'),
        extracted_data: answers,
        outcome,
        score,
        reasons,
        status: 'completed'
      });

      // Fetch updated screen data
      const updatedScreen = await demoAPI.getScreen(screenId);

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
  }, [conversationId, answers, role, screenId, transcript, onComplete, demoAPI]);

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

  const startScreening = async () => {
    try {
      setIsLoading(true);
      
      // In demo mode, simulate voice screening
      toast({
        title: "Demo Mode",
        description: "Voice screening simulation started"
      });
      
      setIsActive(true);
      setConversationId(`demo-${Date.now()}`);
      
      // Simulate screening progress
      setTimeout(() => {
        setTranscript([
          "AI: Hello, I'm here to conduct your phone screening.",
          "Candidate: Hi, I'm ready.",
          "AI: Great! Let's begin with the first question..."
        ]);
        setCurrentQuestion(1);
      }, 2000);

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
      setIsActive(false);
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
      const rule = role.rules?.find(r => r.condition.field === question.id);
      
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
      role.rules?.filter(rule => rule.isRequired)
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
    isSpeaking: false, // Demo mode doesn't have real speaking
    status: isActive ? 'connected' : 'disconnected',
    setVolume: () => {} // No-op in demo mode
  };
}