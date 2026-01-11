#!/usr/bin/env python3
"""
Music21 Workflow Registry for Chamber Music Rehearsal Tool

This module provides a registry of analysis workflows that can be run on MusicXML scores.
Each workflow is a function that takes a music21 stream and measure range, returning analysis data.

To add a new workflow:
1. Define a function with signature: def my_workflow(score, start_measure, end_measure) -> dict
2. Register it in WORKFLOW_REGISTRY with a unique id, name, and description
"""

import json
import sys
from typing import Callable, Any

def get_excerpt(score, start_measure: int, end_measure: int):
    """Extract measures from a score."""
    try:
        return score.measures(start_measure, end_measure)
    except Exception:
        return score


def workflow_global_key(score, start_measure: int, end_measure: int) -> dict:
    """Estimate the global key of the selected section."""
    from music21 import analysis
    
    excerpt = get_excerpt(score, start_measure, end_measure)
    
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
            "confidence": confidence,
            "alternates": alternates
        }
    except Exception as e:
        try:
            simple_key = excerpt.analyze('key')
            return {
                "key": str(simple_key) if simple_key else "Unknown",
                "confidence": 0.7,
                "alternates": []
            }
        except Exception:
            return {
                "key": "Could not determine",
                "confidence": 0,
                "alternates": [],
                "error": str(e)
            }


def workflow_chordified_harmony(score, start_measure: int, end_measure: int) -> dict:
    """Analyze chords by measure."""
    from music21 import harmony, chord as chord_module
    
    excerpt = get_excerpt(score, start_measure, end_measure)
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        chordified = excerpt
    
    measures_data = []
    
    for measure_num in range(start_measure, end_measure + 1):
        measure_chords = []
        
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                measures_data.append({
                    "number": measure_num,
                    "chords": []
                })
                continue
            
            for element in measure.recurse().getElementsByClass('Chord'):
                pitches = [str(p) for p in element.pitches]
                
                chord_label = ""
                try:
                    chord_label = element.pitchedCommonName
                except Exception:
                    try:
                        chord_label = element.commonName
                    except Exception:
                        chord_label = "-".join(pitches[:3]) if pitches else "?"
                
                measure_chords.append({
                    "label": chord_label,
                    "pitches": pitches,
                    "beat": float(element.beat) if hasattr(element, 'beat') and element.beat else 1.0
                })
            
            measures_data.append({
                "number": measure_num,
                "chords": measure_chords
            })
            
        except Exception as e:
            measures_data.append({
                "number": measure_num,
                "chords": [],
                "error": str(e)
            })
    
    return {"measures": measures_data}


def workflow_reduction_data(score, start_measure: int, end_measure: int) -> dict:
    """Generate playback reduction data for Tone.js."""
    from music21 import pitch as pitch_module
    
    excerpt = get_excerpt(score, start_measure, end_measure)
    
    try:
        chordified = excerpt.chordify()
    except Exception:
        chordified = excerpt
    
    events = []
    beats_per_measure = 4
    
    try:
        for ts in excerpt.recurse().getElementsByClass('TimeSignature'):
            beats_per_measure = ts.numerator
            break
    except Exception:
        pass
    
    for measure_num in range(start_measure, end_measure + 1):
        try:
            measure = chordified.measure(measure_num)
            if measure is None:
                continue
            
            for element in measure.recurse().getElementsByClass('Chord'):
                frequencies = []
                for p in element.pitches:
                    try:
                        freq = p.frequency
                        frequencies.append(round(freq, 2))
                    except Exception:
                        pass
                
                if frequencies:
                    beat = float(element.beat) if hasattr(element, 'beat') and element.beat else 1.0
                    duration = float(element.quarterLength) if element.quarterLength else 1.0
                    
                    chord_label = ""
                    try:
                        chord_label = element.pitchedCommonName
                    except Exception:
                        pass
                    
                    events.append({
                        "measure": measure_num,
                        "beat": beat,
                        "duration": duration,
                        "frequencies": frequencies,
                        "chordLabel": chord_label
                    })
                    
        except Exception:
            continue
    
    return {
        "events": events,
        "beatsPerMeasure": beats_per_measure,
        "defaultTempo": 120
    }


WORKFLOW_REGISTRY = {
    "global_key": {
        "id": "global_key",
        "name": "Global Key Estimate",
        "description": "Estimates the key of the selected section using Krumhansl-Schmuckler analysis",
        "function": workflow_global_key
    },
    "chordified_harmony": {
        "id": "chordified_harmony",
        "name": "Chordified Harmony",
        "description": "Analyzes chord labels and pitch sets for each measure",
        "function": workflow_chordified_harmony
    },
    "reduction_data": {
        "id": "reduction_data",
        "name": "Playback Reduction",
        "description": "Generates harmonic reduction data for sine-tone playback",
        "function": workflow_reduction_data
    }
}


def list_workflows() -> list:
    """Return list of available workflows (without function references)."""
    return [
        {"id": w["id"], "name": w["name"], "description": w["description"]}
        for w in WORKFLOW_REGISTRY.values()
    ]


def run_workflow(workflow_id: str, score, start_measure: int, end_measure: int) -> dict:
    """Run a workflow by ID on the given score."""
    if workflow_id not in WORKFLOW_REGISTRY:
        return {"error": f"Unknown workflow: {workflow_id}"}
    
    workflow = WORKFLOW_REGISTRY[workflow_id]
    result = workflow["function"](score, start_measure, end_measure)
    
    return {
        "workflowId": workflow_id,
        "workflowName": workflow["name"],
        "measureRange": {
            "startMeasure": start_measure,
            "endMeasure": end_measure
        },
        "data": result
    }


def parse_musicxml(musicxml_data: str):
    """Parse MusicXML data and return a music21 score."""
    from music21 import converter
    
    score = converter.parse(musicxml_data)
    return score


def convert_to_mei(musicxml_data: str) -> str:
    """Convert MusicXML to MEI format for Verovio rendering."""
    from music21 import converter
    import tempfile
    import os
    
    try:
        score = converter.parse(musicxml_data)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.mei', delete=False) as f:
            temp_path = f.name
        
        try:
            score.write('mei', fp=temp_path)
            with open(temp_path, 'r') as f:
                mei_data = f.read()
            return mei_data
        except Exception:
            return musicxml_data
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception:
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
        for part in score.parts:
            part_name = str(part.partName) if part.partName else f"Part {len(metadata['parts']) + 1}"
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


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Music21 Workflow CLI")
    parser.add_argument("command", choices=["list", "run", "parse", "convert"])
    parser.add_argument("--workflow", help="Workflow ID for run command")
    parser.add_argument("--file", help="Path to MusicXML file")
    parser.add_argument("--start", type=int, default=1, help="Start measure")
    parser.add_argument("--end", type=int, default=None, help="End measure")
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
            
            result = run_workflow(args.workflow, score, args.start, end_measure)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
