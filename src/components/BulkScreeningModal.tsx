import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Phone, Clock, Calendar, DollarSign, Users, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BulkScreeningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedRole?: string;
  preSelectedCandidates?: string[];
  onSuccess?: (operationId: string) => void;
}

export function BulkScreeningModal({
  open,
  onOpenChange,
  preSelectedRole,
  preSelectedCandidates = [],
  onSuccess
}: BulkScreeningModalProps) {
  const [selectedRole, setSelectedRole] = useState(preSelectedRole || '');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(preSelectedCandidates);
  const [roles, setRoles] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [schedulingType, setSchedulingType] = useState<'immediate' | 'scheduled'>('immediate');
  const [batchSize, setBatchSize] = useState([10]);
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchRoles();
      fetchCandidates();
    }
  }, [open]);

  useEffect(() => {
    if (preSelectedRole) {
      setSelectedRole(preSelectedRole);
    }
  }, [preSelectedRole]);

  const fetchRoles = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: orgData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .single();

    if (orgData) {
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .eq('organization_id', orgData.organization_id)
        .eq('status', 'active')
        .eq('voice_enabled', true);
      
      setRoles(rolesData || []);
    }
  };

  const fetchCandidates = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: orgData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .single();

    if (orgData) {
      // Get candidates that haven't been screened yet
      const { data: candidatesData } = await supabase
        .from('candidates')
        .select(`
          *,
          screens!left(
            id,
            status
          )
        `)
        .eq('organization_id', orgData.organization_id);
      
      // Filter out candidates already screened for the selected role
      const unscreenedCandidates = candidatesData?.filter(candidate => {
        const hasBeenScreened = candidate.screens?.some(
          (screen: any) => screen.status === 'completed' || screen.status === 'in_progress'
        );
        return !hasBeenScreened;
      }) || [];
      
      setCandidates(unscreenedCandidates);
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      candidate.name?.toLowerCase().includes(query) ||
      candidate.email?.toLowerCase().includes(query) ||
      candidate.phone?.includes(query)
    );
  });

  const handleToggleCandidate = (candidateId: string) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map(c => c.id));
    }
  };

  const estimatedCost = selectedCandidates.length * 0.15; // Estimated $0.15 per call
  const estimatedDuration = Math.ceil((selectedCandidates.length * 10) / batchSize[0]); // 10 min per call

  const handleStartScreening = async () => {
    if (!selectedRole || selectedCandidates.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please select a role and at least one candidate',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgData) throw new Error('Organization not found');

      // Create bulk operation record
      const { data: bulkOp, error: bulkError } = await supabase
        .from('bulk_operations')
        .insert({
          organization_id: orgData.organization_id,
          user_id: userData.user.id,
          role_id: selectedRole,
          total_count: selectedCandidates.length,
          status: 'pending',
          settings: {
            batch_size: batchSize[0],
            scheduling_type: schedulingType,
            scheduled_time: schedulingType === 'scheduled' ? scheduledTime : null,
          }
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      // Call the edge function to process bulk screening
      const { error } = await supabase.functions.invoke('process-bulk-screenings', {
        body: {
          bulk_operation_id: bulkOp.id,
          role_id: selectedRole,
          candidate_ids: selectedCandidates,
          scheduling_type: schedulingType,
          scheduled_time: schedulingType === 'scheduled' ? scheduledTime : null,
          batch_size: batchSize[0],
        }
      });

      if (error) throw error;

      toast({
        title: 'Bulk Screening Initiated',
        description: `Started screening ${selectedCandidates.length} candidates`,
      });

      if (onSuccess) {
        onSuccess(bulkOp.id);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error starting bulk screening:', error);
      toast({
        title: 'Error',
        description: 'Failed to start bulk screening',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Bulk Screening</DialogTitle>
          <DialogDescription>
            Configure and launch screening calls for multiple candidates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Select Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    <div>
                      <div className="font-medium">{role.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {role.location} • {role.questions?.length || 0} questions
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Candidate Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Candidates ({selectedCandidates.length} selected)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedCandidates.length === filteredCandidates.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <ScrollArea className="h-48 border rounded-lg p-3">
                <div className="space-y-2">
                  {filteredCandidates.map(candidate => (
                    <div key={candidate.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={candidate.id}
                        checked={selectedCandidates.includes(candidate.id)}
                        onCheckedChange={() => handleToggleCandidate(candidate.id)}
                      />
                      <Label
                        htmlFor={candidate.id}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        <div>
                          <div className="font-medium">{candidate.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {candidate.email} • {candidate.phone}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Scheduling Options */}
          <div className="space-y-2">
            <Label>Scheduling</Label>
            <RadioGroup value={schedulingType} onValueChange={(v: any) => setSchedulingType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate" className="font-normal">
                  Start immediately
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="font-normal">
                  Schedule for later
                </Label>
              </div>
            </RadioGroup>
            
            {schedulingType === 'scheduled' && (
              <Input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Batch Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Concurrent Calls</Label>
              <span className="text-sm text-muted-foreground">{batchSize[0]} calls</span>
            </div>
            <Slider
              value={batchSize}
              onValueChange={setBatchSize}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher values process faster but may impact call quality
            </p>
          </div>

          {/* Cost & Time Estimates */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3" />
                    Estimated Cost:
                  </span>
                  <Badge variant="secondary">${estimatedCost.toFixed(2)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Estimated Duration:
                  </span>
                  <Badge variant="secondary">{estimatedDuration} minutes</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Total Candidates:
                  </span>
                  <Badge variant="secondary">{selectedCandidates.length}</Badge>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleStartScreening}
            disabled={isLoading || !selectedRole || selectedCandidates.length === 0}
            className="bg-gradient-primary border-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 mr-2" />
                Start Screening
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}