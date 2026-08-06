import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthUser } from "../common/decorators/current-user.decorator";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
  companyType: "AGENT" | "SUPPLIER" | null;
  impersonatorSub?: string;
  impersonatorEmail?: string;
  impersonationSessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "dev-secret"),
    });
  }

  // Return value becomes req.user
  validate(payload: JwtPayload): AuthUser {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
      companyType: payload.companyType ?? null,
      impersonatorSub: payload.impersonatorSub,
      impersonatorEmail: payload.impersonatorEmail,
      impersonationSessionId: payload.impersonationSessionId,
    };
  }
}
