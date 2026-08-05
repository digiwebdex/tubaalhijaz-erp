import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { IntegrationsService, type WaSaveDto } from "./integrations.service";

class SaveDto {
  @IsOptional() @IsString() @MaxLength(200) apiUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(6) defaultCountry?: string;
  @IsOptional() @IsString() @MaxLength(200) apiKey?: string;
}
class TestDto { @IsOptional() @IsString() @MaxLength(20) phone?: string }

/** Administration → Integrations → WaSender API. Staff-gated. */
@Controller("admin/integrations")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get("wasender") get() { return this.svc.getWaSender(); }
  @Put("wasender") save(@Body() dto: SaveDto) { return this.svc.saveWaSender(dto as WaSaveDto); }
  @Post("wasender/test") test(@Body() dto: TestDto) { return this.svc.test(dto?.phone); }
}
