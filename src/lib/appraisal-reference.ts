/**
 * The HR-APR-* reference shown to users and exported in the HR report.
 *
 * Historically this was a HASH of the local record's UUID: the store had no
 * meaningful identifier to show, so one was invented that at least stayed
 * stable per record. That was a reasonable stand-in while the app owned the
 * data.
 *
 * Once ERPNext is the store the record already HAS a real reference, and it
 * is the one printed on the ERPNext document. Continuing to hash it into a
 * different-looking number would be worse than the original workaround: two
 * plausible "HR-APR-2026-xxxxx" strings for the same appraisal, neither
 * matching the other, and HR unable to cross-reference the two systems for
 * the one record they are looking at.
 *
 * So: if the id already IS an ERPNext reference, show it. Otherwise fall
 * back to the hash, unchanged, so anything still on a local UUID keeps the
 * reference it has always displayed.
 */

const ERPNEXT_REFERENCE = /^HR-APR-\d{4}-\d+$/;

export function appraisalReference(id: string, cycleYear: number): string {
  if (ERPNEXT_REFERENCE.test(id)) return id;

  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0;
  }
  const seq = (h % 99_998) + 1;
  return `HR-APR-${cycleYear}-${String(seq).padStart(5, "0")}`;
}
