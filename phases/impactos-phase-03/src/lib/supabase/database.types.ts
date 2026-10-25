/**
 * Database types. Regenerate after every migration with:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * (replaced in every phase that ships a migration). Hand-checked for phase 3 against 0001–0003.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string; updated_by: string | null };

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Timestamps & {
          id: string;
          name: string;
          slug: string;
          legal_form: 'trust' | 'society' | 'section8' | 'other';
          state: string;
          district: string | null;
          pan: string | null;
          fcra_registered: boolean;
          locale: 'en' | 'hi';
          status: 'active' | 'suspended' | 'closed';
          created_by: string | null;
        };
        Insert: never;
        Update: {
          name?: string;
          legal_form?: 'trust' | 'society' | 'section8' | 'other';
          state?: string;
          district?: string | null;
          pan?: string | null;
          fcra_registered?: boolean;
          locale?: 'en' | 'hi';
        };
        Relationships: [];
      };
      profiles: {
        Row: Timestamps & {
          id: string;
          full_name: string | null;
          email: string | null;
          locale: 'en' | 'hi';
          must_change_password: boolean;
          last_org_id: string | null;
          avatar_key: string | null;
        };
        Insert: { id: string; full_name?: string | null; locale?: 'en' | 'hi' };
        Update: {
          full_name?: string | null;
          locale?: 'en' | 'hi';
          last_org_id?: string | null;
          avatar_key?: string | null;
          must_change_password?: boolean;
        };
        Relationships: [];
      };
      organization_members: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          user_id: string;
          kind: 'email' | 'username';
          base_role: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service';
          status: 'active' | 'deactivated';
          joined_at: string;
          deactivated_at: string | null;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          kind?: 'email' | 'username';
          base_role?: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service';
          created_by?: string | null;
        };
        Update: {
          status?: 'active' | 'deactivated';
          base_role?: 'secretary' | 'admin' | 'finance' | 'member' | 'self_service';
          deactivated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_profile_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      username_accounts: {
        Row: {
          organization_id: string;
          username: string;
          user_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: { organization_id: string; username: string; user_id: string; created_by?: string | null };
        Update: never;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role_key: 'admin' | 'finance' | 'member' | 'self_service';
          role_id: string | null;
          scope: Json;
          token_hash: string;
          locale: 'en' | 'hi';
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          invited_by: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          email: string;
          role_key?: 'admin' | 'finance' | 'member' | 'self_service';
          role_id?: string | null;
          scope?: Json;
          token_hash: string;
          locale?: 'en' | 'hi';
          expires_at?: string;
          invited_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
        Update: { revoked_at?: string | null; role_id?: string | null };
      };
      platform_staff: {
        Row: {
          user_id: string;
          role: 'super_admin' | 'support' | 'billing' | 'readonly';
          active: boolean;
          created_at: string;
        };
        Insert: { user_id: string; role: 'super_admin' | 'support' | 'billing' | 'readonly'; active?: boolean };
        Update: { role?: 'super_admin' | 'support' | 'billing' | 'readonly'; active?: boolean };
        Relationships: [];
      };
      auth_events: {
        Row: {
          id: number;
          user_id: string | null;
          organization_id: string | null;
          event: AuthEvent;
          ip: string | null;
          user_agent: string | null;
          device_hash: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          organization_id?: string | null;
          event: AuthEvent;
          ip?: string | null;
          user_agent?: string | null;
          device_hash?: string | null;
        };
        Update: never;
        Relationships: [];
      };

      permissions: {
        Row: { key: string; module: string; description: string; sensitive: boolean };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      roles: {
        Row: Timestamps & {
          id: string;
          organization_id: string | null;
          key: string | null;
          name: string;
          description: string | null;
          default_scope: 'all' | 'assigned' | 'own';
          requires_mfa: boolean;
          grants_all: boolean;
          is_system: boolean;
          cloned_from: string | null;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          name: string;
          description?: string | null;
          default_scope?: 'all' | 'assigned' | 'own';
          requires_mfa?: boolean;
          cloned_from?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          default_scope?: 'all' | 'assigned' | 'own';
          requires_mfa?: boolean;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: { role_id: string; permission_key: string };
        Insert: { role_id: string; permission_key: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      member_roles: {
        Row: {
          member_id: string;
          role_id: string;
          organization_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'member_roles_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      member_scopes: {
        Row: {
          id: string;
          member_id: string;
          organization_id: string;
          scope_type: 'program' | 'branch';
          ref_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'member_scopes_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };
      positions: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          default_role_id: string | null;
          is_committee: boolean;
          is_secretary: boolean;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          name: string;
          description?: string | null;
          default_role_id?: string | null;
          is_committee?: boolean;
        };
        Update: { name?: string; description?: string | null; default_role_id?: string | null; is_committee?: boolean };
        Relationships: [
          {
            foreignKeyName: 'positions_default_role_id_fkey';
            columns: ['default_role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      position_holders: {
        Row: {
          id: string;
          position_id: string;
          member_id: string;
          organization_id: string;
          from_date: string;
          to_date: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: { position_id: string; member_id: string; organization_id: string; from_date?: string };
        Update: { to_date?: string | null };
        Relationships: [
          {
            foreignKeyName: 'position_holders_position_id_fkey';
            columns: ['position_id'];
            isOneToOne: false;
            referencedRelation: 'positions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'position_holders_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_events: {
        Row: {
          id: number;
          organization_id: string | null;
          actor_id: string | null;
          actor_kind: 'user' | 'platform' | 'system';
          action: string;
          table_name: string | null;
          row_id: string | null;
          before: Json | null;
          after: Json | null;
          changed: string[] | null;
          note: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_legal_form: string;
          p_state: string;
          p_district?: string | null;
          p_pan?: string | null;
          p_fcra?: boolean;
          p_locale?: string;
        };
        Returns: string;
      };
      accept_invitation: { Args: { p_token_hash: string }; Returns: string };
      get_invitation: {
        Args: { p_token_hash: string };
        Returns: {
          organization_name: string;
          email: string;
          expires_at: string;
          state: 'open' | 'accepted' | 'expired' | 'revoked';
          locale: 'en' | 'hi';
        }[];
      };
      slug_available: { Args: { p_slug: string }; Returns: boolean };
      is_member: { Args: { org: string }; Returns: boolean };
      member_role: { Args: { org: string }; Returns: string | null };
      is_platform_staff: { Args: Record<string, never>; Returns: boolean };
      current_user_orgs: { Args: Record<string, never>; Returns: string[] };
      shares_org_with: { Args: { other: string }; Returns: boolean };
      has_permission: { Args: { org: string; perm: string }; Returns: boolean };
      my_permissions: { Args: { org: string }; Returns: string[] };
      in_scope: { Args: { org: string; p_program?: string | null; p_branch?: string | null }; Returns: boolean };
      set_member_roles: { Args: { p_member: string; p_roles: string[] }; Returns: undefined };
      set_member_scopes: {
        Args: { p_member: string; p_programs: string[] | null; p_branches: string[] | null };
        Returns: undefined;
      };
      set_member_status: { Args: { p_member: string; p_status: 'active' | 'deactivated' }; Returns: undefined };
      record_audit: {
        Args: {
          p_org: string;
          p_action: string;
          p_table?: string | null;
          p_row?: string | null;
          p_note?: string | null;
          p_after?: Json | null;
        };
        Returns: undefined;
      };
      log_reveal: {
        Args: { p_org: string; p_permission: string; p_table: string; p_row: string; p_field: string };
        Returns: boolean;
      };
      revoke_user_sessions: { Args: { uid: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AuthEvent =
  | 'sign_up'
  | 'sign_in'
  | 'sign_in_failed'
  | 'sign_out'
  | 'password_changed'
  | 'password_reset_requested'
  | 'mfa_enrolled'
  | 'mfa_verified'
  | 'org_created'
  | 'org_switched'
  | 'invite_accepted'
  | 'username_login'
  | 'console_sign_in';
export type BaseRole = Database['public']['Tables']['organization_members']['Row']['base_role'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type Position = Database['public']['Tables']['positions']['Row'];
export type AuditEventRow = Database['public']['Tables']['audit_events']['Row'];
