// ─── TUBA AL HIJAZ · Bilingual UI Strings ────────────────────────────────────
// The i18n implementation now lives in packages/shared (@tuba/shared) so the
// backend can reuse the same STRINGS/Lang system for PDF documents and
// notification templates.
//
// This file re-exports everything so all existing relative imports
// (e.g. `import { t, type Lang } from "../lib/i18n"`) keep working unchanged.

export * from "@tuba/shared";
