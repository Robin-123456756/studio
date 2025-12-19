"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileText, Loader2, Wand2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRulesSummary } from "@/app/(dashboard)/rules/actions";
import { useToast } from "@/hooks/use-toast";

export default function RuleExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setSummary(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
  });

  const handleExtract = async () => {
    if (!file) return;

    setIsLoading(true);
    setSummary(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const documentDataUri = reader.result as string;
      const result = await getRulesSummary({ documentDataUri });

      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        toast({
          variant: "destructive",
          title: "Extraction Failed",
          description: result.error,
        });
      }
      setIsLoading(false);
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File Error",
        description: "Failed to read the file. Please try again.",
      });
      setIsLoading(false);
    };
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Document</CardTitle>
          <CardDescription>Upload a .pdf, .docx, or .txt file containing the league rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors ${
              isDragActive ? "border-primary bg-muted" : "border-input"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? "Drop the file here" : "Drag & drop a file here, or click to select"}
            </p>
          </div>
          {file && (
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
            </div>
          )}
          <Button onClick={handleExtract} disabled={!file || isLoading} className="w-full">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Extract & Summarize
          </Button>
        </CardContent>
      </Card>
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>2. AI-Generated Summary</CardTitle>
          <CardDescription>A concise summary of the key rules from your document.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p>Analyzing document...</p>
              </div>
            </div>
          )}
          {summary && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap flex-1">
              {summary}
            </div>
          )}
          {!isLoading && !summary && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-input rounded-lg">
              Summary will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
