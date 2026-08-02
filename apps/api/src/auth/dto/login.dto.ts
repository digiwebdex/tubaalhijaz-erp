import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  /** Which portal tab initiated the login (UI: agent | supplier | admin). */
  @IsOptional()
  @IsIn(["agent", "supplier", "admin"])
  portal?: "agent" | "supplier" | "admin";
}
