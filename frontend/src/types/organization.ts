export interface Organization {
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  plan_code: string;
  created_at: string;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

export interface OrganizationInvitation {
  invitation_id: string;
  email: string;
  role_id: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  invitation_url?: string | null;
  email_sent?: boolean;
}

export interface OrganizationInviteCreate {
  email: string;
  role_id: string;
}

export interface InvitationPreview {
  organization_name: string;
  organization_slug: string;
  email: string;
  role_name: string;
  expires_at: string;
}
