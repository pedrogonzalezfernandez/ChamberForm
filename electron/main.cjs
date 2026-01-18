const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let mainWindow = null;
let serverProcess = null;

function devtoolsEnabled() {
  return process.env.ELECTRON_DEVTOOLS === "1";
}

function resolveServerEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "dist", "index.cjs");
  }
  return path.join(app.getAppPath(), "dist", "index.cjs");
}

async function startServerIfNeeded() {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    console.log(`[electron] using renderer URL: ${rendererUrl}`);
    return { url: rendererUrl };
  }

  const serverEntry = resolveServerEntry();
  const cwd = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked")
    : app.getAppPath();

  const child = fork(serverEntry, [], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "0",
    },
    silent: true,
  });

  serverProcess = child;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for server to start"));
    }, 20_000);

    const cleanup = () => {
      clearTimeout(timeout);
      child.removeAllListeners("message");
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
    };

    child.on("message", (msg) => {
      if (msg && typeof msg === "object" && typeof msg.port === "number") {
        cleanup();
        resolve({ url: `http://127.0.0.1:${msg.port}` });
        return;
      }
      if (msg && typeof msg === "object" && typeof msg.error === "string") {
        cleanup();
        reject(new Error(msg.error));
      }
    });

    let combined = "";
    child.stdout?.on("data", (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      combined += text;
      const match = combined.match(/serving on port (\d+)/);
      if (match) {
        cleanup();
        resolve({ url: `http://127.0.0.1:${match[1]}` });
      }
    });

    child.stderr?.on("data", (buf) => {
      const text = buf.toString();
      process.stderr.write(text);
    });

    child.on("exit", (code) => {
      cleanup();
      reject(new Error(`Server exited early (code ${code ?? "unknown"})`));
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function boot() {
  try {
    createWindow();
    const { url } = await startServerIfNeeded();
    console.log(`[electron] loading: ${url}`);
    await mainWindow.loadURL(url);

    if (devtoolsEnabled()) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } catch (err) {
    console.error(err);
    app.quit();
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void boot();
});

app.whenReady().then(() => void boot());

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
