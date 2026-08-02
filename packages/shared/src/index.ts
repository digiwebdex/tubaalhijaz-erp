// ─── @tuba/shared ─────────────────────────────────────────────────────────────
// Shared between apps/web (Vite React) and apps/api (NestJS):
//   - i18n: the bilingual STRINGS table (Bengali default / English alternate),
//     Lang type, t(), numeral/date/currency formatters. The backend uses these
//     for PDF documents and notification templates.
//   - types: shared API contract types (grows in the schema/API design phase).

export * from "./i18n";
export * from "./types";
export * from "./notifications";
