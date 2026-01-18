# ChamberForm - Music Rehearsal Tool

A web-based rehearsal and analysis tool for chamber music students. Upload MusicXML scores, analyze harmony, and practice tuning with sine-tone playback.

## Features

- **Score Rendering**: Upload MusicXML files and view them rendered with Verovio
- **Section Selection**: Select measure ranges for focused analysis and practice
- **Analysis Workflows**: Run music21-powered analysis including:
  - Global key estimation (Krumhansl-Schmuckler algorithm)
  - Chordified harmony by measure (chord labels and pitch sets)
  - Harmonic reduction for playback
- **Tuning Practice**: Play sine-tone harmonic reductions with loop and tempo controls

## Running in Replit

1. Click the "Run" button or use the workflow "Start application"
2. The app will start on port 5000
3. Open the Webview to access the application

### Development

The project uses:
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js with Python child process for music21
- **Score Rendering**: Verovio (browser-based)
- **Audio Playback**: Tone.js (WebAudio)

Run the development server:
```bash
npm run dev
```

## macOS Desktop App (Electron)

This repo can be wrapped as a macOS desktop app by running the existing server locally and loading it in an Electron `BrowserWindow`.

### Prerequisites

- Node.js (for building/packaging)
- Python 3 + `music21` available on your PATH (used by `server/python/workflows.py`)
  - If needed, point Electron/Node at a specific interpreter: `PYTHON_BIN=/path/to/python3`

### Run (development)

```bash
npm install
npm run desktop:dev
```

### Run (production preview, not packaged)

```bash
npm run desktop:preview
```

### Build a distributable macOS app (DMG/ZIP)

```bash
PYTHON_BIN=$(which python3) npm run desktop:dist
```

Notes:
- On macOS, the desktop wrapper runs the server on `127.0.0.1` and uses an OS-assigned port (`PORT=0`).
- For a fully self-contained app (no Python required by end users), the build machine must have Python 3 and `music21` installed; `desktop:dist` will PyInstaller-bundle `server/python/workflows.py`.

## How to Add a New Workflow

The workflow system is designed to be extensible. To add a new music21 analysis workflow:

### 1. Open the workflow registry

Edit `server/python/workflows.py`

### 2. Define your workflow function

```python
def workflow_my_analysis(score, start_measure: int, end_measure: int) -> dict:
    """Description of what your workflow does."""
    from music21 import analysis  # Import music21 modules as needed
    
    # Get the excerpt (measure range)
    excerpt = get_excerpt(score, start_measure, end_measure)
    
    # Perform your analysis
    result = {
        "someKey": "someValue",
        "data": []
    }
    
    return result
```

### 3. Register the workflow

Add your workflow to `WORKFLOW_REGISTRY`:

```python
WORKFLOW_REGISTRY = {
    # ... existing workflows ...
    "my_analysis": {
        "id": "my_analysis",
        "name": "My Analysis",
        "description": "Brief description shown in the UI dropdown",
        "function": workflow_my_analysis
    }
}
```

### 4. (Optional) Update the analysis panel display

If your workflow returns data in a custom format, you may want to update `client/src/components/analysis-panel.tsx` to render it nicely. Add a condition in the `renderResultData` function:

```tsx
if (data.myCustomField) {
  return (
    <div className="space-y-3">
      {/* Custom rendering for your workflow output */}
    </div>
  );
}
```

## API Endpoints

### `POST /api/upload`
Upload a MusicXML file.

**Request**: `multipart/form-data` with `file` field

**Response**:
```json
{
  "scoreId": "uuid",
  "meiData": "MEI XML string for Verovio",
  "metadata": {
    "scoreId": "uuid",
    "title": "Score Title",
    "composer": "Composer Name",
    "parts": ["Violin 1", "Violin 2", "Viola", "Cello"],
    "measureCount": 100
  }
}
```

### `GET /api/workflows`
List available analysis workflows.

**Response**:
```json
{
  "workflows": [
    {
      "id": "global_key",
      "name": "Global Key Estimate",
      "description": "Estimates the key using Krumhansl-Schmuckler analysis"
    }
  ]
}
```

### `POST /api/workflow/run`
Run an analysis workflow on a score section.

**Request**:
```json
{
  "scoreId": "uuid",
  "workflowId": "global_key",
  "startMeasure": 1,
  "endMeasure": 16
}
```

**Response**:
```json
{
  "workflowId": "global_key",
  "workflowName": "Global Key Estimate",
  "measureRange": { "startMeasure": 1, "endMeasure": 16 },
  "data": {
    "key": "C major",
    "confidence": 0.85,
    "alternates": ["A minor", "G major"]
  }
}
```

### `POST /api/reduction`
Get harmonic reduction data for Tone.js playback.

**Request**:
```json
{
  "scoreId": "uuid",
  "startMeasure": 1,
  "endMeasure": 16
}
```

**Response**:
```json
{
  "scoreId": "uuid",
  "startMeasure": 1,
  "endMeasure": 16,
  "events": [
    {
      "measure": 1,
      "beat": 1,
      "duration": 1,
      "frequencies": [261.63, 329.63, 392.00],
      "chordLabel": "C major triad"
    }
  ],
  "beatsPerMeasure": 4,
  "defaultTempo": 120
}
```

## Project Structure

```
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # UI components
│       │   ├── file-upload.tsx
│       │   ├── score-viewer.tsx
│       │   ├── measure-selector.tsx
│       │   ├── workflow-selector.tsx
│       │   ├── analysis-panel.tsx
│       │   └── playback-controls.tsx
│       └── pages/
│           └── home.tsx    # Main application page
├── server/
│   ├── python/
│   │   └── workflows.py    # Music21 workflow registry
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # In-memory score storage
└── shared/
    └── schema.ts           # TypeScript types and Zod schemas
```

## Supported File Formats

- `.xml` - Standard MusicXML
- `.musicxml` - MusicXML with explicit extension
- `.mxl` - Compressed MusicXML (if supported by music21)

## License

MIT
