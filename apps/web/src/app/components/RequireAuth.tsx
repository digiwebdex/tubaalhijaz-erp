import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { isLoggedIn } from "../lib/api";
import { canAccessPath, homePathForUser } from "../lib/rbac";

/**
 * Gate for private ERP/portal routes.
 * - Unauthenticated → /login
 * - Authenticated but lacking UX permission for this path → homePathForUser()
 *
 * This is NOT authorization. Backend permissions remain the only security boundary.
 */
export function RequireAuth({
  children,
  path,
}: {
  children: ReactNode;
  /** Route path to check (e.g. "/ops-control"). Defaults to allowing any logged-in user. */
  path?: string;
}) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (path && !canAccessPath(path)) {
    return <Navigate to={homePathForUser()} replace />;
  }
  return <>{children}</>;
}
