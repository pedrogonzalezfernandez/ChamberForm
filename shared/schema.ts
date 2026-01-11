import { z } from "zod";

export const scoreMetadataSchema = z.object({
  scoreId: z.string(),
  title: z.string().nullable(),
  composer: z.string().nullable(),
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

export const workflowParamSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "select"]),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  default: z.any().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
});

export type WorkflowParam = z.infer<typeof workflowParamSchema>;

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["analysis", "transform"]),
  params: z.array(workflowParamSchema).optional(),
});

export type Workflow = z.infer<typeof workflowSchema>;

export const workflowListResponseSchema = z.object({
  workflows: z.array(workflowSchema),
});

export type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export const selectionSchema = z.object({
  partId: z.string().default("ALL"),
  startMeasure: z.number().min(1),
  endMeasure: z.number().min(1),
});

export type Selection = z.infer<typeof selectionSchema>;

export const measureRangeSchema = z.object({
  startMeasure: z.number().min(1),
  endMeasure: z.number().min(1),
});

export type MeasureRange = z.infer<typeof measureRangeSchema>;

export const pipelineStepSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  params: z.record(z.any()).optional(),
  result: z.any().optional(),
  status: z.enum(["pending", "running", "completed", "error"]).default("pending"),
  error: z.string().optional(),
});

export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export const pipelineStateSchema = z.object({
  scoreId: z.string(),
  selection: selectionSchema,
  steps: z.array(pipelineStepSchema),
  currentStreamId: z.string().nullable(),
});

export type PipelineState = z.infer<typeof pipelineStateSchema>;

export const runStepRequestSchema = z.object({
  scoreId: z.string(),
  stepId: z.string(),
  workflowId: z.string(),
  selection: selectionSchema,
  params: z.record(z.any()).optional(),
});

export type RunStepRequest = z.infer<typeof runStepRequestSchema>;

export const workflowResultSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  type: z.enum(["analysis", "transform"]),
  selection: selectionSchema,
  data: z.record(z.any()),
  playbackEvents: z.array(z.object({
    measure: z.number(),
    beat: z.number(),
    duration: z.number(),
    frequencies: z.array(z.number()),
    chordLabel: z.string().optional(),
  })).optional(),
  transformedStreamId: z.string().optional(),
});

export type WorkflowResult = z.infer<typeof workflowResultSchema>;

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

export const analysisResultSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  measureRange: measureRangeSchema,
  data: z.record(z.any()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
