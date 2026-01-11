import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";
import type { Selection } from "@shared/schema";

interface SelectionPanelProps {
  selection: Selection;
  parts: string[];
  maxMeasure: number;
  onChange: (selection: Selection) => void;
}

export function SelectionPanel({
  selection,
  parts,
  maxMeasure,
  onChange,
}: SelectionPanelProps) {
  const handlePartChange = useCallback((partId: string) => {
    onChange({ ...selection, partId });
  }, [selection, onChange]);

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(value, selection.endMeasure));
    onChange({ ...selection, startMeasure: clampedValue });
  }, [selection, onChange]);

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(selection.startMeasure, Math.min(value, maxMeasure));
    onChange({ ...selection, endMeasure: clampedValue });
  }, [selection, maxMeasure, onChange]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-medium">Selection</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Choose which part and measures to analyze
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="part-select" className="text-sm">Part</Label>
          <Select value={selection.partId} onValueChange={handlePartChange}>
            <SelectTrigger id="part-select" className="h-9" data-testid="select-part">
              <SelectValue placeholder="All parts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" data-testid="part-option-all">
                All parts
              </SelectItem>
              {parts.map((part, index) => (
                <SelectItem 
                  key={index} 
                  value={index.toString()}
                  data-testid={`part-option-${index}`}
                >
                  {part}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Measure Range</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                type="number"
                min={1}
                max={selection.endMeasure}
                value={selection.startMeasure}
                onChange={handleStartChange}
                className="h-9"
                data-testid="input-start-measure"
              />
            </div>
            <span className="text-muted-foreground text-sm">to</span>
            <div className="flex-1">
              <Input
                type="number"
                min={selection.startMeasure}
                max={maxMeasure}
                value={selection.endMeasure}
                onChange={handleEndChange}
                className="h-9"
                data-testid="input-end-measure"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {maxMeasure} measures total
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
