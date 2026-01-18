# Electron wrapper

This folder contains the Electron main process entrypoint.

- Development: loads `ELECTRON_RENDERER_URL` (typically `http://localhost:5000`)
- Production: forks the bundled server (`dist/index.cjs`) on a random local port and loads it in a `BrowserWindow`

