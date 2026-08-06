// Extracted verbatim from AdminUsers.tsx.
export interface User {
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
