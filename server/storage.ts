import { randomUUID } from "crypto";
import type { ScoreMetadata } from "@shared/schema";

export interface StoredScore {
  id: string;
  originalFilename: string;
  musicXmlData: string;
  meiData: string;
  metadata: ScoreMetadata;
}

export interface IStorage {
  saveScore(filename: string, musicXmlData: string, meiData: string, metadata: Omit<ScoreMetadata, "scoreId">): Promise<StoredScore>;
  getScore(id: string): Promise<StoredScore | undefined>;
  deleteScore(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private scores: Map<string, StoredScore>;

  constructor() {
    this.scores = new Map();
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
    return score;
  }

  async getScore(id: string): Promise<StoredScore | undefined> {
    return this.scores.get(id);
  }

  async deleteScore(id: string): Promise<boolean> {
    return this.scores.delete(id);
  }
}

export const storage = new MemStorage();
