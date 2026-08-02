import { Controller, Get, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { registry } from "./metrics";

/**
 * Prometheus scrape endpoint. No JWT + un-throttled for scrapers on the docker
 * network (`http://api:3210/metrics` — see infra/monitoring/prometheus.yml).
 * Public edge blocks `/api/metrics` (S1-04, infra/nginx/tubaalhijaz.com.conf);
 * the API process itself is loopback-bound on the host.
 */
@Controller()
export class MetricsController {
  @Public()
  @SkipThrottle()
  @Get("metrics")
  async metrics(@Res() res: Response) {
    res.setHeader("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  }
}
