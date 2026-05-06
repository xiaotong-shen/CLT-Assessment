import { z } from "zod";

// ---------------------------------------------------------------------------
// Per-format payload schemas
// ---------------------------------------------------------------------------

const McOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

export const McSinglePayloadSchema = z.object({
  passage: z.string().optional(), // reading text / image description
  audioAssetId: z.string().optional(), // for listening-mc items
  stem: z.string().min(1),
  options: z.array(McOptionSchema).min(2).max(6),
  correctOptionId: z.string(),
});

export const McMultiPayloadSchema = z.object({
  passage: z.string().optional(),
  stem: z.string().min(1),
  options: z.array(McOptionSchema).min(2).max(8),
  correctOptionIds: z.array(z.string()).min(1),
});

export const ClozePayloadSchema = z.object({
  // Template with {{BLANK_n}} placeholders
  template: z.string().min(1),
  blanks: z.array(
    z.object({
      id: z.string(),
      correctAnswer: z.string(),
      acceptableVariants: z.array(z.string()).default([]),
    })
  ),
});

export const ListeningMcPayloadSchema = z.object({
  audioAssetId: z.string().min(1),
  transcript: z.string().optional(), // for review UI only, never shown to students
  stem: z.string().min(1),
  options: z.array(McOptionSchema).min(2).max(6),
  correctOptionId: z.string(),
});

export const EssayPayloadSchema = z.object({
  promptText: z.string().min(1),
  minWords: z.number().int().positive().default(50),
  maxWords: z.number().int().positive().default(300),
  rubricId: z.string(),
});

// ---------------------------------------------------------------------------
// Full item schema (union dispatched on format)
// ---------------------------------------------------------------------------

const BaseItemSchema = z.object({
  id: z.string().min(1),
  strand: z.enum(["reading", "listening", "grammar", "writing"]),
  level: z.number().int().min(1).max(5),
  subskill: z.string().min(1),
  status: z.enum(["drafted", "reviewed", "live", "retired"]).default("drafted"),
  culturalContextFlag: z.boolean().default(false),
  estimatedTimeSec: z.number().int().positive().optional(),
});

export const ItemSchema = z.discriminatedUnion("format", [
  BaseItemSchema.extend({ format: z.literal("mc-single"), payload: McSinglePayloadSchema }),
  BaseItemSchema.extend({ format: z.literal("mc-multi"), payload: McMultiPayloadSchema }),
  BaseItemSchema.extend({ format: z.literal("cloze"), payload: ClozePayloadSchema }),
  BaseItemSchema.extend({ format: z.literal("listening-mc"), payload: ListeningMcPayloadSchema }),
  BaseItemSchema.extend({ format: z.literal("essay"), payload: EssayPayloadSchema }),
]);

export type Item = z.infer<typeof ItemSchema>;

// Client-safe item payload — strips answer keys
export const ClientItemSchema = z.discriminatedUnion("format", [
  BaseItemSchema.extend({
    format: z.literal("mc-single"),
    payload: McSinglePayloadSchema.omit({ correctOptionId: true }),
  }),
  BaseItemSchema.extend({
    format: z.literal("mc-multi"),
    payload: McMultiPayloadSchema.omit({ correctOptionIds: true }),
  }),
  BaseItemSchema.extend({
    format: z.literal("cloze"),
    payload: ClozePayloadSchema.omit({ blanks: true }).extend({
      blanks: z.array(z.object({ id: z.string() })),
    }),
  }),
  BaseItemSchema.extend({
    format: z.literal("listening-mc"),
    payload: ListeningMcPayloadSchema
      .omit({ correctOptionId: true, transcript: true }),
  }),
  BaseItemSchema.extend({
    format: z.literal("essay"),
    payload: EssayPayloadSchema,
  }),
]);

export type ClientItem = z.infer<typeof ClientItemSchema>;
