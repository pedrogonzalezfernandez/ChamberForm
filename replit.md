# Chamber Music Rehearsal Tool

## Overview

A web-based rehearsal and analysis tool for chamber music students. Users can upload MusicXML scores, view them rendered in the browser, select measure ranges for focused practice, run music theory analysis workflows, and play sine-tone harmonic reductions for tuning practice.

## Recent Changes

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
- `client/src/pages/home.tsx` - Main application page with all state management
- `client/src/components/file-upload.tsx` - Drag-and-drop MusicXML upload
- `client/src/components/score-viewer.tsx` - Verovio score rendering with pagination
- `client/src/components/measure-selector.tsx` - Start/end measure inputs
- `client/src/components/workflow-selector.tsx` - Dropdown populated from backend
- `client/src/components/analysis-panel.tsx` - Displays workflow results
- `client/src/components/playback-controls.tsx` - Tone.js playback with loop/tempo

### Backend (Express.js + Python)
- `server/routes.ts` - API endpoints for upload, workflows, reduction
- `server/storage.ts` - In-memory storage for uploaded scores
- `server/python/workflows.py` - Music21 workflow registry and CLI

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
| POST | /api/workflow/run | Execute a workflow on measure range |
| POST | /api/reduction | Get playback events for Tone.js |
| GET | /api/score/:scoreId | Retrieve stored score data |

## Adding New Workflows

1. Edit `server/python/workflows.py`
2. Define function: `def workflow_name(score, start, end) -> dict`
3. Add to `WORKFLOW_REGISTRY` with id, name, description, function
4. (Optional) Update `analysis-panel.tsx` for custom result rendering
