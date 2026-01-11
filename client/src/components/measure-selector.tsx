import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { MeasureRange } from "@shared/schema";

interface MeasureSelectorProps {
  startMeasure: number;
  endMeasure: number;
  maxMeasure: number;
  onChange: (range: MeasureRange) => void;
}

export function MeasureSelector({
  startMeasure,
  endMeasure,
  maxMeasure,
  onChange,
}: MeasureSelectorProps) {
  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(value, endMeasure));
    onChange({ startMeasure: clampedValue, endMeasure });
  }, [endMeasure, onChange]);

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(startMeasure, Math.min(value, maxMeasure));
    onChange({ startMeasure, endMeasure: clampedValue });
  }, [startMeasure, maxMeasure, onChange]);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Section Selection</Label>
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="start-measure" className="text-xs text-muted-foreground">
            Start Measure
          </Label>
          <Input
            id="start-measure"
            type="number"
            min={1}
            max={endMeasure}
            value={startMeasure}
            onChange={handleStartChange}
            className="h-10"
            data-testid="input-start-measure"
          />
        </div>
        <div className="flex items-center pt-6">
          <span className="text-muted-foreground">–</span>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="end-measure" className="text-xs text-muted-foreground">
            End Measure
          </Label>
          <Input
            id="end-measure"
            type="number"
            min={startMeasure}
            max={maxMeasure}
            value={endMeasure}
            onChange={handleEndChange}
            className="h-10"
            data-testid="input-end-measure"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Score has {maxMeasure} {maxMeasure === 1 ? "measure" : "measures"} total
      </p>
    </div>
  );
}
