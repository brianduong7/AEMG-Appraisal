import type { Appraisal } from "./types";
import { findMockUser, type MockUser } from "./mock-users";

export type SessionModeForDisplay = "employee" | "manager" | "hr";

/**
 * List row label: prefer directory profile over stored `employeeName`, which can
 * lag (e.g. old seed "John") until the next save.
 */
export function appraisalListDisplayName(
  a: Appraisal,
  mode: SessionModeForDisplay,
  user: MockUser | null
): string {
  if (mode === "employee" && user && a.ownerUserId === user.id) {
    return user.englishName || user.employeeName;
  }
  const fromDirectory = findMockUser(a.ownerUserId);
  if (fromDirectory) return fromDirectory.englishName || fromDirectory.employeeName;
  return a.englishName?.trim() || a.employeeName || "Appraisal";
}

/**
 * The five real AEMG Group brands. One hex per brand (as specced from the
 * style guide + logo files) - deliberately a single accent color each, not
 * a primary/secondary pair, to keep this one clean signal rather than a
 * second color system layered on top of the app's own navy/gold palette.
 *
 * AIFE is deliberately absent from ENTITY_ACCENT_HEX: the app's existing
 * default look (navy hero, gold accents, everywhere already) already IS
 * AIFE's brand (#192844 navy / #D4A138 gold) - so "AIFE" resolves to no
 * override at all. Anyone whose entity doesn't positively match one of the
 * other four brands (including AIFE itself, unset, or an unrecognized
 * legacy value) gets the same unchanged default.
 */
export type BrandEntity = "AEMG" | "AOSC" | "Cloudcampus" | "W&E Health";

export const ENTITY_ACCENT_HEX: Record<BrandEntity, string> = {
  AEMG: "#F19608",
  AOSC: "#FF751F",
  Cloudcampus: "#00A0D5",
  "W&E Health": "#009FE3",
};

/**
 * Raw entity values as they actually arrive from ERPNext's `identity.entity`
 * (see aemg_epm_frappe/api/identity.py): either the AEMG Portal sync's raw
 * brand string on `custom_entity` (real employees - "AIFE" / "Auchin" /
 * "W&E HQ Operations"), or our own `aemg_entity` field's legacy demo-roster
 * vocabulary (HQ Corporate Services / AFE / etc., dev/demo data only).
 * Confirmed against real prod data 2026-08-17 - these are the only values
 * that exist; nothing maps to Cloudcampus today (zero real employees), kept
 * here so it activates automatically the moment one exists.
 */
function brandEntity(entity: string | null | undefined): BrandEntity | null {
  const e = (entity ?? "").trim();
  if (e === "Auchin" || e === "AOSC") return "AOSC";
  if (e === "W&E HQ Operations" || e === "W&E Health") return "W&E Health";
  if (e === "Cloudcampus") return "Cloudcampus";
  if (e === "AEMG") return "AEMG";
  return null; // AIFE, unset, or unrecognized -> default (AIFE) look
}

/**
 * The one solid hex to recolor the app's main navy surfaces with (header
 * bar, hero banner, sidebar drawer) for the four non-AIFE brands. No
 * gradient anywhere - every one of these surfaces is already a flat solid
 * color (`--aife-blue` / `bg-navy-900`), and this only swaps that single
 * color out; nothing about the layout, spacing, or gold accent text changes.
 * Returns null for AIFE (or unset/unrecognized), meaning "don't override" -
 * the existing default stays genuinely untouched, not just similar.
 */
export function entityBrandColor(
  entity: string | null | undefined
): string | null {
  const brand = brandEntity(entity);
  return brand ? ENTITY_ACCENT_HEX[brand] : null;
}
