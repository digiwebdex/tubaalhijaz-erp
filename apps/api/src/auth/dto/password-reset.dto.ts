import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(160) email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
