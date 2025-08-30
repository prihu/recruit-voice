// Mock data for demonstration and development
import { Role, Candidate, Screen } from '@/types';

export const mockRoles: Role[] = [
  {
    id: 'role-1',
    title: 'Senior Python Backend Engineer',
    location: 'Bangalore, India',
    salaryBand: {
      min: 2500000,
      max: 4000000,
      currency: 'INR'
    },
    summary: 'We are looking for a Senior Python Backend Engineer to join our core infrastructure team. You will be responsible for building scalable APIs and microservices.',
    status: 'active',
    questions: [
      {
        id: 'q1',
        text: 'Do you have at least 5 years of experience with Python?',
        type: 'yes_no',
        required: true,
        order: 1,
        matchConfig: {
          expectedAnswer: true
        }
      },
      {
        id: 'q2',
        text: 'How many years of experience do you have with Django or FastAPI?',
        type: 'number',
        required: true,
        order: 2,
        matchConfig: {
          minYears: 3
        }
      },
      {
        id: 'q3',
        text: 'Which databases have you worked with?',
        type: 'multi_choice',
        required: true,
        order: 3,
        options: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra'],
        matchConfig: {
          acceptableAnswers: ['PostgreSQL', 'Redis']
        }
      },
      {
        id: 'q4',
        text: 'Describe your experience with microservices architecture',
        type: 'free_text',
        required: false,
        order: 4
      }
    ],
    faq: [
      {
        id: 'faq1',
        question: 'What is the team size?',
        answer: 'You will be joining a team of 8 engineers working on our core platform.',
        keywords: ['team', 'size', 'engineers']
      },
      {
        id: 'faq2',
        question: 'Is remote work allowed?',
        answer: 'We offer a hybrid model with 3 days in office and 2 days remote per week.',
        keywords: ['remote', 'work from home', 'hybrid']
      }
    ],
    rules: [
      {
        id: 'rule1',
        name: 'Python Experience Required',
        condition: {
          field: 'q1',
          operator: 'equals',
          value: true
        },
        weight: 30,
        isRequired: true,
        failureReason: 'Insufficient Python experience'
      },
      {
        id: 'rule2',
        name: 'Framework Experience',
        condition: {
          field: 'q2',
          operator: 'greater_than',
          value: 2
        },
        weight: 25,
        isRequired: true,
        failureReason: 'Insufficient framework experience'
      }
    ],
    callWindow: {
      timezone: 'Asia/Kolkata',
      allowedHours: {
        start: '10:00',
        end: '18:00'
      },
      allowedDays: [1, 2, 3, 4, 5], // Monday to Friday
      maxAttempts: 3,
      attemptSpacing: 120,
      smsReminder: true,
      emailReminder: true
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    screeningsCount: 12
  }
];

export const mockCandidates: Candidate[] = [
  {
    id: 'cand-1',
    externalId: 'ATS-001',
    name: 'Rajesh Kumar',
    phone: '+91-9876543210',
    email: 'rajesh.kumar@example.com',
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker'],
    expYears: 6,
    locationPref: 'Bangalore',
    salaryExpectation: 3200000,
    language: 'English',
    createdAt: new Date('2024-01-20')
  },
  {
    id: 'cand-2',
    externalId: 'ATS-002',
    name: 'Priya Sharma',
    phone: '+91-9876543211',
    email: 'priya.sharma@example.com',
    skills: ['Python', 'FastAPI', 'MongoDB', 'AWS'],
    expYears: 4,
    locationPref: 'Bangalore',
    salaryExpectation: 2800000,
    language: 'English',
    createdAt: new Date('2024-01-21')
  },
  {
    id: 'cand-3',
    externalId: 'ATS-003',
    name: 'Amit Patel',
    phone: '+91-9876543212',
    email: 'amit.patel@example.com',
    skills: ['Java', 'Spring Boot', 'MySQL'],
    expYears: 3,
    locationPref: 'Mumbai',
    salaryExpectation: 2200000,
    language: 'English',
    createdAt: new Date('2024-01-22')
  }
];

export const mockScreens: Screen[] = [
  {
    id: 'screen-1',
    roleId: 'role-1',
    candidateId: 'cand-1',
    role: mockRoles[0],
    candidate: mockCandidates[0],
    status: 'completed',
    attempts: 1,
    transcript: [
      {
        timestamp: new Date('2024-01-25T10:00:00'),
        speaker: 'agent',
        text: 'Hello Rajesh, this is an automated screening call for the Senior Python Backend Engineer position. Do you have a few minutes to answer some questions?'
      },
      {
        timestamp: new Date('2024-01-25T10:00:15'),
        speaker: 'candidate',
        text: 'Yes, I have time now.'
      },
      {
        timestamp: new Date('2024-01-25T10:00:30'),
        speaker: 'agent',
        text: 'Great! First, do you have at least 5 years of experience with Python?'
      },
      {
        timestamp: new Date('2024-01-25T10:00:35'),
        speaker: 'candidate',
        text: 'Yes, I have 6 years of experience with Python.'
      }
    ],
    answers: {
      q1: true,
      q2: 4,
      q3: ['PostgreSQL', 'Redis'],
      q4: 'I have built multiple microservices using Django and FastAPI, implementing event-driven architecture with Redis and RabbitMQ.'
    },
    score: 85,
    outcome: 'pass',
    reasons: ['Strong Python experience', 'Meets framework requirements', 'Good database knowledge'],
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25')
  },
  {
    id: 'screen-2',
    roleId: 'role-1',
    candidateId: 'cand-3',
    role: mockRoles[0],
    candidate: mockCandidates[2],
    status: 'completed',
    attempts: 2,
    answers: {
      q1: false,
      q2: 0,
      q3: ['MySQL'],
      q4: 'Limited experience with microservices.'
    },
    score: 25,
    outcome: 'fail',
    reasons: ['No Python experience', 'Does not meet framework requirements'],
    createdAt: new Date('2024-01-26'),
    updatedAt: new Date('2024-01-26')
  }
];