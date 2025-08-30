import { useState } from 'react';
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
import { toast } from 'sonner';

export default function CandidateImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappingStep, setMappingStep] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const systemFields = [
    { value: 'name', label: 'Name (Required)' },
    { value: 'phone', label: 'Phone (Required)' },
    { value: 'email', label: 'Email (Required)' },
    { value: 'external_id', label: 'External ID' },
    { value: 'skills', label: 'Skills' },
    { value: 'exp_years', label: 'Experience Years' },
    { value: 'location_pref', label: 'Location Preference' },
    { value: 'salary_expectation', label: 'Salary Expectation' },
    { value: 'language', label: 'Language' }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type === 'text/csv') {
      setFile(uploadedFile);
      // Simulate CSV parsing
      setMappingStep(true);
      setPreviewData([
        { col1: 'John Doe', col2: 'john@example.com', col3: '+1234567890', col4: '5', col5: 'Python, Django' },
        { col1: 'Jane Smith', col2: 'jane@example.com', col3: '+1234567891', col4: '3', col5: 'JavaScript, React' },
        { col1: 'Bob Johnson', col2: 'bob@example.com', col3: '+1234567892', col4: '7', col5: 'Java, Spring' }
      ]);
    } else {
      toast.error('Please upload a valid CSV file');
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    // Simulate import process
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success('Successfully imported 3 candidates');
    setIsProcessing(false);
    setFile(null);
    setMappingStep(false);
    setPreviewData([]);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Candidates</h1>
          <p className="text-muted-foreground mt-2">
            Bulk import candidate data from CSV files or connect to your ATS
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
              <CardDescription>Upload a CSV file with candidate information</CardDescription>
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
                  <Button variant="outline" className="w-full">
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
              <CardDescription>Match your CSV columns to candidate fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.keys(previewData[0] || {}).map((col) => (
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
                  <TableCaption>Preview of first 3 rows</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewData[0] || {}).map((col) => (
                        <TableHead key={col}>
                          {columnMapping[col] || col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value: any, idx) => (
                          <TableCell key={idx}>{value}</TableCell>
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
                    disabled={isProcessing}
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

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
            <CardDescription>Track your candidate import history</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>2024-01-25</TableCell>
                  <TableCell>candidates_batch1.csv</TableCell>
                  <TableCell>45</TableCell>
                  <TableCell>
                    <Badge className="bg-success text-success-foreground">
                      <Check className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2024-01-23</TableCell>
                  <TableCell>ats_sync</TableCell>
                  <TableCell>12</TableCell>
                  <TableCell>
                    <Badge className="bg-success text-success-foreground">
                      <Check className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2024-01-20</TableCell>
                  <TableCell>initial_candidates.csv</TableCell>
                  <TableCell>28</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      <X className="w-3 h-3 mr-1" />
                      Failed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Retry</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}