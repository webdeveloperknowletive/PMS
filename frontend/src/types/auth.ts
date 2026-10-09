import type { User } from "./user";

/** Body for POST /auth/login — sent as x-www-form-urlencoded (OAuth2PasswordRequestForm). */
export interface LoginRequest {
  username: string; // this is the user's email — OAuth2PasswordRequestForm names it "username"
  password: string;
}

/** Response from POST /auth/login */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

/** Response from POST /auth/refresh-token */
export interface RefreshTokenResponse {
  access_token: string;
  token_type: "bearer";
}

/** Body for POST /auth/register — reuses users.schema.UserCreate */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  is_active?: boolean;
}

/** Response from POST /auth/register — reuses users.schema.UserRead */
export type RegisterResponse = User;

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface SimpleMessageResponse {
  success: boolean;
  message: string;
  reset_token?: string; // only present until a real mail service is wired up server-side
}
