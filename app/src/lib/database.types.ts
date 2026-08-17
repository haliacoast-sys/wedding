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
          contracted: number | null
          created_at: string
          deal_status: string | null
          due_on: string | null
          estimate: number | null
          funding: Database["public"]["Enums"]["funding_source"]
          id: string
          label: string
          market_avg: number | null
          market_note: string | null
          memo: string | null
          owner: Database["public"]["Enums"]["assignee"] | null
          paid_at: string | null
          sort_order: number
          updated_at: string
          vendor_contact: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          actual?: number | null
          category?: string | null
          contracted?: number | null
          created_at?: string
          deal_status?: string | null
          due_on?: string | null
          estimate?: number | null
          funding?: Database["public"]["Enums"]["funding_source"]
          id?: string
          label: string
          market_avg?: number | null
          market_note?: string | null
          memo?: string | null
          owner?: Database["public"]["Enums"]["assignee"] | null
          paid_at?: string | null
          sort_order?: number
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          actual?: number | null
          category?: string | null
          contracted?: number | null
          created_at?: string
          deal_status?: string | null
          due_on?: string | null
          estimate?: number | null
          funding?: Database["public"]["Enums"]["funding_source"]
          id?: string
          label?: string
          market_avg?: number | null
          market_note?: string | null
          memo?: string | null
          owner?: Database["public"]["Enums"]["assignee"] | null
          paid_at?: string | null
          sort_order?: number
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
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
          expected_guests: number | null
          guarantee_count: number | null
          hall: string | null
          id: number
          meal_unit_price: number | null
          note: string | null
          target_budget: number | null
          updated_at: string
        }
        Insert: {
          banquet_from_offset_min?: number
          banquet_to_offset_min?: number
          ceremony_at: string
          expected_guests?: number | null
          guarantee_count?: number | null
          hall?: string | null
          id?: number
          meal_unit_price?: number | null
          note?: string | null
          target_budget?: number | null
          updated_at?: string
        }
        Update: {
          banquet_from_offset_min?: number
          banquet_to_offset_min?: number
          ceremony_at?: string
          expected_guests?: number | null
          guarantee_count?: number | null
          hall?: string | null
          id?: number
          meal_unit_price?: number | null
          note?: string | null
          target_budget?: number | null
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
      guests: {
        Row: {
          attending: Database["public"]["Enums"]["attendance"]
          contact: string | null
          created_at: string
          gift_amount: number | null
          head_count: number
          id: string
          invitation: Database["public"]["Enums"]["invite_state"]
          meal_count: number
          memo: string | null
          name: string
          relation: string | null
          side: Database["public"]["Enums"]["wedding_side"]
          sort_order: number
          thanks: string | null
          updated_at: string
        }
        Insert: {
          attending?: Database["public"]["Enums"]["attendance"]
          contact?: string | null
          created_at?: string
          gift_amount?: number | null
          head_count?: number
          id?: string
          invitation?: Database["public"]["Enums"]["invite_state"]
          meal_count?: number
          memo?: string | null
          name: string
          relation?: string | null
          side?: Database["public"]["Enums"]["wedding_side"]
          sort_order?: number
          thanks?: string | null
          updated_at?: string
        }
        Update: {
          attending?: Database["public"]["Enums"]["attendance"]
          contact?: string | null
          created_at?: string
          gift_amount?: number | null
          head_count?: number
          id?: string
          invitation?: Database["public"]["Enums"]["invite_state"]
          meal_count?: number
          memo?: string | null
          name?: string
          relation?: string | null
          side?: Database["public"]["Enums"]["wedding_side"]
          sort_order?: number
          thanks?: string | null
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
      payments: {
        Row: {
          amount: number
          budget_item_id: string | null
          category: string | null
          created_at: string
          description: string | null
          has_receipt: boolean
          id: string
          item_label: string | null
          memo: string | null
          method: string | null
          paid_on: string
          payer: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          budget_item_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          has_receipt?: boolean
          id?: string
          item_label?: string | null
          memo?: string | null
          method?: string | null
          paid_on: string
          payer?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          has_receipt?: boolean
          id?: string
          item_label?: string | null
          memo?: string | null
          method?: string | null
          paid_on?: string
          payer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_rollup"
            referencedColumns: ["id"]
          },
        ]
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
          phase: string | null
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
          phase?: string | null
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
          phase?: string | null
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
      budget_rollup: {
        Row: {
          actual: number | null
          category: string | null
          contracted: number | null
          created_at: string | null
          deal_status: string | null
          due_on: string | null
          estimate: number | null
          funding: Database["public"]["Enums"]["funding_source"] | null
          id: string | null
          label: string | null
          market_avg: number | null
          market_note: string | null
          memo: string | null
          owner: Database["public"]["Enums"]["assignee"] | null
          paid_at: string | null
          paid_sum: number | null
          payment_count: number | null
          sort_order: number | null
          unpaid: number | null
          updated_at: string | null
          vendor_contact: string | null
          vendor_id: string | null
          vendor_name: string | null
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
      attendance: "미정" | "참석" | "불참"
      day_of_phase: "준비" | "접수" | "예식" | "촬영" | "연회" | "마무리"
      funding_source: "선지출" | "축의금"
      invite_state: "미전달" | "전달완료" | "모바일"
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
      attendance: ["미정", "참석", "불참"],
      day_of_phase: ["준비", "접수", "예식", "촬영", "연회", "마무리"],
      funding_source: ["선지출", "축의금"],
      invite_state: ["미전달", "전달완료", "모바일"],
      task_status: ["todo", "doing", "done", "hold"],
      wedding_side: ["신랑", "신부", "공통"],
    },
  },
} as const
