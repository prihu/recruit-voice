# Demo Mode Documentation

## Overview

### Purpose
This application provides a fully functional demo mode for the AI Phone Screening platform, allowing potential customers to explore all features without authentication or real data. The demo mode simulates a complete recruitment screening workflow with realistic data and interactions.

### Key Principles
1. **No Authentication Required**: All features accessible without login
2. **Realistic Data**: Pre-populated with sample roles, candidates, and screening results
3. **Full Feature Access**: All UI features functional with simulated backend responses
4. **Consistent Experience**: Uses fixed org ID (`f47ac10b-58cc-4372-a567-0e02b2c3d479`) across all operations
5. **API-First Approach**: All data operations go through centralized demo API

### Architecture Decisions
- **Frontend**: Uses `useDemoAPI` hook for all data operations
- **Backend**: Demo-specific edge functions handle all requests
- **Constants**: Centralized in `src/lib/demoConstants.ts`
- **No Direct Supabase**: Frontend never directly queries Supabase in demo mode

## Current State (As of Latest Implementation)

### ✅ Completed Components

#### Core Infrastructure
- [x] `src/lib/demoConstants.ts` - Central configuration for demo mode
- [x] `src/hooks/useDemoAPI.ts` - Main hook for demo API operations (EXTENDED with all missing endpoints)
- [x] `src/pages/DemoLogin.tsx` - Demo entry point (no actual auth)
- [x] `src/contexts/AuthContext.tsx` - Modified to support demo mode

#### Pages Updated for Demo Mode
- [x] `src/pages/Roles.tsx` - Uses demo API for roles management
- [x] `src/pages/RoleDetail.tsx` - Uses demo API for role details
- [x] `src/pages/CandidateImport.tsx` - Uses demo API for candidate operations
- [x] `src/pages/Index.tsx` - UPDATED: Now uses demo API instead of direct Supabase
- [x] `src/pages/Screens.tsx` - UPDATED: Now uses demo API, removed realtime subscriptions
- [x] `src/pages/ScreenDetail.tsx` - UPDATED: Now uses demo API for all data fetching
- [x] `src/pages/Settings.tsx` - UPDATED: Now uses demo API for connection testing

#### Components Updated for Demo Mode
- [x] `src/components/PhoneCallScheduler.tsx` - UPDATED: Uses demo API, removed auth checks
- [x] `src/components/VoiceAgentConfig.tsx` - UPDATED: Uses demo API, removed localStorage
- [x] `src/components/ScreeningQueue.tsx` - UPDATED: Uses demo API, removed realtime

#### Edge Functions Created
- [x] `demo-api-roles` - Handles role CRUD operations
- [x] `demo-api-candidates` - Handles candidate CRUD and bulk import
- [x] `demo-api-screenings` - Handles screening operations
- [x] `demo-api-analytics` - Provides analytics data
- [x] `demo-api-agent-manager` - Manages ElevenLabs agents

#### Demo API Endpoints Added
- [x] `getRole(id)` - Fetch single role details
- [x] `getScreen(id)` - Fetch single screen details
- [x] `updateScreen(id, updates)` - Update screen status
- [x] `scheduleCall(screenId, scheduledTime)` - Schedule phone calls
- [x] `testConnection()` - Test ElevenLabs connection
- [x] `updateAgentConfig(roleId, agentId)` - Update voice agent configuration
- [x] `getCandidate(id)` - Fetch single candidate details
- [x] `getBulkOperations()` - Fetch bulk screening operations
- [x] `updateBulkOperation(id, updates)` - Update bulk operation status

### ⚠️ Remaining Components to Check

#### Components That May Need Updates
- [ ] `src/components/BulkScreeningModal.tsx` - May need demo API integration
- [ ] `src/components/EnhancedAnalyticsDashboard.tsx` - Check for direct Supabase queries
- [ ] `src/components/CallMonitor.tsx` - Check for direct queries
- [ ] `src/components/ExportDialog.tsx` - Ensure uses demo data
- [ ] `src/components/QuickActionsMenu.tsx` - Check for direct queries

## Technical Details

### Demo API Endpoints
All endpoints are hosted at: `https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1/`

| Endpoint | Purpose | Methods |
|----------|---------|---------|
| `/demo-api-roles` | Role management | GET, POST, PUT, DELETE |
| `/demo-api-candidates` | Candidate management | GET, POST, PUT, DELETE |
| `/demo-api-screenings` | Screening operations | GET, POST, PUT |
| `/demo-api-analytics` | Analytics data | GET |
| `/demo-api-agent-manager` | Voice agent management | POST |

### Data Flow Pattern

```
Component → useDemoAPI Hook → Demo Edge Function → Supabase (with DEMO_ORG_ID)
```

### Component Pattern

#### ❌ OLD Pattern (Direct Supabase)
```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data } = await supabase.from('roles').select('*');
```

#### ✅ NEW Pattern (Demo API)
```typescript
const { getRoles } = useDemoAPI();
const { data } = await getRoles();
```

## Change Log

### 2024-01-15 - Initial Demo Mode Implementation
- Created demo constants file
- Built demo API hook
- Created demo edge functions for roles, candidates, screenings

### 2024-01-15 - Role Management Update
- Updated Roles.tsx to use demo API
- Updated RoleDetail.tsx to use demo API
- Removed auth checks from role pages

### 2024-01-15 - Candidate Import Update
- Modified CandidateImport.tsx for demo mode
- Added bulk import support to demo API

### 2024-01-16 - Identified Remaining Issues
- Discovered multiple components still using direct Supabase
- Found localStorage usage for API keys
- Identified missing demo API endpoints

## Testing Checklist

### After Each Component Update
- [ ] No authentication errors in console
- [ ] All CRUD operations work
- [ ] No localStorage references for sensitive data
- [ ] Data persists across page refreshes
- [ ] No realtime subscription errors

### Overall Demo Mode Verification
- [ ] Can access all pages without login
- [ ] Can create/edit/delete roles
- [ ] Can import candidates (single and bulk)
- [ ] Can view screening results
- [ ] Can access analytics dashboard
- [ ] Can export data
- [ ] Voice agent configuration works
- [ ] Call scheduling functions properly

## Known Issues & Workarounds

### Issue 1: Realtime Subscriptions
**Problem**: Supabase realtime requires authentication
**Solution**: Remove all realtime subscriptions in demo mode, use polling or manual refresh

### Issue 2: API Key Storage
**Problem**: Components use localStorage for API keys
**Solution**: Use demo/mock responses for API testing features

### Issue 3: File Uploads
**Problem**: Supabase storage requires authentication
**Solution**: Simulate file uploads with pre-defined sample data

## Best Practices for Future Development

1. **Always use `useDemoAPI` hook** for data operations
2. **Never import `supabase/client`** directly in components
3. **Test in demo mode first** before production features
4. **Update this documentation** with every change
5. **Check for auth dependencies** before adding new features

## Demo Data Structure

### Fixed IDs Used
- Organization ID: `f47ac10b-58cc-4372-a567-0e02b2c3d479`
- Demo User ID: `demo-user-001`

### Sample Data Categories
- **Roles**: 5-10 pre-populated job roles
- **Candidates**: 50+ sample candidates with varied profiles
- **Screenings**: 100+ screening records with different statuses
- **Analytics**: Pre-calculated metrics and trends

## Next Steps

1. Complete all pending component updates
2. Add missing demo API endpoints
3. Create automated tests for demo mode
4. Add demo mode indicator in UI
5. Create demo reset functionality
6. Add demo data refresh mechanism