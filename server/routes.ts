import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { runStepRequestSchema, selectionSchema } from "@shared/schema";
import { z } from "zod";

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
    const workflowsBin = process.env.WORKFLOWS_BIN;
    const pythonBin =
      process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
    const defaultWorkflowsPy =
      process.env.NODE_ENV === "production"
        ? path.join(process.cwd(), "dist", "python", "workflows.py")
        : path.join(process.cwd(), "server", "python", "workflows.py");
    const workflowsPy = process.env.WORKFLOWS_PY || defaultWorkflowsPy;
    const defaultBundledBin =
      process.env.NODE_ENV === "production"
        ? path.join(process.cwd(), "dist", "workflows-bin", "workflows")
        : undefined;
    const bundledBin =
      workflowsBin ||
      (defaultBundledBin && fs.existsSync(defaultBundledBin)
        ? defaultBundledBin
        : undefined);

    const spawnCmd = bundledBin || pythonBin;
    const spawnArgs = bundledBin
      ? [command, ...args]
      : [workflowsPy, command, ...args];

    const proc = spawn(spawnCmd, spawnArgs);

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

  app.post("/api/pipeline/runStep", async (req, res) => {
    try {
      const parsed = runStepRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.message,
        });
      }

      const { scoreId, stepId, workflowId, selection, params } = parsed.data;

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      let workspace = await storage.getWorkspace(scoreId);
      if (!workspace) {
        workspace = await storage.initWorkspace(scoreId);
      }

      const workflowArgs = [
        "--workflow", workflowId,
        "--start", selection.startMeasure.toString(),
        "--end", selection.endMeasure.toString(),
        "--part", selection.partId,
      ];

      if (params && Object.keys(params).length > 0) {
        workflowArgs.push("--params", JSON.stringify(params));
      }

      const { stdout } = await runPythonWorkflow("run", workflowArgs, score.musicXmlData);
      const result = JSON.parse(stdout);

      if (result.error) {
        const errorStep = {
          id: stepId,
          workflowId,
          params: params || {},
          status: "error" as const,
          error: result.error,
        };
        
        const existingStepIndex = workspace.steps.findIndex(s => s.id === stepId);
        if (existingStepIndex >= 0) {
          workspace.steps[existingStepIndex] = errorStep;
        } else {
          workspace.steps.push(errorStep);
        }
        await storage.updateWorkspace(scoreId, { steps: workspace.steps });
        
        return res.status(400).json({ error: result.error, stepId });
      }

      const completedStep = {
        id: stepId,
        workflowId,
        params: params || {},
        result,
        status: "completed" as const,
      };
      
      const existingStepIndex = workspace.steps.findIndex(s => s.id === stepId);
      if (existingStepIndex >= 0) {
        workspace.steps[existingStepIndex] = completedStep;
      } else {
        workspace.steps.push(completedStep);
      }
      
      if (result.type === "transform" && result.data?.transformedStreamId) {
        workspace.currentStreamId = result.data.transformedStreamId;
      }
      
      await storage.updateWorkspace(scoreId, { 
        steps: workspace.steps,
        selection,
        currentStreamId: workspace.currentStreamId,
      });

      const workflowResult = {
        ...result,
        stepId,
        timestamp: Date.now(),
        annotations: result.data?.annotations,
        exports: result.data?.exports,
      };

      return res.json(workflowResult);
    } catch (error) {
      console.error("Pipeline step run error:", error);
      return res.status(500).json({
        error: "Failed to run workflow step",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/pipeline/reset", async (req, res) => {
    try {
      const { scoreId } = req.body;

      if (!scoreId) {
        return res.status(400).json({ error: "scoreId is required" });
      }

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      const workspace = await storage.resetWorkspace(scoreId);

      return res.json({
        success: true,
        workspace: {
          scoreId: workspace?.scoreId,
          selection: workspace?.selection,
          steps: [],
          currentStreamId: null,
        },
      });
    } catch (error) {
      console.error("Pipeline reset error:", error);
      return res.status(500).json({
        error: "Failed to reset pipeline",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/pipeline/workspace/:scoreId", async (req, res) => {
    try {
      const { scoreId } = req.params;

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      let workspace = await storage.getWorkspace(scoreId);
      if (!workspace) {
        workspace = await storage.initWorkspace(scoreId);
      }

      return res.json({
        scoreId: workspace.scoreId,
        selection: workspace.selection,
        steps: workspace.steps,
        currentStreamId: workspace.currentStreamId,
        metadata: score.metadata,
        hasOriginal: true,
        hasCurrentStream: workspace.currentStreamId !== null,
        cachedSteps: workspace.steps.filter(s => s.status === "completed").map(s => s.id),
      });
    } catch (error) {
      console.error("Get workspace error:", error);
      return res.status(500).json({
        error: "Failed to get workspace",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/reduction", async (req, res) => {
    try {
      const { scoreId, startMeasure, endMeasure, partId } = req.body;

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
          "--workflow", "reduction_outer_voices",
          "--start", startMeasure.toString(),
          "--end", endMeasure.toString(),
          "--part", partId || "ALL",
        ],
        score.musicXmlData
      );

      const result = JSON.parse(stdout);

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const data = result.data || {};

      return res.json({
        scoreId,
        startMeasure,
        endMeasure,
        events: data.playbackEvents || [],
        beatsPerMeasure: data.beatsPerMeasure || 4,
        defaultTempo: data.defaultTempo || 120,
      });
    } catch (error) {
      console.error("Reduction error:", error);
      return res.status(500).json({
        error: "Failed to generate reduction data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/pipeline/export", async (req, res) => {
    try {
      const { scoreId, stepId, format, selection } = req.body;

      if (!scoreId || !format) {
        return res.status(400).json({
          error: "Missing required fields: scoreId, format",
        });
      }

      if (!["musicxml", "midi"].includes(format)) {
        return res.status(400).json({
          error: "Format must be 'musicxml' or 'midi'",
        });
      }

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      const workspace = await storage.getWorkspace(scoreId);
      const exportSelection = selection || workspace?.selection || {
        partId: "ALL",
        startMeasure: 1,
        endMeasure: score.metadata.measureCount,
      };

      const { stdout } = await runPythonWorkflow(
        "export",
        [
          "--start", exportSelection.startMeasure.toString(),
          "--end", exportSelection.endMeasure.toString(),
          "--part", exportSelection.partId || "ALL",
          "--params", JSON.stringify({ format }),
        ],
        score.musicXmlData
      );

      const result = JSON.parse(stdout);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const buffer = Buffer.from(result.data, "base64");
      
      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      return res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      return res.status(500).json({
        error: "Failed to export",
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

  app.post("/api/pipeline/activateStream", async (req, res) => {
    try {
      const { scoreId, streamId } = req.body;

      if (!scoreId) {
        return res.status(400).json({ error: "scoreId is required" });
      }

      const score = await storage.getScore(scoreId);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }

      let workspace = await storage.getWorkspace(scoreId);
      if (!workspace) {
        workspace = await storage.initWorkspace(scoreId);
      }

      if (streamId === null || streamId === "original") {
        await storage.updateWorkspace(scoreId, { currentStreamId: null });
        return res.json({
          success: true,
          activeStream: "original",
          meiData: score.meiData,
        });
      }

      const derivedXml = await storage.getDerivedStream(scoreId, streamId);
      if (!derivedXml) {
        return res.status(404).json({ error: "Derived stream not found" });
      }

      const { stdout } = await runPythonWorkflow("parse", [], derivedXml);
      const parseResult = JSON.parse(stdout);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Failed to parse derived stream",
          details: parseResult.error,
        });
      }

      await storage.updateWorkspace(scoreId, { currentStreamId: streamId });

      return res.json({
        success: true,
        activeStream: streamId,
        meiData: parseResult.meiData,
      });
    } catch (error) {
      console.error("Activate stream error:", error);
      return res.status(500).json({
        error: "Failed to activate stream",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}
