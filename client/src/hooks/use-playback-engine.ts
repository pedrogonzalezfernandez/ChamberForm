import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PlaybackEngine, type PartSnapshot } from "@/lib/playback/PlaybackEngine";
import { buildTimeMap } from "@/lib/playback/timeMap";
import type { PlaybackScore } from "@/lib/playback/types";

export interface UsePlaybackEngineResult {
  isLoading: boolean;
  loadError: string | null;
  isPlaying: boolean;
  parts: PartSnapshot[];
  loop: boolean;
  speed: number;
  metronomeOn: boolean;
  positionSeconds: number;
  totalSeconds: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setLoop: (value: boolean) => void;
  setSpeed: (value: number) => void;
  setMetronomeOn: (value: boolean) => void;
  setPartVolume: (partId: string, volume: number) => void;
  setPartMuted: (partId: string, muted: boolean) => void;
}

/** Fetches the full-score note data and drives a PlaybackEngine instance bound to this component's lifecycle. */
export function usePlaybackEngine(scoreId: string | null): UsePlaybackEngineResult {
  const engineRef = useRef<PlaybackEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new PlaybackEngine();
  }

  const [isPlaying, setIsPlaying] = useState(false);
  const [parts, setParts] = useState<PartSnapshot[]>([]);
  const [loop, setLoopState] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [metronomeOn, setMetronomeOnState] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const rafRef = useRef<number | null>(null);

  const { data: score, isLoading, error } = useQuery<PlaybackScore>({
    queryKey: ["/api/playback/score", scoreId],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/playback/score", { scoreId });
      return res.json();
    },
    enabled: !!scoreId,
    staleTime: Infinity,
  });

  useEffect(() => {
    const engine = engineRef.current!;
    engine.onPartsChanged(setParts);
    engine.onStopped(() => setIsPlaying(false));
    return () => {
      engine.onPartsChanged(null);
      engine.onStopped(null);
    };
  }, []);

  useEffect(() => {
    if (!score) return;
    engineRef.current!.loadScore(score);
    setIsPlaying(false);
    setPositionSeconds(0);
  }, [score]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      setPositionSeconds(engineRef.current?.getPositionSeconds() ?? 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying]);

  const play = useCallback(() => {
    engineRef.current?.play().then(() => setIsPlaying(true));
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setIsPlaying(false);
    setPositionSeconds(0);
  }, []);

  const setLoop = useCallback((value: boolean) => {
    setLoopState(value);
    engineRef.current?.setLoop(value);
  }, []);

  const setSpeed = useCallback((value: number) => {
    setSpeedState(value);
    engineRef.current?.setSpeed(value);
  }, []);

  const setMetronomeOn = useCallback((value: boolean) => {
    setMetronomeOnState(value);
    engineRef.current?.setMetronomeEnabled(value);
  }, []);

  const setPartVolume = useCallback((partId: string, volume: number) => {
    engineRef.current?.setPartVolume(partId, volume);
  }, []);

  const setPartMuted = useCallback((partId: string, muted: boolean) => {
    engineRef.current?.setPartMuted(partId, muted);
  }, []);

  const totalSeconds = useMemo(() => {
    if (!score) return 0;
    return buildTimeMap(score.tempoMap, score.durationQL, speed).totalSeconds;
  }, [score, speed]);

  return {
    isLoading,
    loadError: error ? (error as Error).message : null,
    isPlaying,
    parts,
    loop,
    speed,
    metronomeOn,
    positionSeconds,
    totalSeconds,
    play,
    pause,
    stop,
    setLoop,
    setSpeed,
    setMetronomeOn,
    setPartVolume,
    setPartMuted,
  };
}
