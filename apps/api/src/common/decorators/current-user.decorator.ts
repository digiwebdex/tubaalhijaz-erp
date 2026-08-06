import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
  companyType: "AGENT" | "SUPPLIER" | null;
  impersonatorSub?: string;
  impersonatorEmail?: string;
  impersonationSessionId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest().user,
);
