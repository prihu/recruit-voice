// Core type definitions for the AI Phone Screening system

export interface Role {
  id: string;
  title: string;
  location: string;
  salaryBand?: {
    min: number;
    max: number;
    currency: string;
  };
  summary: string;
  questions: ScreeningQuestion[];
  faq: FAQEntry[];
  rules: ScoringRule[];
  callWindow: CallWindow;
  status: 'draft' | 'active';
  createdAt: Date;
  updatedAt: Date;
  screeningsCount?: number;
  voice_agent_id?: string;
  agent_sync_status?: string;
  voice_enabled?: boolean;
}

export interface ScreeningQuestion {
  id: string;
  text: string;
  type: 'yes_no' | 'number' | 'multi_choice' | 'free_text';
  required: boolean;
  order: number;
  matchConfig?: {
    minYears?: number;
    requiredSkill?: string;
    expectedAnswer?: string | boolean | number;
    acceptableAnswers?: string[];
  };
  options?: string[]; // For multi_choice
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  keywords?: string[];
}

export interface ScoringRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
    value: any;
  };
  weight: number;
  failureReason?: string;
  isRequired?: boolean;
}

export interface CallWindow {
  timezone: string;
  allowedHours: {
    start: string; // "09:00"
    end: string;   // "17:00"
  };
  allowedDays: number[]; // 0-6, where 0 is Sunday
  maxAttempts: number;
  attemptSpacing: number; // minutes
  smsReminder: boolean;
  emailReminder: boolean;
}

export interface Candidate {
  id: string;
  externalId?: string;
  name: string;
  phone: string;
  email: string;
  skills?: string[];
  expYears?: number;
  locationPref?: string;
  salaryExpectation?: number;
  language?: string;
  createdAt: Date;
}

export interface Screen {
  id: string;
  roleId: string;
  candidateId: string;
  role?: Role;
  candidate?: Candidate;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'incomplete';
  attempts: number;
  transcript?: TranscriptEntry[];
  audioUrl?: string;
  answers?: Record<string, any>;
  score?: number;
  outcome?: 'pass' | 'fail' | 'incomplete' | null;
  reasons?: string[];
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  // Call quality metrics
  conversation_turns?: number;
  candidate_responded?: boolean;
  call_connected?: boolean;
  first_response_time_seconds?: number | null;
}

export interface TranscriptEntry {
  timestamp: Date;
  speaker: 'agent' | 'candidate';
  text: string;
  confidence?: number;
}

export interface ConversationState {
  state: 'INIT' | 'CONSENT' | 'VERIFY' | 'QUESTIONS' | 'FAQ' | 'SUMMARY' | 'DISPOSITION';
  currentQuestionIndex?: number;
  answers: Record<string, any>;
  faqCount: number;
  attempts: number;
  transcript: TranscriptEntry[];
}

export interface ImportMapping {
  [key: string]: string; // CSV column -> system field
}