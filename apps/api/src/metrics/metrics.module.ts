import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";

/** Prometheus metrics (Phase 18). The recording interceptor is registered
 *  globally in AppModule; this module exposes the scrape endpoint. */
@Module({ controllers: [MetricsController] })
export class MetricsModule {}
