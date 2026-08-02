import { Controller, Get } from "@nestjs/common";
import { STRINGS, type ApiHealthResponse } from "@tuba/shared";
import { Public } from "../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health(): ApiHealthResponse & { i18nKeys: number } {
    return {
      status: "ok",
      service: "tuba-api",
      time: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      // Proof that the backend shares the bilingual STRINGS system from @tuba/shared
      i18nKeys: Object.keys(STRINGS).length,
    };
  }
}
