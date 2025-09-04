import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
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
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDemoAPI } from '@/hooks/useDemoAPI';
import { validateIndianPhone } from '@/utils/indianPhoneValidator';

export default function CandidateImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roles, setRoles] = useState<any[]>([]);
  const [hasRoleColumn, setHasRoleColumn] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const demoAPI = useDemoAPI();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setIsProcessing(true);
    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      complete: async (result) => {
        if (result.data && result.data.length > 0) {
          const data = result.data as any[];
          const headers = Object.keys(data[0]);
          
          // Check if we have the minimum required fields
          const hasName = headers.some(h => h.toLowerCase().includes('name'));
          const hasPhone = headers.some(h => h.toLowerCase().includes('phone') || h.toLowerCase().includes('mobile'));
          const hasRole = headers.some(h => h.toLowerCase().includes('role') || h.toLowerCase().includes('position') || h.toLowerCase().includes('job'));
          
          if (!hasName || !hasPhone) {
            toast({
              title: "Invalid CSV Format",
              description: "CSV must contain 'Name' and 'Phone' columns",
              variant: "destructive"
            });
            setFile(null);
            setIsProcessing(false);
            return;
          }
          
          setHasRoleColumn(hasRole);
          setPreviewData(data.slice(0, 5));
          
          // Fetch roles for selection if no role column
          if (!hasRole) {
            try {
              const rolesData = await demoAPI.getRoles();
              setRoles(rolesData || []);
              if (rolesData && rolesData.length === 0) {
                toast({
                  title: "No Roles Available",
                  description: "Please create a role first before importing candidates",
                  variant: "destructive"
                });
              }
            } catch (error) {
              console.error('Error fetching roles:', error);
              toast({
                title: "Error",
                description: "Could not fetch roles",
                variant: "destructive"
              });
            }
          }
        }
        setIsProcessing(false);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleImport = async () => {
    if (!file) return;
    
    if (!hasRoleColumn && !selectedRole) {
      toast({
        title: "Role Required",
        description: "Please select a role for screening",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    Papa.parse(file, {
      complete: async (result) => {
        try {
          const data = result.data as any[];
          const candidates = [];
          const errors = [];
          let roleMap: Record<string, string> = {};
          
          // If CSV has role column, fetch all roles to map titles to IDs
          if (hasRoleColumn) {
            const rolesData = await demoAPI.getRoles();
            rolesData.forEach((role: any) => {
              roleMap[role.title.toLowerCase()] = role.id;
            });
          }
          
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const candidate: any = {};
            let roleId = selectedRole;
            
            // Process each field
            Object.keys(row).forEach(key => {
              const value = row[key];
              const keyLower = key.toLowerCase();
              
              if (keyLower.includes('name')) {
                candidate.name = value;
              } else if (keyLower.includes('phone') || keyLower.includes('mobile')) {
                // Validate and format phone number
                const validation = validateIndianPhone(value);
                if (validation.isValid) {
                  candidate.phone = validation.formatted;
                } else {
                  errors.push(`Row ${i + 1}: Invalid phone number: ${value}`);
                }
              } else if (keyLower.includes('email')) {
                candidate.email = value || null; // Email is now optional
              } else if (keyLower.includes('skill')) {
                candidate.skills = value ? value.split(/[,;]/).map((s: string) => s.trim()) : [];
              } else if (keyLower.includes('exp') || keyLower.includes('year')) {
                candidate.expYears = parseInt(value) || null;
              } else if (keyLower.includes('location')) {
                candidate.locationPref = value;
              } else if (keyLower.includes('salary')) {
                candidate.salaryExpectation = parseInt(value) || null;
              } else if (keyLower.includes('language')) {
                candidate.language = value || 'en';
              } else if (hasRoleColumn && (keyLower.includes('role') || keyLower.includes('position') || keyLower.includes('job'))) {
                // Map role title to role ID
                const roleTitle = value.toLowerCase();
                roleId = roleMap[roleTitle];
                if (!roleId) {
                  errors.push(`Row ${i + 1}: Unknown role: ${value}`);
                }
              }
            });
            
            // Only add if we have name and valid phone
            if (candidate.name && candidate.phone) {
              candidate.roleId = roleId; // Attach role for screening
              candidates.push(candidate);
            }
          }
          
          if (errors.length > 0) {
            toast({
              title: "Import Warnings",
              description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''),
              variant: "destructive"
            });
          }
          
          if (candidates.length === 0) {
            toast({
              title: "No Valid Candidates",
              description: "No candidates could be imported from the CSV",
              variant: "destructive"
            });
            return;
          }
          
          // Import candidates - the API will automatically create screens if roleId is provided
          await demoAPI.bulkImportCandidates(candidates);
          
          toast({
            title: 'Import Successful',
            description: `Imported ${candidates.length} candidates and created screening sessions`,
          });
          
          // Navigate to screens page to show the newly created screens
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
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const downloadTemplate = () => {
    const template = 'Name,Phone\n' +
      'Rajesh Kumar,9876543210\n' +
      'Priya Sharma,9876543211\n' +
      'Amit Patel,9876543212\n' +
      '\n' +
      '# Optional columns: Email, Skills (comma separated), Experience Years, Location, Salary Expectation, Language, Role Title';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_import_template.csv';
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Candidates</h1>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file with candidate names and phone numbers
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              CSV Upload
            </CardTitle>
            <CardDescription>
              Simple CSV format: Only Name and Phone are required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-xs text-muted-foreground mt-2">CSV files only</p>
              {file && (
                <Badge className="mt-3">
                  <Check className="w-3 h-3 mr-1" />
                  {file.name}
                </Badge>
              )}
            </div>
            
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Simple Template
            </Button>

            {/* Info Alert */}
            <div className="rounded-lg bg-muted p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Required columns:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Name - Candidate's full name</li>
                  <li>Phone - Indian mobile number (10 digits)</li>
                </ul>
                <p className="mt-2 font-medium">Optional columns:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Role - Job title for automatic role assignment</li>
                  <li>Email, Skills, Experience, Location, Salary</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview and Role Selection */}
        {file && previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview & Configuration</CardTitle>
              <CardDescription>
                Review candidates and {hasRoleColumn ? 'confirm import' : 'select screening role'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Role Selection (if no role column in CSV) */}
              {!hasRoleColumn && (
                <div className="space-y-2">
                  <Label>Select Role for All Candidates</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role for screening..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length > 0 ? (
                        roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.title} - {role.location}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          No roles available. Create a role first.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableCaption>Preview of first {previewData.length} candidates</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewData[0] || {}).map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <TableCell key={i}>{value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Import Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleImport}
                  disabled={isProcessing || (!hasRoleColumn && !selectedRole)}
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
                      Import & Create Screens
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}