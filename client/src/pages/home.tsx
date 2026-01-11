import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ScoreViewer } from "@/components/score-viewer";
import { MeasureSelector } from "@/components/measure-selector";
import { WorkflowSelector } from "@/components/workflow-selector";
import { AnalysisPanel } from "@/components/analysis-panel";
import { PlaybackControls } from "@/components/playback-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Music, Upload } from "lucide-react";
import type { UploadResponse, Workflow, AnalysisResult, ReductionData, MeasureRange } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [scoreData, setScoreData] = useState<UploadResponse | null>(null);
  const [measureRange, setMeasureRange] = useState<MeasureRange>({ startMeasure: 1, endMeasure: 1 });
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [reductionData, setReductionData] = useState<ReductionData | null>(null);

  const { data: workflows, isLoading: workflowsLoading } = useQuery<{ workflows: Workflow[] }>({
    queryKey: ["/api/workflows"],
    enabled: !!scoreData,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      setScoreData(data);
      setMeasureRange({ startMeasure: 1, endMeasure: data.metadata.measureCount });
      setAnalysisResult(null);
      setReductionData(null);
      toast({
        title: "Score uploaded",
        description: `${data.metadata.title || "Untitled"} loaded with ${data.metadata.measureCount} measures`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runWorkflowMutation = useMutation({
    mutationFn: async (): Promise<AnalysisResult | null> => {
      if (!scoreData || !selectedWorkflow) return null;
      const response = await apiRequest("POST", "/api/workflow/run", {
        scoreId: scoreData.scoreId,
        workflowId: selectedWorkflow,
        startMeasure: measureRange.startMeasure,
        endMeasure: measureRange.endMeasure,
      });
      return response.json() as Promise<AnalysisResult>;
    },
    onSuccess: (data) => {
      if (data) {
        setAnalysisResult(data);
        toast({
          title: "Analysis complete",
          description: `${data.workflowName} finished successfully`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getReductionMutation = useMutation({
    mutationFn: async (): Promise<ReductionData | null> => {
      if (!scoreData) return null;
      const response = await apiRequest("POST", "/api/reduction", {
        scoreId: scoreData.scoreId,
        startMeasure: measureRange.startMeasure,
        endMeasure: measureRange.endMeasure,
      });
      return response.json() as Promise<ReductionData>;
    },
    onSuccess: (data) => {
      if (data) {
        setReductionData(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to load playback data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const handleRunWorkflow = useCallback(() => {
    runWorkflowMutation.mutate();
  }, [runWorkflowMutation]);

  const handleMeasureRangeChange = useCallback((range: MeasureRange) => {
    setMeasureRange(range);
    setReductionData(null);
  }, []);

  const handlePreparePlayback = useCallback(() => {
    getReductionMutation.mutate();
  }, [getReductionMutation]);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b flex items-center justify-between px-6 lg:px-8 bg-card">
        <div className="flex items-center gap-3">
          <Music className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">Chamber Music Rehearsal Tool</h1>
        </div>
        {scoreData && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScoreData(null);
              setAnalysisResult(null);
              setReductionData(null);
            }}
            data-testid="button-new-score"
          >
            <Upload className="h-4 w-4 mr-2" />
            New Score
          </Button>
        )}
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {!scoreData ? (
          <div className="max-w-2xl mx-auto py-12">
            <FileUpload
              onFileSelect={handleFileSelect}
              isUploading={uploadMutation.isPending}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                  <CardTitle className="text-lg font-medium">Score</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {scoreData.metadata.title && (
                      <span className="font-medium text-foreground">{scoreData.metadata.title}</span>
                    )}
                    {scoreData.metadata.composer && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span>{scoreData.metadata.composer}</span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScoreViewer meiData={scoreData.meiData} />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium">Analysis Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MeasureSelector
                    startMeasure={measureRange.startMeasure}
                    endMeasure={measureRange.endMeasure}
                    maxMeasure={scoreData.metadata.measureCount}
                    onChange={handleMeasureRangeChange}
                  />

                  <WorkflowSelector
                    workflows={workflows?.workflows || []}
                    selectedWorkflow={selectedWorkflow}
                    onSelect={setSelectedWorkflow}
                    isLoading={workflowsLoading}
                  />

                  <Button
                    onClick={handleRunWorkflow}
                    disabled={!selectedWorkflow || runWorkflowMutation.isPending}
                    className="w-full"
                    data-testid="button-run-workflow"
                  >
                    {runWorkflowMutation.isPending ? "Running..." : "Run Workflow"}
                  </Button>
                </CardContent>
              </Card>

              <AnalysisPanel
                result={analysisResult}
                isLoading={runWorkflowMutation.isPending}
              />

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium">Playback</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlaybackControls
                    reductionData={reductionData}
                    onPreparePlayback={handlePreparePlayback}
                    isLoading={getReductionMutation.isPending}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
