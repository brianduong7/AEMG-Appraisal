import type { Appraisal } from "./types";

export function cloneAppraisal(a: Appraisal): Appraisal {
  return structuredClone(a);
}
