import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthService, RequestMeta } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterAgentDto } from "./dto/register-agent.dto";
import { RegisterSupplierDto } from "./dto/register-supplier.dto";

const REFRESH_COOKIE = "tuba_rt";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private meta(req: Request): RequestMeta {
    return { ip: req.ip, userAgent: req.headers["user-agent"] };
  }

  /**
   * Cookie Path must match the browser URL, not the Nest mount path.
   * Direct API (`http://127.0.0.1:3210/auth/...`) → `/auth`.
   * Nginx prefix (`https://host/api/auth/...` → strips to `/auth`) → `/api/auth`
   * via REFRESH_COOKIE_PATH (see infra/.env). Wrong Path ⇒ refresh cookie never sent.
   */
  private refreshCookiePath(): string {
    return this.config.get<string>("REFRESH_COOKIE_PATH", "/auth");
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get("COOKIE_SECURE", "false") === "true",
      sameSite: "lax",
      path: this.refreshCookiePath(),
      maxAge: Number(this.config.get("JWT_REFRESH_EXPIRES_DAYS", "14")) * 86_400_000,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // brute-force protection
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.auth.login(dto, this.meta(req));
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register/agent")
  async registerAgent(@Body() dto: RegisterAgentDto, @Req() req: Request) {
    return this.auth.registerAgent(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register/supplier")
  async registerSupplier(@Body() dto: RegisterSupplierDto, @Req() req: Request) {
    return this.auth.registerSupplier(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies ?? {})[REFRESH_COOKIE] as string | undefined;
    const { accessToken, refreshToken, user } = await this.auth.refresh(raw, this.meta(req));
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req.cookies ?? {})[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: this.refreshCookiePath() });
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }
}
