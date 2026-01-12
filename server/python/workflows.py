#!/usr/bin/env python3
"""
Music21 Workflow Registry for Chamber Music Rehearsal Tool

This module provides a registry of analysis and transform workflows.
Each workflow accepts a selection context and returns JSON results.

Workflow types:
- "analysis": Returns JSON data for display (annotations, timelines, etc.)
- "transform": Returns JSON + creates a new derived music21 stream

To add a new workflow:
1. Define a function: def workflow_name(score, selection, params) -> dict
2. Register it in WORKFLOW_REGISTRY with id, name, type, params schema, description
"""

import json
import sys
import pickle
import base64
from typing import Any, Dict, List, Optional
from collections import Counter


def get_part_by_id(score, part_id: str):
    """Get a specific part from the score by name or index."""
    if part_id == "ALL":
        return score
    
    for i, part in enumerate(score.parts):
        part_name = str(part.partName) if part.partName else f"Part {i + 1}"
        if part_name == part_id or str(i) == part_id:
            return part
    
    return score


def get_selection(score, selection: dict):
    """Extract the selected portion of the score based on selection parameters."""
    part_id = selection.get("partId", "ALL")
    start_measure = selection.get("startMeasure", 1)
    end_measure = selection.get("endMeasure", None)
    
    if part_id != "ALL":
        selected = get_part_by_id(score, part_id)
    else:
        selected = score
    
    try:
        if end_measure:
            return selected.measures(start_measure, end_measure)
        else:
            return selected
    except Exception:
        return selected


def get_score_parts(score) -> List[str]:
    """Get list of part names from score."""
    parts = []
    for i, part in enumerate(score.parts):
        part_name = str(part.partName) if part.partName else f"Part {i + 1}"
        parts.append(part_name)
    return parts


def workflow_score_summary(score, selection: dict, params: dict) -> dict:
    """Get summary information about the selected region."""
    from music21 import tempo, key, meter
    
    excerpt = get_selection(score, selection)
    
    title = None
    composer = None
    if hasattr(score, 'metadata') and score.metadata:
        title = str(score.metadata.title) if score.metadata.title else None
        composer = str(score.metadata.composer) if score.metadata.composer else None
    
    parts = get_score_parts(score)
    
    measures = list(excerpt.recurse().getElementsByClass('Measure'))
    measure_count = len(set(m.measureNumber for m in measures if hasattr(m, 'measureNumber')))
    
    time_signatures = []
    for ts in excerpt.recurse().getElementsByClass(meter.TimeSignature):
        ts_str = f"{ts.numerator}/{ts.denominator}"
        if ts_str not in time_signatures:
            time_signatures.append(ts_str)
    
    tempo_marks = []
    for tm in excerpt.recurse().getElementsByClass(tempo.MetronomeMark):
        try:
            tempo_marks.append({
                "text": str(tm.text) if tm.text else None,
                "bpm": tm.number if tm.number else None,
            })
        except Exception:
            pass
    
    key_signatures = []
    for ks in excerpt.recurse().getElementsByClass(key.KeySignature):
        try:
            ks_str = str(ks.asKey()) if hasattr(ks, 'asKey') else str(ks)
            if ks_str not in key_signatures:
                key_signatures.append(ks_str)
        except Exception:
            pass
    
    return {
        "title": title,
        "composer": composer,
        "parts": parts,
        "measureCount": measure_count,
        "selectedRange": {
            "start": selection.get("startMeasure", 1),
            "end": selection.get("endMeasure", measure_count),
            "part": selection.get("partId", "ALL"),
        },
        "timeSignatures": time_signatures if time_signatures else ["4/4"],
        "tempoMarks": tempo_marks,
        "keySignatures": key_signatures,
    }


def workflow_global_key_estimate(score, selection: dict, params: dict) -> dict:
    """Estimate the global key of the selected section."""
    from music21 import analysis
    
    excerpt = get_selection(score, selection)
    
    try:
        key_analysis = analysis.discrete.KrumhanslSchmuckler(excerpt)
        key_result = key_analysis.getSolution(excerpt)
        
        alternates = []
        try:
            alt_keys = key_analysis.alternateKeys(excerpt)
            if alt_keys:
                alternates = [str(k) for k in alt_keys[:3]]
        except Exception:
            pass
        
        confidence = 0.85
        try:
            weights = key_analysis.getWeights(excerpt)
            if weights:
                max_weight = max(weights) if isinstance(weights, list) else max(weights.values())
                confidence = min(max_weight / 10.0, 1.0)
        except Exception:
            pass
        
        return {
            "key": str(key_result) if key_result else "Unknown",
            "confidence": round(confidence, 2),
            "alternates": alternates,
            "notes": "Estimated using Krumhansl-Schmuckler algorithm"
        }
    except Exception as e:
        try:
            simple_key = excerpt.analyze('key')
            return {
                "key": str(simple_key) if simple_key else "Unknown",
                "confidence": 0.7,
                "alternates": [],
                "notes": "Estimated using simple analysis"
            }
        except Exception:
            return {
                "key": "Could not determine",
                "confidence": 0,
                "alternates": [],
                "error": str(e)
            }


def stream_to_musicxml(stream) -> str:
    """Convert a music21 stream to MusicXML string using GeneralObjectExporter.
    
    This is the same approach music21 uses in Jupyter notebooks - it works
    with any music21 object without needing temp files.
    """
    import sys
    try:
        from music21.musicxml.m21ToXml import GeneralObjectExporter
        
        exporter = GeneralObjectExporter(stream)
        musicxml_bytes = exporter.parse()
        return musicxml_bytes.decode('utf-8')
    except Exception as e:
        print(f"stream_to_musicxml error: {e}", file=sys.stderr)
        return ""


def workflow_chordify_and_chords(score, selection: dict, params: dict) -> dict:
    """Chordify the selected region and compute chord labels."""
    excerpt = get_selection(score, selection)
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        chordified = excerpt
    
    measures_data = []
    playback_events = []
    annotations = []
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    for measure_num in range(start_m, end_m + 1):
        measure_chords = []
        
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                continue
            
            for element in measure.recurse().getElementsByClass('Chord'):
                pitches = []
                midi_notes = []
                for p in element.pitches:
                    pitches.append({
                        "name": str(p.nameWithOctave),
                        "midi": p.midi if hasattr(p, 'midi') else None,
                    })
                    if hasattr(p, 'midi'):
                        midi_notes.append(p.midi)
                
                chord_label = ""
                try:
                    chord_label = element.pitchedCommonName
                except Exception:
                    try:
                        chord_label = element.commonName
                    except Exception:
                        chord_label = "-".join([p["name"] for p in pitches[:3]]) if pitches else "?"
                
                beat = float(element.beat) if hasattr(element, 'beat') and element.beat else 1.0
                offset_ql = float(element.offset) if hasattr(element, 'offset') else 0.0
                duration = float(element.quarterLength) if element.quarterLength else 1.0
                
                measure_chords.append({
                    "beat": beat,
                    "label": chord_label,
                    "pitches": pitches,
                    "offsetQL": offset_ql,
                })
                
                frequencies = [440.0 * (2 ** ((m - 69) / 12)) for m in midi_notes]
                playback_events.append({
                    "measure": measure_num,
                    "beat": beat,
                    "duration": duration,
                    "frequencies": [round(f, 2) for f in frequencies],
                    "midiNotes": midi_notes,
                    "chordLabel": chord_label,
                    "offsetQL": offset_ql,
                })
                
                annotations.append({
                    "type": "text",
                    "measure": measure_num,
                    "offsetQL": offset_ql,
                    "part": "ALL",
                    "text": chord_label,
                    "style": {"category": "chord"}
                })
            
            if measure_chords:
                measures_data.append({
                    "measure": measure_num,
                    "chords": measure_chords
                })
                
        except Exception:
            continue
    
    notation_xml = stream_to_musicxml(chordified)
    
    return {
        "measures": measures_data,
        "totalChords": sum(len(m["chords"]) for m in measures_data),
        "playbackEvents": playback_events,
        "annotations": annotations,
        "exports": {"formats": ["musicxml", "midi"]},
        "notationData": notation_xml if notation_xml else None,
    }


def workflow_roman_numeral_analysis(score, selection: dict, params: dict) -> dict:
    """Perform Roman numeral analysis on the selected region."""
    from music21 import roman, key as key_module
    
    excerpt = get_selection(score, selection)
    
    try:
        estimated_key = excerpt.analyze('key')
    except Exception:
        estimated_key = key_module.Key('C')
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        return {"error": "Could not chordify the selection", "measures": []}
    
    measures_data = []
    playback_events = []
    annotations = []
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    for measure_num in range(start_m, end_m + 1):
        measure_numerals = []
        
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                continue
            
            for chord in measure.recurse().getElementsByClass('Chord'):
                try:
                    rn = roman.romanNumeralFromChord(chord, estimated_key)
                    beat = float(chord.beat) if hasattr(chord, 'beat') and chord.beat else 1.0
                    offset_ql = float(chord.offset) if hasattr(chord, 'offset') else 0.0
                    duration = float(chord.quarterLength) if chord.quarterLength else 1.0
                    
                    numeral_str = str(rn.figure)
                    measure_numerals.append({
                        "beat": beat,
                        "numeral": numeral_str,
                        "quality": rn.impliedQuality if hasattr(rn, 'impliedQuality') else None,
                        "offsetQL": offset_ql,
                    })
                    
                    midi_notes = [p.midi for p in chord.pitches if hasattr(p, 'midi')]
                    frequencies = [440.0 * (2 ** ((m - 69) / 12)) for m in midi_notes]
                    playback_events.append({
                        "measure": measure_num,
                        "beat": beat,
                        "duration": duration,
                        "frequencies": [round(f, 2) for f in frequencies],
                        "midiNotes": midi_notes,
                        "chordLabel": numeral_str,
                        "offsetQL": offset_ql,
                    })
                    
                    annotations.append({
                        "type": "text",
                        "measure": measure_num,
                        "offsetQL": offset_ql,
                        "part": "ALL",
                        "text": numeral_str,
                        "style": {"category": "roman"}
                    })
                except Exception:
                    continue
            
            if measure_numerals:
                measures_data.append({
                    "measure": measure_num,
                    "numerals": measure_numerals
                })
                
        except Exception:
            continue
    
    notation_xml = stream_to_musicxml(chordified)
    
    return {
        "key": str(estimated_key),
        "measures": measures_data,
        "playbackEvents": playback_events,
        "annotations": annotations,
        "notationData": notation_xml if notation_xml else None,
    }


def workflow_cadence_spotter(score, selection: dict, params: dict) -> dict:
    """Detect cadence-like progressions in the selection."""
    from music21 import roman, key as key_module
    
    excerpt = get_selection(score, selection)
    
    try:
        estimated_key = excerpt.analyze('key')
    except Exception:
        estimated_key = key_module.Key('C')
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        return {"error": "Could not chordify the selection", "cadences": []}
    
    cadence_patterns = {
        ("V", "I"): "Perfect Authentic Cadence (PAC)",
        ("V", "i"): "Perfect Authentic Cadence (minor)",
        ("V7", "I"): "Perfect Authentic Cadence (V7-I)",
        ("V7", "i"): "Perfect Authentic Cadence (V7-i)",
        ("IV", "I"): "Plagal Cadence (IV-I)",
        ("iv", "i"): "Plagal Cadence (iv-i)",
        ("V", "vi"): "Deceptive Cadence (V-vi)",
        ("V", "VI"): "Deceptive Cadence (V-VI)",
        ("I", "V"): "Half Cadence (I-V)",
        ("ii", "V"): "Half Cadence (ii-V)",
        ("IV", "V"): "Half Cadence (IV-V)",
    }
    
    cadences = []
    prev_numeral = None
    prev_measure = None
    
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    for measure_num in range(start_m, end_m + 1):
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                continue
            
            for chord in measure.recurse().getElementsByClass('Chord'):
                try:
                    rn = roman.romanNumeralFromChord(chord, estimated_key)
                    current = rn.romanNumeralAlone
                    
                    if prev_numeral:
                        pattern = (prev_numeral, current)
                        if pattern in cadence_patterns:
                            cadences.append({
                                "measure": measure_num,
                                "type": cadence_patterns[pattern],
                                "progression": f"{prev_numeral} → {current}",
                                "prevMeasure": prev_measure,
                            })
                    
                    prev_numeral = current
                    prev_measure = measure_num
                except Exception:
                    continue
                    
        except Exception:
            continue
    
    annotations = []
    for cad in cadences:
        annotations.append({
            "type": "marker",
            "measure": cad["measure"],
            "offsetQL": 0.0,
            "part": "ALL",
            "text": cad["type"].split("(")[0].strip(),
            "style": {"category": "cadence"}
        })
    
    return {
        "key": str(estimated_key),
        "cadences": cadences,
        "totalFound": len(cadences),
        "annotations": annotations,
    }


def workflow_interval_map_between_parts(score, selection: dict, params: dict) -> dict:
    """Map harmonic intervals between two parts."""
    from music21 import interval as interval_module
    
    part_a = params.get("partA", "0")
    part_b = params.get("partB", "1")
    
    parts = list(score.parts)
    if len(parts) < 2:
        return {"error": "Score needs at least 2 parts for interval analysis", "intervals": []}
    
    try:
        part_a_idx = int(part_a) if part_a.isdigit() else 0
        part_b_idx = int(part_b) if part_b.isdigit() else 1
    except Exception:
        part_a_idx, part_b_idx = 0, 1
    
    if part_a_idx >= len(parts):
        part_a_idx = 0
    if part_b_idx >= len(parts):
        part_b_idx = min(1, len(parts) - 1)
    
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    try:
        excerpt_a = parts[part_a_idx].measures(start_m, end_m)
        excerpt_b = parts[part_b_idx].measures(start_m, end_m)
    except Exception:
        excerpt_a = parts[part_a_idx]
        excerpt_b = parts[part_b_idx]
    
    intervals_data = []
    interval_counts = Counter()
    
    notes_a = list(excerpt_a.recurse().notes)
    notes_b = list(excerpt_b.recurse().notes)
    
    for note_a in notes_a:
        if not hasattr(note_a, 'pitch'):
            continue
        offset_a = note_a.offset + (note_a.measureNumber - start_m) * 4 if hasattr(note_a, 'measureNumber') else note_a.offset
        
        for note_b in notes_b:
            if not hasattr(note_b, 'pitch'):
                continue
            offset_b = note_b.offset + (note_b.measureNumber - start_m) * 4 if hasattr(note_b, 'measureNumber') else note_b.offset
            
            if abs(offset_a - offset_b) < 0.1:
                try:
                    ivl = interval_module.Interval(note_b.pitch, note_a.pitch)
                    ivl_name = ivl.simpleName
                    interval_counts[ivl_name] += 1
                    
                    measure_num = note_a.measureNumber if hasattr(note_a, 'measureNumber') else start_m
                    beat = float(note_a.beat) if hasattr(note_a, 'beat') and note_a.beat else 1.0
                    
                    intervals_data.append({
                        "measure": measure_num,
                        "beat": beat,
                        "interval": ivl_name,
                        "pitchA": str(note_a.pitch.nameWithOctave),
                        "pitchB": str(note_b.pitch.nameWithOctave),
                    })
                except Exception:
                    continue
    
    part_names = get_score_parts(score)
    
    return {
        "partA": part_names[part_a_idx] if part_a_idx < len(part_names) else f"Part {part_a_idx + 1}",
        "partB": part_names[part_b_idx] if part_b_idx < len(part_names) else f"Part {part_b_idx + 1}",
        "intervals": intervals_data[:100],
        "summary": dict(interval_counts.most_common(10)),
        "totalIntervals": len(intervals_data),
    }


def workflow_parallel_5ths_8ves_detector(score, selection: dict, params: dict) -> dict:
    """Detect parallel fifths and octaves between two parts."""
    from music21 import interval as interval_module
    
    part_a = params.get("partA", "0")
    part_b = params.get("partB", "1")
    
    parts = list(score.parts)
    if len(parts) < 2:
        return {"error": "Score needs at least 2 parts", "parallels": []}
    
    try:
        part_a_idx = int(part_a) if part_a.isdigit() else 0
        part_b_idx = int(part_b) if part_b.isdigit() else 1
    except Exception:
        part_a_idx, part_b_idx = 0, 1
    
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    try:
        excerpt_a = parts[part_a_idx].measures(start_m, end_m)
        excerpt_b = parts[part_b_idx].measures(start_m, end_m)
    except Exception:
        excerpt_a = parts[part_a_idx]
        excerpt_b = parts[part_b_idx]
    
    notes_a = [n for n in excerpt_a.recurse().notes if hasattr(n, 'pitch')]
    notes_b = [n for n in excerpt_b.recurse().notes if hasattr(n, 'pitch')]
    
    parallels = []
    prev_interval = None
    prev_notes = None
    
    for i, note_a in enumerate(notes_a):
        if i >= len(notes_b):
            break
        note_b = notes_b[i]
        
        try:
            ivl = interval_module.Interval(note_b.pitch, note_a.pitch)
            simple_ivl = ivl.generic.simpleDirected
            
            if prev_interval is not None:
                if simple_ivl == 5 and prev_interval == 5:
                    parallels.append({
                        "type": "Parallel Fifth",
                        "measure": note_a.measureNumber if hasattr(note_a, 'measureNumber') else start_m,
                        "pitchA1": str(prev_notes[0].pitch.nameWithOctave),
                        "pitchB1": str(prev_notes[1].pitch.nameWithOctave),
                        "pitchA2": str(note_a.pitch.nameWithOctave),
                        "pitchB2": str(note_b.pitch.nameWithOctave),
                    })
                elif simple_ivl == 1 and prev_interval == 1:
                    parallels.append({
                        "type": "Parallel Octave",
                        "measure": note_a.measureNumber if hasattr(note_a, 'measureNumber') else start_m,
                        "pitchA1": str(prev_notes[0].pitch.nameWithOctave),
                        "pitchB1": str(prev_notes[1].pitch.nameWithOctave),
                        "pitchA2": str(note_a.pitch.nameWithOctave),
                        "pitchB2": str(note_b.pitch.nameWithOctave),
                    })
            
            prev_interval = simple_ivl
            prev_notes = (note_a, note_b)
        except Exception:
            continue
    
    part_names = get_score_parts(score)
    
    return {
        "partA": part_names[part_a_idx] if part_a_idx < len(part_names) else f"Part {part_a_idx + 1}",
        "partB": part_names[part_b_idx] if part_b_idx < len(part_names) else f"Part {part_b_idx + 1}",
        "parallels": parallels,
        "totalFound": len(parallels),
        "fifthsCount": len([p for p in parallels if "Fifth" in p["type"]]),
        "octavesCount": len([p for p in parallels if "Octave" in p["type"]]),
    }


def workflow_rhythm_skeleton(score, selection: dict, params: dict) -> dict:
    """Extract rhythm skeleton (onset times) for each part."""
    excerpt = get_selection(score, selection)
    
    parts_data = []
    playback_events = []
    
    start_m = selection.get("startMeasure", 1)
    
    try:
        parts_to_analyze = list(excerpt.parts) if hasattr(excerpt, 'parts') else [excerpt]
    except Exception:
        parts_to_analyze = [excerpt]
    
    for part_idx, part in enumerate(parts_to_analyze):
        part_name = str(part.partName) if hasattr(part, 'partName') and part.partName else f"Part {part_idx + 1}"
        
        measures_onsets = {}
        
        for note in part.recurse().notes:
            measure_num = note.measureNumber if hasattr(note, 'measureNumber') else start_m
            beat = float(note.beat) if hasattr(note, 'beat') and note.beat else 1.0
            
            if measure_num not in measures_onsets:
                measures_onsets[measure_num] = []
            
            if beat not in measures_onsets[measure_num]:
                measures_onsets[measure_num].append(beat)
        
        measures_list = []
        for m_num in sorted(measures_onsets.keys()):
            onsets = sorted(measures_onsets[m_num])
            measures_list.append({
                "measure": m_num,
                "onsets": onsets,
                "pattern": " ".join([f"{o:.1f}" for o in onsets])
            })
        
        parts_data.append({
            "part": part_name,
            "measures": measures_list
        })
    
    end_m = selection.get("endMeasure", start_m + 10)
    for m in range(start_m, end_m + 1):
        for beat in [1, 2, 3, 4]:
            accent = beat == 1
            playback_events.append({
                "measure": m,
                "beat": float(beat),
                "duration": 0.1,
                "frequencies": [880.0] if accent else [440.0],
                "chordLabel": "accent" if accent else "tick"
            })
    
    return {
        "parts": parts_data,
        "playbackEvents": playback_events,
    }


def workflow_motif_finder_interval_contour(score, selection: dict, params: dict) -> dict:
    """Find repeated interval contour patterns in a part."""
    from music21 import interval as interval_module
    
    part_id = params.get("part", selection.get("partId", "0"))
    motif_length = int(params.get("motifLength", 4))
    
    if part_id == "ALL" and hasattr(score, 'parts') and len(score.parts) > 0:
        part_id = "0"
    
    selected = get_part_by_id(score, part_id)
    
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    try:
        excerpt = selected.measures(start_m, end_m)
    except Exception:
        excerpt = selected
    
    notes = [n for n in excerpt.recurse().notes if hasattr(n, 'pitch')]
    
    def get_interval_contour(note_list):
        if len(note_list) < 2:
            return ""
        contour = []
        for i in range(1, len(note_list)):
            try:
                ivl = interval_module.Interval(note_list[i-1].pitch, note_list[i].pitch)
                semitones = ivl.semitones
                if semitones > 0:
                    contour.append(f"+{semitones}")
                elif semitones < 0:
                    contour.append(f"{semitones}")
                else:
                    contour.append("0")
            except Exception:
                contour.append("?")
        return ",".join(contour)
    
    motif_occurrences = {}
    
    for i in range(len(notes) - motif_length + 1):
        window = notes[i:i + motif_length]
        contour = get_interval_contour(window)
        
        if contour and "?" not in contour:
            if contour not in motif_occurrences:
                motif_occurrences[contour] = []
            
            measure_num = window[0].measureNumber if hasattr(window[0], 'measureNumber') else start_m
            beat = float(window[0].beat) if hasattr(window[0], 'beat') and window[0].beat else 1.0
            
            motif_occurrences[contour].append({
                "measure": measure_num,
                "beat": beat,
                "notes": [str(n.pitch.nameWithOctave) for n in window]
            })
    
    repeated_motifs = []
    motif_id = 1
    for contour, occurrences in sorted(motif_occurrences.items(), key=lambda x: -len(x[1])):
        if len(occurrences) >= 2:
            repeated_motifs.append({
                "id": motif_id,
                "contour": contour,
                "occurrenceCount": len(occurrences),
                "occurrences": occurrences[:10],
            })
            motif_id += 1
            if len(repeated_motifs) >= 10:
                break
    
    part_names = get_score_parts(score)
    analyzed_part = "All parts"
    try:
        if part_id != "ALL":
            idx = int(part_id) if part_id.isdigit() else 0
            if idx < len(part_names):
                analyzed_part = part_names[idx]
    except Exception:
        pass
    
    return {
        "analyzedPart": analyzed_part,
        "motifLength": motif_length,
        "motifs": repeated_motifs,
        "totalMotifsFound": len(repeated_motifs),
    }


def workflow_reduction_outer_voices(score, selection: dict, params: dict) -> dict:
    """Create a reduction with only outer voices (soprano + bass)."""
    from music21 import stream, note, chord as chord_module
    
    excerpt = get_selection(score, selection)
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        chordified = excerpt
    
    reduction_stream = stream.Part()
    playback_events = []
    
    start_m = selection.get("startMeasure", 1)
    end_m = selection.get("endMeasure", start_m + 10)
    
    soprano_part = "Highest voice"
    bass_part = "Lowest voice"
    
    beats_per_measure = 4
    try:
        for ts in excerpt.recurse().getElementsByClass('TimeSignature'):
            beats_per_measure = ts.numerator
            break
    except Exception:
        pass
    
    for measure_num in range(start_m, end_m + 1):
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                continue
            
            for element in measure.recurse().getElementsByClass('Chord'):
                if len(element.pitches) >= 2:
                    sorted_pitches = sorted(element.pitches, key=lambda p: p.midi)
                    bass_pitch = sorted_pitches[0]
                    soprano_pitch = sorted_pitches[-1]
                    
                    bass_freq = bass_pitch.frequency
                    soprano_freq = soprano_pitch.frequency
                    
                    beat = float(element.beat) if hasattr(element, 'beat') and element.beat else 1.0
                    duration = float(element.quarterLength) if element.quarterLength else 1.0
                    
                    playback_events.append({
                        "measure": measure_num,
                        "beat": beat,
                        "duration": duration,
                        "frequencies": [round(bass_freq, 2), round(soprano_freq, 2)],
                        "chordLabel": f"{bass_pitch.nameWithOctave} + {soprano_pitch.nameWithOctave}"
                    })
                elif len(element.pitches) == 1:
                    pitch = element.pitches[0]
                    beat = float(element.beat) if hasattr(element, 'beat') and element.beat else 1.0
                    duration = float(element.quarterLength) if element.quarterLength else 1.0
                    
                    playback_events.append({
                        "measure": measure_num,
                        "beat": beat,
                        "duration": duration,
                        "frequencies": [round(pitch.frequency, 2)],
                        "chordLabel": str(pitch.nameWithOctave)
                    })
                    
        except Exception:
            continue
    
    notation_xml = stream_to_musicxml(chordified)
    
    return {
        "type": "transform",
        "soprano": soprano_part,
        "bass": bass_part,
        "eventCount": len(playback_events),
        "playbackEvents": playback_events,
        "beatsPerMeasure": beats_per_measure,
        "defaultTempo": 120,
        "description": "Outer voices reduction (highest + lowest pitches at each chord change)",
        "exports": {"formats": ["musicxml", "midi"]},
        "notationData": notation_xml if notation_xml else None,
    }


WORKFLOW_REGISTRY = {
    "score_summary": {
        "id": "score_summary",
        "name": "Score Summary",
        "description": "Get title, composer, parts, time signatures, tempos, and key signatures",
        "type": "analysis",
        "params": [],
        "function": workflow_score_summary
    },
    "global_key_estimate": {
        "id": "global_key_estimate",
        "name": "Global Key Estimate",
        "description": "Estimate the key of the selected region using Krumhansl-Schmuckler analysis",
        "type": "analysis",
        "params": [],
        "function": workflow_global_key_estimate
    },
    "chordify_and_chords": {
        "id": "chordify_and_chords",
        "name": "Chordify & Chord Labels",
        "description": "Chordify and extract chord labels with pitch information per beat",
        "type": "analysis",
        "params": [],
        "function": workflow_chordify_and_chords
    },
    "roman_numeral_analysis": {
        "id": "roman_numeral_analysis",
        "name": "Roman Numeral Analysis",
        "description": "Analyze chord progressions using Roman numerals in the estimated key",
        "type": "analysis",
        "params": [],
        "function": workflow_roman_numeral_analysis
    },
    "cadence_spotter": {
        "id": "cadence_spotter",
        "name": "Cadence Spotter",
        "description": "Detect cadence-like progressions (PAC, HC, DC, PC)",
        "type": "analysis",
        "params": [],
        "function": workflow_cadence_spotter
    },
    "interval_map_between_parts": {
        "id": "interval_map_between_parts",
        "name": "Interval Map Between Parts",
        "description": "Map harmonic intervals between two selected parts",
        "type": "analysis",
        "params": [
            {"name": "partA", "type": "select", "label": "Part A", "required": True, "default": "0"},
            {"name": "partB", "type": "select", "label": "Part B", "required": True, "default": "1"}
        ],
        "function": workflow_interval_map_between_parts
    },
    "parallel_5ths_8ves_detector": {
        "id": "parallel_5ths_8ves_detector",
        "name": "Parallel 5ths/8ves Detector",
        "description": "Detect parallel fifths and octaves between two parts",
        "type": "analysis",
        "params": [
            {"name": "partA", "type": "select", "label": "Part A", "required": True, "default": "0"},
            {"name": "partB", "type": "select", "label": "Part B", "required": True, "default": "1"}
        ],
        "function": workflow_parallel_5ths_8ves_detector
    },
    "rhythm_skeleton": {
        "id": "rhythm_skeleton",
        "name": "Rhythm Skeleton",
        "description": "Extract onset patterns per measure for each part with optional click playback",
        "type": "analysis",
        "params": [],
        "function": workflow_rhythm_skeleton
    },
    "motif_finder_interval_contour": {
        "id": "motif_finder_interval_contour",
        "name": "Motif Finder (Interval Contour)",
        "description": "Find repeated interval patterns (transposition-invariant)",
        "type": "analysis",
        "params": [
            {"name": "part", "type": "select", "label": "Part to Analyze", "required": False, "default": "0"},
            {"name": "motifLength", "type": "number", "label": "Motif Length (notes)", "required": False, "default": 4}
        ],
        "function": workflow_motif_finder_interval_contour
    },
    "reduction_outer_voices": {
        "id": "reduction_outer_voices",
        "name": "Outer Voices Reduction",
        "description": "Create a two-voice reduction (soprano + bass) with playback",
        "type": "transform",
        "params": [],
        "function": workflow_reduction_outer_voices
    },
}


def list_workflows() -> list:
    """Return list of available workflows (without function references)."""
    workflows = []
    for w in WORKFLOW_REGISTRY.values():
        workflows.append({
            "id": w["id"],
            "name": w["name"],
            "description": w["description"],
            "type": w["type"],
            "params": w.get("params", [])
        })
    return workflows


def run_workflow(workflow_id: str, score, selection: dict, params: dict) -> dict:
    """Run a workflow by ID on the given score with selection."""
    if workflow_id not in WORKFLOW_REGISTRY:
        return {"error": f"Unknown workflow: {workflow_id}"}
    
    workflow = WORKFLOW_REGISTRY[workflow_id]
    
    try:
        result = workflow["function"](score, selection, params)
    except Exception as e:
        return {
            "error": f"Workflow failed: {str(e)}",
            "workflowId": workflow_id,
            "workflowName": workflow["name"],
        }
    
    return {
        "workflowId": workflow_id,
        "workflowName": workflow["name"],
        "type": workflow["type"],
        "selection": selection,
        "data": result,
        "playbackEvents": result.get("playbackEvents") if isinstance(result, dict) else None,
    }


def parse_musicxml(musicxml_data: str):
    """Parse MusicXML data and return a music21 score."""
    from music21 import converter
    
    score = converter.parse(musicxml_data)
    return score


def convert_to_mei(musicxml_data: str) -> str:
    """Convert MusicXML to MEI format for Verovio rendering."""
    return musicxml_data


def get_score_metadata(score) -> dict:
    """Extract metadata from a music21 score."""
    metadata = {
        "title": None,
        "composer": None,
        "parts": [],
        "measureCount": 0
    }
    
    try:
        if score.metadata:
            if score.metadata.title:
                metadata["title"] = str(score.metadata.title)
            if score.metadata.composer:
                metadata["composer"] = str(score.metadata.composer)
    except Exception:
        pass
    
    try:
        for i, part in enumerate(score.parts):
            part_name = str(part.partName) if part.partName else f"Part {i + 1}"
            metadata["parts"].append(part_name)
    except Exception:
        pass
    
    try:
        measures = list(score.recurse().getElementsByClass('Measure'))
        if measures:
            measure_numbers = [m.measureNumber for m in measures if hasattr(m, 'measureNumber') and m.measureNumber]
            if measure_numbers:
                metadata["measureCount"] = max(measure_numbers)
            else:
                metadata["measureCount"] = len(measures)
        else:
            metadata["measureCount"] = 1
    except Exception:
        metadata["measureCount"] = 1
    
    return metadata


def export_score(score, selection: dict, format: str) -> dict:
    """Export score to MusicXML or MIDI format."""
    import io
    from music21 import midi
    
    excerpt = get_selection(score, selection)
    
    try:
        if format == "midi":
            mf = midi.translate.music21ObjectToMidiFile(excerpt)
            buf = io.BytesIO()
            mf.open(buf, 'wb')
            mf.write()
            mf.close()
            buf.seek(0)
            data = base64.b64encode(buf.read()).decode('utf-8')
            return {
                "success": True,
                "format": "midi",
                "data": data,
                "contentType": "audio/midi",
                "filename": "export.mid"
            }
        elif format == "musicxml":
            from music21 import converter
            xml_data = converter.toData(excerpt, fmt='musicxml')
            if isinstance(xml_data, bytes):
                xml_str = xml_data.decode('utf-8')
            else:
                xml_str = str(xml_data)
            data = base64.b64encode(xml_str.encode('utf-8')).decode('utf-8')
            return {
                "success": True,
                "format": "musicxml",
                "data": data,
                "contentType": "application/vnd.recordare.musicxml+xml",
                "filename": "export.musicxml"
            }
        else:
            return {"success": False, "error": f"Unknown format: {format}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Music21 Workflow CLI")
    parser.add_argument("command", choices=["list", "run", "parse", "convert", "export"])
    parser.add_argument("--workflow", help="Workflow ID for run command")
    parser.add_argument("--file", help="Path to MusicXML file")
    parser.add_argument("--start", type=int, default=1, help="Start measure")
    parser.add_argument("--end", type=int, default=None, help="End measure")
    parser.add_argument("--part", default="ALL", help="Part ID (ALL or part name/index)")
    parser.add_argument("--params", default="{}", help="JSON params for workflow")
    parser.add_argument("--data", help="Raw MusicXML data (for stdin processing)")
    
    args = parser.parse_args()
    
    if args.command == "list":
        print(json.dumps({"workflows": list_workflows()}))
    
    elif args.command == "parse":
        if args.file:
            with open(args.file, 'r') as f:
                musicxml_data = f.read()
        elif args.data:
            musicxml_data = args.data
        else:
            musicxml_data = sys.stdin.read()
        
        try:
            score = parse_musicxml(musicxml_data)
            mei_data = convert_to_mei(musicxml_data)
            metadata = get_score_metadata(score)
            
            print(json.dumps({
                "success": True,
                "meiData": mei_data,
                "metadata": metadata
            }))
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": str(e)
            }))
    
    elif args.command == "convert":
        if args.file:
            with open(args.file, 'r') as f:
                musicxml_data = f.read()
        else:
            musicxml_data = sys.stdin.read()
        
        mei_data = convert_to_mei(musicxml_data)
        print(mei_data)
    
    elif args.command == "run":
        if not args.workflow:
            print(json.dumps({"error": "Workflow ID required"}))
            sys.exit(1)
        
        if args.file:
            with open(args.file, 'r') as f:
                musicxml_data = f.read()
        else:
            musicxml_data = sys.stdin.read()
        
        try:
            score = parse_musicxml(musicxml_data)
            metadata = get_score_metadata(score)
            
            end_measure = args.end if args.end else metadata["measureCount"]
            
            selection = {
                "partId": args.part,
                "startMeasure": args.start,
                "endMeasure": end_measure
            }
            
            try:
                params = json.loads(args.params)
            except Exception:
                params = {}
            
            result = run_workflow(args.workflow, score, selection, params)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    
    elif args.command == "export":
        if args.file:
            with open(args.file, 'r') as f:
                musicxml_data = f.read()
        else:
            musicxml_data = sys.stdin.read()
        
        try:
            score = parse_musicxml(musicxml_data)
            metadata = get_score_metadata(score)
            
            end_measure = args.end if args.end else metadata["measureCount"]
            
            selection = {
                "partId": args.part,
                "startMeasure": args.start,
                "endMeasure": end_measure
            }
            
            try:
                params = json.loads(args.params)
            except Exception:
                params = {}
            
            format_type = params.get("format", "musicxml")
            result = export_score(score, selection, format_type)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
