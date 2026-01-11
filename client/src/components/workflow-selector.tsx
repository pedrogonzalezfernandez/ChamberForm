import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workflow } from "@shared/schema";

interface WorkflowSelectorProps {
  workflows: Workflow[];
  selectedWorkflow: string;
  onSelect: (workflowId: string) => void;
  isLoading: boolean;
}

export function WorkflowSelector({
  workflows,
  selectedWorkflow,
  onSelect,
  isLoading,
}: WorkflowSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Analysis Workflow</Label>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="workflow-select" className="text-sm font-medium">
        Analysis Workflow
      </Label>
      <Select value={selectedWorkflow} onValueChange={onSelect}>
        <SelectTrigger id="workflow-select" className="h-10" data-testid="select-workflow">
          <SelectValue placeholder="Select a workflow..." />
        </SelectTrigger>
        <SelectContent>
          {workflows.map((workflow) => (
            <SelectItem
              key={workflow.id}
              value={workflow.id}
              data-testid={`workflow-option-${workflow.id}`}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{workflow.name}</span>
                <span className="text-xs text-muted-foreground">{workflow.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedWorkflow && (
        <p className="text-xs text-muted-foreground">
          {workflows.find(w => w.id === selectedWorkflow)?.description}
        </p>
      )}
    </div>
  );
}
