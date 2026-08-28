import {
  MembershipRole,
  MembershipStatus,
} from '../../../generated/prisma/client';

export type AuthUserPayload = {
  id: string;
  email: string;
};

export type MembershipContext = {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type RequestContext = {
  user?: AuthUserPayload;
  membership?: MembershipContext;
  platformAdmin?: { id: string; status: string };
};
