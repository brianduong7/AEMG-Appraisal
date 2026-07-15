import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_REVIEW_WINDOWS,
  type ReviewWindowSettings,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "settings.json");

const USE_MEMORY_STORE =
  process.env.APPRAISAL_STORE === "memory" ||
  (process.env.APPRAISAL_STORE !== "file" &&
    process.env.NODE_ENV !== "development");

let memorySettings: ReviewWindowSettings | null = null;

function normalize(raw: unknown): ReviewWindowSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    kpiSubmissionOpen:
      typeof o.kpiSubmissionOpen === "boolean"
        ? o.kpiSubmissionOpen
        : DEFAULT_REVIEW_WINDOWS.kpiSubmissionOpen,
    midYearReviewOpen:
      typeof o.midYearReviewOpen === "boolean"
        ? o.midYearReviewOpen
        : DEFAULT_REVIEW_WINDOWS.midYearReviewOpen,
    annualReviewOpen:
      typeof o.annualReviewOpen === "boolean"
        ? o.annualReviewOpen
        : DEFAULT_REVIEW_WINDOWS.annualReviewOpen,
  };
}

async function readFile(): Promise<ReviewWindowSettings> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    const defaults = { ...DEFAULT_REVIEW_WINDOWS };
    await fs.writeFile(DATA_FILE, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }
}

export async function getReviewWindows(): Promise<ReviewWindowSettings> {
  if (USE_MEMORY_STORE) {
    if (!memorySettings) {
      memorySettings = { ...DEFAULT_REVIEW_WINDOWS };
    }
    return { ...memorySettings };
  }
  return readFile();
}

export async function updateReviewWindows(
  patch: Partial<ReviewWindowSettings>
): Promise<ReviewWindowSettings> {
  const current = await getReviewWindows();
  const next = normalize({ ...current, ...patch });
  if (USE_MEMORY_STORE) {
    memorySettings = next;
    return { ...next };
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
