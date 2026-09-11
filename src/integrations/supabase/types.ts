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
      integration_secrets: {
        Row: {
          id: boolean
          meta_capi_token: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          meta_capi_token?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          meta_capi_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          event_key: string
          id: string
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_key: string
          id?: string
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_key?: string
          id?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      public_rate_limits: {
        Row: {
          key_hash: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          key_hash: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          key_hash?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          country: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          access_email_sent_at: string | null
          abandoned_at: string | null
          amount_minor: number
          attribution: Json
          checkout_url: string | null
          country: string | null
          created_at: string
          currency: string
          cancelled_at: string | null
          customer_id: string | null
          download_count: number
          download_expires_at: string | null
          download_token: string | null
          email: string
          expired_at: string | null
          failed_at: string | null
          fulfilled_at: string | null
          gateway: string | null
          gateway_attempted: string[]
          gateway_reference: string | null
          id: string
          meta_capi_sent_at: string | null
          meta_capi_attempts: number
          meta_capi_last_attempt_at: string | null
          meta_capi_next_retry_at: string | null
          meta_capi_last_error: string | null
          meta_event_id: string | null
          name: string | null
          paid_at: string | null
          payment_failure_reason: string | null
          phone: string | null
          product_id: string | null
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          access_email_sent_at?: string | null
          abandoned_at?: string | null
          amount_minor: number
          attribution?: Json
          checkout_url?: string | null
          country?: string | null
          created_at?: string
          currency: string
          cancelled_at?: string | null
          customer_id?: string | null
          download_count?: number
          download_expires_at?: string | null
          download_token?: string | null
          email: string
          expired_at?: string | null
          failed_at?: string | null
          fulfilled_at?: string | null
          gateway?: string | null
          gateway_attempted?: string[]
          gateway_reference?: string | null
          id?: string
          meta_capi_sent_at?: string | null
          meta_capi_attempts?: number
          meta_capi_last_attempt_at?: string | null
          meta_capi_next_retry_at?: string | null
          meta_capi_last_error?: string | null
          meta_event_id?: string | null
          name?: string | null
          paid_at?: string | null
          payment_failure_reason?: string | null
          phone?: string | null
          product_id?: string | null
          reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_email_sent_at?: string | null
          abandoned_at?: string | null
          amount_minor?: number
          attribution?: Json
          checkout_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          cancelled_at?: string | null
          customer_id?: string | null
          download_count?: number
          download_expires_at?: string | null
          download_token?: string | null
          email?: string
          expired_at?: string | null
          failed_at?: string | null
          fulfilled_at?: string | null
          gateway?: string | null
          gateway_attempted?: string[]
          gateway_reference?: string | null
          id?: string
          meta_capi_sent_at?: string | null
          meta_capi_attempts?: number
          meta_capi_last_attempt_at?: string | null
          meta_capi_next_retry_at?: string | null
          meta_capi_last_error?: string | null
          meta_event_id?: string | null
          name?: string | null
          paid_at?: string | null
          payment_failure_reason?: string | null
          phone?: string | null
          product_id?: string | null
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          currency: string
          id: string
          price_minor: number
          product_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          price_minor: number
          product_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          price_minor?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_currency: string
          base_price_minor: number
          cover_image_url: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          base_price_minor?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          base_price_minor?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          default_currency: string
          download_expiry_hours: number
          email_sender_name: string
          fx_rates: Json
          gateway_routing: Json
          id: boolean
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          store_name: string
          support_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          download_expiry_hours?: number
          email_sender_name?: string
          fx_rates?: Json
          gateway_routing?: Json
          id?: boolean
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          store_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          download_expiry_hours?: number
          email_sender_name?: string
          fx_rates?: Json
          gateway_routing?: Json
          id?: boolean
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          store_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      consume_public_rate_limit: {
        Args: {
          p_key_hash: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
