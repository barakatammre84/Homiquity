import { ALL_ROLES } from "@shared/schema";

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  isPartner?: boolean;
  partnerCompanyName?: string | null;
  nmlsId?: string | null;
  createdAt: string | null;
}

/** Both the role filter and the change-role picker offer every role. */
export const ROLES = ALL_ROLES;
