import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { AnalysisResult } from "@shared/schema";

interface AnalysisPanelProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

export function AnalysisPanel({ result, isLoading }: AnalysisPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a workflow and click "Run Workflow" to see results
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg font-medium">Analysis Results</CardTitle>
          <Badge variant="secondary" className="font-normal">
            {result.workflowName}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Measures {result.measureRange.startMeasure} – {result.measureRange.endMeasure}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-80">
          <div className="space-y-4" data-testid="analysis-results">
            {renderResultData(result.data)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function renderResultData(data: Record<string, any>): JSX.Element {
  if (data.key) {
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Estimated Key</span>
          <span className="text-xl font-semibold font-mono">{data.key}</span>
        </div>
        {data.confidence && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Confidence</span>
            <span className="text-sm font-medium">{Math.round(data.confidence * 100)}%</span>
          </div>
        )}
        {data.alternates && data.alternates.length > 0 && (
          <div className="pt-2 border-t">
            <span className="text-sm text-muted-foreground block mb-2">Alternate Keys</span>
            <div className="flex flex-wrap gap-2">
              {data.alternates.map((alt: string, i: number) => (
                <Badge key={i} variant="outline" className="font-mono">
                  {alt}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (data.measures) {
    return (
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground block mb-3">Harmony by Measure</span>
        <div className="grid gap-2">
          {data.measures.map((measure: any) => (
            <div
              key={measure.number}
              className="flex items-center gap-4 p-3 rounded-md bg-muted/30"
            >
              <span className="text-xs text-muted-foreground w-8">
                m.{measure.number}
              </span>
              <div className="flex-1 flex flex-wrap gap-2">
                {measure.chords?.map((chord: any, i: number) => (
                  <div key={i} className="flex flex-col items-start">
                    <span className="font-mono text-sm font-medium">
                      {chord.label || chord.symbol || "—"}
                    </span>
                    {chord.pitches && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {chord.pitches.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <pre className="text-xs font-mono bg-muted/30 p-4 rounded-md overflow-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
