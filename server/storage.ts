import { randomUUID } from "crypto";
import type { ScoreMetadata, Selection, PipelineStep } from "@shared/schema";

export interface StoredScore {
  id: string;
  originalFilename: string;
  musicXmlData: string;
  meiData: string;
  metadata: ScoreMetadata;
}

export interface WorkspaceState {
  scoreId: string;
  selection: Selection;
  steps: PipelineStep[];
  currentStreamId: string | null;
  derivedStreams: Map<string, string>;
}

export interface IStorage {
  saveScore(filename: string, musicXmlData: string, meiData: string, metadata: Omit<ScoreMetadata, "scoreId">): Promise<StoredScore>;
  getScore(id: string): Promise<StoredScore | undefined>;
  deleteScore(id: string): Promise<boolean>;
  
  getWorkspace(scoreId: string): Promise<WorkspaceState | undefined>;
  initWorkspace(scoreId: string): Promise<WorkspaceState>;
  updateWorkspace(scoreId: string, updates: Partial<WorkspaceState>): Promise<WorkspaceState | undefined>;
  resetWorkspace(scoreId: string): Promise<WorkspaceState | undefined>;
  
  addDerivedStream(scoreId: string, streamId: string, musicXmlData: string): Promise<void>;
  getDerivedStream(scoreId: string, streamId: string): Promise<string | undefined>;
}

export class MemStorage implements IStorage {
  private scores: Map<string, StoredScore>;
  private workspaces: Map<string, WorkspaceState>;

  constructor() {
    this.scores = new Map();
    this.workspaces = new Map();
  }

  async saveScore(
    filename: string,
    musicXmlData: string,
    meiData: string,
    metadata: Omit<ScoreMetadata, "scoreId">
  ): Promise<StoredScore> {
    const id = randomUUID();
    const score: StoredScore = {
      id,
      originalFilename: filename,
      musicXmlData,
      meiData,
      metadata: { ...metadata, scoreId: id },
    };
    this.scores.set(id, score);
    
    await this.initWorkspace(id);
    
    return score;
  }

  async getScore(id: string): Promise<StoredScore | undefined> {
    return this.scores.get(id);
  }

  async deleteScore(id: string): Promise<boolean> {
    this.workspaces.delete(id);
    return this.scores.delete(id);
  }

  async getWorkspace(scoreId: string): Promise<WorkspaceState | undefined> {
    return this.workspaces.get(scoreId);
  }

  async initWorkspace(scoreId: string): Promise<WorkspaceState> {
    const score = this.scores.get(scoreId);
    const measureCount = score?.metadata.measureCount || 1;
    
    const workspace: WorkspaceState = {
      scoreId,
      selection: {
        partId: "ALL",
        startMeasure: 1,
        endMeasure: measureCount,
      },
      steps: [],
      currentStreamId: null,
      derivedStreams: new Map(),
    };
    
    this.workspaces.set(scoreId, workspace);
    return workspace;
  }

  async updateWorkspace(scoreId: string, updates: Partial<WorkspaceState>): Promise<WorkspaceState | undefined> {
    const workspace = this.workspaces.get(scoreId);
    if (!workspace) return undefined;
    
    Object.assign(workspace, updates);
    return workspace;
  }

  async resetWorkspace(scoreId: string): Promise<WorkspaceState | undefined> {
    const score = this.scores.get(scoreId);
    if (!score) return undefined;
    
    const workspace = this.workspaces.get(scoreId);
    if (!workspace) return this.initWorkspace(scoreId);
    
    workspace.selection = {
      partId: "ALL",
      startMeasure: 1,
      endMeasure: score.metadata.measureCount,
    };
    workspace.steps = [];
    workspace.currentStreamId = null;
    workspace.derivedStreams.clear();
    
    return workspace;
  }

  async addDerivedStream(scoreId: string, streamId: string, musicXmlData: string): Promise<void> {
    const workspace = this.workspaces.get(scoreId);
    if (workspace) {
      workspace.derivedStreams.set(streamId, musicXmlData);
    }
  }

  async getDerivedStream(scoreId: string, streamId: string): Promise<string | undefined> {
    const workspace = this.workspaces.get(scoreId);
    return workspace?.derivedStreams.get(streamId);
  }
}

export const storage = new MemStorage();
