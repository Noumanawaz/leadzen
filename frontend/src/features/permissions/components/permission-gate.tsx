"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { OrgMembership } from "@/features/auth/api/auth-api";

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { data } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiClient<OrgMembership[]>("/v1/organizations"),
  });

  const currentOrgId =
    typeof window !== "undefined"
      ? localStorage.getItem("lms_organization_id")
      : null;
  const current = data?.find((m) => m.organization.id === currentOrgId);
  const allowed = current?.permissions?.includes(permission);

  if (!allowed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
