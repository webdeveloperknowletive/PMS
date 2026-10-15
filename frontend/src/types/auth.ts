/** Body for POST /auth/login — sent as x-www-form-urlencoded (OAuth2PasswordRequestForm). */
export interface LoginRequest {
  username: string; // this is the user's email — OAuth2PasswordRequestForm names it "username"
  password: string;
  workspace_slug?: string;
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

/** Public owner signup creates a company workspace as well as the first account. */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  organization_name: string;
  workspace_slug: string;
  accepted_terms: boolean;
}

export interface RegisterResponse {
  user_id: string;
  organization: { organization_id: string; name: string; slug: string; status: string; plan_code: string; created_at: string };
  verification_required: boolean;
  verification_email_sent: boolean;
  verification_url?: string | null;
}

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
