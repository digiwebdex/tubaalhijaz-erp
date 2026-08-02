import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { Request, Response } from "express";

/**
 * Structured request logging: method, path, status, duration, and the acting
 * user (once auth has run). Skips non-HTTP contexts (WebSocket frames).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger("HTTP");

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;
    const started = Date.now();

    const emit = () => {
      const res = ctx.switchToHttp().getResponse<Response>();
      const ms = Date.now() - started;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const line = `${method} ${originalUrl} ${res.statusCode} ${ms}ms${userId ? ` user=${userId}` : ""}`;
      // 5xx as error, 4xx as warn, else info
      if (res.statusCode >= 500) this.log.error(line);
      else if (res.statusCode >= 400) this.log.warn(line);
      else this.log.log(line);
    };

    return next.handle().pipe(tap({ next: emit, error: emit }));
  }
}
