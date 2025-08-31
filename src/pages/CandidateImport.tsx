import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Upload, 
  FileSpreadsheet,
  Check,
  X,
  AlertCircle,
  Download,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useDemoAPI } from '@/hooks/useDemoAPI';

export default function CandidateImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappingStep, setMappingStep] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roles, setRoles] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const demoAPI = useDemoAPI();

  const systemFields = [
    { value: 'name', label: 'Name (Required)' },
    { value: 'phone', label: 'Phone Number (Indian)' },
    { value: 'email', label: 'Email (Required)' },
    { value: 'external_id', label: 'External ID' },
    { value: 'skills', label: 'Skills (semicolon separated)' },
    { value: 'exp_years', label: 'Experience Years' },
    { value: 'location_pref', label: 'Location Preference' },
    { value: 'salary_expectation', label: 'Salary Expectation (INR)' },
    { value: 'preferred_language', label: 'Preferred Language' }
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type === 'text/csv') {
      setFile(uploadedFile);
      
      // Parse CSV file
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      setCsvHeaders(headers);
      
      // Parse first few rows for preview
      const preview = [];
      for (let i = 1; i < Math.min(4, lines.length); i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        preview.push(row);
      }
      
      setPreviewData(preview);
      setMappingStep(true);
      
      // Fetch roles
      const rolesData = await demoAPI.getRoles();
      setRoles(rolesData || []);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please upload a valid CSV file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!file || !selectedRole) {
      toast({
        title: 'Missing Information',
        description: 'Please select a role for screening',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const candidates = [];
      const errors = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const candidate: any = {};
          let hasError = false;
          
          headers.forEach((header, index) => {
            const mappedField = columnMapping[header];
            if (mappedField) {
              const value = values[index];
              
              if (mappedField === 'skills') {
                candidate[mappedField] = value.split(';').map(s => s.trim());
              } else if (mappedField === 'exp_years' || mappedField === 'salary_expectation') {
                candidate[mappedField] = parseInt(value) || 0;
              } else if (mappedField === 'phone') {
                // Validate Indian phone number
                let phone = value.replace(/\D/g, '');
                if (!phone.startsWith('91') && phone.length === 10) {
                  phone = '91' + phone;
                }
                if (phone.length !== 12 || !phone.startsWith('91')) {
                  errors.push(`Row ${i}: Invalid Indian phone number: ${value}`);
                  hasError = true;
                } else {
                  candidate.phone = '+' + phone;
                }
              } else {
                candidate[mappedField] = value;
              }
            }
          });
          
          // Set default language if not provided
          if (!candidate.preferred_language) {
            candidate.preferred_language = 'English';
          }
          
          // Only add if we have at least name, email, and valid phone
          if (candidate.name && candidate.email && !hasError) {
            candidates.push(candidate);
          }
        }
      }
      
      if (errors.length > 0) {
        toast({
          title: "Phone Number Validation Errors",
          description: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''),
          variant: "destructive"
        });
      }
      
      // Insert candidates into database using demo API
      const result = await demoAPI.bulkImportCandidates(candidates);
      
      toast({
        title: 'Import Successful',
        description: `Imported ${candidates.length} candidates successfully`,
      });
      
      navigate('/screens');
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'There was an error importing candidates',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'name,email,phone,skills,exp_years,location_pref,salary_expectation,preferred_language\n' +
      'Rajesh Kumar,rajesh@example.com,9876543210,Python;Django;AWS,5,Bangalore,1200000,English\n' +
      'Priya Sharma,priya@example.com,9876543211,JavaScript;React;Node.js,3,Mumbai,800000,Hindi\n' +
      'Amit Patel,amit@example.com,9876543212,Java;Spring Boot;Microservices,7,Pune,1500000,English';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_import_template.csv';
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Candidates</h1>
          <p className="text-muted-foreground mt-2">
            Bulk import candidate data from CSV files for phone screening
          </p>
        </div>

        {/* Import Methods */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                CSV Upload
              </CardTitle>
              <CardDescription>Upload a CSV file with candidate information including phone numbers</CardDescription>
            </CardHeader>
            <CardContent>
              {!mappingStep ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <Label htmlFor="csv-upload" className="cursor-pointer">
                      <span className="text-primary underline">Click to upload</span> or drag and drop
                    </Label>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground mt-2">CSV files only, max 10MB</p>
                    {file && (
                      <Badge className="mt-3">
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </Badge>
                    )}
                  </div>
                  <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template CSV
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Badge className="mb-2 bg-success text-success-foreground">
                    <Check className="w-3 h-3 mr-1" />
                    File uploaded successfully
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Map your CSV columns to system fields below
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                ATS Integration
              </CardTitle>
              <CardDescription>Connect to your ATS for automatic syncing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input 
                    id="webhook-url"
                    placeholder="https://api.your-ats.com/webhook"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input 
                    id="api-key"
                    type="password"
                    placeholder="Enter your ATS API key"
                    disabled
                  />
                </div>
                <Button variant="outline" className="w-full" disabled>
                  Connect ATS (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column Mapping */}
        {mappingStep && (
          <Card>
            <CardHeader>
              <CardTitle>Map CSV Columns</CardTitle>
              <CardDescription>Match your CSV columns to candidate fields and select role for screening</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Select Role for Screening</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.title} - {role.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {csvHeaders.map((col) => (
                  <div key={col} className="flex items-center gap-3">
                    <Badge variant="outline" className="min-w-[80px]">{col}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Select onValueChange={(value) => setColumnMapping({...columnMapping, [col]: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {systemFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableCaption>Preview of first {previewData.length} rows</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {csvHeaders.map((col) => (
                        <TableHead key={col}>
                          {columnMapping[col] || col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        {csvHeaders.map((header) => (
                          <TableCell key={header}>{row[header]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMappingStep(false);
                    setFile(null);
                    setPreviewData([]);
                    setCsvHeaders([]);
                    setColumnMapping({});
                  }}
                >
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {previewData.length} candidates ready
                  </Badge>
                  <Button 
                    onClick={handleImport}
                    disabled={isProcessing || !selectedRole}
                    className="bg-gradient-primary border-0"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import Candidates
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}