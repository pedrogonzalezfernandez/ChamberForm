# Chamber Music Rehearsal Tool - Design Guidelines

## Design Approach: Productivity-Focused Application

**Selected System**: Clean productivity tool aesthetic inspired by Linear and Notion, prioritizing clarity and workflow efficiency over visual flair. This is a utility application where function, learnability, and information density are paramount.

## Core Design Principles

1. **Information Hierarchy**: Score rendering is the primary visual focus; controls and analysis panels are supporting elements
2. **Workflow Clarity**: Each step in the analysis process should be visually distinct and easy to follow
3. **Density with Breathing Room**: Pack functionality without overwhelming the interface
4. **Immediate Feedback**: All interactions should provide clear visual confirmation

## Typography System

**Font Family**: Inter or System UI fonts via Google Fonts CDN
- **Primary Interface**: Inter (400, 500, 600 weights)
- **Score Metadata/Labels**: Inter Medium (500)

**Type Scale**:
- Large Headings: text-2xl font-semibold (App title, major section headers)
- Section Headers: text-lg font-medium (Panel titles: "Score", "Analysis Results", "Playback")
- Body Text: text-base (Analysis output, metadata)
- Labels/Controls: text-sm font-medium (Button labels, input labels)
- Secondary/Helper Text: text-sm (Measure counts, timestamps)
- Code/Technical: text-sm font-mono (Chord labels, pitch sets)

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, and 8** consistently
- Component padding: p-4 or p-6
- Section gaps: gap-6 or gap-8
- Tight groupings: gap-2 or gap-4
- Page margins: p-6 or p-8

**Grid Structure**:
- **Single Column for Narrow Viewports** (< 1024px): Stack score, controls, analysis vertically
- **Two-Column for Wide Viewports** (≥ 1024px):
  - Left Column (60-65% width): Score rendering area with max-width constraint
  - Right Column (35-40% width): Controls and analysis results panel

**Container Strategy**:
- Main app container: max-w-screen-2xl mx-auto with px-6 or px-8
- Score viewer: Centered with appropriate max-width to maintain readability
- Control panels: Fixed or sticky positioning on desktop for easy access

## Component Library

### Primary Navigation/Header
- Minimal top bar with app title and upload button
- Height: h-16
- Padding: px-6 or px-8
- Contains: Logo/title (left), Upload button (right)

### Score Rendering Panel
- Clean white/neutral background for score display
- Border: border with rounded corners (rounded-lg)
- Padding: p-6 or p-8 around Verovio canvas
- Should expand to fill available width within constraints

### Control Panel (Measure Selection & Workflow)
- Grouped in a card-style container
- Section headers: text-lg font-medium with mb-4
- Form layout:
  - **Measure Range**: Two number inputs side-by-side (gap-4)
    - Labels: "Start Measure" and "End Measure"
    - Inputs: Standard number input with border, rounded corners
  - **Workflow Dropdown**: Full-width select element
    - Label: "Analysis Workflow"
    - Populated dynamically from backend
  - **Run Button**: Primary button, full-width, mt-4

### Analysis Results Panel
- Card container with border and padding (p-6)
- Header: "Analysis Results" with workflow name
- Content area:
  - Scrollable if content exceeds viewport
  - Use monospace font for technical output (chord labels, pitch sets)
  - Structured display with clear section breaks (gap-4)
  - Key-value pairs for results using flex layout

### Audio Playback Controls
- Compact horizontal control bar
- Elements (left to right):
  - Play/Pause toggle button (icon from Heroicons)
  - Stop button
  - Loop toggle (checkbox or toggle switch)
  - Tempo slider with numeric display (60-200 BPM range)
  - Current position indicator
- Group related controls with gap-3 or gap-4
- Use icon buttons with hover states

### File Upload Component
- Drag-and-drop zone OR prominent button
- Clear affordance: "Upload MusicXML Score" text
- Visual feedback during upload (loading state)
- Display uploaded file name and metadata once loaded

### Cards/Panels (General)
- Background: Subtle surface differentiation
- Border: border with rounded-lg
- Padding: p-6
- Shadow: shadow-sm for subtle elevation
- Gap between panels: gap-6 or gap-8

### Buttons
- **Primary Actions** (Run Workflow, Upload): 
  - Padding: px-6 py-2.5
  - Rounded: rounded-md
  - Font: text-sm font-medium
  - Full-width on mobile, auto-width on desktop
- **Secondary Actions** (Stop, Reset):
  - Similar sizing with visual differentiation
- **Icon Buttons** (Play, Loop):
  - Size: w-10 h-10
  - Padding: p-2
  - Icons from Heroicons (CDN)

### Form Inputs
- Height: h-10
- Padding: px-3
- Border: border with rounded-md
- Focus states: Visible focus ring
- Labels: text-sm font-medium mb-1.5

## Information Architecture

**Primary Layout (Desktop)**:
```
[Header: App Title | Upload Button]
[Main Content Area]
  Left: Score Display (60%)
  Right: Controls & Results (40%)
    - Measure Selection
    - Workflow Dropdown + Run Button
    - Analysis Results Panel (scrollable)
    - Playback Controls (fixed at bottom of right panel)
```

**Mobile Layout**:
Stack vertically: Header → Score → Controls → Results → Playback

## Visual Rhythm & Spacing

- Consistent vertical rhythm using multiples of 4px (Tailwind's default)
- Section spacing: space-y-6 or space-y-8 for major sections
- Tighter spacing (space-y-2 or space-y-4) within related control groups
- Generous padding around score rendering to prevent visual cramping

## Interaction Patterns

- **Workflow Selection**: Dropdown auto-populates from backend on load
- **Measure Range**: Input validation (start < end, within score bounds)
- **Run Workflow**: Button triggers API call, shows loading state, displays results
- **Playback**: Play/pause toggles state; stop resets to beginning; loop checkbox enables repeat
- **Tempo Control**: Slider with live value display
- All interactive elements have clear hover/focus states

## Icons

**Library**: Heroicons (via CDN) - outline style for consistency
- Play: play-circle
- Pause: pause-circle  
- Stop: stop-circle
- Loop: arrow-path
- Upload: arrow-up-tray
- Check/Success: check-circle
- Error: exclamation-triangle

## Accessibility & States

- All form inputs have visible labels
- Focus indicators on all interactive elements
- Loading states for async operations (upload, workflow execution)
- Error messages displayed inline with relevant controls
- Success confirmations for completed workflows

## No Images Required

This is a functional tool application - no hero images or marketing imagery needed. All visual interest comes from the rendered musical score and clean, functional interface design.