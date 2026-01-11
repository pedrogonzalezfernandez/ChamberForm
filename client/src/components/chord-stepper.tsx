import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Square, 
  SkipBack, 
  SkipForward,
  Volume2
} from "lucide-react";
import * as Tone from "tone";

interface PlaybackEvent {
  measure: number;
  beat: number;
  duration: number;
  frequencies: number[];
  midiNotes?: number[];
  chordLabel?: string;
  offsetQL?: number;
}

interface ChordStepperProps {
  events: PlaybackEvent[];
  tempo?: number;
  onChordChange?: (index: number, event: PlaybackEvent) => void;
}

export function ChordStepper({ events, tempo = 120, onChordChange }: ChordStepperProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [volume, setVolume] = useState(-6);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentEvent = events[currentIndex];

  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.8,
          release: 0.3,
        },
      }).toDestination();
    }
    
    if (synthRef.current) {
      synthRef.current.volume.value = volume;
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (synthRef.current) {
        synthRef.current.releaseAll();
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);

  const playCurrentChord = useCallback(async () => {
    if (!currentEvent || !synthRef.current) return;
    
    await Tone.start();
    
    const durationSeconds = (currentEvent.duration * 60) / tempo;
    
    synthRef.current.releaseAll();
    synthRef.current.triggerAttackRelease(
      currentEvent.frequencies,
      Math.min(durationSeconds, 2)
    );
    
    if (autoAdvance) {
      if (currentIndex < events.length - 1) {
        timeoutRef.current = setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
        }, durationSeconds * 1000);
      } else {
        timeoutRef.current = setTimeout(() => {
          setIsPlaying(false);
          setAutoAdvance(false);
        }, durationSeconds * 1000);
      }
    } else {
      timeoutRef.current = setTimeout(() => {
        setIsPlaying(false);
      }, durationSeconds * 1000);
    }
  }, [currentEvent, tempo, autoAdvance, currentIndex, events.length]);

  useEffect(() => {
    onChordChange?.(currentIndex, currentEvent);
  }, [currentIndex, currentEvent, onChordChange]);

  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (isPlaying) {
      playCurrentChord();
    }
  }, [currentIndex, isPlaying, playCurrentChord]);

  const handlePrev = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentIndex(prev => Math.min(events.length - 1, prev + 1));
  }, [events.length]);

  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      synthRef.current?.releaseAll();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await playCurrentChord();
    }
  }, [isPlaying, playCurrentChord]);

  const handlePlayAll = useCallback(async () => {
    setAutoAdvance(true);
    setIsPlaying(true);
    setCurrentIndex(0);
  }, []);

  const handleStop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    synthRef.current?.releaseAll();
    setIsPlaying(false);
    setAutoAdvance(false);
  }, []);

  const handleFirst = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentIndex(0);
  }, []);

  const handleLast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentIndex(events.length - 1);
  }, [events.length]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Chord Stepper</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {currentIndex + 1} / {events.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center p-4 bg-muted/30 rounded-md">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono mb-1">
              {currentEvent?.chordLabel || "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              m.{currentEvent?.measure} beat {currentEvent?.beat?.toFixed(1)}
            </div>
            {currentEvent?.frequencies && (
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {currentEvent.frequencies.map(f => Math.round(f)).join(" Hz, ")} Hz
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleFirst}
            disabled={currentIndex === 0}
            title="First chord"
            data-testid="chord-stepper-first"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            title="Previous chord"
            data-testid="chord-stepper-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={isPlaying ? "destructive" : "default"}
            onClick={handlePlay}
            title={isPlaying ? "Stop" : "Play current"}
            data-testid="chord-stepper-play"
          >
            {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNext}
            disabled={currentIndex === events.length - 1}
            title="Next chord"
            data-testid="chord-stepper-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLast}
            disabled={currentIndex === events.length - 1}
            title="Last chord"
            data-testid="chord-stepper-last"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlayAll}
            disabled={isPlaying}
            className="flex-1"
            data-testid="chord-stepper-play-all"
          >
            <Play className="h-3 w-3 mr-2" />
            Play All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStop}
            disabled={!isPlaying}
            className="flex-1"
            data-testid="chord-stepper-stop"
          >
            <Square className="h-3 w-3 mr-2" />
            Stop
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              Volume
            </Label>
            <span className="text-xs text-muted-foreground">{volume} dB</span>
          </div>
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            min={-24}
            max={0}
            step={1}
            className="w-full"
            data-testid="chord-stepper-volume"
          />
        </div>

        <Slider
          value={[currentIndex]}
          onValueChange={([v]) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setCurrentIndex(v);
          }}
          min={0}
          max={events.length - 1}
          step={1}
          className="w-full"
          data-testid="chord-stepper-scrubber"
        />
      </CardContent>
    </Card>
  );
}
