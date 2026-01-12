import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

interface MiniScoreViewerProps {
  meiData: string;
  height?: number;
  scale?: number;
}

let verovioModulePromise: Promise<any> | null = null;

async function getVerovioToolkit() {
  if (!verovioModulePromise) {
    verovioModulePromise = createVerovioModule();
  }
  const VerovioModule = await verovioModulePromise;
  return new VerovioToolkit(VerovioModule);
}

export function MiniScoreViewer({ 
  meiData, 
  height = 150,
  scale = 35
}: MiniScoreViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meiData) {
      setError("No notation data available");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    
    const loadVerovio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vrvToolkit = await getVerovioToolkit();
        
        if (!isMounted) return;

        const containerWidth = containerRef.current?.clientWidth || 600;
        
        vrvToolkit.setOptions({
          scale: scale,
          pageWidth: Math.floor(containerWidth * 100 / scale),
          pageHeight: 1000,
          adjustPageHeight: true,
          header: "none",
          footer: "none",
          breaks: "auto",
          svgBoundingBoxes: false,
          svgViewBox: true,
        });

        const loadSuccess = vrvToolkit.loadData(meiData);
        
        if (!loadSuccess) {
          throw new Error("Could not parse notation data");
        }
        
        if (containerRef.current) {
          const svg = vrvToolkit.renderToSVG(1);
          containerRef.current.innerHTML = svg;

          const svgElement = containerRef.current.querySelector("svg");
          if (svgElement) {
            svgElement.style.width = "100%";
            svgElement.style.height = "auto";
            svgElement.style.maxHeight = `${height}px`;
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Mini Verovio error:", err);
        if (isMounted) {
          setError("Failed to render notation");
          setIsLoading(false);
        }
      }
    };

    loadVerovio();

    return () => {
      isMounted = false;
    };
  }, [meiData, height, scale]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center bg-white dark:bg-card rounded-md" style={{ height }}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-muted/30 rounded-md text-sm text-muted-foreground" style={{ height }}>
        {error}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="bg-white dark:bg-card rounded-md overflow-auto p-2"
      style={{ maxHeight: height }}
      data-testid="mini-score-display"
    />
  );
}
