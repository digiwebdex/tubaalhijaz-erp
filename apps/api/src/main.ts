import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { setupApp } from "./setup-app";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const config = app.get(ConfigService);
  // ESP-04 — refuse to start production with the known insecure JWT default.
  const jwtSecret = config.get<string>("JWT_SECRET", "dev-secret");
  if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret === "dev-secret")) {
    throw new Error("JWT_SECRET must be set to a strong value when NODE_ENV=production");
  }
  const port = Number(config.get<string>("PORT", "3210"));
  // Bind an explicit host: a wildcard ('::') bind can be silently shadowed on
  // 127.0.0.1 by port-forwarding IDEs (seen with Cursor on this machine) —
  // an explicit bind fails loudly instead.
  const host = config.get<string>("HOST", "127.0.0.1");
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[tuba-api] listening on http://${host}:${port}`);
}
bootstrap();
