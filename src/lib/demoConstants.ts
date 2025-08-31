// Demo mode configuration
export const DEMO_MODE = true;
export const DEMO_ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
export const DEMO_ORG_NAME = 'Demo Company';
export const DEMO_ORG_DOMAIN = 'demo.recruiterscreen.ai';

// Demo user configuration
export const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@recruiterscreen.ai',
  role: 'admin'
};

// API endpoints for demo mode
export const DEMO_API_BASE = 'https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1';

export const DEMO_ENDPOINTS = {
  roles: `${DEMO_API_BASE}/demo-api-roles`,
  candidates: `${DEMO_API_BASE}/demo-api-candidates`,
  screenings: `${DEMO_API_BASE}/demo-api-screenings`,
  analytics: `${DEMO_API_BASE}/demo-api-analytics`,
  bulkScreenings: `${DEMO_API_BASE}/demo-api-bulk-screenings`,
  agentManager: `${DEMO_API_BASE}/demo-api-agent-manager`,
};