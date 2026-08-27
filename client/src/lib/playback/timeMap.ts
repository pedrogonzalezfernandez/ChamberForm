import type { TempoEvent, TimeSignatureEvent } from "./types";

interface Breakpoint {
  offsetQL: number;
  bpm: number;
  cumSeconds: number;
}

export interface TimeMap {
  totalSeconds: number;
  qlToSeconds: (offsetQL: number) => number;
  secondsToQL: (seconds: number) => number;
}

/**
 * Builds a single shared conversion between score position (quarter lengths)
 * and playback seconds, honoring every tempo change. Both note scheduling and
 * the metronome consume this same map so they can never drift apart.
 *
 * `speedMultiplier` scales every tempo segment by the same factor, which lets
 * the UI offer an overall "speed" control without losing the score's relative
 * tempo changes (accelerandi/ritardandi expressed as multiple marks stay
 * proportional to one another).
 */
export function buildTimeMap(
  tempoMap: TempoEvent[],
  durationQL: number,
  speedMultiplier = 1
): TimeMap {
  const sorted = [...tempoMap].sort((a, b) => a.offsetQL - b.offsetQL);
  const segments = sorted.length > 0 ? sorted : [{ offsetQL: 0, bpm: 120 }];
  if (segments[0].offsetQL > 0) {
    segments.unshift({ offsetQL: 0, bpm: segments[0].bpm });
  }

  const breakpoints: Breakpoint[] = [];
  let cumSeconds = 0;
  for (let i = 0; i < segments.length; i++) {
    const { offsetQL, bpm } = segments[i];
    const effectiveBpm = Math.max(1, bpm * speedMultiplier);
    breakpoints.push({ offsetQL, bpm: effectiveBpm, cumSeconds });
    const nextOffset = i + 1 < segments.length ? segments[i + 1].offsetQL : durationQL;
    const span = Math.max(0, nextOffset - offsetQL);
    cumSeconds += span * (60 / effectiveBpm);
  }

  const totalSeconds = cumSeconds;

  function findBreakpointByQL(ql: number): Breakpoint {
    let chosen = breakpoints[0];
    for (const bp of breakpoints) {
      if (bp.offsetQL <= ql + 1e-9) chosen = bp;
      else break;
    }
    return chosen;
  }

  function findBreakpointBySeconds(seconds: number): Breakpoint {
    let chosen = breakpoints[0];
    for (const bp of breakpoints) {
      if (bp.cumSeconds <= seconds + 1e-9) chosen = bp;
      else break;
    }
    return chosen;
  }

  function qlToSeconds(offsetQL: number): number {
    const bp = findBreakpointByQL(offsetQL);
    return bp.cumSeconds + (offsetQL - bp.offsetQL) * (60 / bp.bpm);
  }

  function secondsToQL(seconds: number): number {
    const bp = findBreakpointBySeconds(seconds);
    return bp.offsetQL + (seconds - bp.cumSeconds) * (bp.bpm / 60);
  }

  return { totalSeconds, qlToSeconds, secondsToQL };
}

export interface ClickEvent {
  offsetQL: number;
  accent: boolean;
}

/**
 * Flattens the time-signature map into individual beat clicks, correctly
 * grouping compound meters (e.g. 6/8 as two dotted-quarter beats) via
 * music21's beatCount/beatDuration rather than assuming simple meters.
 */
export function buildClickEvents(
  timeSignatureMap: TimeSignatureEvent[],
  durationQL: number
): ClickEvent[] {
  const sorted = [...timeSignatureMap].sort((a, b) => a.offsetQL - b.offsetQL);
  if (sorted.length === 0) return [];

  const clicks: ClickEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const segEnd = i + 1 < sorted.length ? sorted[i + 1].offsetQL : durationQL;
    if (seg.beatDurationQL <= 0 || seg.beatCount <= 0) continue;

    let beatIndex = 0;
    for (let offset = seg.offsetQL; offset < segEnd - 1e-6; offset += seg.beatDurationQL) {
      clicks.push({ offsetQL: offset, accent: beatIndex % seg.beatCount === 0 });
      beatIndex++;
    }
  }
  return clicks;
}
