import { Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { PartSnapshot } from "@/lib/playback/PlaybackEngine";

interface PartMixerProps {
  parts: PartSnapshot[];
  onVolumeChange: (partId: string, volume: number) => void;
  onMuteToggle: (partId: string, muted: boolean) => void;
}

/** One volume/mute channel strip per MusicXML part, so each instrument can be balanced or isolated independently. */
export function PartMixer({ parts, onVolumeChange, onMuteToggle }: PartMixerProps) {
  if (parts.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="part-mixer">
      {parts.map((part) => (
        <div
          key={part.id}
          className="flex items-center gap-3 rounded-md border p-2.5"
          data-testid={`mixer-row-${part.id}`}
        >
          <Button
            size="icon"
            variant={part.muted ? "secondary" : "outline"}
            className="h-8 w-8 shrink-0"
            onClick={() => onMuteToggle(part.id, !part.muted)}
            data-testid={`button-mute-${part.id}`}
            aria-label={part.muted ? `Unmute ${part.name}` : `Mute ${part.name}`}
          >
            {part.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          <div className="min-w-0 w-28 shrink-0">
            <p className="text-sm font-medium truncate">{part.name}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {part.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {part.error && <AlertCircle className="h-3 w-3 text-destructive" />}
              {part.instrument}
            </p>
          </div>

          <Slider
            value={[Math.round(part.volume * 100)]}
            onValueChange={(v) => onVolumeChange(part.id, v[0] / 100)}
            min={0}
            max={100}
            step={1}
            disabled={part.muted}
            className="flex-1"
            data-testid={`slider-volume-${part.id}`}
          />
          <span className="text-xs font-mono text-muted-foreground w-8 text-right shrink-0">
            {part.muted ? "—" : Math.round(part.volume * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}
