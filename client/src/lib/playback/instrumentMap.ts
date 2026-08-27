/**
 * Maps a MusicXML/music21 instrument or part name to a General MIDI soundfont
 * instrument key understood by `smplr`'s Soundfont player. This is the only
 * place that needs updating to expand or swap the instrument set later (e.g.
 * to point at a different soundfont kit or a custom sample library).
 */
const INSTRUMENT_RULES: [RegExp, string][] = [
  [/piccolo/i, "piccolo"],
  [/flute|flauto/i, "flute"],
  [/oboe/i, "oboe"],
  [/english horn|cor anglais/i, "english_horn"],
  [/clarinet/i, "clarinet"],
  [/bassoon|fagott/i, "bassoon"],
  [/(french )?horn|corno/i, "french_horn"],
  [/trumpet|tromba/i, "trumpet"],
  [/trombone/i, "trombone"],
  [/tuba/i, "tuba"],
  [/violin/i, "violin"],
  [/viola/i, "viola"],
  [/violoncello|cello/i, "cello"],
  [/contrabass|double\s*bass/i, "contrabass"],
  [/harp/i, "orchestral_harp"],
  [/guitar/i, "acoustic_guitar_nylon"],
  [/marimba/i, "marimba"],
  [/vibraphone/i, "vibraphone"],
  [/xylophone/i, "xylophone"],
  [/glockenspiel/i, "glockenspiel"],
  [/timpani/i, "timpani"],
  [/organ/i, "church_organ"],
  [/harpsichord/i, "harpsichord"],
  [/(grand )?piano/i, "acoustic_grand_piano"],
  [/voice|soprano|alto|tenor|bass(?!oon)|choir/i, "choir_aahs"],
];

export const DEFAULT_INSTRUMENT_KEY = "acoustic_grand_piano";

export function resolveInstrumentKey(nameOrPartLabel: string): string {
  for (const [pattern, key] of INSTRUMENT_RULES) {
    if (pattern.test(nameOrPartLabel)) return key;
  }
  return DEFAULT_INSTRUMENT_KEY;
}
