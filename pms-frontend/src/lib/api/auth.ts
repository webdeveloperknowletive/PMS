import { apiClient } from "./client";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  SimpleMessageResponse,
  VerifyEmailRequest,
} from "@/types/auth";
import type { User } from "@/types/user";

export const authApi = {
  /**
   * POST /auth/login
   * The backend uses FastAPI's OAuth2PasswordRequestForm, which requires
   * application/x-www-form-urlencoded, NOT JSON — hence URLSearchParams here.
   */
  login: async ({ username, password }: LoginRequest): Promise<LoginResponse> => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const { data } = await apiClient.post<LoginResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  register: async (payload: RegisterRequest): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<RegisterResponse>("/auth/register", payload);
    return data;
  },

  logout: async (): Promise<SimpleMessageResponse> => {
    const { data } = await apiClient.post<SimpleMessageResponse>("/auth/logout");
    return data;
  },

  refreshToken: async (refresh_token: string): Promise<RefreshTokenResponse> => {
    const { data } = await apiClient.post<RefreshTokenResponse>("/auth/refresh-token", { refresh_token });
    return data;
  },

  forgotPassword: async (payload: ForgotPasswordRequest): Promise<SimpleMessageResponse> => {
    const { data } = await apiClient.post<SimpleMessageResponse>("/auth/forgot-password", payload);
    return data;
  },

  resetPassword: async (payload: ResetPasswordRequest): Promise<SimpleMessageResponse> => {
    const { data } = await apiClient.post<SimpleMessageResponse>("/auth/reset-password", payload);
    return data;
  },

  verifyEmail: async (payload: VerifyEmailRequest): Promise<SimpleMessageResponse> => {
    const { data } = await apiClient.post<SimpleMessageResponse>("/auth/verify-email", payload);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};
