import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, FileText, Upload, Phone, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsMenuProps {
  onOpenBulkScreening?: () => void;
}

export function QuickActionsMenu({ onOpenBulkScreening }: QuickActionsMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-1" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background border">
        <DropdownMenuItem
          onClick={() => navigate('/roles')}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>Create New Role</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/candidates/import')}
          className="cursor-pointer"
        >
          <Upload className="mr-2 h-4 w-4" />
          <span>Import Candidates</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onOpenBulkScreening}
          className="cursor-pointer"
        >
          <Phone className="mr-2 h-4 w-4" />
          <span>Start Bulk Screening</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/screens?status=in_progress')}
          className="cursor-pointer"
        >
          <Phone className="mr-2 h-4 w-4 text-accent" />
          <span>View Active Calls</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/screens')}
          className="cursor-pointer"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>Recent Screens</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}