import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Phone } from 'lucide-react';
import { Candidate, Role } from '@/types';

interface PhoneCallSchedulerProps {
  candidate: Candidate;
  role: Role;
  onScheduled?: () => void;
}

export function PhoneCallScheduler({ candidate, role, onScheduled }: PhoneCallSchedulerProps) {
  const demoAPI = useDemoAPI();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [isScheduling, setIsScheduling] = useState(false);
  const { toast } = useToast();

  const handleScheduleCall = async () => {
    if (!date || !time) {
      toast({
        title: 'Missing Information',
        description: 'Please select both date and time for the call',
        variant: 'destructive',
      });
      return;
    }

    if (!candidate.phone) {
      toast({
        title: 'Phone Number Required',
        description: 'Candidate phone number is missing',
        variant: 'destructive',
      });
      return;
    }

    setIsScheduling(true);
    try {
      // Parse time and combine with date
      const [hours, minutes] = time.split(':');
      const scheduledTime = new Date(date);
      scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Schedule the call using demo API
      await demoAPI.scheduleCall(
        role.id,
        candidate.id,
        scheduledTime.toISOString()
      );

      toast({
        title: 'Call Scheduled (Demo)',
        description: `Phone screening scheduled for ${format(scheduledTime, 'PPp')} in demo mode`,
      });

      onScheduled?.();
    } catch (error) {
      console.error('Error scheduling call:', error);
      toast({
        title: 'Scheduling Failed',
        description: 'Failed to schedule the phone call. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // Generate time slots from 9 AM to 5 PM
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Schedule Phone Screening
        </CardTitle>
        <CardDescription>
          Schedule an automated phone screening call with {candidate.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Time</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time">
                  {time && (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {time}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="text-sm">
            <strong>Candidate:</strong> {candidate.name}
          </p>
          <p className="text-sm">
            <strong>Phone:</strong> {candidate.phone || 'Not provided'}
          </p>
          <p className="text-sm">
            <strong>Role:</strong> {role.title}
          </p>
        </div>

        <Button
          onClick={handleScheduleCall}
          disabled={!date || !time || isScheduling || !candidate.phone}
          className="w-full"
        >
          {isScheduling ? 'Scheduling...' : 'Schedule Call'}
        </Button>
      </CardContent>
    </Card>
  );
}