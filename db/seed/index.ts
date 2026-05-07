/**
 * Seed script — run with: pnpm db:seed
 * Idempotent: re-running updates existing items by id, does not duplicate.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { items, prompts, rubrics } from "../schema";
import { ItemSchema } from "../../src/server/schemas/items";

// Must have DATABASE_URL in environment
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

function readJson<T>(filename: string): T[] {
  const path = join(__dirname, filename);
  return JSON.parse(readFileSync(path, "utf-8")) as T[];
}

async function seedItems(filename: string): Promise<void> {
  const raw = readJson<unknown>(filename);
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const rawItem of raw) {
    const result = ItemSchema.safeParse(rawItem);
    if (!result.success) {
      console.error(
        `\n✗ Invalid item in ${filename}:`,
        JSON.stringify((rawItem as { id?: string }).id),
        "\n",
        result.error.flatten()
      );
      failed++;
      continue;
    }

    const item = result.data;
    const existing = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, item.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(items)
        .set({
          strand: item.strand,
          level: item.level,
          subskill: item.subskill,
          format: item.format,
          payload: item.payload,
          status: item.status,
          culturalContextFlag: item.culturalContextFlag,
          estimatedTimeSec: item.estimatedTimeSec,
          updatedAt: new Date(),
        })
        .where(eq(items.id, item.id));
      updated++;
    } else {
      await db.insert(items).values({
        id: item.id,
        strand: item.strand,
        level: item.level,
        subskill: item.subskill,
        format: item.format,
        payload: item.payload,
        status: item.status,
        culturalContextFlag: item.culturalContextFlag,
        estimatedTimeSec: item.estimatedTimeSec,
      });
      inserted++;
    }
  }

  console.log(
    `${filename}: ${inserted} inserted, ${updated} updated, ${failed} failed`
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function seedWritingPrompts(): Promise<void> {
  const raw = readJson<{
    id: string;
    level: number;
    promptTextEn: string;
    promptTextZh?: string;
    status: "drafted" | "reviewed" | "live" | "retired";
  }>("writing-prompts.json");

  // Ensure a default rubric exists
  const defaultRubricId = "rubric-v1";
  const existingRubric = await db
    .select({ id: rubrics.id })
    .from(rubrics)
    .where(eq(rubrics.id, defaultRubricId))
    .limit(1);

  if (existingRubric.length === 0) {
    await db.insert(rubrics).values({
      id: defaultRubricId,
      version: "1.0.0",
      traits: [
        { name: "taskFulfillment", label: "Task Fulfillment", weight: 1 },
        { name: "linguisticRange", label: "Linguistic Range", weight: 1 },
        { name: "linguisticAccuracy", label: "Linguistic Accuracy", weight: 1 },
        { name: "coherence", label: "Coherence", weight: 1 },
      ],
    });
    console.log("rubric: default rubric inserted");
  }

  let inserted = 0;
  let updated = 0;

  for (const p of raw) {
    const existing = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(eq(prompts.id, p.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(prompts)
        .set({
          level: p.level,
          promptTextEn: p.promptTextEn,
          promptTextZh: p.promptTextZh,
          status: p.status,
        })
        .where(eq(prompts.id, p.id));
      updated++;
    } else {
      await db.insert(prompts).values({
        id: p.id,
        level: p.level,
        promptTextEn: p.promptTextEn,
        promptTextZh: p.promptTextZh ?? null,
        rubricId: defaultRubricId,
        status: p.status,
      });
      inserted++;
    }
  }

  console.log(`writing-prompts.json: ${inserted} inserted, ${updated} updated`);
}

async function main(): Promise<void> {
  console.log("Seeding database...\n");
  // Seed rubric first so essay items can reference it
  await seedWritingPrompts(); // also creates rubric-v1
  await seedItems("reading.json");
  await seedItems("grammar.json");
  await seedItems("listening.json");
  await seedItems("writing.json");
  console.log("\nDone.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
