import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Square, RefreshCw, Loader2 } from "lucide-react";
import type { ReductionData, PlaybackEvent } from "@shared/schema";

interface PlaybackControlsProps {
  reductionData: ReductionData | null;
  onPreparePlayback: () => void;
  isLoading: boolean;
}

export function PlaybackControls({
  reductionData,
  onPreparePlayback,
  isLoading,
}: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [currentMeasure, setCurrentMeasure] = useState<number | null>(null);
  
  const toneRef = useRef<typeof import("tone") | null>(null);
  const synthRef = useRef<any>(null);
  const scheduledEventsRef = useRef<number[]>([]);
  const isLoadingToneRef = useRef(false);

  const loadTone = useCallback(async () => {
    if (toneRef.current || isLoadingToneRef.current) return toneRef.current;
    
    isLoadingToneRef.current = true;
    try {
      const Tone = await import("tone");
      toneRef.current = Tone;
      
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.8,
        },
      }).toDestination();
      
      return Tone;
    } finally {
      isLoadingToneRef.current = false;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      toneRef.current.getTransport().cancel();
      scheduledEventsRef.current = [];
    }
    setIsPlaying(false);
    setCurrentMeasure(null);
  }, []);

  const scheduleEvents = useCallback((Tone: typeof import("tone"), events: PlaybackEvent[], beatsPerMeasure: number) => {
    const transport = Tone.getTransport();
    transport.cancel();
    scheduledEventsRef.current = [];
    
    transport.bpm.value = tempo;
    
    const secondsPerBeat = 60 / tempo;

    events.forEach((event) => {
      const measureOffset = event.measure - (reductionData?.startMeasure || 1);
      const timeInBeats = measureOffset * beatsPerMeasure + (event.beat - 1);
      const timeInSeconds = timeInBeats * secondsPerBeat;

      const eventId = transport.schedule((time) => {
        setCurrentMeasure(event.measure);
        
        if (synthRef.current && event.frequencies.length > 0) {
          const notes = event.frequencies.map(freq => Tone.Frequency(freq).toNote());
          const durationInSeconds = event.duration * secondsPerBeat;
          synthRef.current.triggerAttackRelease(
            notes,
            durationInSeconds,
            time
          );
        }
      }, timeInSeconds);

      scheduledEventsRef.current.push(eventId);
    });

    const totalMeasures = (reductionData?.endMeasure || 1) - (reductionData?.startMeasure || 1) + 1;
    const totalBeats = totalMeasures * beatsPerMeasure;
    const endTimeInSeconds = totalBeats * secondsPerBeat;

    transport.schedule(() => {
      if (loop) {
        transport.stop();
        transport.position = 0;
        transport.start();
      } else {
        stopPlayback();
      }
    }, endTimeInSeconds);
  }, [tempo, loop, reductionData, stopPlayback]);

  const handlePlay = useCallback(async () => {
    if (!reductionData) {
      onPreparePlayback();
      return;
    }

    const Tone = await loadTone();
    if (!Tone) return;

    await Tone.start();

    if (isPlaying) {
      Tone.getTransport().pause();
      setIsPlaying(false);
    } else {
      scheduleEvents(Tone, reductionData.events, reductionData.beatsPerMeasure);
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [reductionData, isPlaying, loadTone, scheduleEvents, onPreparePlayback]);

  const handleStop = useCallback(() => {
    stopPlayback();
    if (toneRef.current) {
      toneRef.current.getTransport().position = 0;
    }
  }, [stopPlayback]);

  const handleTempoChange = useCallback((value: number[]) => {
    const newTempo = value[0];
    setTempo(newTempo);
    if (toneRef.current) {
      toneRef.current.getTransport().bpm.value = newTempo;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toneRef.current) {
        toneRef.current.getTransport().stop();
        toneRef.current.getTransport().cancel();
      }
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying && toneRef.current && reductionData) {
      const Tone = toneRef.current;
      Tone.getTransport().stop();
      scheduleEvents(Tone, reductionData.events, reductionData.beatsPerMeasure);
      Tone.getTransport().start();
    }
  }, [loop]);

  if (!reductionData && !isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Prepare the harmonic reduction to enable playback of sine-tone chords for tuning practice.
        </p>
        <Button
          onClick={onPreparePlayback}
          variant="outline"
          className="w-full"
          data-testid="button-prepare-playback"
        >
          Prepare Playback
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Preparing playback data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant={isPlaying ? "secondary" : "default"}
          onClick={handlePlay}
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={handleStop}
          disabled={!isPlaying && currentMeasure === null}
          data-testid="button-stop"
        >
          <Square className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 ml-auto">
          <RefreshCw className={`h-4 w-4 ${loop ? "text-primary" : "text-muted-foreground"}`} />
          <Switch
            checked={loop}
            onCheckedChange={setLoop}
            data-testid="switch-loop"
          />
          <Label className="text-sm">Loop</Label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Tempo</Label>
          <span className="text-sm font-mono font-medium">{tempo} BPM</span>
        </div>
        <Slider
          value={[tempo]}
          onValueChange={handleTempoChange}
          min={40}
          max={200}
          step={1}
          className="w-full"
          data-testid="slider-tempo"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>40</span>
          <span>200</span>
        </div>
      </div>

      {currentMeasure !== null && (
        <div className="text-center py-2 rounded-md bg-muted/30">
          <span className="text-sm text-muted-foreground">Playing measure </span>
          <span className="text-sm font-medium font-mono">{currentMeasure}</span>
        </div>
      )}

      {reductionData && (
        <p className="text-xs text-muted-foreground text-center">
          {reductionData.events.length} harmonic events loaded
        </p>
      )}
    </div>
  );
}
