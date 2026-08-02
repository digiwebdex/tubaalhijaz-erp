import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "requiredPermissions";
/**
 * Gate a route on permission keys (rows in the Permission table).
 * Checked against the caller's role→permission rows in the DB, so
 * Super Admin can re-assign permissions without a deploy.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
