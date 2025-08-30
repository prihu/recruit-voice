import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Clock, User, Briefcase, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface ActiveCall {
  id: string;
  candidateName: string;
  roleName: string;
  status: string;
  startedAt: Date;
  duration: number;
  phoneNumber: string;
}

export function CallMonitor() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCalls();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('active-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screens',
          filter: 'status=in.(in_progress,scheduled)',
        },
        (payload) => {
          console.log('Call status update:', payload);
          fetchActiveCalls();
        }
      )
      .subscribe();

    // Update duration every second for active calls
    const interval = setInterval(() => {
      setActiveCalls((prev) =>
        prev.map((call) => ({
          ...call,
          duration: Math.floor((Date.now() - call.startedAt.getTime()) / 1000),
        }))
      );
    }, 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const fetchActiveCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('screens')
        .select(`
          id,
          status,
          started_at,
          scheduled_at,
          candidates!inner(name, phone),
          roles!inner(title)
        `)
        .in('status', ['in_progress', 'scheduled'])
        .order('started_at', { ascending: false });

      if (error) throw error;

      const calls: ActiveCall[] = (data || []).map((screen) => ({
        id: screen.id,
        candidateName: screen.candidates?.name || 'Unknown',
        roleName: screen.roles?.title || 'Unknown Role',
        status: screen.status,
        startedAt: new Date(screen.started_at || screen.scheduled_at),
        duration: screen.started_at 
          ? Math.floor((Date.now() - new Date(screen.started_at).getTime()) / 1000)
          : 0,
        phoneNumber: screen.candidates?.phone || 'Unknown',
      }));

      setActiveCalls(calls);
    } catch (error) {
      console.error('Error fetching active calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'success';
      case 'scheduled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'Active Call';
      case 'scheduled':
        return 'Scheduled';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Call Monitor
        </CardTitle>
        <CardDescription>
          Real-time monitoring of ongoing and scheduled screening calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading active calls...</div>
          </div>
        ) : activeCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No active or scheduled calls</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{call.candidateName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        <span>{call.roleName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{call.phoneNumber}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={getStatusColor(call.status) as any}>
                        {getStatusText(call.status)}
                      </Badge>
                      {call.status === 'in_progress' && (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">{formatDuration(call.duration)}</span>
                        </div>
                      )}
                      {call.status === 'scheduled' && (
                        <div className="text-sm text-muted-foreground">
                          {format(call.startedAt, 'PPp')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {call.status === 'in_progress' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Call Progress</span>
                        <span>{Math.min(100, Math.floor((call.duration / 900) * 100))}%</span>
                      </div>
                      <Progress 
                        value={Math.min(100, Math.floor((call.duration / 900) * 100))} 
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}