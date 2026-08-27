import type { PlaybackScore, PlaybackNote } from "./types";
import { buildTimeMap, buildClickEvents, type TimeMap, type ClickEvent } from "./timeMap";
import { resolveInstrumentKey } from "./instrumentMap";
import { playMetronomeClick } from "./metronomeClick";

/**
 * Minimal structural type for the subset of the `smplr` instrument API this
 * engine relies on (Soundfont, but also anything shaped the same way).
 */
interface SamplerInstrument {
  ready: Promise<void>;
  start(event: {
    note: number;
    time: number;
    duration: number;
    velocity: number;
    detune?: number;
  }): void;
  stop(): void;
  dispose(): void;
}

interface PartChannel {
  id: string;
  notes: PlaybackNote[];
  gainNode: GainNode;
  volume: number;
  muted: boolean;
  instrument: SamplerInstrument | null;
  loading: boolean;
  error: boolean;
}

export interface PartSnapshot {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  muted: boolean;
  loading: boolean;
  error: boolean;
}

type PartsChangedListener = (parts: PartSnapshot[]) => void;
type StoppedListener = () => void;

const RAMP_SECONDS = 0.02;

/**
 * Owns every audio resource needed for full multi-part ensemble playback:
 * one `smplr` sampled instrument + gain node per part (its own channel, so
 * volume/mute never touches any other part), a synchronized metronome driven
 * off the same time map as the notes, and the Tone.Transport scheduling that
 * ties it all together. One instance is created per mounted playback panel
 * and fully disposed on unmount / score change.
 */
export class PlaybackEngine {
  private Tone: typeof import("tone") | null = null;
  private transport: ReturnType<typeof import("tone").getTransport> | null = null;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private score: PlaybackScore | null = null;
  private timeMap: TimeMap | null = null;
  private clickEvents: ClickEvent[] = [];
  private partChannels = new Map<string, PartChannel>();

  private speed = 1;
  private loopEnabled = false;
  private metronomeEnabled = false;
  private metronomeVolume = 0.8;
  private needsReschedule = true;
  private loadToken = 0;
  private scheduledIds: number[] = [];

  private partsChangedListener: PartsChangedListener | null = null;
  private stoppedListener: StoppedListener | null = null;

  async ensureAudio(): Promise<void> {
    if (this.Tone) return;
    const Tone = await import("tone");
    this.Tone = Tone;
    this.transport = Tone.getTransport();
    this.context = Tone.getContext().rawContext as unknown as AudioContext;
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
  }

  onPartsChanged(listener: PartsChangedListener | null): void {
    this.partsChangedListener = listener;
  }

  onStopped(listener: StoppedListener | null): void {
    this.stoppedListener = listener;
  }

  private emitPartsChanged(): void {
    if (!this.partsChangedListener) return;
    this.partsChangedListener(this.getPartsSnapshot());
  }

  getPartsSnapshot(): PartSnapshot[] {
    if (!this.score) return [];
    return this.score.parts.map((p) => {
      const channel = this.partChannels.get(p.id);
      return {
        id: p.id,
        name: p.name,
        instrument: p.instrument,
        volume: channel?.volume ?? 0.85,
        muted: channel?.muted ?? false,
        loading: channel?.loading ?? true,
        error: channel?.error ?? false,
      };
    });
  }

  async loadScore(score: PlaybackScore): Promise<void> {
    await this.ensureAudio();
    this.stop();
    this.disposePartChannels();

    const token = ++this.loadToken;
    this.score = score;
    this.rebuildTimeMap();
    this.clickEvents = buildClickEvents(score.timeSignatureMap, score.durationQL);
    this.needsReschedule = true;

    const { Soundfont } = await import("smplr");

    for (const part of score.parts) {
      const gainNode = this.context!.createGain();
      gainNode.gain.value = 0.85;
      gainNode.connect(this.masterGain!);

      const channel: PartChannel = {
        id: part.id,
        notes: part.notes,
        gainNode,
        volume: 0.85,
        muted: false,
        instrument: null,
        loading: true,
        error: false,
      };
      this.partChannels.set(part.id, channel);

      const instrumentKey = resolveInstrumentKey(part.instrument || part.name);
      const instrument = new Soundfont(this.context!, {
        instrument: instrumentKey,
        destination: gainNode,
      }) as unknown as SamplerInstrument;

      instrument.ready
        .then(() => {
          if (token !== this.loadToken) {
            instrument.dispose();
            return;
          }
          channel.instrument = instrument;
          channel.loading = false;
          this.emitPartsChanged();
        })
        .catch(() => {
          if (token !== this.loadToken) return;
          channel.loading = false;
          channel.error = true;
          this.emitPartsChanged();
        });
    }

    this.emitPartsChanged();
  }

  private rebuildTimeMap(): void {
    if (!this.score) return;
    this.timeMap = buildTimeMap(this.score.tempoMap, this.score.durationQL, this.speed);
  }

  private clearScheduled(): void {
    if (!this.transport) return;
    this.transport.cancel();
    this.scheduledIds = [];
  }

  private scheduleAll(): void {
    if (!this.transport || !this.timeMap || !this.score) return;
    this.clearScheduled();
    const tm = this.timeMap;

    for (const channel of Array.from(this.partChannels.values())) {
      for (const note of channel.notes) {
        const startSec = tm.qlToSeconds(note.onsetQL);
        const endSec = tm.qlToSeconds(note.onsetQL + note.durationQL);
        const durationSec = Math.max(0.03, endSec - startSec);
        const midiRounded = Math.round(note.midi);
        const detuneCents = (note.midi - midiRounded) * 100;

        const id = this.transport.schedule((time: number) => {
          channel.instrument?.start({
            note: midiRounded,
            time,
            duration: durationSec,
            velocity: note.velocity,
            detune: detuneCents,
          });
        }, startSec);
        this.scheduledIds.push(id);
      }
    }

    for (const click of this.clickEvents) {
      const t = tm.qlToSeconds(click.offsetQL);
      const id = this.transport.schedule((time: number) => {
        if (!this.metronomeEnabled || !this.context || !this.masterGain) return;
        playMetronomeClick(this.context, this.masterGain, time, click.accent, this.metronomeVolume);
      }, t);
      this.scheduledIds.push(id);
    }

    const endId = this.transport.schedule((time: number) => {
      if (this.loopEnabled) {
        this.transport!.stop(time);
        this.transport!.seconds = 0;
        this.transport!.start(time);
      } else {
        this.stopInternal(time);
        this.stoppedListener?.();
      }
    }, tm.totalSeconds);
    this.scheduledIds.push(endId);

    this.needsReschedule = false;
  }

  async play(): Promise<void> {
    await this.ensureAudio();
    if (!this.transport || !this.timeMap) return;
    await this.Tone!.start();

    if (this.needsReschedule) {
      this.scheduleAll();
    }
    this.transport.start();
  }

  pause(): void {
    this.transport?.pause();
  }

  private stopInternal(atTime?: number): void {
    if (!this.transport) return;
    this.transport.stop(atTime);
    this.clearScheduled();
    this.transport.seconds = 0;
    for (const channel of Array.from(this.partChannels.values())) {
      channel.instrument?.stop();
    }
    this.needsReschedule = true;
  }

  stop(): void {
    this.stopInternal();
  }

  getTransportState(): "stopped" | "playing" | "paused" {
    if (!this.transport) return "stopped";
    return this.transport.state as "stopped" | "playing" | "paused";
  }

  getPositionSeconds(): number {
    return this.transport?.seconds ?? 0;
  }

  getTotalSeconds(): number {
    return this.timeMap?.totalSeconds ?? 0;
  }

  setLoop(enabled: boolean): void {
    this.loopEnabled = enabled;
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.metronomeEnabled = enabled;
  }

  setMetronomeVolume(volume: number): void {
    this.metronomeVolume = Math.max(0, Math.min(1, volume));
  }

  /** Rescales the whole tempo map while preserving the current musical position. */
  setSpeed(multiplier: number): void {
    if (!this.score || !this.timeMap) {
      this.speed = multiplier;
      return;
    }
    const wasPlaying = this.getTransportState() === "playing";
    const currentQL = this.timeMap.secondsToQL(this.getPositionSeconds());

    this.transport?.pause();
    this.speed = multiplier;
    this.rebuildTimeMap();
    this.scheduleAll();

    if (this.transport && this.timeMap) {
      this.transport.seconds = this.timeMap.qlToSeconds(currentQL);
    }
    if (wasPlaying) {
      this.transport?.start();
    }
  }

  setPartVolume(partId: string, volume: number): void {
    const channel = this.partChannels.get(partId);
    if (!channel || !this.context) return;
    channel.volume = Math.max(0, Math.min(1, volume));
    const target = channel.muted ? 0 : channel.volume;
    channel.gainNode.gain.linearRampToValueAtTime(target, this.context.currentTime + RAMP_SECONDS);
    this.emitPartsChanged();
  }

  setPartMuted(partId: string, muted: boolean): void {
    const channel = this.partChannels.get(partId);
    if (!channel || !this.context) return;
    channel.muted = muted;
    const target = muted ? 0 : channel.volume;
    channel.gainNode.gain.linearRampToValueAtTime(target, this.context.currentTime + RAMP_SECONDS);
    this.emitPartsChanged();
  }

  private disposePartChannels(): void {
    for (const channel of Array.from(this.partChannels.values())) {
      try {
        channel.instrument?.stop();
        channel.instrument?.dispose();
      } catch {
        // instrument may still be loading; nothing to clean up yet
      }
      channel.gainNode.disconnect();
    }
    this.partChannels.clear();
  }

  dispose(): void {
    this.loadToken++;
    this.stopInternal();
    this.disposePartChannels();
    this.masterGain?.disconnect();
    this.masterGain = null;
    this.score = null;
    this.timeMap = null;
  }
}
