import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ScoreViewer } from "@/components/score-viewer";
import { SelectionPanel } from "@/components/selection-panel";
import { PipelinePanel } from "@/components/pipeline-panel";
import { AnalysisPanel } from "@/components/analysis-panel";
import { PlaybackControls } from "@/components/playback-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Music, Upload } from "lucide-react";
import type { 
  UploadResponse, 
  Workflow, 
  WorkflowResult, 
  ReductionData, 
  Selection,
  PipelineStep,
  Annotation,
} from "@shared/schema";

let stepIdCounter = 0;
function generateStepId(): string {
  return `step_${++stepIdCounter}_${Date.now()}`;
}

export default function Home() {
  const { toast } = useToast();
  const [scoreData, setScoreData] = useState<UploadResponse | null>(null);
  const [selection, setSelection] = useState<Selection>({ 
    partId: "ALL", 
    startMeasure: 1, 
    endMeasure: 1 
  });
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<WorkflowResult | null>(null);
  const [reductionData, setReductionData] = useState<ReductionData | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const abortRef = useRef(false);

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
      setSelection({ 
        partId: "ALL", 
        startMeasure: 1, 
        endMeasure: data.metadata.measureCount 
      });
      setPipelineSteps([]);
      setCurrentResult(null);
      setReductionData(null);
      setSelectedStepId(null);
      setActiveStreamId(null);
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

  const runStepMutation = useMutation({
    mutationFn: async (stepId: string): Promise<{ stepId: string; result: WorkflowResult } | null> => {
      if (!scoreData) return null;
      
      const step = pipelineSteps.find(s => s.id === stepId);
      if (!step) return null;
      
      const response = await apiRequest("POST", "/api/pipeline/runStep", {
        scoreId: scoreData.scoreId,
        stepId,
        workflowId: step.workflowId,
        selection,
        params: step.params || {},
      });
      const result = await response.json() as WorkflowResult;
      return { stepId, result };
    },
    onMutate: (stepId) => {
      setPipelineSteps(prev => 
        prev.map(step => 
          step.id === stepId ? { ...step, status: "running" as const, error: undefined } : step
        )
      );
    },
    onSuccess: (data) => {
      if (data) {
        const { stepId, result } = data;
        
        setPipelineSteps(prev => 
          prev.map(step => 
            step.id === stepId 
              ? { ...step, status: "completed" as const, result, error: undefined } 
              : step
          )
        );
        
        setSelectedStepId(stepId);
        setCurrentResult(result);
        
        if (result.playbackEvents && result.playbackEvents.length > 0) {
          setReductionData({
            scoreId: scoreData?.scoreId || "",
            startMeasure: selection.startMeasure,
            endMeasure: selection.endMeasure,
            events: result.playbackEvents,
            beatsPerMeasure: result.data?.beatsPerMeasure || 4,
            defaultTempo: result.data?.defaultTempo || 120,
          });
        }
        
        toast({
          title: "Step completed",
          description: `${result.workflowName} finished successfully`,
        });
      }
    },
    onError: (error: Error, stepId) => {
      setPipelineSteps(prev => 
        prev.map(step => 
          step.id === stepId 
            ? { ...step, status: "error" as const, error: error.message } 
            : step
        )
      );
      toast({
        title: "Step failed",
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
        startMeasure: selection.startMeasure,
        endMeasure: selection.endMeasure,
        partId: selection.partId,
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

  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setSelection(newSelection);
    setReductionData(null);
    
    setPipelineSteps(prev => 
      prev.map(step => ({
        ...step,
        status: "pending" as const,
        result: undefined,
        error: undefined,
      }))
    );
    setCurrentResult(null);
  }, []);

  const handleAddStep = useCallback((workflowId: string) => {
    const workflow = workflows?.workflows.find(w => w.id === workflowId);
    const defaultParams: Record<string, any> = {};
    
    if (workflow?.params) {
      for (const param of workflow.params) {
        if (param.default !== undefined) {
          defaultParams[param.name] = param.default;
        }
      }
    }
    
    const newStep: PipelineStep = {
      id: generateStepId(),
      workflowId,
      params: defaultParams,
      status: "pending",
    };
    setPipelineSteps(prev => [...prev, newStep]);
  }, [workflows]);

  const handleRemoveStep = useCallback((stepId: string) => {
    setPipelineSteps(prev => prev.filter(step => step.id !== stepId));
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
      setCurrentResult(null);
    }
  }, [selectedStepId]);

  const handleUpdateStepParams = useCallback((stepId: string, params: Record<string, any>) => {
    setPipelineSteps(prev => 
      prev.map(step => 
        step.id === stepId 
          ? { ...step, params, status: "pending" as const, result: undefined, error: undefined } 
          : step
      )
    );
  }, []);

  const handleRunStep = useCallback((stepId: string) => {
    runStepMutation.mutate(stepId);
  }, [runStepMutation]);

  const handleRunAll = useCallback(async () => {
    if (!scoreData || pipelineSteps.length === 0) return;
    
    setIsRunningPipeline(true);
    abortRef.current = false;
    
    for (const step of pipelineSteps) {
      if (abortRef.current) break;
      
      setPipelineSteps(prev => 
        prev.map(s => 
          s.id === step.id ? { ...s, status: "running" as const, error: undefined } : s
        )
      );
      
      try {
        const response = await apiRequest("POST", "/api/pipeline/runStep", {
          scoreId: scoreData.scoreId,
          stepId: step.id,
          workflowId: step.workflowId,
          selection,
          params: step.params || {},
        });
        
        const result = await response.json() as WorkflowResult;
        
        setPipelineSteps(prev => 
          prev.map(s => 
            s.id === step.id ? { ...s, status: "completed" as const, result, error: undefined } : s
          )
        );
        
        setSelectedStepId(step.id);
        setCurrentResult(result);
        
        if (result.playbackEvents && result.playbackEvents.length > 0) {
          setReductionData({
            scoreId: scoreData.scoreId,
            startMeasure: selection.startMeasure,
            endMeasure: selection.endMeasure,
            events: result.playbackEvents,
            beatsPerMeasure: result.data?.beatsPerMeasure || 4,
            defaultTempo: result.data?.defaultTempo || 120,
          });
        }
      } catch (error) {
        setPipelineSteps(prev => 
          prev.map(s => 
            s.id === step.id 
              ? { ...s, status: "error" as const, error: error instanceof Error ? error.message : "Unknown error" } 
              : s
          )
        );
        toast({
          title: "Pipeline stopped",
          description: `Error in step: ${step.workflowId}`,
          variant: "destructive",
        });
        break;
      }
    }
    
    setIsRunningPipeline(false);
    
    const completedCount = pipelineSteps.filter(s => s.status === "completed").length;
    if (completedCount === pipelineSteps.length) {
      toast({
        title: "Pipeline completed",
        description: `All ${pipelineSteps.length} steps executed successfully`,
      });
    }
  }, [pipelineSteps, scoreData, selection, toast]);

  const handleReset = useCallback(async () => {
    abortRef.current = true;
    setPipelineSteps([]);
    setCurrentResult(null);
    setReductionData(null);
    setSelectedStepId(null);
    setIsRunningPipeline(false);
    setActiveStreamId(null);
    
    if (scoreData) {
      setSelection({ 
        partId: "ALL", 
        startMeasure: 1, 
        endMeasure: scoreData.metadata.measureCount 
      });
      
      try {
        await apiRequest("POST", "/api/pipeline/reset", {
          scoreId: scoreData.scoreId,
        });
        
        const response = await fetch(`/api/score/${scoreData.scoreId}`);
        if (response.ok) {
          const data = await response.json();
          setScoreData(prev => prev ? { ...prev, meiData: data.meiData } : prev);
        }
      } catch (error) {
        console.error("Reset error:", error);
      }
    }
    
    toast({
      title: "Pipeline reset",
      description: "All steps cleared",
    });
  }, [scoreData, toast]);

  const handleSelectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    const step = pipelineSteps.find(s => s.id === stepId);
    if (step?.result) {
      setCurrentResult(step.result as WorkflowResult);
      
      const result = step.result as WorkflowResult;
      if (result.playbackEvents && result.playbackEvents.length > 0) {
        setReductionData({
          scoreId: scoreData?.scoreId || "",
          startMeasure: selection.startMeasure,
          endMeasure: selection.endMeasure,
          events: result.playbackEvents,
          beatsPerMeasure: result.data?.beatsPerMeasure || 4,
          defaultTempo: result.data?.defaultTempo || 120,
        });
      }
    }
  }, [pipelineSteps, scoreData, selection]);

  const handleExport = useCallback(async (stepId: string, format: "musicxml" | "midi") => {
    if (!scoreData) return;
    
    const step = pipelineSteps.find(s => s.id === stepId);
    if (!step?.result) return;
    
    const result = step.result as WorkflowResult;
    
    try {
      const response = await fetch("/api/pipeline/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreId: scoreData.scoreId,
          stepId,
          format,
          selection: result.selection,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "midi" ? "export.mid" : "export.musicxml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export complete",
        description: `Downloaded ${format.toUpperCase()} file`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [pipelineSteps, scoreData, toast]);

  const handlePlayStep = useCallback((stepId: string) => {
    const step = pipelineSteps.find(s => s.id === stepId);
    if (step?.result) {
      const result = step.result as WorkflowResult;
      if (result.playbackEvents && result.playbackEvents.length > 0) {
        setReductionData({
          scoreId: scoreData?.scoreId || "",
          startMeasure: selection.startMeasure,
          endMeasure: selection.endMeasure,
          events: result.playbackEvents,
          beatsPerMeasure: result.data?.beatsPerMeasure || 4,
          defaultTempo: result.data?.defaultTempo || 120,
        });
      }
    }
  }, [pipelineSteps, scoreData, selection]);

  const handlePreparePlayback = useCallback(() => {
    getReductionMutation.mutate();
  }, [getReductionMutation]);

  const handleActivateStream = useCallback(async (streamId: string | null) => {
    if (!scoreData) return;
    
    try {
      const response = await apiRequest("POST", "/api/pipeline/activateStream", {
        scoreId: scoreData.scoreId,
        streamId: streamId || "original",
      });
      
      const data = await response.json();
      
      if (data.success && data.meiData) {
        setScoreData(prev => prev ? { ...prev, meiData: data.meiData } : prev);
        setActiveStreamId(streamId);
        
        toast({
          title: streamId ? "View switched" : "Restored original",
          description: streamId ? "Showing transformed score" : "Showing original score",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to switch view",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [scoreData, toast]);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6 lg:px-8 bg-card">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Chamber Music Rehearsal Tool</h1>
        </div>
        {scoreData && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScoreData(null);
              setPipelineSteps([]);
              setCurrentResult(null);
              setReductionData(null);
              setSelectedStepId(null);
            }}
            data-testid="button-new-score"
          >
            <Upload className="h-4 w-4 mr-2" />
            New Score
          </Button>
        )}
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-6">
        {!scoreData ? (
          <div className="max-w-2xl mx-auto py-12">
            <FileUpload
              onFileSelect={handleFileSelect}
              isUploading={uploadMutation.isPending}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                  <CardTitle className="text-base font-medium">Score</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {scoreData.metadata.title && (
                      <span className="font-medium text-foreground">{scoreData.metadata.title}</span>
                    )}
                    {scoreData.metadata.composer && (
                      <>
                        <span>·</span>
                        <span>{scoreData.metadata.composer}</span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScoreViewer 
                    meiData={scoreData.meiData} 
                    annotations={currentResult?.annotations || []}
                    showAnnotations={showAnnotations}
                    onAnnotationToggle={setShowAnnotations}
                  />
                </CardContent>
              </Card>

              <AnalysisPanel
                steps={pipelineSteps}
                workflows={workflows?.workflows || []}
                selectedStepId={selectedStepId}
                activeStreamId={activeStreamId}
                onSelectStep={handleSelectStep}
                onExport={handleExport}
                onPlayStep={handlePlayStep}
                onActivateStream={handleActivateStream}
                isLoading={runStepMutation.isPending}
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <SelectionPanel
                selection={selection}
                parts={scoreData.metadata.parts}
                maxMeasure={scoreData.metadata.measureCount}
                onChange={handleSelectionChange}
              />

              <PipelinePanel
                workflows={workflows?.workflows || []}
                steps={pipelineSteps}
                parts={scoreData.metadata.parts}
                selection={selection}
                isRunning={isRunningPipeline || runStepMutation.isPending}
                onAddStep={handleAddStep}
                onRemoveStep={handleRemoveStep}
                onUpdateStepParams={handleUpdateStepParams}
                onRunStep={handleRunStep}
                onRunAll={handleRunAll}
                onReset={handleReset}
                onSelectStep={handleSelectStep}
                selectedStepId={selectedStepId}
              />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Playback</CardTitle>
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
