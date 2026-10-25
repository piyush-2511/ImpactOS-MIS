/**
 * Database types. Regenerate after every migration with:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * (replaced in every phase that ships a migration). Hand-checked for phase 2 against 0002_auth_tenancy.sql.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string; updated_by: string | null };

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Timestamps & {
          id: string; name: string; slug: string; legal_form: 'trust' | 'society' | 'section8' | 'other'; state: string;
          district: string | null; pan: string | null; fcra_registered: boolean; locale: 'en' | 'hi';
          status: 'active' | 'suspended' | 'closed'; created_by: string | null;
        };
        Insert: never;
        Update: { name?: string; legal_form?: 'trust' | 'society' | 'section8' | 'other'; state?: string; district?: string | null; pan?: string | null; fcra_registered?: boolean; locale?: 'en' | 'hi' };
        Relationships: [];
      };
      profiles: {
        Row: Timestamps & {
          id: string; full_name: string | null; locale: 'en' | 'hi'; must_change_password: boolean; last_org_id: string | null; avatar_key: string | null;
        };
        Insert: { id: string; full_name?: string | null; locale?: 'en' | 'hi' };
        Update: { full_name?: string | null; locale?: 'en' | 'hi'; last_org_id?: string | null; avatar_key?: string | null; must_change_password?: boolean };
        Relationships: [];
      };
      organization_members: {
        Row: Timestamps & {
          id: string; organization_id: string; user_id: string; kind: 'email' | 'username';
          base_role: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service'; status: 'active' | 'deactivated';
          joined_at: string; deactivated_at: string | null; created_by: string | null;
        };
        Insert: { organization_id: string; user_id: string; kind?: 'email' | 'username'; base_role?: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service'; created_by?: string | null };
        Update: { status?: 'active' | 'deactivated'; base_role?: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service'; deactivated_at?: string | null };
        Relationships: [
          { foreignKeyName: 'organization_members_organization_id_fkey'; columns: ['organization_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ];
      };
      username_accounts: {
        Row: { organization_id: string; username: string; user_id: string; created_at: string; created_by: string | null };
        Insert: { organization_id: string; username: string; user_id: string; created_by?: string | null };
        Update: never;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string; organization_id: string; email: string; role_key: 'admin' | 'finance' | 'member' | 'self_service'; scope: Json; token_hash: string;
          locale: 'en' | 'hi'; expires_at: string; accepted_at: string | null; accepted_by: string | null; revoked_at: string | null; invited_by: string; created_at: string;
        };
        Insert: { organization_id: string; email: string; role_key?: 'admin' | 'finance' | 'member' | 'self_service'; scope?: Json; token_hash: string; locale?: 'en' | 'hi'; expires_at?: string; invited_by?: string };
        Update: { revoked_at?: string | null };
        Relationships: [];
      };
      platform_staff: {
        Row: { user_id: string; role: 'super_admin' | 'support' | 'billing' | 'readonly'; active: boolean; created_at: string };
        Insert: { user_id: string; role: 'super_admin' | 'support' | 'billing' | 'readonly'; active?: boolean };
        Update: { role?: 'super_admin' | 'support' | 'billing' | 'readonly'; active?: boolean };
        Relationships: [];
      };
      auth_events: {
        Row: { id: number; user_id: string | null; organization_id: string | null; event: AuthEvent; ip: string | null; user_agent: string | null; device_hash: string | null; created_at: string };
        Insert: { user_id?: string | null; organization_id?: string | null; event: AuthEvent; ip?: string | null; user_agent?: string | null; device_hash?: string | null };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_legal_form: string; p_state: string; p_district?: string | null; p_pan?: string | null; p_fcra?: boolean; p_locale?: string };
        Returns: string;
      };
      accept_invitation: { Args: { p_token_hash: string }; Returns: string };
      get_invitation: {
        Args: { p_token_hash: string };
        Returns: { organization_name: string; email: string; expires_at: string; state: 'open' | 'accepted' | 'expired' | 'revoked'; locale: 'en' | 'hi' }[];
      };
      slug_available: { Args: { p_slug: string }; Returns: boolean };
      is_member: { Args: { org: string }; Returns: boolean };
      member_role: { Args: { org: string }; Returns: string | null };
      is_platform_staff: { Args: Record<string, never>; Returns: boolean };
      current_user_orgs: { Args: Record<string, never>; Returns: string[] };
      shares_org_with: { Args: { other: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AuthEvent =
  | 'sign_up' | 'sign_in' | 'sign_in_failed' | 'sign_out' | 'password_changed' | 'password_reset_requested' | 'mfa_enrolled'
  | 'mfa_verified' | 'org_created' | 'org_switched' | 'invite_accepted' | 'username_login' | 'console_sign_in';
export type BaseRole = Database['public']['Tables']['organization_members']['Row']['base_role'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
