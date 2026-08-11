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
    PostgrestVersion: "14.15"
  }
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
      allowed_emails: {
        Row: {
          display_name: string
          email: string
        }
        Insert: {
          display_name: string
          email: string
        }
        Update: {
          display_name?: string
          email?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          actual: number | null
          category: string | null
          created_at: string
          estimate: number | null
          funding: Database["public"]["Enums"]["funding_source"]
          id: string
          label: string
          market_avg: number | null
          market_note: string | null
          memo: string | null
          paid_at: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          actual?: number | null
          category?: string | null
          created_at?: string
          estimate?: number | null
          funding?: Database["public"]["Enums"]["funding_source"]
          id?: string
          label: string
          market_avg?: number | null
          market_note?: string | null
          memo?: string | null
          paid_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          actual?: number | null
          category?: string | null
          created_at?: string
          estimate?: number | null
          funding?: Database["public"]["Enums"]["funding_source"]
          id?: string
          label?: string
          market_avg?: number | null
          market_note?: string | null
          memo?: string | null
          paid_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      day_of_config: {
        Row: {
          banquet_from_offset_min: number
          banquet_to_offset_min: number
          ceremony_at: string
          guarantee_count: number | null
          hall: string | null
          id: number
          note: string | null
          updated_at: string
        }
        Insert: {
          banquet_from_offset_min?: number
          banquet_to_offset_min?: number
          ceremony_at: string
          guarantee_count?: number | null
          hall?: string | null
          id?: number
          note?: string | null
          updated_at?: string
        }
        Update: {
          banquet_from_offset_min?: number
          banquet_to_offset_min?: number
          ceremony_at?: string
          guarantee_count?: number | null
          hall?: string | null
          id?: number
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      day_of_events: {
        Row: {
          created_at: string
          duration_min: number | null
          id: string
          location: string | null
          note: string | null
          offset_min: number
          phase: Database["public"]["Enums"]["day_of_phase"]
          role_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number | null
          id?: string
          location?: string | null
          note?: string | null
          offset_min: number
          phase: Database["public"]["Enums"]["day_of_phase"]
          role_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number | null
          id?: string
          location?: string | null
          note?: string | null
          offset_min?: number
          phase?: Database["public"]["Enums"]["day_of_phase"]
          role_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_of_events_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "day_of_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_of_items: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          note: string | null
          owner: Database["public"]["Enums"]["assignee"] | null
          packed: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          owner?: Database["public"]["Enums"]["assignee"] | null
          packed?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          owner?: Database["public"]["Enums"]["assignee"] | null
          packed?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      day_of_roles: {
        Row: {
          confirmed: boolean
          contact: string | null
          created_at: string
          fee: number | null
          id: string
          note: string | null
          person_name: string | null
          role: string
          side: Database["public"]["Enums"]["wedding_side"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          contact?: string | null
          created_at?: string
          fee?: number | null
          id?: string
          note?: string | null
          person_name?: string | null
          role: string
          side?: Database["public"]["Enums"]["wedding_side"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          contact?: string | null
          created_at?: string
          fee?: number | null
          id?: string
          note?: string | null
          person_name?: string | null
          role?: string
          side?: Database["public"]["Enums"]["wedding_side"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee: Database["public"]["Enums"]["assignee"] | null
          category: string
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string | null
          id: string
          note: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assignee?: Database["public"]["Enums"]["assignee"] | null
          category: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assignee?: Database["public"]["Enums"]["assignee"] | null
          category?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          category: string | null
          contact: string | null
          created_at: string
          id: string
          memo: string | null
          name: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      day_of_schedule: {
        Row: {
          duration_min: number | null
          ends_at: string | null
          id: string | null
          location: string | null
          note: string | null
          offset_min: number | null
          phase: Database["public"]["Enums"]["day_of_phase"] | null
          role_id: string | null
          role_name: string | null
          role_person: string | null
          sort_order: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_of_events_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "day_of_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_member: { Args: never; Returns: boolean }
    }
    Enums: {
      assignee: "주호" | "지영" | "같이"
      day_of_phase: "준비" | "접수" | "예식" | "촬영" | "연회" | "마무리"
      funding_source: "선지출" | "축의금"
      task_status: "todo" | "doing" | "done" | "hold"
      wedding_side: "신랑" | "신부" | "공통"
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
      assignee: ["주호", "지영", "같이"],
      day_of_phase: ["준비", "접수", "예식", "촬영", "연회", "마무리"],
      funding_source: ["선지출", "축의금"],
      task_status: ["todo", "doing", "done", "hold"],
      wedding_side: ["신랑", "신부", "공통"],
    },
  },
} as const
