/**
 * Synthesizes a metronome click directly with Web Audio oscillators — no
 * samples to load, so the metronome is always available instantly regardless
 * of instrument loading state. The downbeat is pitched higher and louder to
 * clearly distinguish beat one of the bar from the rest.
 */
export function playMetronomeClick(
  context: BaseAudioContext,
  destination: AudioNode,
  time: number,
  accent: boolean,
  volume: number
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(accent ? 1600 : 1000, time);

  const peak = (accent ? 0.9 : 0.5) * volume;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  osc.connect(gain).connect(destination);
  osc.start(time);
  osc.stop(time + 0.07);
}
