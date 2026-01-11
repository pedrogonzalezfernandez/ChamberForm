import { z } from "zod";

export const scoreMetadataSchema = z.object({
  scoreId: z.string(),
  title: z.string().optional(),
  composer: z.string().optional(),
  parts: z.array(z.string()),
  measureCount: z.number(),
});

export type ScoreMetadata = z.infer<typeof scoreMetadataSchema>;

export const uploadResponseSchema = z.object({
  scoreId: z.string(),
  meiData: z.string(),
  metadata: scoreMetadataSchema,
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export type Workflow = z.infer<typeof workflowSchema>;

export const workflowListResponseSchema = z.object({
  workflows: z.array(workflowSchema),
});

export type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export const measureRangeSchema = z.object({
  startMeasure: z.number().min(1),
  endMeasure: z.number().min(1),
});

export type MeasureRange = z.infer<typeof measureRangeSchema>;

export const workflowRequestSchema = z.object({
  scoreId: z.string(),
  workflowId: z.string(),
  startMeasure: z.number().min(1),
  endMeasure: z.number().min(1),
});

export type WorkflowRequest = z.infer<typeof workflowRequestSchema>;

export const analysisResultSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  measureRange: measureRangeSchema,
  data: z.record(z.any()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const playbackEventSchema = z.object({
  measure: z.number(),
  beat: z.number(),
  duration: z.number(),
  frequencies: z.array(z.number()),
  chordLabel: z.string().optional(),
});

export type PlaybackEvent = z.infer<typeof playbackEventSchema>;

export const reductionDataSchema = z.object({
  scoreId: z.string(),
  startMeasure: z.number(),
  endMeasure: z.number(),
  events: z.array(playbackEventSchema),
  beatsPerMeasure: z.number(),
  defaultTempo: z.number(),
});

export type ReductionData = z.infer<typeof reductionDataSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
