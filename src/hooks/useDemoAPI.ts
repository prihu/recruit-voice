import { DEMO_MODE, DEMO_ENDPOINTS, DEMO_ORG_ID } from '@/lib/demoConstants';
import { supabase } from '@/integrations/supabase/client';

export function useDemoAPI() {
  const fetchDemoAPI = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  };

  // Role operations
  const getRoles = async () => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.roles);
    }
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    return data;
  };

  const createRole = async (role: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.roles, {
        method: 'POST',
        body: JSON.stringify(role),
      });
    }
    const { data, error } = await supabase.from('roles').insert(role).select().single();
    if (error) throw error;
    return data;
  };

  const updateRole = async (id: string, updates: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.roles}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    }
    const { data, error } = await supabase.from('roles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  // Candidate operations
  const getCandidates = async (filters?: { skills?: string[]; location?: string }) => {
    if (DEMO_MODE) {
      const params = new URLSearchParams();
      if (filters?.skills) params.append('skills', filters.skills.join(','));
      if (filters?.location) params.append('location', filters.location);
      return fetchDemoAPI(`${DEMO_ENDPOINTS.candidates}?${params}`);
    }
    let query = supabase.from('candidates').select('*');
    if (filters?.skills) query = query.contains('skills', filters.skills);
    if (filters?.location) query = query.ilike('location_pref', `%${filters.location}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const createCandidate = async (candidate: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.candidates, {
        method: 'POST',
        body: JSON.stringify(candidate),
      });
    }
    const { data, error } = await supabase.from('candidates').insert(candidate).select().single();
    if (error) throw error;
    return data;
  };

  const bulkImportCandidates = async (candidates: any[]) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.candidates}/bulk`, {
        method: 'POST',
        body: JSON.stringify({ candidates }),
      });
    }
    const { data, error } = await supabase.from('candidates').insert(candidates).select();
    if (error) throw error;
    return { success: true, count: data.length, candidates: data };
  };

  // Screening operations
  const getScreenings = async () => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.screenings);
    }
    const { data, error } = await supabase.from('screens').select(`
      *,
      candidate:candidates(name, email, phone),
      role:roles(title)
    `);
    if (error) throw error;
    return { screens: data };
  };

  const initiateScreening = async (roleId: string, candidateIds: string[], scheduledTime?: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.screenings}/initiate`, {
        method: 'POST',
        body: JSON.stringify({ roleId, candidateIds, scheduledTime }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const bulkScreening = async (roleId: string, candidateIds: string[], settings?: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.bulkScreenings}`, {
        method: 'POST',
        body: JSON.stringify({ roleId, candidateIds, ...settings }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  // Analytics operations
  const getAnalytics = async (params?: { startDate?: string; endDate?: string; roleId?: string; includeDetails?: boolean }) => {
    if (DEMO_MODE) {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.roleId) queryParams.append('roleId', params.roleId);
      if (params?.includeDetails) queryParams.append('includeDetails', 'true');
      return fetchDemoAPI(`${DEMO_ENDPOINTS.analytics}?${queryParams}`);
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const exportAnalytics = async (format: 'csv' | 'json') => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.analytics}?format=${format}`);
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  // Agent operations
  const createAgent = async (roleId: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.agentManager, {
        method: 'POST',
        body: JSON.stringify({ action: 'create', roleId }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const updateAgent = async (agentId: string, updates: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.agentManager, {
        method: 'POST',
        body: JSON.stringify({ action: 'update', agentId, updates }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const testCall = async (agentId: string, phoneNumber: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(DEMO_ENDPOINTS.agentManager, {
        method: 'POST',
        body: JSON.stringify({ action: 'test-call', agentId, phoneNumber }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  // Additional endpoints for complete demo coverage
  const getRole = async (id: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.roles}/${id}`);
    }
    const { data, error } = await supabase.from('roles').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  const getScreen = async (id: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.screenings}/${id}`);
    }
    const { data, error } = await supabase.from('screens').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  const updateScreen = async (id: string, updates: any) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.screenings}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    }
    const { data, error } = await supabase.from('screens').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  const scheduleCall = async (roleId: string, candidateId: string, scheduledTime: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.screenings}/initiate`, {
        method: 'POST',
        body: JSON.stringify({ 
          roleId, 
          candidateIds: [candidateId], 
          scheduledTime 
        }),
      });
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const testConnection = async () => {
    if (DEMO_MODE) {
      // Demo mode always returns success
      return { success: true, message: 'Demo mode - connection simulated' };
    }
    // Original implementation would go here
    throw new Error('Not implemented in non-demo mode');
  };

  const updateAgentConfig = async (roleId: string, agentId: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.roles}/${roleId}/agent`, {
        method: 'PUT',
        body: JSON.stringify({ agentId }),
      });
    }
    const { data, error } = await supabase
      .from('roles')
      .update({ voice_agent_id: agentId, voice_enabled: true })
      .eq('id', roleId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const getCandidate = async (id: string) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.candidates}/${id}`);
    }
    const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  const getBulkOperations = async () => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.bulkScreenings}`);
    }
    const { data, error } = await supabase.from('bulk_operations').select('*');
    if (error) throw error;
    return data;
  };

  const updateBulkOperation = async (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry_failed') => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.bulkScreenings}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
    }
    const { data, error } = await supabase.from('bulk_operations').update({ status: action }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  const processBulkScreening = async (params: {
    bulk_operation_id: string;
    role_id: string;
    candidate_ids: string[];
    scheduling_type: string;
    scheduled_time?: string;
    batch_size: number;
  }) => {
    if (DEMO_MODE) {
      return fetchDemoAPI(`${DEMO_ENDPOINTS.screenings}/bulk-process`, {
        method: 'POST',
        body: JSON.stringify(params)
      });
    }

    const { data, error } = await supabase.functions.invoke('process-bulk-screenings', {
      body: params
    });
    
    if (error) throw error;
    return data;
  };

  return {
    // Role operations
    getRoles,
    getRole,
    createRole,
    updateRole,
    updateAgentConfig,

    // Candidate operations
    getCandidates,
    getCandidate,
    createCandidate,
    bulkImportCandidates,

    // Screening operations
    getScreenings,
    getScreen,
    updateScreen,
    initiateScreening,
    bulkScreening,
    scheduleCall,
    getBulkOperations,
    updateBulkOperation,
    processBulkScreening,

    // Analytics operations
    getAnalytics,
    exportAnalytics,

    // Agent operations
    createAgent,
    updateAgent,
    testCall,

    // Connection testing
    testConnection,

    // Constants
    DEMO_ORG_ID,
  };
}