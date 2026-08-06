// The user shape served by /api/admin/users. Extracted verbatim from
// AdminUsers.tsx so the table and the dialogs can share it.
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
