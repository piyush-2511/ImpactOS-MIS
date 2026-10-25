/**
 * Database types. Regenerate after every migration with:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * (replaced in every phase that ships a migration). Hand-checked for phase 4 against 0001–0004.
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
          custom_fields: Json;
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
          custom_fields?: Json;
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

      lookup_lists: {
        Row: {
          key: string;
          module: string;
          label_en: string;
          label_hi: string;
          allow_custom: boolean;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      lookup_values: {
        Row: Timestamps & {
          id: string;
          organization_id: string | null;
          list_key: string;
          value_key: string;
          label_en: string;
          label_hi: string | null;
          color: string | null;
          sort_order: number;
          active: boolean;
          import_batch_id: string | null;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          list_key: string;
          value_key: string;
          label_en: string;
          label_hi?: string | null;
          color?: string | null;
          sort_order?: number;
          active?: boolean;
          import_batch_id?: string | null;
        };
        Update: {
          label_en?: string;
          label_hi?: string | null;
          color?: string | null;
          sort_order?: number;
          active?: boolean;
        };
        Relationships: [];
      };
      custom_field_definitions: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          entity: string;
          key: string;
          label_en: string;
          label_hi: string | null;
          type: CustomFieldType;
          options: Json;
          help_en: string | null;
          help_hi: string | null;
          required: boolean;
          show_in_table: boolean;
          filterable: boolean;
          section: string;
          sort_order: number;
          archived_at: string | null;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          entity: string;
          key: string;
          label_en: string;
          label_hi?: string | null;
          type: CustomFieldType;
          options?: Json;
          help_en?: string | null;
          help_hi?: string | null;
          required?: boolean;
          show_in_table?: boolean;
          filterable?: boolean;
          section?: string;
          sort_order?: number;
        };
        Update: {
          label_en?: string;
          label_hi?: string | null;
          type?: CustomFieldType;
          options?: Json;
          help_en?: string | null;
          help_hi?: string | null;
          required?: boolean;
          show_in_table?: boolean;
          filterable?: boolean;
          section?: string;
          sort_order?: number;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      field_settings: {
        Row: {
          organization_id: string;
          entity: string;
          field_key: string;
          label_en: string | null;
          label_hi: string | null;
          show_in_table: boolean | null;
          filterable: boolean | null;
          required: boolean | null;
          section: string | null;
          sort_order: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          organization_id: string;
          entity: string;
          field_key: string;
          label_en?: string | null;
          label_hi?: string | null;
          show_in_table?: boolean | null;
          filterable?: boolean | null;
          required?: boolean | null;
          section?: string | null;
          sort_order?: number | null;
        };
        Update: {
          label_en?: string | null;
          label_hi?: string | null;
          show_in_table?: boolean | null;
          filterable?: boolean | null;
          required?: boolean | null;
          section?: string | null;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      number_series: {
        Row: {
          organization_id: string;
          series_key: string;
          period: string;
          prefix: string;
          pad: number;
          next_value: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      storage_files: {
        Row: {
          id: string;
          organization_id: string;
          provider: 'r2' | 'drive' | 'local';
          object_key: string | null;
          drive_file_id: string | null;
          name: string;
          mime: string;
          size_bytes: number;
          sha256: string | null;
          entity: string | null;
          entity_id: string | null;
          purpose: string;
          status: 'pending' | 'ready' | 'deleted';
          uploaded_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          provider: 'r2' | 'drive' | 'local';
          object_key?: string | null;
          drive_file_id?: string | null;
          name: string;
          mime: string;
          size_bytes: number;
          sha256?: string | null;
          entity?: string | null;
          entity_id?: string | null;
          purpose?: string;
          status?: 'pending';
          uploaded_by?: string;
        };
        Update: {
          status?: 'pending' | 'ready' | 'deleted';
          deleted_at?: string | null;
          drive_file_id?: string | null;
          sha256?: string | null;
          size_bytes?: number;
        };
        Relationships: [];
      };
      drive_connections: {
        Row: {
          organization_id: string;
          google_email: string;
          refresh_token_enc: string;
          folder_id: string | null;
          status: 'connected' | 'revoked' | 'error';
          connected_by: string | null;
          connected_at: string;
          last_error: string | null;
        };
        Insert: {
          organization_id: string;
          google_email: string;
          refresh_token_enc: string;
          folder_id?: string | null;
          status?: 'connected' | 'revoked' | 'error';
          connected_by?: string | null;
          connected_at?: string;
        };
        Update: {
          google_email?: string;
          refresh_token_enc?: string;
          folder_id?: string | null;
          status?: 'connected' | 'revoked' | 'error';
          last_error?: string | null;
          connected_at?: string;
          connected_by?: string | null;
        };
        Relationships: [];
      };
      import_jobs: {
        Row: {
          id: string;
          organization_id: string;
          entity: string;
          status: ImportStatus;
          file_name: string;
          headers: string[];
          rows: Json | null;
          mapping: Json;
          total_rows: number;
          valid_rows: number;
          error_rows: number;
          committed_rows: number;
          errors: Json;
          created_by: string;
          created_at: string;
          committed_at: string | null;
          undo_until: string | null;
          undone_at: string | null;
        };
        Insert: {
          organization_id: string;
          entity: string;
          file_name: string;
          headers?: string[];
          rows?: Json | null;
          total_rows?: number;
        };
        Update: {
          status?: ImportStatus;
          rows?: Json | null;
          mapping?: Json;
          valid_rows?: number;
          error_rows?: number;
          committed_rows?: number;
          errors?: Json;
          committed_at?: string | null;
          undo_until?: string | null;
          undone_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          emailed_at: string | null;
          created_at: string;
        };
        Insert: {
          organization_id?: string | null;
          user_id: string;
          kind: string;
          title: string;
          body?: string | null;
          link?: string | null;
        };
        Update: { read_at?: string | null; emailed_at?: string | null };
        Relationships: [];
      };
      notification_prefs: {
        Row: { user_id: string; digest_enabled: boolean; email_enabled: boolean; updated_at: string };
        Insert: { user_id: string; digest_enabled?: boolean; email_enabled?: boolean };
        Update: { digest_enabled?: boolean; email_enabled?: boolean };
        Relationships: [];
      };
      saved_views: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          entity: string;
          name: string;
          state: Json;
          shared: boolean;
          created_at: string;
        };
        Insert: { organization_id: string; entity: string; name: string; state: Json; shared?: boolean };
        Update: { name?: string; state?: Json; shared?: boolean };
        Relationships: [];
      };
      report_definitions: {
        Row: Timestamps & {
          id: string;
          organization_id: string;
          name: string;
          entity: string;
          config: Json;
          shared: boolean;
          created_by: string | null;
        };
        Insert: { organization_id: string; name: string; entity: string; config: Json; shared?: boolean };
        Update: { name?: string; config?: Json; shared?: boolean };
        Relationships: [];
      };
      jobs_log: {
        Row: {
          id: number;
          organization_id: string | null;
          job_name: string;
          run_id: string | null;
          status: 'started' | 'succeeded' | 'failed';
          attempt: number;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          organization_id?: string | null;
          job_name: string;
          run_id?: string | null;
          status: 'started' | 'succeeded' | 'failed';
          attempt?: number;
          error?: string | null;
          finished_at?: string | null;
        };
        Update: { status?: 'started' | 'succeeded' | 'failed'; error?: string | null; finished_at?: string | null };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          organization_id: string;
          purpose: string;
          input_hash: string;
          model: string;
          output: Json;
          units: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          purpose: string;
          input_hash: string;
          model: string;
          output: Json;
          units?: number;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: { organization_id: string; month: string; units: number };
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
      lookup_list: {
        Args: { p_org: string; p_list: string; p_include_inactive?: boolean };
        Returns: {
          id: string;
          value_key: string;
          label_en: string;
          label_hi: string | null;
          color: string | null;
          sort_order: number;
          active: boolean;
          is_default: boolean;
          overridden: boolean;
        }[];
      };
      next_number: {
        Args: { p_org: string; p_series: string; p_period?: string; p_prefix?: string; p_pad?: number };
        Returns: string;
      };
      filter_facets: {
        Args: { p_org: string; p_entity: string; p_field: string; p_limit?: number };
        Returns: { value: string; n: number }[];
      };
      global_search: {
        Args: { p_org: string; p_q: string; p_limit?: number };
        Returns: { kind: string; id: string; title: string; subtitle: string | null; href: string; score: number }[];
      };
      ai_consume: { Args: { p_org: string; p_units: number; p_allowance: number }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type CustomFieldType =
  'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'phone' | 'email' | 'file';
export type ImportStatus = 'uploaded' | 'validated' | 'committing' | 'committed' | 'failed' | 'undone';

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
