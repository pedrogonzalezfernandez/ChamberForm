import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Music, 
  Key, 
  BarChart3, 
  Hash, 
  AlertTriangle, 
  Waves,
  ChevronDown,
  ChevronRight,
  Download,
  Play,
  Eye,
  CheckCircle2,
  Clock,
  List,
  Layers,
  SkipForward,
  Zap,
  RotateCcw
} from "lucide-react";
import type { WorkflowResult, PipelineStep, Workflow } from "@shared/schema";
import { useState } from "react";
import { ChordStepper } from "./chord-stepper";
import { MiniScoreViewer } from "./mini-score-viewer";

interface AnalysisPanelProps {
  steps: PipelineStep[];
  workflows: Workflow[];
  selectedStepId: string | null;
  activeStreamId: string | null;
  onSelectStep: (stepId: string) => void;
  onExport?: (stepId: string, format: "musicxml" | "midi") => void;
  onPlayStep?: (stepId: string) => void;
  onActivateStream?: (streamId: string | null) => void;
  isLoading: boolean;
}

export function AnalysisPanel({ 
  steps, 
  workflows, 
  selectedStepId,
  activeStreamId,
  onSelectStep,
  onExport,
  onPlayStep,
  onActivateStream,
  isLoading 
}: AnalysisPanelProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const completedSteps = steps.filter(s => s.status === "completed" && s.result);

  const toggleCard = (stepId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const getWorkflowById = (id: string) => workflows.find(w => w.id === id);

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (completedSteps.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Run a workflow step to see results
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg font-medium">Results</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {completedSteps.length} step{completedSteps.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2 p-4 pt-0">
            {completedSteps.map((step, index) => {
              const result = step.result as WorkflowResult;
              const workflow = getWorkflowById(step.workflowId);
              const isExpanded = expandedCards.has(step.id);
              const isSelected = selectedStepId === step.id;
              const hasExports = result?.exports?.formats && result.exports.formats.length > 0;
              const hasPlayback = result?.playbackEvents && result.playbackEvents.length > 0;
              const hasNotation = result?.data?.notationData && result.data.notationData.length > 0;

              return (
                <div
                  key={step.id}
                  className={`rounded-md border transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : ""
                  }`}
                  data-testid={`result-card-${index}`}
                >
                  <Collapsible open={isExpanded}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="p-3 cursor-pointer hover-elevate rounded-t-md"
                        onClick={() => {
                          onSelectStep(step.id);
                          toggleCard(step.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {result?.workflowName || workflow?.name || step.workflowId}
                            </span>
                            {workflow?.type === "transform" && (
                              <Badge variant="outline" className="text-xs shrink-0">Transform</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {result?.timestamp && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(result.timestamp)}
                              </span>
                            )}
                          </div>
                        </div>
                        {result?.selection && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            {result.selection.partId === "ALL" ? "All parts" : `Part ${result.selection.partId}`}
                            {" • "}
                            Measures {result.selection.startMeasure} – {result.selection.endMeasure}
                          </p>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t">
                        {workflow?.type === "transform" && result?.data?.transformedStreamId && (
                          <div className="px-3 py-2 bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              Transform result available
                            </span>
                            {activeStreamId === result.data.transformedStreamId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onActivateStream?.(null)}
                                className="gap-1.5"
                                data-testid={`deactivate-stream-${index}`}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Show Original
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => onActivateStream?.(result.data.transformedStreamId)}
                                className="gap-1.5"
                                data-testid={`activate-stream-${index}`}
                              >
                                <Zap className="h-3 w-3" />
                                Activate in Score
                              </Button>
                            )}
                          </div>
                        )}
                        <Tabs defaultValue="list" className="w-full">
                          <div className="px-3 pt-2">
                            <TabsList className="h-8">
                              <TabsTrigger value="list" className="text-xs gap-1">
                                <List className="h-3 w-3" />
                                List
                              </TabsTrigger>
                              {hasNotation && (
                                <TabsTrigger value="notation" className="text-xs gap-1">
                                  <Music className="h-3 w-3" />
                                  Notation
                                </TabsTrigger>
                              )}
                              {hasPlayback && (
                                <TabsTrigger value="playback" className="text-xs gap-1">
                                  <SkipForward className="h-3 w-3" />
                                  Stepper
                                </TabsTrigger>
                              )}
                              {hasExports && (
                                <TabsTrigger value="export" className="text-xs gap-1">
                                  <Download className="h-3 w-3" />
                                  Export
                                </TabsTrigger>
                              )}
                            </TabsList>
                          </div>
                          
                          <TabsContent value="list" className="px-3 pb-3 mt-0 max-h-64 overflow-y-auto">
                            <div className="space-y-4 pt-3" data-testid={`result-data-${index}`}>
                              {renderResultData(result?.workflowId || step.workflowId, result?.data || {})}
                            </div>
                          </TabsContent>
                          
                          {hasNotation && (
                            <TabsContent value="notation" className="px-3 pb-3 mt-0">
                              <div className="pt-3" data-testid={`result-notation-${index}`}>
                                <MiniScoreViewer 
                                  meiData={result.data.notationData} 
                                  height={200}
                                  scale={30}
                                />
                              </div>
                            </TabsContent>
                          )}
                          
                          {hasPlayback && (
                            <TabsContent value="playback" className="px-3 pb-3 mt-0">
                              <div className="pt-3">
                                <ChordStepper 
                                  events={result.playbackEvents || []} 
                                  tempo={result.data?.defaultTempo || 120}
                                />
                              </div>
                            </TabsContent>
                          )}
                          
                          {hasExports && (
                            <TabsContent value="export" className="px-3 pb-3 mt-0">
                              <div className="pt-3 flex flex-wrap gap-2">
                                {result.exports?.formats.includes("musicxml") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onExport?.(step.id, "musicxml")}
                                    className="gap-2"
                                    data-testid={`export-musicxml-${index}`}
                                  >
                                    <Download className="h-3 w-3" />
                                    MusicXML
                                  </Button>
                                )}
                                {result.exports?.formats.includes("midi") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onExport?.(step.id, "midi")}
                                    className="gap-2"
                                    data-testid={`export-midi-${index}`}
                                  >
                                    <Download className="h-3 w-3" />
                                    MIDI
                                  </Button>
                                )}
                              </div>
                            </TabsContent>
                          )}
                        </Tabs>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function renderResultData(workflowId: string, data: Record<string, any>): JSX.Element {
  switch (workflowId) {
    case "score_summary":
      return <ScoreSummaryResult data={data} />;
    case "global_key_estimate":
      return <KeyEstimateResult data={data} />;
    case "chordify_and_chords":
      return <ChordifyResult data={data} />;
    case "roman_numeral_analysis":
      return <RomanNumeralResult data={data} />;
    case "cadence_spotter":
      return <CadenceResult data={data} />;
    case "interval_map_between_parts":
      return <IntervalMapResult data={data} />;
    case "parallel_5ths_8ves_detector":
      return <ParallelsResult data={data} />;
    case "rhythm_skeleton":
      return <RhythmSkeletonResult data={data} />;
    case "motif_finder_interval_contour":
      return <MotifFinderResult data={data} />;
    case "reduction_outer_voices":
      return <ReductionResult data={data} />;
    default:
      return <GenericResult data={data} />;
  }
}

function ScoreSummaryResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {data.title && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Title</span>
          <span className="font-medium">{data.title}</span>
        </div>
      )}
      {data.composer && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Composer</span>
          <span className="font-medium">{data.composer}</span>
        </div>
      )}
      {data.parts && data.parts.length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-sm text-muted-foreground block mb-2">Parts ({data.parts.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {data.parts.map((part: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {part}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Measures</span>
        <span className="font-medium">{data.measureCount}</span>
      </div>
      {data.timeSignatures?.length > 0 && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Time Signatures</span>
          <span className="font-mono text-sm">{data.timeSignatures.join(", ")}</span>
        </div>
      )}
      {data.keySignatures?.length > 0 && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Key Signatures</span>
          <span className="font-mono text-sm">{data.keySignatures.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function KeyEstimateResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Key className="h-5 w-5 text-muted-foreground" />
        <span className="text-2xl font-bold font-mono">{data.key}</span>
        {data.confidence && (
          <Badge variant="secondary" className="text-xs">
            {Math.round(data.confidence * 100)}% confidence
          </Badge>
        )}
      </div>
      {data.alternates && data.alternates.length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground block mb-2">Alternate keys</span>
          <div className="flex flex-wrap gap-1.5">
            {data.alternates.map((alt: string, i: number) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {alt}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {data.notes && (
        <p className="text-xs text-muted-foreground italic">{data.notes}</p>
      )}
    </div>
  );
}

function ChordifyResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chords by Measure</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {data.totalChords} total
        </Badge>
      </div>
      <div className="space-y-2">
        {data.measures?.map((measure: any) => (
          <div key={measure.measure} className="flex gap-3 p-2 rounded bg-muted/30">
            <span className="text-xs text-muted-foreground w-8 shrink-0">m.{measure.measure}</span>
            <div className="flex flex-wrap gap-2">
              {measure.chords?.map((chord: any, i: number) => (
                <div key={i} className="flex flex-col">
                  <span className="font-mono text-sm font-medium">{chord.label || "?"}</span>
                  {chord.pitches && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {chord.pitches.map((p: any) => p.name).join(" ")}
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

function RomanNumeralResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Key: {data.key}</span>
      </div>
      <div className="space-y-2">
        {data.measures?.map((measure: any) => (
          <div key={measure.measure} className="flex gap-3 p-2 rounded bg-muted/30">
            <span className="text-xs text-muted-foreground w-8 shrink-0">m.{measure.measure}</span>
            <div className="flex flex-wrap gap-2">
              {measure.numerals?.map((rn: any, i: number) => (
                <Badge key={i} variant="outline" className="font-mono">
                  {rn.numeral}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CadenceResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Cadences Detected</span>
        <Badge variant="secondary" className="text-xs">
          {data.totalFound} found
        </Badge>
      </div>
      {data.cadences?.length > 0 ? (
        <div className="space-y-2">
          {data.cadences.map((cad: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{cad.type}</Badge>
                <span className="text-xs text-muted-foreground">m.{cad.measure}</span>
              </div>
              <p className="text-sm font-mono mt-1">{cad.progression}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No cadences detected in selection</p>
      )}
    </div>
  );
}

function IntervalMapResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{data.partA} - {data.partB}</span>
        <Badge variant="secondary" className="text-xs">
          {data.totalIntervals} intervals
        </Badge>
      </div>
      {data.summary && Object.keys(data.summary).length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground block mb-2">Most Common</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.summary).map(([interval, count]) => (
              <Badge key={interval} variant="outline" className="font-mono text-xs">
                {interval}: {count as number}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParallelsResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Parallel Motion</span>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">5ths: {data.fifthsCount}</Badge>
          <Badge variant="outline" className="text-xs">8ves: {data.octavesCount}</Badge>
        </div>
      </div>
      {data.parallels?.length > 0 ? (
        <div className="space-y-2">
          {data.parallels.map((p: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30 text-sm">
              <div className="flex justify-between">
                <Badge variant="destructive" className="text-xs">{p.type}</Badge>
                <span className="text-xs text-muted-foreground">m.{p.measure}</span>
              </div>
              <p className="font-mono text-xs mt-1">
                {p.pitchA1}/{p.pitchB1} - {p.pitchA2}/{p.pitchB2}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No parallels detected</p>
      )}
    </div>
  );
}

function RhythmSkeletonResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Waves className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Onset Patterns</span>
      </div>
      {data.parts?.map((part: any, pi: number) => (
        <div key={pi} className="pt-2 border-t first:border-t-0 first:pt-0">
          <span className="text-xs font-medium block mb-1.5">{part.part}</span>
          <div className="space-y-1">
            {part.measures?.slice(0, 8).map((m: any) => (
              <div key={m.measure} className="flex gap-2 text-xs">
                <span className="text-muted-foreground w-6">m.{m.measure}</span>
                <span className="font-mono">{m.pattern}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MotifFinderResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Motifs in {data.analyzedPart}</span>
        <Badge variant="secondary" className="text-xs">
          {data.totalMotifsFound} patterns
        </Badge>
      </div>
      {data.motifs?.length > 0 ? (
        <div className="space-y-3">
          {data.motifs.map((motif: any) => (
            <div key={motif.id} className="p-2 rounded bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-xs">Motif {motif.id}</Badge>
                <span className="text-xs text-muted-foreground">{motif.occurrenceCount} times</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mb-2">{motif.contour}</p>
              <div className="flex flex-wrap gap-1">
                {motif.occurrences?.slice(0, 5).map((occ: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs font-mono">
                    m.{occ.measure}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No repeated motifs found</p>
      )}
    </div>
  );
}

function ReductionResult({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Outer Voices Reduction</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 rounded bg-muted/30">
          <span className="text-xs text-muted-foreground block">Soprano</span>
          <span className="font-medium">{data.soprano}</span>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <span className="text-xs text-muted-foreground block">Bass</span>
          <span className="font-medium">{data.bass}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Playback events</span>
        <span className="font-medium">{data.eventCount}</span>
      </div>
      {data.description && (
        <p className="text-xs text-muted-foreground italic">{data.description}</p>
      )}
    </div>
  );
}

function GenericResult({ data }: { data: any }) {
  return (
    <pre className="text-xs font-mono bg-muted/30 p-4 rounded-md overflow-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
