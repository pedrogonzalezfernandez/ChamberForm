import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { spawn } from "child_process";
import path from "path";
import { workflowRequestSchema } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".xml", ".musicxml", ".mxl"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload a MusicXML file."));
    }
  },
});

function runPythonWorkflow(
  command: string,
  args: string[],
  input?: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(process.cwd(), "server", "python", "workflows.py");
    const proc = spawn("python", [pythonPath, command, ...args]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `Python process exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const musicXmlData = req.file.buffer.toString("utf-8");

      const { stdout } = await runPythonWorkflow("parse", [], musicXmlData);
      const parseResult = JSON.parse(stdout);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Failed to parse MusicXML file",
          details: parseResult.error,
        });
      }

      const score = await storage.saveScore(
        req.file.originalname,
        musicXmlData,
        parseResult.meiData,
        parseResult.metadata
      );

      return res.json({
        scoreId: score.id,
        meiData: score.meiData,
        metadata: score.metadata,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/workflows", async (req, res) => {
    try {
      const { stdout } = await runPythonWorkflow("list", []);
      const result = JSON.parse(stdout);
      return res.json(result);
    } catch (error) {
      console.error("Workflow list error:", error);
      return res.status(500).json({
        error: "Failed to get workflow list",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/workflow/run", async (req, res) => {
    try {
      const parsed = workflowRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.message,
        });
      }

      const { scoreId, workflowId, startMeasure, endMeasure } = parsed.data;

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      const { stdout } = await runPythonWorkflow(
        "run",
        [
          "--workflow",
          workflowId,
          "--start",
          startMeasure.toString(),
          "--end",
          endMeasure.toString(),
        ],
        score.musicXmlData
      );

      const result = JSON.parse(stdout);

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("Workflow run error:", error);
      return res.status(500).json({
        error: "Failed to run workflow",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/reduction", async (req, res) => {
    try {
      const { scoreId, startMeasure, endMeasure } = req.body;

      if (!scoreId || !startMeasure || !endMeasure) {
        return res.status(400).json({
          error: "Missing required fields: scoreId, startMeasure, endMeasure",
        });
      }

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      const { stdout } = await runPythonWorkflow(
        "run",
        [
          "--workflow",
          "reduction_data",
          "--start",
          startMeasure.toString(),
          "--end",
          endMeasure.toString(),
        ],
        score.musicXmlData
      );

      const result = JSON.parse(stdout);

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({
        scoreId,
        startMeasure,
        endMeasure,
        events: result.data?.events || [],
        beatsPerMeasure: result.data?.beatsPerMeasure || 4,
        defaultTempo: result.data?.defaultTempo || 120,
      });
    } catch (error) {
      console.error("Reduction error:", error);
      return res.status(500).json({
        error: "Failed to generate reduction data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/score/:scoreId", async (req, res) => {
    try {
      const score = await storage.getScore(req.params.scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      return res.json({
        scoreId: score.id,
        meiData: score.meiData,
        metadata: score.metadata,
      });
    } catch (error) {
      console.error("Get score error:", error);
      return res.status(500).json({
        error: "Failed to get score",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}
