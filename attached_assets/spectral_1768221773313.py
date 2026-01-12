# -----------------------------------------------------------------------------
# Name:         analysis/spectral.py
# Purpose:      Score-based spectral analysis tools (symbolic partial models)
#
# Authors:      OpenAI Assistant (Codex CLI)
#
# Copyright:    Copyright © 2006-2026 Michael Scott Asato Cuthbert
# License:      BSD, see license.txt
# -----------------------------------------------------------------------------
"""
Score-based spectral analysis utilities.

These tools work on symbolic scores (MusicXML, etc.) and build a synthetic spectrum
per event-change verticality (note-on/note-off boundaries).  This is designed for
analyses common in spectral-music practice, where a "spectral configuration" is
approximated from fundamentals and partials rather than derived from audio.

The core function is :func:`analyze`, which accepts either a path/URL supported by
``converter.parse`` or a pre-parsed :class:`~music21.stream.Stream`.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
import typing as t
import unittest

from music21 import common
from music21 import converter
from music21 import note

if t.TYPE_CHECKING:
    from music21 import pitch
    from music21 import stream
    from music21.tree.verticality import Verticality


@dataclass(frozen=True)
class SpectralFrame:
    """
    One event-change spectral frame.

    Offsets are in quarterLength units (score-relative).
    """
    offset: float
    endOffset: float
    fundamentalsHz: tuple[float, ...]
    centroidHz: float | None
    spreadHz: float | None
    totalPartials: int
    commonPartialCount: int | None = None


def _to_sounding_pitch(s: stream.Stream, *, toSoundingPitch: bool) -> stream.Stream:
    if not toSoundingPitch:
        return s

    if s.hasPartLikeStreams():
        firstPartLike = s.getElementsByClass('Stream').first()
        if firstPartLike is not None and getattr(firstPartLike, 'atSoundingPitch', True) is False:
            return s.toSoundingPitch(inPlace=False)
    if getattr(s, 'atSoundingPitch', True) is False:
        return s.toSoundingPitch(inPlace=False)
    return s


def _verticality_fundamental_pitches(
    v: Verticality,
    *,
    keepDuplicates: bool,
) -> list[pitch.Pitch]:
    pitches: list[pitch.Pitch] = []
    for ts in v.startAndOverlapTimespans:
        if not hasattr(ts, 'pitches'):
            continue
        tsPitches = t.cast('t.Iterable[pitch.Pitch]', ts.pitches)
        for p in tsPitches:
            pitches.append(p)

    if keepDuplicates:
        return pitches

    seen: set[str] = set()
    uniquePitches: list[pitch.Pitch] = []
    for p in pitches:
        # nameWithOctave includes microtonal alterations (e.g., "C~4") in music21.
        k = p.nameWithOctave
        if k in seen:
            continue
        seen.add(k)
        uniquePitches.append(p)
    return uniquePitches


def _partial_peaks(
    fundamentalsHz: t.Sequence[float],
    *,
    maxPartials: int,
    rolloff: float,
) -> tuple[list[float], list[float]]:
    if maxPartials < 1:
        raise ValueError('maxPartials must be >= 1')
    if rolloff <= 0:
        raise ValueError('rolloff must be > 0')

    freqs: list[float] = []
    amps: list[float] = []
    for f0 in fundamentalsHz:
        if f0 <= 0:
            continue
        for n in range(1, maxPartials + 1):
            freqs.append(f0 * n)
            amps.append(1.0 / (n ** rolloff))
    return freqs, amps


def _centroid_and_spread(freqs: t.Sequence[float], amps: t.Sequence[float]) -> tuple[float | None, float | None]:
    if not freqs:
        return None, None
    ampSum = float(sum(amps))
    if ampSum <= 0:
        return None, None
    centroid = float(sum(f * a for f, a in zip(freqs, amps)) / ampSum)
    variance = float(sum(a * ((f - centroid) ** 2) for f, a in zip(freqs, amps)) / ampSum)
    spread = float(math.sqrt(max(0.0, variance)))
    return centroid, spread


def _common_partial_count(freqs: t.Sequence[float], *, toleranceCents: float) -> int:
    """
    Count near-coincident partials (a rough "fusion" proxy).

    This clusters partial frequencies in cents and counts overlaps beyond the first partial
    in each cluster.
    """
    if toleranceCents <= 0:
        raise ValueError('toleranceCents must be > 0')
    if len(freqs) < 2:
        return 0

    centsList = sorted(1200.0 * math.log2(f) for f in freqs if f > 0)
    if len(centsList) < 2:
        return 0

    commonCount = 0
    clusterSize = 1
    last = centsList[0]
    for c in centsList[1:]:
        if (c - last) <= toleranceCents:
            clusterSize += 1
        else:
            if clusterSize > 1:
                commonCount += (clusterSize - 1)
            clusterSize = 1
        last = c
    if clusterSize > 1:
        commonCount += (clusterSize - 1)
    return commonCount


def analyze(
    streamOrPath: stream.Stream | str,
    *,
    toSoundingPitch: bool = True,
    keepDuplicates: bool = True,
    includeEmpty: bool = False,
    maxPartials: int = 32,
    rolloff: float = 1.0,
    computeCommonPartials: bool = True,
    commonPartialToleranceCents: float = 10.0,
) -> list[SpectralFrame]:
    """
    Compute synthetic-spectrum descriptors for each event-change verticality.

    Parameters
    ----------
    streamOrPath
        A pre-parsed Stream/Score, or a path/URL supported by :func:`music21.converter.parse`.
    toSoundingPitch
        If True (default), analyze sounding pitch (transpositions applied).
    keepDuplicates
        If True (default), keep doubled pitches (useful for orchestration weighting).
        If False, deduplicate by pitch spelling+octave at each frame.
    includeEmpty
        If False (default), omit frames with no fundamentals (silence/rest-only).
    maxPartials
        Number of partials per fundamental in the synthetic spectrum model.
    rolloff
        Amplitude rolloff exponent for partials (amp = 1 / n**rolloff).
    computeCommonPartials
        If True (default), compute a simple "common partial" overlap count.
    commonPartialToleranceCents
        Clustering tolerance for common partial detection.
    """
    if isinstance(streamOrPath, str):
        s = converter.parse(streamOrPath)
    else:
        s = streamOrPath

    s = _to_sounding_pitch(s, toSoundingPitch=toSoundingPitch)

    # GeneralNote covers Note/Chord/Rest; we ignore unpitched or rest-only frames downstream.
    tsTree = s.asTimespans(flatten=True, classList=(note.GeneralNote,))

    frames: list[SpectralFrame] = []
    for v in tsTree.iterateVerticalities():
        durationToNext = v.timeToNextEvent
        if durationToNext is None:
            continue
        endOffset = float(common.opFrac(v.offset + durationToNext))

        pitches = _verticality_fundamental_pitches(v, keepDuplicates=keepDuplicates)
        fundamentalsHz = tuple(float(p.frequency) for p in pitches if getattr(p, 'frequency', 0.0) > 0.0)
        if not fundamentalsHz and not includeEmpty:
            continue

        freqs, amps = _partial_peaks(fundamentalsHz, maxPartials=maxPartials, rolloff=rolloff)
        centroidHz, spreadHz = _centroid_and_spread(freqs, amps)
        commonCount: int | None = None
        if computeCommonPartials:
            commonCount = _common_partial_count(freqs, toleranceCents=commonPartialToleranceCents)

        frames.append(SpectralFrame(
            offset=float(v.offset),
            endOffset=endOffset,
            fundamentalsHz=fundamentalsHz,
            centroidHz=centroidHz,
            spreadHz=spreadHz,
            totalPartials=len(freqs),
            commonPartialCount=commonCount,
        ))

    return frames


class Test(unittest.TestCase):
    def testAnalyzeMusicXMLMicrotoneAndEventChanges(self):
        from music21 import pitch

        musicxml = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>P1</part-name></score-part>
    <score-part id="P2"><part-name>P2</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <key><fifths>0</fifths></key>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><alter>0.5</alter><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <rest/>
        <duration>2</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <key><fifths>0</fifths></key>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <rest/>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <rest/>
        <duration>2</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>
"""
        s = converter.parseData(musicxml, format='musicxml')
        frames = analyze(s, maxPartials=8, rolloff=1.0, toSoundingPitch=True)

        # Expect event-change frames at 0.0 (only C quarter-sharp) and 1.0 (C quarter-sharp + E)
        offsets = [f.offset for f in frames]
        self.assertEqual(offsets, [0.0, 1.0])

        baseC4 = pitch.Pitch('C4').frequency
        expectedCQuarterSharp = baseC4 * (2 ** (50.0 / 1200.0))
        self.assertTrue(any(abs(hz - expectedCQuarterSharp) < 1e-3 for hz in frames[0].fundamentalsHz))

        # Adding E4 should move centroid upward (with the same partial model).
        self.assertIsNotNone(frames[0].centroidHz)
        self.assertIsNotNone(frames[1].centroidHz)
        self.assertGreater(frames[1].centroidHz, frames[0].centroidHz)


if __name__ == '__main__':
    import music21
    music21.mainTest(Test)
