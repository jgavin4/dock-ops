"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImportResult } from "@/lib/api";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  exampleColumns: string[];
  onImport: (file: File) => Promise<ImportResult>;
  onSuccess?: (result: ImportResult) => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  exampleColumns,
  onImport,
  onSuccess,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validExtensions = [".csv", ".xlsx", ".xls"];
      const fileExtension = selectedFile.name
        .toLowerCase()
        .substring(selectedFile.name.lastIndexOf("."));
      
      if (!validExtensions.includes(fileExtension)) {
        alert("Please select a CSV or Excel file (.csv, .xlsx, .xls)");
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setIsImporting(true);
    try {
      const importResult = await onImport(file);
      setResult(importResult);
      if (onSuccess) {
        onSuccess(importResult);
      }
    } catch (error: any) {
      setResult({
        success: false,
        created_count: 0,
        error_count: 1,
        created: [],
        errors: [{ row: 0, error: error.message || "Import failed" }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Expected Columns:</h4>
            <ul className="text-sm space-y-1">
              {exampleColumns.map((col, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-muted-foreground mr-2">•</span>
                  <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                    {col}
                  </code>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Select File (CSV or Excel)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {result && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Import Results</h4>
                <span
                  className={`text-sm font-medium ${
                    result.success
                      ? "text-green-600"
                      : "text-destructive"
                  }`}
                >
                  {result.created_count} created, {result.error_count} errors
                </span>
              </div>
              
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Errors:
                  </p>
                  <ul className="text-xs space-y-1">
                    {result.errors.map((error, idx) => (
                      <li key={idx} className="text-destructive">
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.created.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-2">
                    Successfully Created:
                  </p>
                  <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {result.created.map((item, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        • {item.name || item.item_name || `ID: ${item.id}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
            >
              {isImporting ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
