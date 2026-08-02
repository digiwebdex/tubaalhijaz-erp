import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { Request, Response } from "express";
import { httpDuration, httpErrors } from "./metrics";

/** Records request duration + 5xx counts. Route label uses the matched pattern
 *  (e.g. /finance/invoices/:id), not the raw path, to keep cardinality bounded. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const stop = httpDuration.startTimer();
    const record = () => {
      const res = ctx.switchToHttp().getResponse<Response>();
      const route = (req.route as { path?: string } | undefined)?.path ?? "unmatched";
      stop({ method: req.method, route, status_code: res.statusCode });
      if (res.statusCode >= 500) httpErrors.inc({ method: req.method, route });
    };
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
