import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileMusic, Loader2 } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

export function FileUpload({ onFileSelect, isUploading }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xml") || file.name.endsWith(".musicxml") || file.name.endsWith(".mxl"))) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <Card className={`transition-all duration-200 ${isDragOver ? "ring-2 ring-primary ring-offset-2" : ""}`}>
      <CardContent className="p-8">
        <div
          className={`
            border-2 border-dashed rounded-lg p-12
            flex flex-col items-center justify-center gap-4
            transition-colors duration-200
            ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="dropzone-upload"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">Uploading score...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait while we process your file
                </p>
              </div>
            </>
          ) : selectedFile ? (
            <>
              <FileMusic className="h-12 w-12 text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing score...
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">Upload MusicXML Score</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports .xml, .musicxml, and .mxl files
                </p>
              </div>
              <label>
                <Button variant="outline" className="mt-2" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xml,.musicxml,.mxl"
                  onChange={handleFileInput}
                  className="hidden"
                  data-testid="input-file-upload"
                />
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
