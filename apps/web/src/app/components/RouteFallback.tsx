/**
 * ESP-03 — lightweight Suspense fallback for lazy route chunks.
 * Reuses existing LoadingSkeleton — no new UI dialect.
 */
import { LoadingSkeleton } from "./States";

export function RouteFallback({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-6 md:p-7 min-h-[40vh]" role="status" aria-live="polite" aria-busy="true">
      <LoadingSkeleton tone="light" rows={rows} />
    </div>
  );
}
