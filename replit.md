# Chamber Music Rehearsal Tool

## Overview

A web-based rehearsal and analysis tool for chamber music students. Users can upload MusicXML scores, view them rendered in the browser, select measure ranges and parts for focused practice, run music theory analysis workflows in a pipeline system, and play sine-tone harmonic reductions for tuning practice.

## Recent Changes

- **2026-01-11**: v0.3 Enhanced UI/UX
  - Added ChordStepper component with Prev/Play/Next/Play All controls, volume slider, and scrubber for stepping through chord events
  - Added score annotation overlay system with toggle controls and measure-grouped display
  - Added Activate derived stream feature to switch between original and transformed scores
  - Extended WorkflowResult schema with annotations, exports, and timestamp fields
  - Refactored AnalysisPanel with collapsible step cards and tabbed views (List/Stepper/Export)
  - Integrated Tone.js polyphonic playback in ChordStepper with proper cleanup on unmount

- **2026-01-11**: v0.2 Pipeline System
  - Added pipeline-based workflow execution with step management
  - Implemented 10 music21 workflows: score_summary, global_key_estimate, chordify_and_chords, roman_numeral_analysis, cadence_spotter, interval_map_between_parts, parallel_5ths_8ves_detector, rhythm_skeleton, motif_finder_interval_contour, reduction_outer_voices
  - Added SelectionPanel for part and measure range selection
  - Added PipelinePanel with step list, workflow dropdown, parameter inputs, and run controls
  - Added workspace state management per scoreId with step result caching
  - Selection changes reset step states to prevent stale cached results

- **2026-01-11**: Initial v0.1 implementation
  - Added MusicXML file upload with music21 parsing
  - Integrated Verovio for browser-based score rendering
  - Implemented 3 analysis workflows: key estimation, chordified harmony, reduction data
  - Added Tone.js playback with loop and tempo controls
  - Created responsive two-column layout for desktop

## User Preferences

- Application uses Inter font family for UI
- Clean, productivity-focused design aesthetic
- Score rendering is the primary visual focus
- Analysis results displayed with monospace fonts for technical data

## Project Architecture

### Frontend (React + Vite + TypeScript)
- `client/src/pages/home.tsx` - Main application page with pipeline state management
- `client/src/components/file-upload.tsx` - Drag-and-drop MusicXML upload
- `client/src/components/score-viewer.tsx` - Verovio score rendering with pagination
- `client/src/components/selection-panel.tsx` - Part dropdown and measure range inputs
- `client/src/components/pipeline-panel.tsx` - Step list, workflow selection, params UI, run controls
- `client/src/components/analysis-panel.tsx` - Displays workflow results with dedicated renderers
- `client/src/components/playback-controls.tsx` - Tone.js playback with loop/tempo
- `client/src/components/chord-stepper.tsx` - Step-through chord playback with Tone.js

### Backend (Express.js + Python)
- `server/routes.ts` - API endpoints for upload, workflows, pipeline operations
- `server/storage.ts` - In-memory storage with workspace state (scores, derived streams, step cache)
- `server/python/workflows.py` - Music21 workflow registry with 10 workflows

### Shared
- `shared/schema.ts` - TypeScript types and Zod validation schemas

## Key Technologies

- **Verovio**: Browser-based music notation rendering (loads MEI/MusicXML)
- **Tone.js**: WebAudio synthesis for sine-tone playback
- **music21**: Python library for computational musicology
- **TanStack Query**: Data fetching and caching

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/upload | Upload MusicXML, returns scoreId and MEI data |
| GET | /api/workflows | List available analysis workflows |
| POST | /api/pipeline/runStep | Execute a workflow step in the pipeline |
| POST | /api/pipeline/reset | Reset pipeline to original score state |
| GET | /api/pipeline/workspace/:scoreId | Get current workspace state |
| POST | /api/pipeline/activateStream | Switch between original and derived streams |
| POST | /api/pipeline/export | Export score selection as MIDI or MusicXML |
| POST | /api/reduction | Get playback events for Tone.js |
| GET | /api/score/:scoreId | Get score data by ID |

## Available Workflows

| ID | Name | Type | Description |
|----|------|------|-------------|
| score_summary | Score Summary | analysis | Basic score metadata and structure |
| global_key_estimate | Global Key Estimate | analysis | Estimated key using Krumhansl-Schmuckler |
| chordify_and_chords | Chordify & Chord Labels | analysis | Vertical sonorities with chord labels |
| roman_numeral_analysis | Roman Numeral Analysis | analysis | Roman numeral labels in estimated key |
| cadence_spotter | Cadence Spotter | analysis | Detects potential cadence points |
| interval_map_between_parts | Interval Map Between Parts | analysis | Vertical intervals between two parts |
| parallel_5ths_8ves_detector | Parallel 5ths/8ves Detector | analysis | Voice leading errors detection |
| rhythm_skeleton | Rhythm Skeleton | analysis | Rhythmic pattern analysis |
| motif_finder_interval_contour | Motif Finder (Interval Contour) | analysis | Melodic motif detection |
| reduction_outer_voices | Outer Voices Reduction | transform | Bass/soprano reduction with playback |

## Adding New Workflows

1. Edit `server/python/workflows.py`
2. Define function: `def workflow_name(score, start, end, params) -> dict`
3. Add to `WORKFLOW_REGISTRY` with id, name, description, type, params schema, function
4. (Optional) Update `analysis-panel.tsx` for custom result rendering

## Known Limitations

- Transform workflows operate on the original score; chained transforms do not persist modified streams to subsequent steps
- Playback and ChordStepper work with workflows that return playbackEvents (chordify_and_chords, roman_numeral_analysis, reduction_outer_voices)
- Annotations overlay displays below score, not as inline score annotations (Verovio limitation)
