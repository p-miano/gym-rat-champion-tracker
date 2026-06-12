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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annual_awards: {
        Row: {
          athlete_id: string
          award_key: string
          computed_at: string
          details: Json | null
          year: number
        }
        Insert: {
          athlete_id: string
          award_key: string
          computed_at?: string
          details?: Json | null
          year: number
        }
        Update: {
          athlete_id?: string
          award_key?: string
          computed_at?: string
          details?: Json | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_awards_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string
          full_name: string
          gymrats_id: number
          id: string
          profile_picture_url: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          gymrats_id: number
          id?: string
          profile_picture_url?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          gymrats_id?: number
          id?: string
          profile_picture_url?: string | null
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          activity_type: string | null
          athlete_id: string
          description: string | null
          distance_km: number | null
          duration_min: number | null
          has_photo: boolean
          id: number
          invalid_reasons: string[]
          is_valid: boolean
          location_latitude: number | null
          location_longitude: number | null
          location_name: string | null
          month_id: string
          occurred_at: string
          photo_url: string | null
          raw: Json | null
          reactions: string[]
          title: string | null
        }
        Insert: {
          activity_type?: string | null
          athlete_id: string
          description?: string | null
          distance_km?: number | null
          duration_min?: number | null
          has_photo?: boolean
          id: number
          invalid_reasons?: string[]
          is_valid?: boolean
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          month_id: string
          occurred_at: string
          photo_url?: string | null
          raw?: Json | null
          reactions?: string[]
          title?: string | null
        }
        Update: {
          activity_type?: string | null
          athlete_id?: string
          description?: string | null
          distance_km?: number | null
          duration_min?: number | null
          has_photo?: boolean
          id?: number
          invalid_reasons?: string[]
          is_valid?: boolean
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string | null
          month_id?: string
          occurred_at?: string
          photo_url?: string | null
          raw?: Json | null
          reactions?: string[]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      month_results: {
        Row: {
          active_days: number
          athlete_id: string
          is_last: boolean
          is_winner: boolean
          month_id: string
          rank: number
          total_checkins: number
          total_distance_km: number
          total_minutes: number
        }
        Insert: {
          active_days?: number
          athlete_id: string
          is_last?: boolean
          is_winner?: boolean
          month_id: string
          rank: number
          total_checkins?: number
          total_distance_km?: number
          total_minutes?: number
        }
        Update: {
          active_days?: number
          athlete_id?: string
          is_last?: boolean
          is_winner?: boolean
          month_id?: string
          rank?: number
          total_checkins?: number
          total_distance_km?: number
          total_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "month_results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_results_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          created_by: string | null
          id: string
          imported_at: string
          month: number
          name: string
          source_id: number | null
          year: number
        }
        Insert: {
          created_by?: string | null
          id?: string
          imported_at?: string
          month: number
          name: string
          source_id?: number | null
          year: number
        }
        Update: {
          created_by?: string | null
          id?: string
          imported_at?: string
          month?: number
          name?: string
          source_id?: number | null
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
