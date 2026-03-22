export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clinics: {
        Row: {
          cnpj: string
          created_at: string
          custom_fields: Json | null
          id: string
          logo_url: string | null
          name: string
          theme: Json | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          custom_fields?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          custom_fields?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
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
          name: string
          patient_id: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          patient_id: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          patient_id?: string
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
          clinic_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      sessions: {
        Row: {
          anamnesis: Json | null
          clinic_id: string | null
          complexity_score: number | null
          created_at: string
          group_id: string | null
          id: string
          notes: string | null
          pain_score: number | null
          patient_id: string
          session_date: string
          status: string
          treatment: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnesis?: Json | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id: string
          session_date?: string
          status?: string
          treatment?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnesis?: Json | null
          clinic_id?: string | null
          complexity_score?: number | null
          created_at?: string
          group_id?: string | null
          id?: string
          notes?: string | null
          pain_score?: number | null
          patient_id?: string
          session_date?: string
          status?: string
          treatment?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_patient_registration_link: {
        Args: { _patient_id: string }
        Returns: Json
      }
      get_patient_registration_form: {
        Args: { _password: string; _token: string }
        Returns: Json
      }
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      handle_signup: {
        Args: {
          _cnpj: string
          _email: string
          _full_name?: string
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
      submit_patient_registration_form: {
        Args: { _password: string; _payload: Json; _token: string }
        Returns: Json
      }
      validate_user_clinic: {
        Args: { _cnpj: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "clinic_admin" | "user"
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
  public: {
    Enums: {
      app_role: ["super_admin", "clinic_admin", "user"],
    },
  },
} as const
