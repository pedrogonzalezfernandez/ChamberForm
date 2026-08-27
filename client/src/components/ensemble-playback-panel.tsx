import { Play, Pause, Square, RefreshCw, Timer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PartMixer } from "@/components/part-mixer";
import { usePlaybackEngine } from "@/hooks/use-playback-engine";

interface EnsemblePlaybackPanelProps {
  scoreId: string | null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Full multi-part instrumental playback: sampled instruments per part, a
 * synchronized metronome, and an independent volume/mute mixer channel for
 * every part — so a musician can mute their own part and rehearse against
 * the rest of the ensemble.
 */
export function EnsemblePlaybackPanel({ scoreId }: EnsemblePlaybackPanelProps) {
  const engine = usePlaybackEngine(scoreId);

  if (!scoreId) return null;

  if (engine.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Preparing ensemble playback...</span>
      </div>
    );
  }

  if (engine.loadError) {
    return (
      <p className="text-sm text-destructive py-4">
        Failed to prepare ensemble playback: {engine.loadError}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant={engine.isPlaying ? "secondary" : "default"}
          onClick={() => (engine.isPlaying ? engine.pause() : engine.play())}
          data-testid="button-ensemble-play-pause"
        >
          {engine.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={engine.stop}
          data-testid="button-ensemble-stop"
        >
          <Square className="h-4 w-4" />
        </Button>

        <span className="text-xs font-mono text-muted-foreground">
          {formatTime(engine.positionSeconds)} / {formatTime(engine.totalSeconds)}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <RefreshCw className={`h-4 w-4 ${engine.loop ? "text-primary" : "text-muted-foreground"}`} />
          <Switch
            checked={engine.loop}
            onCheckedChange={engine.setLoop}
            data-testid="switch-ensemble-loop"
          />
          <Label className="text-sm">Loop</Label>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md border p-2.5">
        <Timer className={`h-4 w-4 shrink-0 ${engine.metronomeOn ? "text-primary" : "text-muted-foreground"}`} />
        <Label className="text-sm shrink-0">Metronome</Label>
        <Switch
          checked={engine.metronomeOn}
          onCheckedChange={engine.setMetronomeOn}
          className="ml-auto"
          data-testid="switch-metronome"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Speed</Label>
          <span className="text-sm font-mono font-medium">{Math.round(engine.speed * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(engine.speed * 100)]}
          onValueChange={(v) => engine.setSpeed(v[0] / 100)}
          min={50}
          max={150}
          step={5}
          data-testid="slider-speed"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Mixer</Label>
        <PartMixer
          parts={engine.parts}
          onVolumeChange={engine.setPartVolume}
          onMuteToggle={engine.setPartMuted}
        />
      </div>
    </div>
  );
}
