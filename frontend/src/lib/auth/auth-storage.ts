const ACCESS_KEY = "lms_access_token";
const REFRESH_KEY = "lms_refresh_token";
const ORG_KEY = "lms_organization_id";

export const authStorage = {
  getAccessToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  getOrganizationId: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ORG_KEY),
  setSession: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  setOrganizationId: (organizationId: string) => {
    localStorage.setItem(ORG_KEY, organizationId);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ORG_KEY);
  },
};
