import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

interface ScoreViewerProps {
  meiData: string;
}

let verovioModulePromise: Promise<any> | null = null;

async function getVerovioToolkit() {
  if (!verovioModulePromise) {
    verovioModulePromise = createVerovioModule();
  }
  const VerovioModule = await verovioModulePromise;
  return new VerovioToolkit(VerovioModule);
}

export function ScoreViewer({ meiData }: ScoreViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const verovioRef = useRef<VerovioToolkit | null>(null);

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
      <div 
        ref={containerRef} 
        className="p-6 overflow-auto max-h-[600px]"
        data-testid="score-display"
      />
      
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
