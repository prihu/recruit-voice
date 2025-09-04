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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_archive_log: {
        Row: {
          agent_id: string
          archived_at: string | null
          id: string
          organization_id: string
          reason: string
          role_id: string
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
          id?: string
          organization_id: string
          reason: string
          role_id: string
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
          id?: string
          organization_id?: string
          reason?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_archive_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_archive_log_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          candidate_id: string | null
          event_category: string | null
          event_data: Json | null
          event_type: string
          id: string
          organization_id: string
          role_id: string | null
          screen_id: string | null
          timestamp: string
        }
        Insert: {
          candidate_id?: string | null
          event_category?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          organization_id: string
          role_id?: string | null
          screen_id?: string | null
          timestamp?: string
        }
        Update: {
          candidate_id?: string | null
          event_category?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          organization_id?: string
          role_id?: string | null
          screen_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_operations: {
        Row: {
          completed_at: string | null
          completed_count: number
          created_at: string
          failed_count: number
          id: string
          operation_type: string
          organization_id: string
          role_id: string
          settings: Json | null
          started_at: string | null
          status: string
          total_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          operation_type?: string
          organization_id: string
          role_id: string
          settings?: Json | null
          started_at?: string | null
          status?: string
          total_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          operation_type?: string
          organization_id?: string
          role_id?: string
          settings?: Json | null
          started_at?: string | null
          status?: string
          total_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_sid: string | null
          cost: number | null
          created_at: string
          direction: string | null
          duration_seconds: number | null
          id: string
          organization_id: string
          phone_number: string
          recording_url: string | null
          screen_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          call_sid?: string | null
          cost?: number | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id: string
          phone_number: string
          recording_url?: string | null
          screen_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          call_sid?: string | null
          cost?: number | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          phone_number?: string
          recording_url?: string | null
          screen_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string | null
          email: string | null
          exp_years: number | null
          external_id: string | null
          id: string
          language: string | null
          location_pref: string | null
          name: string
          organization_id: string | null
          phone: string
          preferred_language: string | null
          salary_expectation: number | null
          skills: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          exp_years?: number | null
          external_id?: string | null
          id?: string
          language?: string | null
          location_pref?: string | null
          name: string
          organization_id?: string | null
          phone: string
          preferred_language?: string | null
          salary_expectation?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          exp_years?: number | null
          external_id?: string | null
          id?: string
          language?: string | null
          location_pref?: string | null
          name?: string
          organization_id?: string | null
          phone?: string
          preferred_language?: string | null
          salary_expectation?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_domain: string | null
          country: string | null
          created_at: string
          currency: string | null
          id: string
          name: string
          settings: Json | null
          timezone: string | null
          twilio_config: Json | null
          updated_at: string
        }
        Insert: {
          company_domain?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name: string
          settings?: Json | null
          timezone?: string | null
          twilio_config?: Json | null
          updated_at?: string
        }
        Update: {
          company_domain?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name?: string
          settings?: Json | null
          timezone?: string | null
          twilio_config?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          agent_created_at: string | null
          agent_error_message: string | null
          agent_last_used_at: string | null
          agent_sync_status: string | null
          call_window: Json | null
          created_at: string | null
          evaluation_criteria: string | null
          faq: Json | null
          id: string
          location: string
          organization_id: string | null
          questions: Json | null
          rules: Json | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          status: string | null
          summary: string | null
          title: string
          updated_at: string | null
          user_id: string
          voice_agent_id: string | null
          voice_enabled: boolean | null
        }
        Insert: {
          agent_created_at?: string | null
          agent_error_message?: string | null
          agent_last_used_at?: string | null
          agent_sync_status?: string | null
          call_window?: Json | null
          created_at?: string | null
          evaluation_criteria?: string | null
          faq?: Json | null
          id?: string
          location: string
          organization_id?: string | null
          questions?: Json | null
          rules?: Json | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          voice_agent_id?: string | null
          voice_enabled?: boolean | null
        }
        Update: {
          agent_created_at?: string | null
          agent_error_message?: string | null
          agent_last_used_at?: string | null
          agent_sync_status?: string | null
          call_window?: Json | null
          created_at?: string | null
          evaluation_criteria?: string | null
          faq?: Json | null
          id?: string
          location?: string
          organization_id?: string | null
          questions?: Json | null
          rules?: Json | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          voice_agent_id?: string | null
          voice_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_calls: {
        Row: {
          created_at: string
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          organization_id: string
          retry_count: number | null
          scheduled_time: string
          screen_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          organization_id: string
          retry_count?: number | null
          scheduled_time: string
          screen_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          organization_id?: string
          retry_count?: number | null
          scheduled_time?: string
          screen_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_calls_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_events: {
        Row: {
          event_data: Json | null
          event_type: string
          id: string
          screen_id: string
          timestamp: string | null
        }
        Insert: {
          event_data?: Json | null
          event_type: string
          id?: string
          screen_id: string
          timestamp?: string | null
        }
        Update: {
          event_data?: Json | null
          event_type?: string
          id?: string
          screen_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_events_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          ai_recommendations: Json | null
          ai_summary: string | null
          answers: Json | null
          attempts: number | null
          audio_url: string | null
          bulk_operation_id: string | null
          candidate_id: string
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          extracted_data: Json | null
          id: string
          organization_id: string | null
          outcome: string | null
          questions_answered: number | null
          reasons: string[] | null
          recording_url: string | null
          response_completeness: number | null
          role_id: string
          scheduled_at: string | null
          score: number | null
          screening_type: string | null
          session_id: string | null
          started_at: string | null
          status: string | null
          total_questions: number | null
          transcript: Json | null
          updated_at: string | null
          user_id: string
          voice_analytics: Json | null
        }
        Insert: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          answers?: Json | null
          attempts?: number | null
          audio_url?: string | null
          bulk_operation_id?: string | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          extracted_data?: Json | null
          id?: string
          organization_id?: string | null
          outcome?: string | null
          questions_answered?: number | null
          reasons?: string[] | null
          recording_url?: string | null
          response_completeness?: number | null
          role_id: string
          scheduled_at?: string | null
          score?: number | null
          screening_type?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
          total_questions?: number | null
          transcript?: Json | null
          updated_at?: string | null
          user_id: string
          voice_analytics?: Json | null
        }
        Update: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          answers?: Json | null
          attempts?: number | null
          audio_url?: string | null
          bulk_operation_id?: string | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          extracted_data?: Json | null
          id?: string
          organization_id?: string | null
          outcome?: string | null
          questions_answered?: number | null
          reasons?: string[] | null
          recording_url?: string | null
          response_completeness?: number | null
          role_id?: string
          scheduled_at?: string | null
          score?: number | null
          screening_type?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
          total_questions?: number | null
          transcript?: Json | null
          updated_at?: string | null
          user_id?: string
          voice_analytics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "screens_bulk_operation_id_fkey"
            columns: ["bulk_operation_id"]
            isOneToOne: false
            referencedRelation: "bulk_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screens_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screens_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_demo_org_for_user: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_org_admin: {
        Args: { _org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
