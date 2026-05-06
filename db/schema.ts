import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Auth.js required tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: text("role", { enum: ["student", "specialist", "admin"] })
    .notNull()
    .default("student"),
  locale: text("locale", { enum: ["en", "zh-Hans"] }).notNull().default("en"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ---------------------------------------------------------------------------
// Item bank
// ---------------------------------------------------------------------------

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  strand: text("strand", {
    enum: ["reading", "listening", "grammar", "writing"],
  }).notNull(),
  level: integer("level").notNull(), // 1..5
  subskill: text("subskill").notNull(),
  format: text("format", {
    enum: [
      "mc-single",
      "mc-multi",
      "cloze",
      "matching",
      "short-answer",
      "essay",
      "listening-mc",
    ],
  }).notNull(),
  payload: jsonb("payload").notNull(), // format-specific content
  status: text("status", {
    enum: ["drafted", "reviewed", "live", "retired"],
  })
    .notNull()
    .default("drafted"),
  culturalContextFlag: boolean("cultural_context_flag").notNull().default(false),
  estimatedTimeSec: integer("estimated_time_sec"),
  // calibration stats — updated by analytics job
  nAttempts: integer("n_attempts").notNull().default(0),
  pCorrect: real("p_correct"),
  pointBiserial: real("point_biserial"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Rubrics and writing prompts
// ---------------------------------------------------------------------------

export const rubrics = pgTable("rubrics", {
  id: text("id").primaryKey(),
  version: text("version").notNull(), // semver string
  traits: jsonb("traits").notNull(), // RubricTrait[]
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const prompts = pgTable("prompts", {
  id: text("id").primaryKey(),
  level: integer("level").notNull(), // 1..5
  promptTextEn: text("prompt_text_en").notNull(),
  promptTextZh: text("prompt_text_zh"),
  rubricId: text("rubric_id")
    .notNull()
    .references(() => rubrics.id),
  status: text("status", { enum: ["drafted", "reviewed", "live", "retired"] })
    .notNull()
    .default("drafted"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export const attempts = pgTable("attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
  status: text("status", {
    enum: ["in-progress", "complete", "abandoned"],
  })
    .notNull()
    .default("in-progress"),
  intakeAnswers: jsonb("intake_answers"), // IntakeAnswers
  recommendation: jsonb("recommendation"), // Recommendation (filled on complete)
  engineVersion: text("engine_version"),
  itemBankSnapshotId: text("item_bank_snapshot_id"), // hash of live item ids at attempt start
});

export const attemptItems = pgTable("attempt_items", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  strand: text("strand", {
    enum: ["reading", "listening", "grammar", "writing"],
  }).notNull(),
  stage: text("stage", { enum: ["route", "target", "confirm"] }).notNull(),
  level: integer("level").notNull(),
  presentedAt: timestamp("presented_at", { mode: "date" }).notNull(),
  response: jsonb("response"), // raw student response
  isCorrect: boolean("is_correct"),
  timeMs: integer("time_ms"),
});

export const writingResponses = pgTable("writing_responses", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  promptId: text("prompt_id")
    .notNull()
    .references(() => prompts.id),
  text: text("text").notNull(),
  scoredTraits: jsonb("scored_traits"), // { trait: string; score: number; rationale: string }[]
  scoredLevel: integer("scored_level"),
  model: text("model"),
  modelRationale: text("model_rationale"),
  rubricVersion: text("rubric_version"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Specialist overrides
// ---------------------------------------------------------------------------

export const recommendationOverrides = pgTable("recommendation_overrides", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => attempts.id),
  specialistId: text("specialist_id")
    .notNull()
    .references(() => users.id),
  original: jsonb("original").notNull(), // Recommendation
  override: jsonb("override").notNull(), // Partial<Recommendation>
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Audio assets (pre-generated TTS clips for listening items)
// ---------------------------------------------------------------------------

export const audioAssets = pgTable("audio_assets", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  voice: text("voice").notNull(),
  url: text("url").notNull(),
  durationMs: integer("duration_ms"),
  generatedAt: timestamp("generated_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const attemptRelations = relations(attempts, ({ many }) => ({
  attemptItems: many(attemptItems),
  writingResponses: many(writingResponses),
  overrides: many(recommendationOverrides),
}));

export const itemRelations = relations(items, ({ many }) => ({
  attemptItems: many(attemptItems),
  audioAssets: many(audioAssets),
}));
