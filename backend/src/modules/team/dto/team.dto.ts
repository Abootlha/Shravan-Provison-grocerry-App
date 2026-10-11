import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

export const TEAM_ROLES = [UserRole.ADMIN, UserRole.MANAGER] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const MIN_STAFF_PASSWORD_LENGTH = 12;

export class CreateTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** 3-50 chars: letters, digits, dot, dash, underscore. */
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, {
    message: 'username must be 3-50 letters, digits, ".", "-" or "_"',
  })
  username!: string;

  @IsString()
  @MinLength(MIN_STAFF_PASSWORD_LENGTH)
  @MaxLength(128)
  password!: string;

  @IsIn(TEAM_ROLES)
  role!: TeamRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(TEAM_ROLES)
  role?: TeamRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Resets the password and signs the member out everywhere. */
  @IsOptional()
  @IsString()
  @MinLength(MIN_STAFF_PASSWORD_LENGTH)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
