import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Download, FileText, Table, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import * as XLSX from 'xlsx';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenCount: number;
  filters?: {
    roleIds?: string[];
    outcomes?: string[];
    dateRange?: { from: Date | undefined; to: Date | undefined };
  };
}

type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';
type ExportTemplate = 'full' | 'executive' | 'technical' | 'hr' | 'comparison';

const EXPORT_COLUMNS = [
  { id: 'candidate_name', label: 'Candidate Name', category: 'basic' },
  { id: 'candidate_phone', label: 'Phone Number', category: 'basic' },
  { id: 'candidate_email', label: 'Email', category: 'basic' },
  { id: 'current_role', label: 'Current Role', category: 'professional' },
  { id: 'total_experience_years', label: 'Total Experience', category: 'professional' },
  { id: 'relevant_experience_years', label: 'Relevant Experience', category: 'professional' },
  { id: 'skills_primary', label: 'Primary Skills', category: 'professional' },
  { id: 'skills_secondary', label: 'Secondary Skills', category: 'professional' },
  { id: 'education_level', label: 'Education Level', category: 'professional' },
  { id: 'current_location', label: 'Current Location', category: 'location' },
  { id: 'preferred_locations', label: 'Preferred Locations', category: 'location' },
  { id: 'relocation_willing', label: 'Willing to Relocate', category: 'location' },
  { id: 'notice_period_days', label: 'Notice Period', category: 'location' },
  { id: 'current_salary', label: 'Current Salary', category: 'compensation' },
  { id: 'expected_salary_min', label: 'Expected Salary Min', category: 'compensation' },
  { id: 'expected_salary_max', label: 'Expected Salary Max', category: 'compensation' },
  { id: 'screening_score', label: 'Screening Score', category: 'results' },
  { id: 'screening_outcome', label: 'Outcome', category: 'results' },
  { id: 'strengths', label: 'Strengths', category: 'results' },
  { id: 'areas_of_concern', label: 'Areas of Concern', category: 'results' },
  { id: 'rejection_reasons', label: 'Rejection Reasons', category: 'results' },
  { id: 'technical_skills_score', label: 'Technical Score', category: 'assessment' },
  { id: 'communication_score', label: 'Communication Score', category: 'assessment' },
  { id: 'cultural_fit_score', label: 'Cultural Fit Score', category: 'assessment' },
  { id: 'call_duration_minutes', label: 'Call Duration', category: 'metadata' },
  { id: 'questions_answered', label: 'Questions Answered', category: 'metadata' },
  { id: 'response_quality', label: 'Response Quality', category: 'metadata' },
  { id: 'ai_summary', label: 'AI Summary', category: 'insights' },
  { id: 'ai_recommendation', label: 'AI Recommendation', category: 'insights' },
  { id: 'suggested_next_steps', label: 'Next Steps', category: 'insights' },
  { id: 'red_flags', label: 'Red Flags', category: 'insights' },
];

const TEMPLATES: Record<ExportTemplate, { name: string; description: string; columns: string[] }> = {
  full: {
    name: 'Full Export',
    description: 'All available data fields',
    columns: EXPORT_COLUMNS.map(c => c.id),
  },
  executive: {
    name: 'Executive Summary',
    description: 'High-level overview for management',
    columns: ['candidate_name', 'current_role', 'total_experience_years', 'screening_score', 'screening_outcome', 'ai_recommendation', 'red_flags'],
  },
  technical: {
    name: 'Technical Assessment',
    description: 'Focus on skills and technical evaluation',
    columns: ['candidate_name', 'skills_primary', 'skills_secondary', 'technical_skills_score', 'total_experience_years', 'relevant_experience_years', 'strengths'],
  },
  hr: {
    name: 'HR Compliance',
    description: 'Detailed screening records for compliance',
    columns: ['candidate_name', 'candidate_phone', 'candidate_email', 'screening_score', 'screening_outcome', 'questions_answered', 'call_duration_minutes', 'rejection_reasons'],
  },
  comparison: {
    name: 'Candidate Comparison',
    description: 'Side-by-side comparison fields',
    columns: ['candidate_name', 'screening_score', 'total_experience_years', 'expected_salary_min', 'technical_skills_score', 'communication_score', 'screening_outcome'],
  },
};

export function ExportDialog({ open, onOpenChange, screenCount, filters }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [template, setTemplate] = useState<ExportTemplate>('full');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(TEMPLATES.full.columns);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeAIAnalysis, setIncludeAIAnalysis] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(
    filters?.dateRange || { from: undefined, to: undefined }
  );
  const [exporting, setExporting] = useState(false);
  const demoAPI = useDemoAPI();

  const handleTemplateChange = (newTemplate: ExportTemplate) => {
    setTemplate(newTemplate);
    setSelectedColumns(TEMPLATES[newTemplate].columns);
  };

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleExport = async () => {
    setExporting(true);
    
    try {
      // Fetch analytics data with export details
      const data = await demoAPI.getAnalytics({
        startDate: dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined,
        endDate: dateRange.to ? dateRange.to.toISOString().split('T')[0] : undefined,
      });

      const screenings = data.screenings || [];

      // Process the export based on format
      if (format === 'excel') {
        await exportToExcel(screenings);
      } else if (format === 'csv') {
        await exportToCSV(screenings);
      } else if (format === 'json') {
        await exportToJSON(screenings);
      } else if (format === 'pdf') {
        // PDF export would require additional library
        toast({
          title: "PDF Export",
          description: "PDF export will be available soon",
        });
      }

      toast({
        title: "Export Successful",
        description: `Exported ${screenings.length} screening records`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async (data: any[]) => {
    const wb = XLSX.utils.book_new();
    
    // Main data sheet
    const mainData = data.map(screen => {
      const row: any = {};
      selectedColumns.forEach(col => {
        const value = screen.extracted_data?.[col] || screen[col];
        row[EXPORT_COLUMNS.find(c => c.id === col)?.label || col] = 
          Array.isArray(value) ? value.join(', ') : value;
      });
      return row;
    });
    
    const ws = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws, "Screenings");
    
    // Summary sheet
    const summaryData = [
      { Metric: 'Total Screenings', Value: data.length },
      { Metric: 'Pass Rate', Value: `${Math.round((data.filter(s => s.outcome === 'pass').length / data.length) * 100)}%` },
      { Metric: 'Average Score', Value: Math.round(data.reduce((acc, s) => acc + (s.score || 0), 0) / data.length) },
      { Metric: 'Date Range', Value: `${dateRange.from ? dateRange.from.toLocaleDateString() : 'All'} - ${dateRange.to ? dateRange.to.toLocaleDateString() : 'All'}` },
    ];
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    
    // Transcripts sheet (if included)
    if (includeTranscript) {
      const transcriptData = data.map(screen => ({
        'Candidate': screen.candidate?.name || 'Unknown',
        'Date': screen.created_at ? new Date(screen.created_at).toLocaleDateString() : '',
        'Transcript': screen.transcript ? JSON.stringify(screen.transcript) : 'No transcript',
      }));
      
      const transcriptWs = XLSX.utils.json_to_sheet(transcriptData);
      XLSX.utils.book_append_sheet(wb, transcriptWs, "Transcripts");
    }
    
    // Download the file
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `screening_export_${dateStr}.xlsx`);
  };

  const exportToCSV = async (data: any[]) => {
    const csvData = data.map(screen => {
      const row: any = {};
      selectedColumns.forEach(col => {
        const value = screen.extracted_data?.[col] || screen[col];
        row[col] = Array.isArray(value) ? value.join('; ') : value;
      });
      return row;
    });

    const headers = selectedColumns.join(',');
    const rows = csvData.map(row => 
      selectedColumns.map(col => {
        const value = row[col];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value || '';
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const csvDateStr = new Date().toISOString().split('T')[0];
    a.download = `screening_export_${csvDateStr}.csv`;
    a.click();
  };

  const exportToJSON = async (data: any[]) => {
    const jsonData = data.map(screen => {
      const row: any = {};
      selectedColumns.forEach(col => {
        row[col] = screen.extracted_data?.[col] || screen[col];
      });
      return row;
    });

    const json = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const jsonDateStr = new Date().toISOString().split('T')[0];
    a.download = `screening_export_${jsonDateStr}.json`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Screening Data</DialogTitle>
          <DialogDescription>
            Export {screenCount} screening records with customizable options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="grid grid-cols-4 gap-4">
                <Label className="flex items-center space-x-2 cursor-pointer">
                  <RadioGroupItem value="excel" />
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel</span>
                </Label>
                <Label className="flex items-center space-x-2 cursor-pointer">
                  <RadioGroupItem value="csv" />
                  <Table className="w-4 h-4" />
                  <span>CSV</span>
                </Label>
                <Label className="flex items-center space-x-2 cursor-pointer">
                  <RadioGroupItem value="json" />
                  <FileJson className="w-4 h-4" />
                  <span>JSON</span>
                </Label>
                <Label className="flex items-center space-x-2 cursor-pointer opacity-50">
                  <RadioGroupItem value="pdf" disabled />
                  <FileText className="w-4 h-4" />
                  <span>PDF</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Export Template</Label>
            <Select value={template} onValueChange={(v) => handleTemplateChange(v as ExportTemplate)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{value.name}</div>
                      <div className="text-xs text-muted-foreground">{value.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? dateRange.from.toLocaleDateString() : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? dateRange.to.toLocaleDateString() : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Column Selection */}
          <div className="space-y-2">
            <Label>Data Fields ({selectedColumns.length} selected)</Label>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
              <div className="space-y-4">
                {['basic', 'professional', 'location', 'compensation', 'results', 'assessment', 'metadata', 'insights'].map(category => {
                  const categoryColumns = EXPORT_COLUMNS.filter(c => c.category === category);
                  if (categoryColumns.length === 0) return null;
                  
                  return (
                    <div key={category}>
                      <div className="font-medium text-sm mb-2 capitalize">{category}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryColumns.map(col => (
                          <Label key={col.id} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              checked={selectedColumns.includes(col.id)}
                              onCheckedChange={() => handleColumnToggle(col.id)}
                            />
                            <span className="text-sm">{col.label}</span>
                          </Label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-2">
            <Label>Additional Options</Label>
            <div className="space-y-2">
              <Label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={includeTranscript}
                  onCheckedChange={(checked) => setIncludeTranscript(!!checked)}
                />
                <span>Include call transcripts</span>
              </Label>
              <Label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={includeAIAnalysis}
                  onCheckedChange={(checked) => setIncludeAIAnalysis(!!checked)}
                />
                <span>Include AI analysis</span>
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting || selectedColumns.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}