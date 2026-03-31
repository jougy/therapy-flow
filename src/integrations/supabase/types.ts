export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          event_type: string
          id: string
          patient_id: string | null
          scheduled_for: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          patient_id?: string | null
          scheduled_for: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          patient_id?: string | null
          scheduled_for?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_form_templates: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system_default: boolean
          name: string
          schema: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name: string
          schema?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name?: string
          schema?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_form_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_memberships: {
        Row: {
          account_role: Database["public"]["Enums"]["account_role_type"] | null
          clinic_id: string
          created_at: string
          ended_at: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          membership_status: Database["public"]["Enums"]["membership_status_type"]
          operational_role: Database["public"]["Enums"]["operational_role_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_role?: Database["public"]["Enums"]["account_role_type"] | null
          clinic_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          membership_status?: Database["public"]["Enums"]["membership_status_type"]
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_role?: Database["public"]["Enums"]["account_role_type"] | null
          clinic_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          membership_status?: Database["public"]["Enums"]["membership_status_type"]
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          account_owner_user_id: string | null
          concurrent_access_limit: number
          address: Json
          anamnesis_base_schema: Json
          business_hours: Json
          cnpj: string
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          subaccount_limit: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          theme: Json | null
          updated_at: string
        }
        Insert: {
          account_owner_user_id?: string | null
          concurrent_access_limit?: number
          address?: Json
          anamnesis_base_schema?: Json
          business_hours?: Json
          cnpj: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          subaccount_limit?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          account_owner_user_id?: string | null
          concurrent_access_limit?: number
          address?: Json
          anamnesis_base_schema?: Json
          business_hours?: Json
          cnpj?: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          subaccount_limit?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          theme?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_groups: {
        Row: {
          clinic_id: string | null
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          patient_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          patient_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          patient_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_groups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_registration_links: {
        Row: {
          clinic_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          password_prefix: string
          patient_id: string
          token: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          password_prefix: string
          patient_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          password_prefix?: string
          patient_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_registration_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_registration_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_complement: string | null
          address_number: string | null
          age: number | null
          allergies: string | null
          blood_type: string | null
          cep: string | null
          chronic_conditions: string | null
          city: string | null
          clinic_id: string | null
          clinical_notes: string | null
          continuous_medications: string | null
          country: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          gender: string | null
          id: string
          name: string
          neighborhood: string | null
          phone: string | null
          profession: string | null
          pronoun: string | null
          registration_complete: boolean
          rg: string | null
          state: string | null
          status: string
          street: string | null
          surgeries: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          age?: number | null
          allergies?: string | null
          blood_type?: string | null
          cep?: string | null
          chronic_conditions?: string | null
          city?: string | null
          clinic_id?: string | null
          clinical_notes?: string | null
          continuous_medications?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          phone?: string | null
          profession?: string | null
          pronoun?: string | null
          registration_complete?: boolean
          rg?: string | null
          state?: string | null
          status?: string
          street?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          age?: number | null
          allergies?: string | null
          blood_type?: string | null
          cep?: string | null
          chronic_conditions?: string | null
          city?: string | null
          clinic_id?: string | null
          clinical_notes?: string | null
          continuous_medications?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          phone?: string | null
          profession?: string | null
          pronoun?: string | null
          registration_complete?: boolean
          rg?: string | null
          state?: string | null
          status?: string
          street?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: Json
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_password_changed_at: string | null
          last_seen_at: string | null
          password_temporary: boolean
          phone: string | null
          professional_license: string | null
          public_code: string
          social_name: string | null
          specialties: Json
          specialty: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: Json
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_password_changed_at?: string | null
          last_seen_at?: string | null
          password_temporary?: boolean
          phone?: string | null
          professional_license?: string | null
          public_code: string
          social_name?: string | null
          specialties?: Json
          specialty?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: Json
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_password_changed_at?: string | null
          last_seen_at?: string | null
          password_temporary?: boolean
          phone?: string | null
          professional_license?: string | null
          public_code?: string
          social_name?: string | null
          specialties?: Json
          specialty?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          actor_user_id: string | null
          clinic_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          target_user_id: string | null
          visibility_scope: string
        }
        Insert: {
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          target_user_id?: string | null
          visibility_scope?: string
        }
        Update: {
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          target_user_id?: string | null
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_edit_history: {
        Row: {
          clinic_id: string
          edited_at: string
          editor_user_id: string
          id: string
          session_id: string
        }
        Insert: {
          clinic_id: string
          edited_at?: string
          editor_user_id: string
          id?: string
          session_id: string
        }
        Update: {
          clinic_id?: string
          edited_at?: string
          editor_user_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_edit_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_edit_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          anamnesis: Json | null
          anamnesis_form_response: Json | null
          anamnesis_template_id: string | null
          clinic_id: string | null
          complexity_score: number | null
          created_at: string
          group_id: string | null
          id: string
          notes: string | null
          pain_score: number | null
          patient_id: string
          provider_id: string | null
          session_date: string
          status: string
          treatment: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnesis?: Json | null
          anamnesis_form_response?: Json | null
          anamnesis_template_id?: string | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id: string
          provider_id?: string | null
          session_date?: string
          status?: string
          treatment?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnesis?: Json | null
          anamnesis_form_response?: Json | null
          anamnesis_template_id?: string | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id?: string
          provider_id?: string | null
          session_date?: string
          status?: string
          treatment?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_anamnesis_template_id_fkey"
            columns: ["anamnesis_template_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "patient_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_development_profiles: {
        Row: {
          clinic_id: string
          created_at: string
          development_status: string
          goals: string | null
          id: string
          internal_level: string
          last_review_at: string | null
          next_review_at: string | null
          onboarding_flow_read: boolean
          onboarding_initial_training: boolean
          review_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          development_status?: string
          goals?: string | null
          id?: string
          internal_level?: string
          last_review_at?: string | null
          next_review_at?: string | null
          onboarding_flow_read?: boolean
          onboarding_initial_training?: boolean
          review_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          development_status?: string
          goals?: string | null
          id?: string
          internal_level?: string
          last_review_at?: string | null
          next_review_at?: string | null
          onboarding_flow_read?: boolean
          onboarding_initial_training?: boolean
          review_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_development_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security_sessions: {
        Row: {
          browser: string | null
          clinic_id: string | null
          created_at: string
          device_label: string | null
          ended_at: string | null
          id: string
          last_seen_at: string
          platform: string | null
          session_key: string
          signed_in_at: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          clinic_id?: string | null
          created_at?: string
          device_label?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          platform?: string | null
          session_key: string
          signed_in_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          clinic_id?: string | null
          created_at?: string
          device_label?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          platform?: string | null
          session_key?: string
          signed_in_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security_settings: {
        Row: {
          alert_access_change: boolean
          alert_new_login: boolean
          alert_other_sessions_ended: boolean
          alert_password_changed: boolean
          clinic_id: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_access_change?: boolean
          alert_new_login?: boolean
          alert_other_sessions_ended?: boolean
          alert_password_changed?: boolean
          clinic_id?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_access_change?: boolean
          alert_new_login?: boolean
          alert_other_sessions_ended?: boolean
          alert_password_changed?: boolean
          clinic_id?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_clinic_subaccount: {
        Args: {
          _clinic_id?: string
          _email: string
          _full_name: string
          _job_title?: string
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _password: string
          _specialty?: string
        }
        Returns: Json
      }
      get_clinic_concurrent_access_overview: {
        Args: { _clinic_id?: string }
        Returns: Json
      }
      create_patient_registration_link: {
        Args: { _patient_id: string }
        Returns: Json
      }
      current_user_can: {
        Args: { _capability: string; _clinic_id?: string }
        Returns: boolean
      }
      end_other_security_sessions: {
        Args: { _current_session_key: string }
        Returns: Json
      }
      ensure_team_development_profile: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: string
      }
      generate_profile_public_code: { Args: never; Returns: string }
      generate_profile_public_code_for_clinic: {
        Args: { _clinic_id: string }
        Returns: string
      }
      get_patient_registration_form: {
        Args: { _password: string; _token: string }
        Returns: Json
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      handle_signup:
        | {
            Args: {
              _cnpj: string
              _email: string
              _full_name?: string
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _cnpj: string
              _email: string
              _full_name?: string
              _subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
              _user_id: string
            }
            Returns: Json
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _actor_user_id: string
          _clinic_id: string
          _event_type: string
          _payload?: Json
          _target_user_id: string
          _visibility_scope?: string
        }
        Returns: string
      }
      register_current_security_session: {
        Args: {
          _browser?: string
          _device_label?: string
          _platform?: string
          _session_key: string
          _user_agent?: string
        }
        Returns: Json
      }
      submit_patient_registration_form: {
        Args: { _password: string; _payload: Json; _token: string }
        Returns: Json
      }
      update_clinic_subaccount: {
        Args: {
          _cpf?: string
          _email?: string
          _full_name?: string
          _job_title?: string
          _membership_id: string
          _membership_status?: Database["public"]["Enums"]["membership_status_type"]
          _new_password?: string
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _phone?: string
          _professional_license?: string
          _specialty?: string
          _working_hours?: string
        }
        Returns: Json
      }
      update_clinic_subaccount_profile: {
        Args: {
          _address?: Json
          _bio?: string
          _birth_date?: string
          _cpf?: string
          _email?: string
          _full_name?: string
          _job_title?: string
          _membership_id: string
          _membership_status?: Database["public"]["Enums"]["membership_status_type"]
          _new_password?: string
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _phone?: string
          _professional_license?: string
          _social_name?: string
          _specialty?: string
          _working_hours?: string
        }
        Returns: Json
      }
      update_current_profile: {
        Args: {
          _address?: Json
          _bio?: string
          _birth_date?: string
          _cpf?: string
          _email?: string
          _full_name?: string
          _job_title?: string
          _new_password?: string
          _phone?: string
          _professional_license?: string
          _social_name?: string
          _specialty?: string
          _working_hours?: string
        }
        Returns: Json
      }
      update_team_development_profile: {
        Args: {
          _development_status?: string
          _goals?: string
          _internal_level?: string
          _last_review_at?: string
          _next_review_at?: string
          _onboarding_flow_read?: boolean
          _onboarding_initial_training?: boolean
          _review_notes?: string
          _user_id: string
        }
        Returns: Json
      }
      upsert_current_user_security_settings: {
        Args: {
          _alert_access_change?: boolean
          _alert_new_login?: boolean
          _alert_other_sessions_ended?: boolean
          _alert_password_changed?: boolean
        }
        Returns: Json
      }
      validate_user_clinic: {
        Args: { _cnpj: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_role_type: "account_owner"
      app_role: "super_admin" | "clinic_admin" | "user"
      membership_status_type: "invited" | "active" | "inactive" | "suspended"
      operational_role_type: "owner" | "admin" | "professional" | "assistant"
      subscription_plan: "solo" | "clinic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_role_type: ["account_owner"],
      app_role: ["super_admin", "clinic_admin", "user"],
      membership_status_type: ["invited", "active", "inactive", "suspended"],
      operational_role_type: ["owner", "admin", "professional", "assistant"],
      subscription_plan: ["solo", "clinic"],
    },
  },
} as const
