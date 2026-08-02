import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { tenantContext } from "../tenant-context";

/** Opens an empty AsyncLocalStorage store around every request. */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    tenantContext.run({}, () => next());
  }
}
