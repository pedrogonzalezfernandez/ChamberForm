import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Play, 
  Trash2, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Layers,
  Eye
} from "lucide-react";
import type { Workflow, PipelineStep, WorkflowParam, Selection } from "@shared/schema";

interface PipelinePanelProps {
  workflows: Workflow[];
  steps: PipelineStep[];
  parts: string[];
  selection: Selection;
  isRunning: boolean;
  onAddStep: (workflowId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStepParams: (stepId: string, params: Record<string, any>) => void;
  onRunStep: (stepId: string) => void;
  onRunAll: () => void;
  onReset: () => void;
  onSelectStep: (stepId: string) => void;
  selectedStepId: string | null;
}

export function PipelinePanel({
  workflows,
  steps,
  parts,
  selection,
  isRunning,
  onAddStep,
  onRemoveStep,
  onUpdateStepParams,
  onRunStep,
  onRunAll,
  onReset,
  onSelectStep,
  selectedStepId,
}: PipelinePanelProps) {
  const [newWorkflowId, setNewWorkflowId] = useState<string>("");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const handleAddStep = useCallback(() => {
    if (newWorkflowId) {
      onAddStep(newWorkflowId);
      setNewWorkflowId("");
    }
  }, [newWorkflowId, onAddStep]);

  const toggleStepExpand = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, []);

  const handleParamChange = useCallback((stepId: string, paramName: string, value: any) => {
    const step = steps.find(s => s.id === stepId);
    if (step) {
      const newParams = { ...step.params, [paramName]: value };
      onUpdateStepParams(stepId, newParams);
    }
  }, [steps, onUpdateStepParams]);

  const getWorkflowById = useCallback((id: string) => {
    return workflows.find(w => w.id === id);
  }, [workflows]);

  const renderParamInput = (step: PipelineStep, param: WorkflowParam) => {
    const storedValue = step.params?.[param.name];
    const currentValue = storedValue !== undefined ? storedValue : param.default;

    if (param.type === "select") {
      const options = param.name === "partA" || param.name === "partB" || param.name === "part"
        ? parts.map((p, i) => ({ value: i.toString(), label: p }))
        : param.options || [];

      const selectValue = currentValue !== undefined ? currentValue.toString() : (options[0]?.value || "0");

      return (
        <div key={param.name} className="space-y-1.5">
          <Label className="text-xs">{param.label}</Label>
          <Select
            value={selectValue}
            onValueChange={(value) => handleParamChange(step.id, param.name, value)}
          >
            <SelectTrigger className="h-8 text-xs" data-testid={`param-${step.id}-${param.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (param.type === "number") {
      return (
        <div key={param.name} className="space-y-1.5">
          <Label className="text-xs">{param.label}</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={currentValue ?? ""}
            onChange={(e) => handleParamChange(step.id, param.name, parseInt(e.target.value) || param.default)}
            data-testid={`param-${step.id}-${param.name}`}
          />
        </div>
      );
    }

    return (
      <div key={param.name} className="space-y-1.5">
        <Label className="text-xs">{param.label}</Label>
        <Input
          className="h-8 text-xs"
          value={currentValue ?? ""}
          onChange={(e) => handleParamChange(step.id, param.name, e.target.value)}
          data-testid={`param-${step.id}-${param.name}`}
        />
      </div>
    );
  };

  const renderStepStatus = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const completedCount = steps.filter(s => s.status === "completed").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Pipeline</CardTitle>
          </div>
          {steps.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{steps.length} done
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={newWorkflowId} onValueChange={setNewWorkflowId}>
            <SelectTrigger className="flex-1 h-9" data-testid="select-add-workflow">
              <SelectValue placeholder="Add workflow step..." />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((workflow) => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  <div className="flex flex-col items-start">
                    <span className="text-sm">{workflow.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {workflow.type === "transform" ? "Transform" : "Analysis"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="outline"
            onClick={handleAddStep}
            disabled={!newWorkflowId}
            data-testid="button-add-step"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {steps.length > 0 && (
          <>
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {steps.map((step, index) => {
                  const workflow = getWorkflowById(step.workflowId);
                  const isExpanded = expandedSteps.has(step.id);
                  const isSelected = selectedStepId === step.id;
                  const hasParams = workflow?.params && workflow.params.length > 0;
                  const hasResult = step.status === "completed" && step.result;

                  return (
                    <div
                      key={step.id}
                      className={`rounded-md border transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover-elevate"
                      }`}
                      data-testid={`pipeline-step-${index}`}
                    >
                      <div 
                        className="p-3 cursor-pointer"
                        onClick={() => onSelectStep(step.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
                            {renderStepStatus(step.status)}
                            <span className="text-sm font-medium truncate">
                              {workflow?.name || step.workflowId}
                            </span>
                            {workflow?.type === "transform" && (
                              <Badge variant="outline" className="text-xs shrink-0">Transform</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasResult && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectStep(step.id);
                                }}
                                title="View result"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            {hasParams && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStepExpand(step.id);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRunStep(step.id);
                              }}
                              disabled={isRunning}
                              data-testid={`button-run-step-${index}`}
                            >
                              {step.status === "running" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveStep(step.id);
                              }}
                              disabled={isRunning}
                              data-testid={`button-remove-step-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {step.error && (
                          <p className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                            {step.error}
                          </p>
                        )}

                        {hasResult && isSelected && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                            Result available - see Analysis panel
                          </div>
                        )}
                      </div>

                      {isExpanded && hasParams && (
                        <div className="px-3 pb-3 pt-0 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="pt-3 space-y-3">
                            {workflow?.params?.map((param) => renderParamInput(step, param))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={onRunAll}
                disabled={isRunning || steps.length === 0}
                data-testid="button-run-all"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run All
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                disabled={isRunning}
                data-testid="button-reset-pipeline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </>
        )}

        {steps.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <p>No steps in pipeline</p>
            <p className="text-xs mt-1">Add a workflow to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
