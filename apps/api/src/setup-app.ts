import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { tenantContext } from "./common/tenant-context";

/** T001-05 — Mutamer Excel preview/commit JSON (≤1000 rows) needs > default 100kb. */
const JSON_BODY_LIMIT = "15mb";

/**
 * Shared app wiring used by BOTH main.ts and the e2e tests, so the test app
 * behaves exactly like production (ALS tenant context, cookies, validation, CORS).
 */
export function setupApp(app: INestApplication) {
  // Raise JSON/urlencoded limits for enterprise Mutamer import payloads.
  const expressApp = app as NestExpressApplication;
  if (typeof expressApp.useBodyParser === "function") {
    expressApp.useBodyParser("json", { limit: JSON_BODY_LIMIT });
    expressApp.useBodyParser("urlencoded", { limit: JSON_BODY_LIMIT, extended: true });
  }

  // Per-request AsyncLocalStorage store — read by the Prisma tenant-scoping extension.
  app.use((_req: unknown, _res: unknown, next: () => void) => {
    tenantContext.run({}, () => next());
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = app.get(ConfigService);
  app.enableCors({
    origin: config.get<string>("CORS_ORIGIN", "http://localhost:5173").split(","),
    credentials: true,
  });

  return app;
}
