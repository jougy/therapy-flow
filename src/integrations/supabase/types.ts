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
          generated_by_recurring_patient: boolean
          id: string
          patient_id: string | null
          payment_plan_id: string | null
          payment_plan_session_index: number | null
          scheduled_for: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          event_type: string
          generated_by_recurring_patient?: boolean
          id?: string
          patient_id?: string | null
          payment_plan_id?: string | null
          payment_plan_session_index?: number | null
          scheduled_for: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          generated_by_recurring_patient?: boolean
          id?: string
          patient_id?: string | null
          payment_plan_id?: string | null
          payment_plan_session_index?: number | null
          scheduled_for?: string
          status?: string
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
          {
            foreignKeyName: "agenda_events_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "patient_payment_plans"
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
      app_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          actor_user_id: string | null
          body: string
          category: string
          clinic_id: string | null
          created_at: string
          dismissed_at: string | null
          event_type: string
          id: string
          payload: Json
          read_at: string | null
          source_event_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          actor_user_id?: string | null
          body: string
          category: string
          clinic_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type: string
          id?: string
          payload?: Json
          read_at?: string | null
          source_event_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          actor_user_id?: string | null
          body?: string
          category?: string
          clinic_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          read_at?: string | null
          source_event_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          asaas_event_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
          signature: string | null
        }
        Insert: {
          asaas_event_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          signature?: string | null
        }
        Update: {
          asaas_event_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          signature?: string | null
        }
        Relationships: []
      }
      clinic_collaborator_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          clinic_id: string
          created_at: string
          email: string
          existing_user_id: string | null
          expires_at: string
          id: string
          invited_by: string | null
          job_title: string | null
          last_resent_at: string | null
          operational_role: Database["public"]["Enums"]["operational_role_type"]
          specialty: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          clinic_id: string
          created_at?: string
          email: string
          existing_user_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          last_resent_at?: string | null
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          specialty?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          existing_user_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          job_title?: string | null
          last_resent_at?: string | null
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          specialty?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_collaborator_invitations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_group_color_slots: {
        Row: {
          alpha: number
          clinic_id: string
          color_hex: string
          created_at: string
          id: string
          slot_index: number
          updated_at: string
        }
        Insert: {
          alpha?: number
          clinic_id: string
          color_hex: string
          created_at?: string
          id?: string
          slot_index: number
          updated_at?: string
        }
        Update: {
          alpha?: number
          clinic_id?: string
          color_hex?: string
          created_at?: string
          id?: string
          slot_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_group_color_slots_clinic_id_fkey"
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
          job_title: string | null
          joined_at: string
          membership_status: Database["public"]["Enums"]["membership_status_type"]
          operational_role: Database["public"]["Enums"]["operational_role_type"]
          specialty: string | null
          updated_at: string
          user_id: string
          working_hours: Json | null
        }
        Insert: {
          account_role?: Database["public"]["Enums"]["account_role_type"] | null
          clinic_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          joined_at?: string
          membership_status?: Database["public"]["Enums"]["membership_status_type"]
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          specialty?: string | null
          updated_at?: string
          user_id: string
          working_hours?: Json | null
        }
        Update: {
          account_role?: Database["public"]["Enums"]["account_role_type"] | null
          clinic_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          job_title?: string | null
          joined_at?: string
          membership_status?: Database["public"]["Enums"]["membership_status_type"]
          operational_role?: Database["public"]["Enums"]["operational_role_type"]
          specialty?: string | null
          updated_at?: string
          user_id?: string
          working_hours?: Json | null
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
      clinic_operational_role_capabilities: {
        Row: {
          capability: string
          clinic_id: string
          created_at: string
          enabled: boolean
          id: string
          operational_role: string
          updated_at: string
        }
        Insert: {
          capability: string
          clinic_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          operational_role: string
          updated_at?: string
        }
        Update: {
          capability?: string
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          operational_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_operational_role_capabilities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_operational_roles: {
        Row: {
          base_operational_role: Database["public"]["Enums"]["operational_role_type"]
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          label: string
          role_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_operational_role?: Database["public"]["Enums"]["operational_role_type"]
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label: string
          role_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_operational_role?: Database["public"]["Enums"]["operational_role_type"]
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label?: string
          role_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_operational_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_subscriptions: {
        Row: {
          account_owner_user_id: string
          additional_concurrent_access_count: number
          additional_concurrent_access_price: number
          applied_coupon_id: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          auto_renew: boolean | null
          base_concurrent_access_count: number
          base_monthly_price: number
          base_subaccount_limit: number
          billing_cycle: string
          billing_email: string | null
          billing_name: string | null
          clinic_id: string
          coupon_code: string | null
          courtesy_reason: string | null
          cpf_cnpj: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          discount_fixed_amount: number | null
          discount_percentage: number | null
          expires_at: string | null
          id: string
          installment_count: number | null
          is_courtesy: boolean
          is_free_trial: boolean | null
          is_read_only: boolean | null
          next_due_date: string | null
          override_at: string | null
          override_by_user_id: string | null
          override_reason: string | null
          payment_method: string
          period_duration_days: number | null
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          purchased_subaccount_extra_count: number
          purchased_subaccount_unit_price: number
          status: string
          total_recurring_monthly_price: number
          trial_card_token: string | null
          trial_ends_at: string | null
          trial_max_attendances: number | null
          trial_max_custom_forms: number | null
          trial_max_patients: number | null
          updated_at: string
        }
        Insert: {
          account_owner_user_id: string
          additional_concurrent_access_count?: number
          additional_concurrent_access_price?: number
          applied_coupon_id?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          auto_renew?: boolean | null
          base_concurrent_access_count?: number
          base_monthly_price?: number
          base_subaccount_limit?: number
          billing_cycle?: string
          billing_email?: string | null
          billing_name?: string | null
          clinic_id: string
          coupon_code?: string | null
          courtesy_reason?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_fixed_amount?: number | null
          discount_percentage?: number | null
          expires_at?: string | null
          id?: string
          installment_count?: number | null
          is_courtesy?: boolean
          is_free_trial?: boolean | null
          is_read_only?: boolean | null
          next_due_date?: string | null
          override_at?: string | null
          override_by_user_id?: string | null
          override_reason?: string | null
          payment_method?: string
          period_duration_days?: number | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          purchased_subaccount_extra_count?: number
          purchased_subaccount_unit_price?: number
          status?: string
          total_recurring_monthly_price?: number
          trial_card_token?: string | null
          trial_ends_at?: string | null
          trial_max_attendances?: number | null
          trial_max_custom_forms?: number | null
          trial_max_patients?: number | null
          updated_at?: string
        }
        Update: {
          account_owner_user_id?: string
          additional_concurrent_access_count?: number
          additional_concurrent_access_price?: number
          applied_coupon_id?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          auto_renew?: boolean | null
          base_concurrent_access_count?: number
          base_monthly_price?: number
          base_subaccount_limit?: number
          billing_cycle?: string
          billing_email?: string | null
          billing_name?: string | null
          clinic_id?: string
          coupon_code?: string | null
          courtesy_reason?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_fixed_amount?: number | null
          discount_percentage?: number | null
          expires_at?: string | null
          id?: string
          installment_count?: number | null
          is_courtesy?: boolean
          is_free_trial?: boolean | null
          is_read_only?: boolean | null
          next_due_date?: string | null
          override_at?: string | null
          override_by_user_id?: string | null
          override_reason?: string | null
          payment_method?: string
          period_duration_days?: number | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          purchased_subaccount_extra_count?: number
          purchased_subaccount_unit_price?: number
          status?: string
          total_recurring_monthly_price?: number
          trial_card_token?: string | null
          trial_ends_at?: string | null
          trial_max_attendances?: number | null
          trial_max_custom_forms?: number | null
          trial_max_patients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_subscriptions_account_owner_user_id_fkey"
            columns: ["account_owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_applied_coupon_id_fkey"
            columns: ["applied_coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_override_by_user_id_fkey"
            columns: ["override_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_tag_relations: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_tag_relations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "clinic_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          access_status: string
          account_owner_user_id: string | null
          address: Json
          anamnesis_base_schema: Json
          business_hours: Json
          cnpj: string
          concurrent_access_limit: number | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          route_key: string
          subaccount_limit: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          theme: Json | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          account_owner_user_id?: string | null
          address?: Json
          anamnesis_base_schema?: Json
          business_hours?: Json
          cnpj: string
          concurrent_access_limit?: number | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          route_key?: string
          subaccount_limit?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          account_owner_user_id?: string | null
          address?: Json
          anamnesis_base_schema?: Json
          business_hours?: Json
          cnpj?: string
          concurrent_access_limit?: number | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          route_key?: string
          subaccount_limit?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          theme?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      community_form_template_comments: {
        Row: {
          author_name: string
          clinic_name: string | null
          content: string
          created_at: string
          id: string
          rating: number | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name: string
          clinic_name?: string | null
          content: string
          created_at?: string
          id?: string
          rating?: number | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          clinic_name?: string | null
          content?: string
          created_at?: string
          id?: string
          rating?: number | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_form_template_comments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "community_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      community_form_template_likes: {
        Row: {
          created_at: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_form_template_likes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "community_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      community_form_templates: {
        Row: {
          author_name: string
          category: string
          clinic_id: string | null
          clinic_name: string | null
          created_at: string
          description: string | null
          fields_count: number
          id: string
          imports_count: number
          is_featured: boolean
          is_published: boolean
          kind: string
          likes_count: number
          schema: Json
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name: string
          category?: string
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          description?: string | null
          fields_count?: number
          id?: string
          imports_count?: number
          is_featured?: boolean
          is_published?: boolean
          kind?: string
          likes_count?: number
          schema?: Json
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          category?: string
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          description?: string | null
          fields_count?: number
          id?: string
          imports_count?: number
          is_featured?: boolean
          is_published?: boolean
          kind?: string
          likes_count?: number
          schema?: Json
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_form_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          clinic_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          key: string
          reason: string | null
          scope: Database["public"]["Enums"]["feature_flag_scope"]
          starts_at: string | null
          tag_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key: string
          reason?: string | null
          scope?: Database["public"]["Enums"]["feature_flag_scope"]
          starts_at?: string | null
          tag_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          reason?: string | null
          scope?: Database["public"]["Enums"]["feature_flag_scope"]
          starts_at?: string | null
          tag_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "clinic_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_rules: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          notify_clinic_access: boolean
          notify_event_reminders: boolean
          notify_patient_saved: boolean
          notify_security: boolean
          notify_session_activity: boolean
          notify_system: boolean
          sound_key: string
          sound_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notify_clinic_access?: boolean
          notify_event_reminders?: boolean
          notify_patient_saved?: boolean
          notify_security?: boolean
          notify_session_activity?: boolean
          notify_system?: boolean
          sound_key?: string
          sound_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notify_clinic_access?: boolean
          notify_event_reminders?: boolean
          notify_patient_saved?: boolean
          notify_security?: boolean
          notify_session_activity?: boolean
          notify_system?: boolean
          sound_key?: string
          sound_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_clinical_snapshots: {
        Row: {
          change_note: string | null
          change_summary: Json
          changed_fields: string[]
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          patient_id: string
          snapshot_data: Json
        }
        Insert: {
          change_note?: string | null
          change_summary?: Json
          changed_fields?: string[]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id: string
          snapshot_data?: Json
        }
        Update: {
          change_note?: string | null
          change_summary?: Json
          changed_fields?: string[]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id?: string
          snapshot_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinical_snapshots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_snapshots_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_evolution_groups: {
        Row: {
          clinic_id: string
          created_at: string
          custom_name: string | null
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          custom_name?: string | null
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          custom_name?: string | null
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_evolution_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_evolution_groups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_file_uploads: {
        Row: {
          bucket_name: string
          byte_size: number
          category: Database["public"]["Enums"]["patient_file_upload_category"]
          checksum_sha256: string | null
          clinic_id: string
          compression_profile: string | null
          content_type: string
          created_at: string
          deleted_at: string | null
          id: string
          image_height: number | null
          image_width: number | null
          last_accessed_at: string | null
          metadata: Json
          object_key: string
          original_byte_size: number | null
          original_content_type: string | null
          original_filename: string
          page_count: number | null
          patient_id: string
          provider: string
          session_id: string | null
          status: Database["public"]["Enums"]["patient_file_upload_status"]
          storage_encoding: string | null
          stored_byte_size: number | null
          stored_content_type: string | null
          updated_at: string
          upload_expires_at: string
          uploaded_at: string | null
          uploaded_by_user_id: string
        }
        Insert: {
          bucket_name: string
          byte_size: number
          category?: Database["public"]["Enums"]["patient_file_upload_category"]
          checksum_sha256?: string | null
          clinic_id: string
          compression_profile?: string | null
          content_type: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          last_accessed_at?: string | null
          metadata?: Json
          object_key: string
          original_byte_size?: number | null
          original_content_type?: string | null
          original_filename: string
          page_count?: number | null
          patient_id: string
          provider?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["patient_file_upload_status"]
          storage_encoding?: string | null
          stored_byte_size?: number | null
          stored_content_type?: string | null
          updated_at?: string
          upload_expires_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id: string
        }
        Update: {
          bucket_name?: string
          byte_size?: number
          category?: Database["public"]["Enums"]["patient_file_upload_category"]
          checksum_sha256?: string | null
          clinic_id?: string
          compression_profile?: string | null
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          last_accessed_at?: string | null
          metadata?: Json
          object_key?: string
          original_byte_size?: number | null
          original_content_type?: string | null
          original_filename?: string
          page_count?: number | null
          patient_id?: string
          provider?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["patient_file_upload_status"]
          storage_encoding?: string | null
          stored_byte_size?: number | null
          stored_content_type?: string | null
          updated_at?: string
          upload_expires_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_file_uploads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_file_uploads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_file_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_group_templates: {
        Row: {
          clinic_color_slot_id: string | null
          clinic_id: string
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          normalized_name: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_color_slot_id?: string | null
          clinic_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          normalized_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_color_slot_id?: string | null
          clinic_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          normalized_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_group_templates_clinic_color_slot_id_fkey"
            columns: ["clinic_color_slot_id"]
            isOneToOne: false
            referencedRelation: "clinic_group_color_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_group_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_groups: {
        Row: {
          clinic_color_slot_id: string | null
          clinic_id: string | null
          color: string
          created_at: string
          group_kind: string
          id: string
          is_default: boolean
          name: string
          patient_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          clinic_color_slot_id?: string | null
          clinic_id?: string | null
          color?: string
          created_at?: string
          group_kind?: string
          id?: string
          is_default?: boolean
          name: string
          patient_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          clinic_color_slot_id?: string | null
          clinic_id?: string | null
          color?: string
          created_at?: string
          group_kind?: string
          id?: string
          is_default?: boolean
          name?: string
          patient_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_groups_clinic_color_slot_id_fkey"
            columns: ["clinic_color_slot_id"]
            isOneToOne: false
            referencedRelation: "clinic_group_color_slots"
            referencedColumns: ["id"]
          },
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
      patient_payment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          notes: string | null
          patient_id: string
          payment_installments: number
          payment_method: string
          payment_status: string
          payment_status_date: string | null
          session_unit_amount_cents: number
          start_date: string
          total_amount_cents: number
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id: string
          payment_installments?: number
          payment_method?: string
          payment_status?: string
          payment_status_date?: string | null
          session_unit_amount_cents?: number
          start_date?: string
          total_amount_cents?: number
          total_sessions: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string
          payment_installments?: number
          payment_method?: string
          payment_status?: string
          payment_status_date?: string | null
          session_unit_amount_cents?: number
          start_date?: string
          total_amount_cents?: number
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_payment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payment_plans_patient_id_fkey"
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
          clinical_profile: Json | null
          continuous_medications: string | null
          country: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact: Json | null
          gender: string | null
          guardian_consent: Json | null
          id: string
          is_recurring: boolean
          name: string
          neighborhood: string | null
          origin_insurance_member_id: string | null
          origin_insurance_plan: string | null
          origin_insurance_provider: string | null
          origin_other_description: string | null
          origin_other_name: string | null
          origin_referrer_name: string | null
          origin_type: string
          patient_code: string | null
          phone: string | null
          profession: string | null
          pronoun: string | null
          recurring_time: string
          recurring_weekdays: number[]
          registration_complete: boolean
          responsible_cpf: string | null
          responsible_name: string | null
          responsible_relationship: string | null
          rg: string | null
          state: string | null
          status: string
          street: string | null
          surgeries: string | null
          updated_at: string
          user_id: string
          uses_responsible_cpf: boolean
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
          clinical_profile?: Json | null
          continuous_medications?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          gender?: string | null
          guardian_consent?: Json | null
          id?: string
          is_recurring?: boolean
          name: string
          neighborhood?: string | null
          origin_insurance_member_id?: string | null
          origin_insurance_plan?: string | null
          origin_insurance_provider?: string | null
          origin_other_description?: string | null
          origin_other_name?: string | null
          origin_referrer_name?: string | null
          origin_type?: string
          patient_code?: string | null
          phone?: string | null
          profession?: string | null
          pronoun?: string | null
          recurring_time?: string
          recurring_weekdays?: number[]
          registration_complete?: boolean
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_relationship?: string | null
          rg?: string | null
          state?: string | null
          status?: string
          street?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id: string
          uses_responsible_cpf?: boolean
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
          clinical_profile?: Json | null
          continuous_medications?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          gender?: string | null
          guardian_consent?: Json | null
          id?: string
          is_recurring?: boolean
          name?: string
          neighborhood?: string | null
          origin_insurance_member_id?: string | null
          origin_insurance_plan?: string | null
          origin_insurance_provider?: string | null
          origin_other_description?: string | null
          origin_other_name?: string | null
          origin_referrer_name?: string | null
          origin_type?: string
          patient_code?: string | null
          phone?: string | null
          profession?: string | null
          pronoun?: string | null
          recurring_time?: string
          recurring_weekdays?: number[]
          registration_complete?: boolean
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_relationship?: string | null
          rg?: string | null
          state?: string | null
          status?: string
          street?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id?: string
          uses_responsible_cpf?: boolean
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
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          last_used_at: string | null
          role: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_used_at?: string | null
          role?: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_used_at?: string | null
          role?: Database["public"]["Enums"]["platform_admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_events: {
        Row: {
          actor_platform_role: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id: string
          clinic_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          actor_platform_role: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id: string
          clinic_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_platform_role?: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id?: string
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_clinic_access_sessions: {
        Row: {
          actor_user_id: string
          clinic_id: string
          ended_at: string | null
          id: string
          last_seen_at: string
          reason: string
          started_at: string
        }
        Insert: {
          actor_user_id: string
          clinic_id: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          reason: string
          started_at?: string
        }
        Update: {
          actor_user_id?: string
          clinic_id?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          reason?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_clinic_access_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedbacks: {
        Row: {
          admin_notes: string | null
          average_rating: number | null
          clinic_id: string | null
          clinic_name: string | null
          created_at: string
          id: string
          opinion: string | null
          page_url: string | null
          problem_report: string | null
          ratings: Json
          status: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          average_rating?: number | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          id?: string
          opinion?: string | null
          page_url?: string | null
          problem_report?: string | null
          ratings?: Json
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          average_rating?: number | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          id?: string
          opinion?: string | null
          page_url?: string | null
          problem_report?: string | null
          ratings?: Json
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedbacks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_release_note_items: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["platform_release_note_category"]
          created_at: string
          id: string
          release_id: string
          sort_order: number
          title: string
        }
        Insert: {
          body?: string | null
          category: Database["public"]["Enums"]["platform_release_note_category"]
          created_at?: string
          id?: string
          release_id: string
          sort_order?: number
          title: string
        }
        Update: {
          body?: string | null
          category?: Database["public"]["Enums"]["platform_release_note_category"]
          created_at?: string
          id?: string
          release_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_release_note_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_releases: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          published_at: string
          summary: string | null
          title: string
          updated_at: string
          version: string
          version_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          summary?: string | null
          title: string
          updated_at?: string
          version: string
          version_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string
          version_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: Json
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          clinic_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_password_changed_at: string | null
          last_seen_at: string | null
          owner_terms_accepted_at: string | null
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
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_password_changed_at?: string | null
          last_seen_at?: string | null
          owner_terms_accepted_at?: string | null
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
          clinic_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_password_changed_at?: string | null
          last_seen_at?: string | null
          owner_terms_accepted_at?: string | null
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
      session_shares: {
        Row: {
          access_level: string
          clinic_id: string
          created_at: string
          id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          session_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          access_level?: string
          clinic_id: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          session_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          access_level?: string
          clinic_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          session_id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_shares_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          amount_charged_cents: number
          amount_original_cents: number
          amount_paid_cents: number
          anamnesis: Json | null
          anamnesis_form_response: Json | null
          anamnesis_template_id: string | null
          clinic_id: string | null
          complexity_score: number | null
          created_at: string
          evolution_group_id: string | null
          group_id: string | null
          id: string
          notes: string | null
          pain_score: number | null
          parent_session_id: string | null
          patient_arrived_at: string | null
          patient_id: string
          payment_adjustment_reason: string | null
          payment_installments: number
          payment_method: string
          payment_plan_id: string | null
          payment_plan_session_index: number | null
          payment_status: string
          payment_status_date: string | null
          provider_id: string | null
          scheduled_start_at: string | null
          session_date: string
          status: string
          treatment: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_charged_cents?: number
          amount_original_cents?: number
          amount_paid_cents?: number
          anamnesis?: Json | null
          anamnesis_form_response?: Json | null
          anamnesis_template_id?: string | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          evolution_group_id?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          parent_session_id?: string | null
          patient_arrived_at?: string | null
          patient_id: string
          payment_adjustment_reason?: string | null
          payment_installments?: number
          payment_method?: string
          payment_plan_id?: string | null
          payment_plan_session_index?: number | null
          payment_status?: string
          payment_status_date?: string | null
          provider_id?: string | null
          scheduled_start_at?: string | null
          session_date?: string
          status?: string
          treatment?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_charged_cents?: number
          amount_original_cents?: number
          amount_paid_cents?: number
          anamnesis?: Json | null
          anamnesis_form_response?: Json | null
          anamnesis_template_id?: string | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          evolution_group_id?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          parent_session_id?: string | null
          patient_arrived_at?: string | null
          patient_id?: string
          payment_adjustment_reason?: string | null
          payment_installments?: number
          payment_method?: string
          payment_plan_id?: string | null
          payment_plan_session_index?: number | null
          payment_status?: string
          payment_status_date?: string | null
          provider_id?: string | null
          scheduled_start_at?: string | null
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
            foreignKeyName: "sessions_evolution_group_id_fkey"
            columns: ["evolution_group_id"]
            isOneToOne: false
            referencedRelation: "patient_evolution_groups"
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
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "patient_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupons: {
        Row: {
          applicable_plans: string[] | null
          code: string
          created_at: string
          description: string | null
          discount_duration_months: number | null
          discount_duration_type: string
          discount_type: string
          discount_value: number
          eligibility_rules: Json
          id: string
          is_active: boolean
          max_redemptions: number | null
          times_redeemed: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: string[] | null
          code: string
          created_at?: string
          description?: string | null
          discount_duration_months?: number | null
          discount_duration_type?: string
          discount_type: string
          discount_value?: number
          eligibility_rules?: Json
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          times_redeemed?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: string[] | null
          code?: string
          created_at?: string
          description?: string | null
          discount_duration_months?: number | null
          discount_duration_type?: string
          discount_type?: string
          discount_value?: number
          eligibility_rules?: Json
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          times_redeemed?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string
          asaas_subscription_id: string | null
          bank_slip_url: string | null
          billing_type: string | null
          charge_type: string
          clinic_id: string
          created_at: string
          discount_amount: number | null
          due_date: string
          id: string
          installment_number: number | null
          invoice_url: string | null
          metadata: Json | null
          net_value: number | null
          original_value: number | null
          paid_at: string | null
          payment_date: string | null
          pix_copy_paste: string | null
          pix_expiration_date: string | null
          pix_qr_code: string | null
          status: string
          subscription_id: string | null
          total_installments: number | null
          value: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          charge_type?: string
          clinic_id: string
          created_at?: string
          discount_amount?: number | null
          due_date: string
          id?: string
          installment_number?: number | null
          invoice_url?: string | null
          metadata?: Json | null
          net_value?: number | null
          original_value?: number | null
          paid_at?: string | null
          payment_date?: string | null
          pix_copy_paste?: string | null
          pix_expiration_date?: string | null
          pix_qr_code?: string | null
          status?: string
          subscription_id?: string | null
          total_installments?: number | null
          value: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          charge_type?: string
          clinic_id?: string
          created_at?: string
          discount_amount?: number | null
          due_date?: string
          id?: string
          installment_number?: number | null
          invoice_url?: string | null
          metadata?: Json | null
          net_value?: number | null
          original_value?: number | null
          paid_at?: string | null
          payment_date?: string | null
          pix_copy_paste?: string | null
          pix_expiration_date?: string | null
          pix_qr_code?: string | null
          status?: string
          subscription_id?: string | null
          total_installments?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "clinic_subscriptions"
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
      telemetry_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          pathname: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          pathname: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          pathname?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_clinic_contexts: {
        Row: {
          clinic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_clinic_contexts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_governance_overrides: {
        Row: {
          max_actions: number
          time_window_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          max_actions?: number
          time_window_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          max_actions?: number
          time_window_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_punishments: {
        Row: {
          applied_at: string
          applied_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_manual: boolean
          punishment_type: string
          reason: string
          user_id: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          punishment_type: string
          reason: string
          user_id?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          punishment_type?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_release_note_states: {
        Row: {
          created_at: string
          last_seen_at: string
          last_seen_release_id: string | null
          last_seen_release_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          last_seen_release_id?: string | null
          last_seen_release_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          last_seen_release_id?: string | null
          last_seen_release_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_release_note_states_last_seen_release_id_fkey"
            columns: ["last_seen_release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
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
          force_signed_out_at: string | null
          forced_out_by: string | null
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
          force_signed_out_at?: string | null
          forced_out_by?: string | null
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
          force_signed_out_at?: string | null
          forced_out_by?: string | null
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
      user_telemetry_summaries: {
        Row: {
          clinic_id: string | null
          docs_printed_count: number
          dwell_time_seconds: number
          id: string
          is_spam_flagged: boolean
          page_views_count: number
          pdf_exported_count: number
          prints_detected_count: number
          spam_reason: string | null
          summary_date: string
          top_routes: Json
          updated_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          clinic_id?: string | null
          docs_printed_count?: number
          dwell_time_seconds?: number
          id?: string
          is_spam_flagged?: boolean
          page_views_count?: number
          pdf_exported_count?: number
          prints_detected_count?: number
          spam_reason?: string | null
          summary_date?: string
          top_routes?: Json
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          clinic_id?: string | null
          docs_printed_count?: number
          dwell_time_seconds?: number
          id?: string
          is_spam_flagged?: boolean
          page_views_count?: number
          pdf_exported_count?: number
          prints_detected_count?: number
          spam_reason?: string | null
          summary_date?: string
          top_routes?: Json
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_telemetry_summaries_clinic_id_fkey"
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
      accept_clinic_collaborator_invitation: {
        Args: { _full_name?: string; _token: string }
        Returns: Json
      }
      accept_current_user_clinic_invitation: {
        Args: { _invitation_id: string }
        Returns: Json
      }
      acknowledge_current_user_release_notes: {
        Args: { _release_id?: string }
        Returns: Json
      }
      activate_clinic_free_trial:
        | {
            Args: {
              _clinic_id: string
              _plan_type: Database["public"]["Enums"]["subscription_plan"]
            }
            Returns: Json
          }
        | { Args: { _clinic_id: string; _plan_type?: string }; Returns: Json }
      apply_user_punishment: {
        Args: {
          _duration_minutes: number
          _is_manual?: boolean
          _punishment_type: string
          _reason: string
          _user_id: string
        }
        Returns: string
      }
      authorize_minor_guardian_consent: {
        Args: { _consent_data: Json; _password: string; _token: string }
        Returns: Json
      }
      buy_clinic_subaccount_extra_spaces: {
        Args: { _billing_type?: string; _clinic_id: string; _quantity: number }
        Returns: Json
      }
      can_insert_session: {
        Args: { _clinic_id: string; _provider_id: string; _user_id: string }
        Returns: boolean
      }
      can_perform_action: {
        Args: { _capability: string; _clinic_id?: string }
        Returns: boolean
      }
      can_read_clinic_data: { Args: { _clinic_id: string }; Returns: boolean }
      can_read_session: { Args: { _session_id: string }; Returns: boolean }
      can_share_session: { Args: { _session_id: string }; Returns: boolean }
      cancel_clinic_collaborator_invitation: {
        Args: { _invitation_id: string }
        Returns: Json
      }
      check_clinic_plan_quota: {
        Args: { p_clinic_id: string; p_feature_type: string }
        Returns: Json
      }
      cleanup_old_telemetry_events: {
        Args: {
          _page_view_retention_days?: number
          _security_event_retention_days?: number
        }
        Returns: {
          deleted_page_views: number
          deleted_security_events: number
        }[]
      }
      cleanup_user_security_sessions: {
        Args: {
          _inactive_window?: string
          _retention_window?: string
          _user_id?: string
        }
        Returns: Json
      }
      clear_current_user_notifications: { Args: never; Returns: Json }
      confirm_asaas_subscription_payment: {
        Args: {
          _asaas_payment_id: string
          _billing_type?: string
          _clinic_id: string
          _paid_value: number
          _payment_date?: string
        }
        Returns: Json
      }
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
      create_current_user_notification: {
        Args: {
          _action_label?: string
          _action_url?: string
          _body: string
          _category: string
          _clinic_id: string
          _event_type: string
          _payload?: Json
          _title: string
        }
        Returns: string
      }
      create_due_agenda_reminder_notifications: {
        Args: { _lookahead?: string }
        Returns: number
      }
      create_patient_registration_link: {
        Args: { _patient_id: string }
        Returns: Json
      }
      create_user_notification: {
        Args: {
          _action_label?: string
          _action_url?: string
          _actor_user_id: string
          _body: string
          _category: string
          _clinic_id: string
          _event_type: string
          _payload?: Json
          _source_event_id?: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      current_user_can: {
        Args: { _capability: string; _clinic_id?: string }
        Returns: boolean
      }
      current_user_is_clinic_manager: {
        Args: { _clinic_id: string }
        Returns: boolean
      }
      decline_current_user_clinic_invitation: {
        Args: { _invitation_id: string }
        Returns: Json
      }
      delete_current_user_notification: {
        Args: { _notification_id: string }
        Returns: Json
      }
      end_clinic_user_security_sessions: {
        Args: { _clinic_id?: string; _target_user_id: string }
        Returns: Json
      }
      end_current_security_session: {
        Args: { _session_key: string }
        Returns: Json
      }
      end_other_security_sessions: {
        Args: { _current_session_key: string }
        Returns: Json
      }
      end_platform_clinic_access: { Args: never; Returns: Json }
      ensure_clinic_patient: {
        Args: {
          _clinic_id: string
          _cpf?: string
          _date_of_birth: string
          _email?: string
          _gender?: string
          _name: string
          _name_key: string
          _phone?: string
          _pronoun?: string
          _responsible_name?: string
          _responsible_relationship?: string
          _rg?: string
          _uses_responsible_cpf?: boolean
        }
        Returns: Json
      }
      ensure_notification_preferences: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          notify_clinic_access: boolean
          notify_event_reminders: boolean
          notify_patient_saved: boolean
          notify_security: boolean
          notify_session_activity: boolean
          notify_system: boolean
          sound_key: string
          sound_mode: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_team_development_profile: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: string
      }
      expire_abandoned_security_sessions: {
        Args: { _abandoned_window?: string }
        Returns: Json
      }
      finalize_overdue_agenda_events: {
        Args: { _batch_size?: number; _timezone?: string }
        Returns: {
          cancelled_count: number
          deleted_event_count: number
        }[]
      }
      generate_next_patient_code: {
        Args: { _clinic_id: string }
        Returns: string
      }
      generate_profile_public_code: { Args: never; Returns: string }
      generate_profile_public_code_for_clinic: {
        Args: { _clinic_id: string }
        Returns: string
      }
      get_active_platform_clinic_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_asaas_webhook_logs: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          asaas_event_id: string
          created_at: string
          error_message: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string
          signature: string
        }[]
      }
      get_clinic_collaborator_invitation: {
        Args: { _token: string }
        Returns: Json
      }
      get_clinic_dashboard_analytics: {
        Args: { _clinic_id: string; _year?: number }
        Returns: Json
      }
      get_clinic_feature_flags: { Args: { _clinic_id: string }; Returns: Json }
      get_clinic_pending_collaborator_invitations: {
        Args: { _clinic_id: string }
        Returns: Json
      }
      get_clinic_share_collaborators: {
        Args: { _clinic_id?: string }
        Returns: Json
      }
      get_clinic_subscription_summary: {
        Args: { _clinic_id: string }
        Returns: {
          account_owner_user_id: string
          additional_concurrent_access_count: number
          applied_coupon_id: string
          asaas_customer_id: string
          asaas_subscription_id: string
          auto_renew: boolean
          base_concurrent_access_count: number
          base_monthly_price: number
          base_subaccount_limit: number
          billing_cycle: string
          billing_email: string
          billing_name: string
          clinic_id: string
          coupon_code: string
          cpf_cnpj: string
          current_period_end: string
          current_period_start: string
          days_remaining: number
          discount_fixed_amount: number
          discount_percentage: number
          expires_at: string
          is_expired: boolean
          next_due_date: string
          override_at: string
          override_by_user_id: string
          override_reason: string
          payment_method: string
          period_duration_days: number
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          purchased_subaccount_extra_count: number
          status: string
          subscription_id: string
          total_concurrent_access_limit: number
          total_recurring_monthly_price: number
          total_subaccount_limit: number
          trial_ends_at: string
        }[]
      }
      get_current_platform_role: {
        Args: never
        Returns: Database["public"]["Enums"]["platform_admin_role"]
      }
      get_current_user_pending_release_notes: { Args: never; Returns: Json }
      get_patient_registration_form: {
        Args: { _password: string; _token: string }
        Returns: Json
      }
      get_personal_professional_sessions_portfolio: {
        Args: {
          _clinic_id?: string
          _limit?: number
          _offset?: number
          _query?: string
        }
        Returns: {
          anamnesis_base_schema: Json
          anamnesis_form_response: Json
          care_lines: Json
          clinic_id: string
          clinic_name: string
          clinic_route_key: string
          complexity_score: number
          created_at: string
          notes_sanitized: string
          pain_score: number
          patient_demographics: string
          patient_id: string
          patient_name: string
          patient_pseudonym: string
          patient_ref: string
          session_date: string
          session_id: string
          session_status: string
          treatment_sanitized: string
        }[]
      }
      get_platform_clinic_detail: {
        Args: { _clinic_id: string }
        Returns: Json
      }
      get_platform_clinic_detail_by_route_key: {
        Args: { _route_key: string }
        Returns: Json
      }
      get_platform_clinic_forms_summary_by_route_key: {
        Args: { _route_key: string }
        Returns: Json
      }
      get_platform_clinic_roles_overview: {
        Args: { _clinic_id: string }
        Returns: Json
      }
      get_platform_dashboard: { Args: never; Returns: Json }
      get_platform_person_detail: {
        Args: { _item_id: string; _item_type: string }
        Returns: Json
      }
      get_session_share_recipients: {
        Args: { _session_id: string }
        Returns: Json
      }
      get_session_share_summary: {
        Args: { _session_ids: string[] }
        Returns: Json
      }
      get_user_active_governance: {
        Args: { _user_id: string }
        Returns: {
          applied_at: string
          applied_by_name: string
          expires_at: string
          is_manual: boolean
          punishment_id: string
          punishment_type: string
          reason: string
        }[]
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      handle_personal_signup: {
        Args: {
          _birth_date?: string
          _cpf?: string
          _email: string
          _full_name?: string
          _phone?: string
          _user_id: string
        }
        Returns: Json
      }
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
        | {
            Args: {
              _clinic_name?: string
              _cnpj: string
              _email: string
              _full_name?: string
              _subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _allow_duplicate_cnpj?: boolean
              _clinic_name?: string
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
      increment_community_template_import: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      invite_clinic_collaborator: {
        Args: {
          _clinic_id?: string
          _email?: string
          _job_title?: string
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _specialty?: string
        }
        Returns: Json
      }
      is_active_clinic_member: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_clinic_read_only: { Args: { _clinic_id: string }; Returns: boolean }
      is_clinic_subscription_manager: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_platform_owner_mfa_verified: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      leave_current_user_clinic: { Args: { _clinic_id: string }; Returns: Json }
      list_current_user_clinic_invitations: {
        Args: never
        Returns: {
          clinic_id: string
          clinic_logo_url: string
          clinic_name: string
          clinic_route_key: string
          created_at: string
          expires_at: string
          invitation_id: string
          invited_by_name: string
          job_title: string
          operational_role: Database["public"]["Enums"]["operational_role_type"]
          specialty: string
        }[]
      }
      list_current_user_clinics: {
        Args: never
        Returns: {
          account_role: Database["public"]["Enums"]["account_role_type"]
          clinic_account_owner_user_id: string
          clinic_active_access_count: number
          clinic_active_access_users: Json
          clinic_concurrent_access_limit: number
          clinic_id: string
          clinic_logo_url: string
          clinic_name: string
          clinic_route_key: string
          clinic_subaccount_limit: number
          clinic_subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          is_active: boolean
          joined_at: string
          membership_id: string
          membership_status: Database["public"]["Enums"]["membership_status_type"]
          operational_role: Database["public"]["Enums"]["operational_role_type"]
        }[]
      }
      list_current_user_notification_preferences: {
        Args: never
        Returns: {
          notify_clinic_access: boolean
          notify_event_reminders: boolean
          notify_patient_saved: boolean
          notify_security: boolean
          notify_session_activity: boolean
          notify_system: boolean
          sound_key: string
          sound_mode: string
        }[]
      }
      list_current_user_notifications: {
        Args: never
        Returns: {
          action_label: string
          action_url: string
          actor_name: string
          actor_user_id: string
          body: string
          category: string
          clinic_id: string
          clinic_name: string
          created_at: string
          event_type: string
          notification_id: string
          payload: Json
          read_at: string
          title: string
        }[]
      }
      list_feature_flags: {
        Args: { _clinic_id?: string }
        Returns: {
          clinic_id: string
          clinic_name: string
          created_at: string
          created_by: string
          description: string
          expires_at: string
          id: string
          is_active_now: boolean
          key: string
          reason: string
          scope: Database["public"]["Enums"]["feature_flag_scope"]
          starts_at: string
          tag_id: string
          updated_at: string
          updated_by: string
          value: Json
        }[]
      }
      list_platform_audit_events: {
        Args: { _clinic_id?: string; _limit?: number }
        Returns: {
          actor_email: string
          actor_name: string
          actor_platform_role: Database["public"]["Enums"]["platform_admin_role"]
          actor_user_id: string
          clinic_id: string
          clinic_name: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason: string
        }[]
      }
      list_platform_clinics: {
        Args: never
        Returns: {
          active_flags_count: number
          clinic_cnpj: string
          clinic_concurrent_access_limit: number
          clinic_created_at: string
          clinic_id: string
          clinic_name: string
          clinic_route_key: string
          clinic_subaccount_limit: number
          clinic_subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          clinic_updated_at: string
          collaborators_count: number
          last_activity_at: string
          owner_email: string
          owner_name: string
          owner_user_id: string
          patients_count: number
          sessions_count: number
        }[]
      }
      list_platform_directory: {
        Args: {
          _kind?: string
          _limit?: number
          _query?: string
          _status?: string
          _tag_id?: string
        }
        Returns: {
          clinic_id: string
          clinic_name: string
          item_id: string
          item_type: string
          metadata: Json
          primary_document: string
          secondary_document: string
          status: string
          subtitle: string
          title: string
          updated_at: string
        }[]
      }
      list_platform_telemetry_events: {
        Args: { _clinic_id: string; _limit?: number }
        Returns: {
          clinic_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          pathname: string
          resource_id: string
          resource_type: string
          user_id: string
          user_name: string
        }[]
      }
      list_platform_user_telemetry_events: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          clinic_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          pathname: string
          resource_id: string
          resource_type: string
          user_id: string
          user_name: string
        }[]
      }
      log_platform_audit_event: {
        Args: {
          _clinic_id?: string
          _event_type: string
          _metadata?: Json
          _reason?: string
        }
        Returns: string
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
      manage_clinic_subscription_plan: {
        Args: {
          _billing_cycle?: string
          _clinic_id: string
          _new_plan: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: Json
      }
      normalize_patient_name_key: { Args: { _value: string }; Returns: string }
      notification_category_enabled: {
        Args: {
          _category: string
          _preferences: Database["public"]["Tables"]["notification_preferences"]["Row"]
        }
        Returns: boolean
      }
      notify_clinic_collaborator_presence: {
        Args: { _clinic_id: string; _status: string; _user_id: string }
        Returns: undefined
      }
      platform_create_clinic: {
        Args: {
          _cnpj: string
          _name: string
          _reason?: string
          _subaccount_limit?: number
          _subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: Json
      }
      platform_normalize_search: { Args: { _value: string }; Returns: string }
      platform_override_clinic_subscription: {
        Args: {
          _clinic_id: string
          _concurrent_access_limit?: number
          _new_plan?: Database["public"]["Enums"]["subscription_plan"]
          _next_due_date?: string
          _reason?: string
          _status?: string
          _subaccount_limit?: number
        }
        Returns: Json
      }
      pseudonymize_patient_name: { Args: { _name: string }; Returns: string }
      raise_exception_json: { Args: { _message: string }; Returns: Json }
      record_asaas_webhook_event: {
        Args: {
          _event_id: string
          _event_type: string
          _payload: Json
          _signature?: string
        }
        Returns: Json
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
      resend_clinic_collaborator_invitation: {
        Args: { _invitation_id: string }
        Returns: Json
      }
      revoke_clinic_member_access: {
        Args: { _membership_id: string }
        Returns: Json
      }
      revoke_session_share: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      revoke_user_punishment: {
        Args: { _punishment_id: string; _reason: string }
        Returns: undefined
      }
      sanitize_clinical_free_text: { Args: { _text: string }; Returns: string }
      set_current_user_active_clinic: {
        Args: { _clinic_id: string }
        Returns: Json
      }
      set_current_user_active_clinic_by_route_key: {
        Args: { _route_key: string }
        Returns: Json
      }
      share_sessions_with_collaborators:
        | {
            Args: { _session_ids: string[]; _user_ids: string[] }
            Returns: Json
          }
        | {
            Args: {
              _access_level?: string
              _session_ids: string[]
              _user_ids: string[]
            }
            Returns: Json
          }
      slugify_text: { Args: { _val: string }; Returns: string }
      start_platform_clinic_access: {
        Args: { _clinic_id: string; _reason: string }
        Returns: Json
      }
      submit_patient_registration_form: {
        Args: { _password: string; _payload: Json; _token: string }
        Returns: Json
      }
      submit_user_platform_feedback: {
        Args: {
          _clinic_id: string
          _opinion?: string
          _page_url?: string
          _problem_report?: string
          _ratings: Json
          _user_agent?: string
        }
        Returns: string
      }
      toggle_community_template_like: {
        Args: { p_template_id: string }
        Returns: Json
      }
      toggle_subscription_auto_renew: {
        Args: { _auto_renew: boolean; _clinic_id: string }
        Returns: Json
      }
      trim_user_notifications: {
        Args: { _user_id: string }
        Returns: undefined
      }
      update_clinic_collaborator_invitation: {
        Args: {
          _invitation_id: string
          _job_title?: string
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _specialty?: string
        }
        Returns: Json
      }
      update_clinic_concurrent_accesses: {
        Args: { _clinic_id: string; _extra_concurrent: number }
        Returns: Json
      }
      update_clinic_member_operational_fields: {
        Args: {
          _job_title?: string
          _membership_id: string
          _membership_status?: Database["public"]["Enums"]["membership_status_type"]
          _operational_role?: Database["public"]["Enums"]["operational_role_type"]
          _specialty?: string
          _working_hours?: string
        }
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
      update_current_user_notification_preferences: {
        Args: {
          _notify_clinic_access?: boolean
          _notify_event_reminders?: boolean
          _notify_patient_saved?: boolean
          _notify_security?: boolean
          _notify_session_activity?: boolean
          _notify_system?: boolean
          _sound_key?: string
          _sound_mode?: string
        }
        Returns: Json
      }
      update_patient_guardian_consent: {
        Args: { _consent_payload: Json; _patient_id: string }
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
      upsert_feature_flag: {
        Args: {
          _clinic_id?: string
          _description?: string
          _expires_at?: string
          _key: string
          _reason?: string
          _scope: Database["public"]["Enums"]["feature_flag_scope"]
          _starts_at?: string
          _tag_id?: string
          _value?: Json
        }
        Returns: string
      }
      upsert_user_telemetry_summary: {
        Args: {
          _clinic_id: string
          _docs_printed: number
          _dwell_seconds: number
          _is_spam_flagged?: boolean
          _page_views: number
          _pdf_exported: number
          _prints_detected: number
          _spam_reason?: string
          _top_routes: Json
          _user_name: string
        }
        Returns: undefined
      }
      user_has_active_clinic_membership: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      validate_subscription_coupon:
        | { Args: { _code: string; _plan_type?: string }; Returns: Json }
        | {
            Args: {
              _billing_cycle?: string
              _clinic_id?: string
              _code: string
              _plan_type?: string
            }
            Returns: Json
          }
      validate_user_clinic: {
        Args: { _cnpj: string; _user_id: string }
        Returns: boolean
      }
      verify_password_recovery_identity: {
        Args: { _cpf: string; _email: string }
        Returns: boolean
      }
    }
    Enums: {
      account_role_type: "account_owner"
      app_role: "super_admin" | "clinic_admin" | "user"
      feature_flag_scope: "global" | "clinic" | "tag"
      membership_status_type: "invited" | "active" | "inactive" | "suspended"
      operational_role_type:
        | "owner"
        | "admin"
        | "professional"
        | "assistant"
        | "estagiario"
      patient_file_upload_category:
        | "anamnesis"
        | "exam"
        | "image"
        | "document"
        | "other"
      patient_file_upload_status: "pending" | "uploaded" | "failed" | "deleted"
      platform_admin_role: "platform_owner"
      platform_release_note_category: "fixed" | "added" | "changed" | "removed"
      subscription_plan: "solo" | "clinic" | "enterprise"
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
      feature_flag_scope: ["global", "clinic", "tag"],
      membership_status_type: ["invited", "active", "inactive", "suspended"],
      operational_role_type: [
        "owner",
        "admin",
        "professional",
        "assistant",
        "estagiario",
      ],
      patient_file_upload_category: [
        "anamnesis",
        "exam",
        "image",
        "document",
        "other",
      ],
      patient_file_upload_status: ["pending", "uploaded", "failed", "deleted"],
      platform_admin_role: ["platform_owner"],
      platform_release_note_category: ["fixed", "added", "changed", "removed"],
      subscription_plan: ["solo", "clinic", "enterprise"],
    },
  },
} as const

