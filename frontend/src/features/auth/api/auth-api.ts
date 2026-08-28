import { apiClient } from "@/lib/api/client";
import type { LoginInput, RegisterInput } from "../schemas/auth-schema";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type OrgMembership = {
  membershipId: string;
  role: "owner" | "admin" | "manager" | "member";
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  permissions?: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiClient<
      AuthTokens & {
        user: AuthUser;
        organization: { id: string; name: string; slug: string };
        membership: { id: string; role: string };
      }
    >("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    apiClient<
      AuthTokens & {
        user: AuthUser;
        organizations: OrgMembership[];
      }
    >("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () =>
    apiClient<{ user: AuthUser; organizations: OrgMembership[] }>(
      "/v1/auth/me",
    ),
};
