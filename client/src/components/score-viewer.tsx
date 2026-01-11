import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Eye, EyeOff, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import type { Annotation } from "@shared/schema";

interface ScoreViewerProps {
  meiData: string;
  annotations?: Annotation[];
  showAnnotations?: boolean;
  onAnnotationToggle?: (show: boolean) => void;
}

let verovioModulePromise: Promise<any> | null = null;

async function getVerovioToolkit() {
  if (!verovioModulePromise) {
    verovioModulePromise = createVerovioModule();
  }
  const VerovioModule = await verovioModulePromise;
  return new VerovioToolkit(VerovioModule);
}

export function ScoreViewer({ 
  meiData, 
  annotations = [], 
  showAnnotations = false,
  onAnnotationToggle 
}: ScoreViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [annotationsVisible, setAnnotationsVisible] = useState(showAnnotations);
  const verovioRef = useRef<VerovioToolkit | null>(null);

  useEffect(() => {
    setAnnotationsVisible(showAnnotations);
  }, [showAnnotations]);

  useEffect(() => {
    let isMounted = true;
    
    const loadVerovio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vrvToolkit = await getVerovioToolkit();
        
        if (!isMounted) return;

        verovioRef.current = vrvToolkit;
        
        const containerWidth = containerRef.current?.clientWidth || 800;
        
        vrvToolkit.setOptions({
          scale: 40,
          pageWidth: Math.floor(containerWidth * 100 / 40),
          pageHeight: 2000,
          adjustPageHeight: true,
          header: "none",
          footer: "none",
          breaks: "auto",
          svgBoundingBoxes: true,
          svgViewBox: true,
        });

        const loadSuccess = vrvToolkit.loadData(meiData);
        
        if (!loadSuccess) {
          throw new Error("Verovio could not parse the score data");
        }
        
        const pageCount = vrvToolkit.getPageCount();
        setTotalPages(pageCount);
        setCurrentPage(1);

        renderPage(vrvToolkit, 1);
        setIsLoading(false);
      } catch (err) {
        console.error("Verovio error:", err);
        if (isMounted) {
          setError("Failed to render score. Please try a different file.");
          setIsLoading(false);
        }
      }
    };

    loadVerovio();

    return () => {
      isMounted = false;
    };
  }, [meiData]);

  const renderPage = (vrvToolkit: VerovioToolkit, page: number) => {
    if (!containerRef.current) return;
    
    const svg = vrvToolkit.renderToSVG(page);
    containerRef.current.innerHTML = svg;

    const svgElement = containerRef.current.querySelector("svg");
    if (svgElement) {
      svgElement.style.width = "100%";
      svgElement.style.height = "auto";
      svgElement.style.maxHeight = "600px";
    }
  };

  const handlePageChange = (newPage: number) => {
    if (verovioRef.current && newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      renderPage(verovioRef.current, newPage);
    }
  };

  const handleAnnotationToggle = useCallback((checked: boolean) => {
    setAnnotationsVisible(checked);
    onAnnotationToggle?.(checked);
  }, [onAnnotationToggle]);

  const groupedAnnotations = annotations.reduce((acc, ann) => {
    if (!acc[ann.measure]) {
      acc[ann.measure] = [];
    }
    acc[ann.measure].push(ann);
    return acc;
  }, {} as Record<number, Annotation[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-card">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading score...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-card">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please make sure your file is a valid MusicXML document.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card">
      {annotations.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-annotations" className="text-sm text-muted-foreground">
              Show annotations
            </Label>
            <Switch
              id="show-annotations"
              checked={annotationsVisible}
              onCheckedChange={handleAnnotationToggle}
              data-testid="toggle-annotations"
            />
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="p-6 overflow-auto max-h-[600px]"
        data-testid="score-display"
      />
      
      {annotationsVisible && annotations.length > 0 && (
        <div className="border-t px-4 py-3 bg-muted/10 max-h-48 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {Object.entries(groupedAnnotations).map(([measure, anns]) => (
              <div key={measure} className="flex items-center gap-1.5 p-2 rounded bg-background border">
                <span className="text-xs text-muted-foreground font-mono">m.{measure}</span>
                <div className="flex flex-wrap gap-1">
                  {anns.map((ann, i) => (
                    <Badge 
                      key={i} 
                      variant={ann.type === "marker" ? "destructive" : "secondary"}
                      className="text-xs font-mono"
                    >
                      {ann.text}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 border-t bg-muted/30">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-prev-page"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-next-page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
