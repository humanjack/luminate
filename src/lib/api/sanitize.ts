/**
 * Allow-list sanitizers for the PATCH/update routes.
 *
 * These exist because several routes used to spread the raw request body into
 * a Drizzle `.set(...)` (`db.update(...).set({ ...body })`), which let a client
 * write arbitrary columns — overwrite the primary `id`, forge `createdAt`, or
 * smuggle a `status` outside the schema enum. Each function returns ONLY the
 * fields a client is allowed to change, validated against the schema enums, and
 * throws {@link ApiValidationError} (→ 400) on an invalid value. `id`,
 * `projectId`, `createdAt`, and `updatedAt` are never accepted from the client.
 */

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}

const PROJECT_STATUS = ["draft", "in_progress", "completed"] as const;
const RESEARCH_DEPTH = ["quick", "detailed", "comprehensive"] as const;
const CONTENT_FORMAT = ["presentation", "tutorial", "explainer"] as const;

// Mirror the JSON column shapes declared in src/lib/db/schema.ts so the
// returned objects type-check against Drizzle's `.set(...)`.
type ResearchSource = { title: string; url: string; snippet?: string };
type OutlineEntry = { title: string; points: string[] };

type Obj = Record<string, unknown>;

/** Coerce an unknown JSON body into a plain object (null/array/primitive → {}). */
function asObject(body: unknown): Obj {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Obj)
    : {};
}

function requireString(value: unknown, field: string, { trim = false } = {}): string {
  if (typeof value !== "string") {
    throw new ApiValidationError(`${field} must be a string`);
  }
  const out = trim ? value.trim() : value;
  if (trim && out.length === 0) {
    throw new ApiValidationError(`${field} must not be empty`);
  }
  return out;
}

function requireIntInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiValidationError(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requireEnum<T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ApiValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

export interface ProjectUpdateFields {
  name?: string;
  currentStep?: number;
  status?: (typeof PROJECT_STATUS)[number];
}

/** Fields a client may change on a project via PATCH /api/projects/[id]. */
export function projectUpdateFields(body: unknown): ProjectUpdateFields {
  const b = asObject(body);
  const out: ProjectUpdateFields = {};
  if ("name" in b) out.name = requireString(b.name, "name", { trim: true });
  if ("currentStep" in b) out.currentStep = requireIntInRange(b.currentStep, "currentStep", 1, 7);
  if ("status" in b) out.status = requireEnum(b.status, "status", PROJECT_STATUS);
  return out;
}

export interface ResearchUpdateFields {
  topic?: string;
  depth?: (typeof RESEARCH_DEPTH)[number];
  content?: string;
  sources?: ResearchSource[] | null;
}

/** Fields a client may change on existing research data. */
export function researchUpdateFields(body: unknown): ResearchUpdateFields {
  const b = asObject(body);
  const out: ResearchUpdateFields = {};
  if ("topic" in b) out.topic = requireString(b.topic, "topic");
  if ("depth" in b) out.depth = requireEnum(b.depth, "depth", RESEARCH_DEPTH);
  if ("content" in b) out.content = requireString(b.content, "content");
  if ("sources" in b) {
    if (b.sources !== null && !Array.isArray(b.sources)) {
      throw new ApiValidationError("sources must be an array or null");
    }
    out.sources = b.sources as ResearchSource[] | null;
  }
  return out;
}

export interface ContentUpdateFields {
  title?: string;
  format?: (typeof CONTENT_FORMAT)[number];
  targetLength?: number;
  outline?: OutlineEntry[] | null;
  markdown?: string;
}

/** Fields a client may change on existing content data. */
export function contentUpdateFields(body: unknown): ContentUpdateFields {
  const b = asObject(body);
  const out: ContentUpdateFields = {};
  if ("title" in b) out.title = requireString(b.title, "title");
  if ("format" in b) out.format = requireEnum(b.format, "format", CONTENT_FORMAT);
  if ("targetLength" in b) out.targetLength = requireIntInRange(b.targetLength, "targetLength", 1, 600);
  if ("outline" in b) {
    if (b.outline !== null && !Array.isArray(b.outline)) {
      throw new ApiValidationError("outline must be an array or null");
    }
    out.outline = b.outline as OutlineEntry[] | null;
  }
  if ("markdown" in b) out.markdown = requireString(b.markdown, "markdown");
  return out;
}
