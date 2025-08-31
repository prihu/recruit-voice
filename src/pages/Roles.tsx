import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MapPin, 
  DollarSign, 
  Calendar,
  Phone,
  Edit,
  Copy,
  MoreVertical,
  FileText,
  Mic
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export default function Roles() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        // Try to auto-heal by ensuring organization exists
        const { data: orgId, error: rpcError } = await supabase.rpc('ensure_demo_org_for_user');
        if (rpcError || !orgId) {
          console.error('Failed to ensure organization:', rpcError);
          toast({
            title: 'Setup Required',
            description: 'Creating demo organization...',
          });
          // Retry fetch after short delay
          setTimeout(() => fetchRoles(), 1000);
          return;
        }
        // Re-fetch member with new org
        const { data: newMember } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();
        if (!newMember) return;

        const organizationId = newMember?.organization_id || member.organization_id;
        const { data, error } = await supabase
          .from('roles')
          .select(`
            *,
            screens:screens(count)
          `)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });
      } else {
        const { data, error } = await supabase
          .from('roles')
          .select(`
            *,
            screens:screens(count)
          `)
          .eq('organization_id', member.organization_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const rolesWithCount = data?.map(role => ({
        ...role,
        screeningsCount: role.screens?.[0]?.count || 0,
        salaryBand: role.salary_min && role.salary_max ? {
          min: role.salary_min,
          max: role.salary_max,
          currency: role.salary_currency || 'INR'
        } : null,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
        })) || [];

        setRoles(rolesWithCount);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load roles',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter(role =>
    role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Screening Roles</h1>
            <p className="text-muted-foreground mt-2">
              Manage your interview screening configurations and questions
            </p>
          </div>
          <Link to="/roles/new">
            <Button className="bg-gradient-primary border-0 hover:shadow-glow">
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            Active Roles
            <Badge className="ml-2 bg-success text-success-foreground">
              {roles.filter(r => r.status === 'active').length}
            </Badge>
          </Button>
        </div>

        {/* Roles Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoles.map((role) => (
            <Card 
              key={role.id} 
              className="hover:shadow-lg transition-all hover:translate-y-[-2px] border-border/50 bg-gradient-card"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1">{role.title}</CardTitle>
                    <CardDescription className="space-y-1">
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3" />
                        {role.location}
                      </span>
                      {role.voice_agent_id && (
                        <span className="flex items-center gap-1 text-sm text-success">
                          <Mic className="w-3 h-3" />
                          Voice Enabled
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={role.status === 'active' ? 'default' : 'secondary'}
                    className={role.status === 'active' ? 'bg-success text-success-foreground' : ''}
                  >
                    {role.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {role.screeningsCount || 0} screens
                  </span>
                </div>

                {role.salaryBand && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    {role.salaryBand.currency} {(role.salaryBand.min / 100000).toFixed(0)}L - {(role.salaryBand.max / 100000).toFixed(0)}L
                  </div>
                )}

                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Questions</span>
                    <span className="font-medium">{role.questions?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">FAQ Entries</span>
                    <span className="font-medium">{role.faq?.length || 0}</span>
                  </div>
                  {!role.voice_agent_id && (
                    <div className="text-xs text-warning bg-warning/10 rounded px-2 py-1 text-center">
                      Voice agent not configured
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(role.updatedAt, { addSuffix: true })}
                  </span>
                  <Link to={`/roles/${role.id}`}>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <Card className="p-12 text-center">
            <div className="animate-pulse">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted mb-4" />
              <div className="h-4 bg-muted rounded w-32 mx-auto mb-2" />
              <div className="h-3 bg-muted rounded w-48 mx-auto" />
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredRoles.length === 0 && (
          <Card className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No roles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Create your first screening role to get started'}
            </p>
            {!searchQuery && (
              <Link to="/roles/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Role
                </Button>
              </Link>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}