import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUploadSessions, SessionInput } from "@workspace/api-client-react";
import { parseCSV } from "@/components/csv-parser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, FileUp, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<SessionInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const uploadMutation = useUploadSessions({
    mutation: {
      onSuccess: (result) => {
        toast({
          title: "Upload Successful",
          description: `Successfully imported ${result.inserted} sessions.`,
        });
        // Invalidate dates to fetch newly uploaded dates
        queryClient.invalidateQueries({ queryKey: ["/api/sessions/dates"] });
        
        // Navigate back to dashboard
        setLocation("/");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: error instanceof Error ? error.message : "An unknown error occurred during upload.",
        });
      }
    }
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    if (!text.trim()) {
      setParsedRows([]);
      setParseErrors([]);
      return;
    }
    
    const { rows, errors } = parseCSV(text);
    setParsedRows(rows);
    setParseErrors(errors);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      
      const { rows, errors } = parseCSV(text);
      setParsedRows(rows);
      setParseErrors(errors);
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClear = () => {
    setCsvText("");
    setParsedRows([]);
    setParseErrors([]);
    setFileName(null);
  };

  const handleSubmit = () => {
    if (parsedRows.length === 0) return;
    
    uploadMutation.mutate({
      data: { rows: parsedRows }
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">Data Import</h1>
        <p className="text-muted-foreground">Upload or paste session data exported from your booking system.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select a .csv file from your computer
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center p-8 border-2 border-dashed border-muted mx-6 mb-6 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">Click to browse or drag file here</p>
            <p className="text-xs text-muted-foreground">Supported format: CSV</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Paste Data
            </CardTitle>
            <CardDescription>
              Or paste raw CSV text directly below
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea 
              placeholder="date,time,title,wave_direction,capacity_booked,capacity_available&#10;2024-05-01,08:00,Cruiser,left,10,2&#10;2024-05-01,08:00,Cruiser,right,12,0"
              className="font-mono text-xs min-h-[200px] resize-y bg-muted/10"
              value={csvText}
              onChange={handleTextChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* Errors Display */}
      {parseErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Parsing Errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
              {parseErrors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {parseErrors.length > 5 && (
                <li>...and {parseErrors.length - 5} more errors</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <Card className="shadow-sm border-border border-primary/20 shadow-primary/5">
          <CardHeader className="pb-4 bg-muted/30 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Data Preview
              </CardTitle>
              <CardDescription>
                {parsedRows.length} valid rows extracted {fileName ? `from ${fileName}` : 'from pasted text'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Booked</TableHead>
                    <TableHead className="text-right">Avail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>{row.title}</TableCell>
                      <TableCell className="capitalize">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.wave_direction === 'left' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'}`}>
                          {row.wave_direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.capacity_booked}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.capacity_available}</TableCell>
                    </TableRow>
                  ))}
                  {parsedRows.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        Showing first 100 rows of {parsedRows.length}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 border-t p-4 flex justify-end">
            <Button 
              size="lg" 
              onClick={handleSubmit} 
              disabled={uploadMutation.isPending || parseErrors.length > 0}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parsedRows.length} Sessions`
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
