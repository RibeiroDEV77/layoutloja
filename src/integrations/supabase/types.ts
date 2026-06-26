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
      asset_folders: {
        Row: {
          context: Database["public"]["Enums"]["asset_context"]
          created_at: string
          id: string
          name: string
          parent_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_folders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_links: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          owner_id: string
          owner_type: string
          role: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id: string
          owner_type: string
          role?: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_tag_map: {
        Row: {
          asset_id: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_tag_map_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "asset_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_upload_jobs: {
        Row: {
          asset_id: string | null
          attempts: number
          bytes_uploaded: number
          context: Database["public"]["Enums"]["asset_context"]
          created_at: string
          error: string | null
          filename: string
          id: string
          mime: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["asset_job_status"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          attempts?: number
          bytes_uploaded?: number
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          error?: string | null
          filename: string
          id?: string
          mime?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_job_status"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          attempts?: number
          bytes_uploaded?: number
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          error?: string | null
          filename?: string
          id?: string
          mime?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_job_status"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_upload_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_upload_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          mime: string | null
          sha256: string | null
          size_bytes: number | null
          storage_driver: Database["public"]["Enums"]["asset_driver"]
          storage_path: string | null
          version_no: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          mime?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_driver: Database["public"]["Enums"]["asset_driver"]
          storage_path?: string | null
          version_no: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          mime?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_driver?: Database["public"]["Enums"]["asset_driver"]
          storage_path?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alt_text: string | null
          archived_at: string | null
          bucket: string | null
          caption: string | null
          context: Database["public"]["Enums"]["asset_context"]
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          external_id: string | null
          external_url: string | null
          folder_id: string | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          medium_path: string | null
          mime: string | null
          original_filename: string | null
          sha256: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["asset_status"]
          storage_driver: Database["public"]["Enums"]["asset_driver"]
          storage_path: string | null
          store_id: string
          thumb_path: string | null
          title: string | null
          updated_at: string
          webp_path: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          archived_at?: string | null
          bucket?: string | null
          caption?: string | null
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          external_url?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          medium_path?: string | null
          mime?: string | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage_driver: Database["public"]["Enums"]["asset_driver"]
          storage_path?: string | null
          store_id: string
          thumb_path?: string | null
          title?: string | null
          updated_at?: string
          webp_path?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          archived_at?: string | null
          bucket?: string | null
          caption?: string | null
          context?: Database["public"]["Enums"]["asset_context"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          external_url?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          medium_path?: string | null
          mime?: string | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage_driver?: Database["public"]["Enums"]["asset_driver"]
          storage_path?: string | null
          store_id?: string
          thumb_path?: string | null
          title?: string | null
          updated_at?: string
          webp_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_folder_fk"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_values: {
        Row: {
          attribute_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          meta_json: Json | null
          sort_order: number
        }
        Insert: {
          attribute_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          meta_json?: Json | null
          sort_order?: number
        }
        Update: {
          attribute_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          meta_json?: Json | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          filter_order: number
          filter_ui: string
          id: string
          input_type: Database["public"]["Enums"]["attribute_input_type"]
          is_color: boolean
          is_filterable: boolean
          is_public: boolean
          is_size: boolean
          name: string
          store_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          filter_order?: number
          filter_ui?: string
          id?: string
          input_type?: Database["public"]["Enums"]["attribute_input_type"]
          is_color?: boolean
          is_filterable?: boolean
          is_public?: boolean
          is_size?: boolean
          name: string
          store_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          filter_order?: number
          filter_ui?: string
          id?: string
          input_type?: Database["public"]["Enums"]["attribute_input_type"]
          is_color?: boolean
          is_filterable?: boolean
          is_public?: boolean
          is_size?: boolean
          name?: string
          store_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
          store_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
          store_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
          store_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_coupons: {
        Row: {
          applied_value: number
          cart_id: string
          coupon_id: string
          created_at: string
          id: string
          snapshot: Json
        }
        Insert: {
          applied_value?: number
          cart_id: string
          coupon_id: string
          created_at?: string
          id?: string
          snapshot?: Json
        }
        Update: {
          applied_value?: number
          cart_id?: string
          coupon_id?: string
          created_at?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cart_coupons_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          discount_amount: number
          id: string
          line_total: number
          list_price: number
          metadata: Json
          price_list_item_id: string | null
          price_source: Database["public"]["Enums"]["cart_price_source"]
          product_id: string
          qty: number
          snapshot: Json
          unit_price: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          discount_amount?: number
          id?: string
          line_total?: number
          list_price?: number
          metadata?: Json
          price_list_item_id?: string | null
          price_source?: Database["public"]["Enums"]["cart_price_source"]
          product_id: string
          qty: number
          snapshot?: Json
          unit_price?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          line_total?: number
          list_price?: number
          metadata?: Json
          price_list_item_id?: string | null
          price_source?: Database["public"]["Enums"]["cart_price_source"]
          product_id?: string
          qty?: number
          snapshot?: Json
          unit_price?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_snapshots: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          payload: Json
          reason: string
          store_id: string
          totals: Json
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          payload: Json
          reason: string
          store_id: string
          totals: Json
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          store_id?: string
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cart_snapshots_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_timeline: {
        Row: {
          actor_user_id: string | null
          cart_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["cart_timeline_event"]
          id: string
          payload: Json
          store_id: string
        }
        Insert: {
          actor_user_id?: string | null
          cart_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["cart_timeline_event"]
          id?: string
          payload?: Json
          store_id: string
        }
        Update: {
          actor_user_id?: string | null
          cart_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["cart_timeline_event"]
          id?: string
          payload?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_timeline_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_timeline_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          billing_address_id: string | null
          converted_order_id: string | null
          created_at: string
          currency: string
          customer_group_id: string | null
          customer_id: string | null
          discount_total: number
          expires_at: string | null
          id: string
          items_count: number
          last_activity_at: string
          merged_into_cart_id: string | null
          metadata: Json
          price_list_id: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          selected_shipping_quote_id: string | null
          session_token: string | null
          shipping_address_id: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["cart_status"]
          store_id: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          billing_address_id?: string | null
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_group_id?: string | null
          customer_id?: string | null
          discount_total?: number
          expires_at?: string | null
          id?: string
          items_count?: number
          last_activity_at?: string
          merged_into_cart_id?: string | null
          metadata?: Json
          price_list_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          selected_shipping_quote_id?: string | null
          session_token?: string | null
          shipping_address_id?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["cart_status"]
          store_id: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          billing_address_id?: string | null
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_group_id?: string | null
          customer_id?: string | null
          discount_total?: number
          expires_at?: string | null
          id?: string
          items_count?: number
          last_activity_at?: string
          merged_into_cart_id?: string | null
          metadata?: Json
          price_list_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          selected_shipping_quote_id?: string | null
          session_token?: string | null
          shipping_address_id?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["cart_status"]
          store_id?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_billing_address_id_fkey"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_merged_into_cart_id_fkey"
            columns: ["merged_into_cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          depth: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          level: number | null
          name: string
          parent_id: string | null
          path: string | null
          path_ids: string[] | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number | null
          name: string
          parent_id?: string | null
          path?: string | null
          path_ids?: string[] | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number | null
          name?: string
          parent_id?: string | null
          path?: string | null
          path_ids?: string[] | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      category_attributes: {
        Row: {
          attribute_id: string
          category_id: string
          created_at: string
          filter_order: number
          id: string
          is_required: boolean
          is_variant_axis: boolean
          show_in_filters: boolean
          sort_order: number
        }
        Insert: {
          attribute_id: string
          category_id: string
          created_at?: string
          filter_order?: number
          id?: string
          is_required?: boolean
          is_variant_axis?: boolean
          show_in_filters?: boolean
          sort_order?: number
        }
        Update: {
          attribute_id?: string
          category_id?: string
          created_at?: string
          filter_order?: number
          id?: string
          is_required?: boolean
          is_variant_axis?: boolean
          show_in_filters?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          rules_json: Json | null
          slug: string
          sort_order: number
          store_id: string
          type: Database["public"]["Enums"]["collection_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          rules_json?: Json | null
          slug: string
          sort_order?: number
          store_id: string
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          rules_json?: Json | null
          slug?: string
          sort_order?: number
          store_id?: string
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_history: {
        Row: {
          cost_method: string
          created_at: string
          effective_at: string
          id: string
          previous_cost: number | null
          quantity_in: number | null
          reference_id: string | null
          reference_type: string | null
          store_id: string
          unit_cost: number
          variant_id: string
        }
        Insert: {
          cost_method?: string
          created_at?: string
          effective_at?: string
          id?: string
          previous_cost?: number | null
          quantity_in?: number | null
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          unit_cost: number
          variant_id: string
        }
        Update: {
          cost_method?: string
          created_at?: string
          effective_at?: string
          id?: string
          previous_cost?: number | null
          quantity_in?: number | null
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          unit_cost?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_ledger: {
        Row: {
          amount: number | null
          cart_id: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          kind: Database["public"]["Enums"]["coupon_ledger_kind"]
          metadata: Json
          reason: string | null
          store_id: string
        }
        Insert: {
          amount?: number | null
          cart_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["coupon_ledger_kind"]
          metadata?: Json
          reason?: string | null
          store_id: string
        }
        Update: {
          amount?: number | null
          cart_id?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["coupon_ledger_kind"]
          metadata?: Json
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_ledger_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_ledger_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "coupon_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount: number
          cart_id: string | null
          coupon_id: string
          customer_id: string | null
          id: string
          order_id: string | null
          redeemed_at: string
          store_id: string
        }
        Insert: {
          amount?: number
          cart_id?: string | null
          coupon_id: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          redeemed_at?: string
          store_id: string
        }
        Update: {
          amount?: number
          cart_id?: string | null
          coupon_id?: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          redeemed_at?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          applies_to_ids: string[]
          code: string
          created_at: string
          customer_group_id: string | null
          description: string | null
          id: string
          max_discount: number | null
          metadata: Json
          min_subtotal: number | null
          name: string
          scope: Database["public"]["Enums"]["coupon_scope"]
          stackable: boolean
          store_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_count: number
          usage_limit_per_customer: number | null
          usage_limit_total: number | null
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean
          applies_to_ids?: string[]
          code: string
          created_at?: string
          customer_group_id?: string | null
          description?: string | null
          id?: string
          max_discount?: number | null
          metadata?: Json
          min_subtotal?: number | null
          name: string
          scope?: Database["public"]["Enums"]["coupon_scope"]
          stackable?: boolean
          store_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_count?: number
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Update: {
          active?: boolean
          applies_to_ids?: string[]
          code?: string
          created_at?: string
          customer_group_id?: string | null
          description?: string | null
          id?: string
          max_discount?: number | null
          metadata?: Json
          min_subtotal?: number | null
          name?: string
          scope?: Database["public"]["Enums"]["coupon_scope"]
          stackable?: boolean
          store_id?: string
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_count?: number
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          complement: string | null
          country: string
          created_at: string
          customer_id: string
          district: string | null
          doc_number: string | null
          geocode_precision: string | null
          geocode_provider: string | null
          geocoded_at: string | null
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string | null
          latitude: number | null
          longitude: number | null
          number: string | null
          phone: string | null
          recipient: string | null
          reference: string | null
          state: string | null
          street: string | null
          type: Database["public"]["Enums"]["address_type"]
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          customer_id: string
          district?: string | null
          doc_number?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocoded_at?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          number?: string | null
          phone?: string | null
          recipient?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["address_type"]
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          district?: string | null
          doc_number?: string | null
          geocode_precision?: string | null
          geocode_provider?: string | null
          geocoded_at?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          number?: string | null
          phone?: string | null
          recipient?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["address_type"]
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents_log: {
        Row: {
          actor_user_id: string | null
          channel: string
          created_at: string
          customer_id: string
          granted: boolean
          id: string
          ip: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          channel: string
          created_at?: string
          customer_id: string
          granted: boolean
          id?: string
          ip?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string
          granted?: boolean
          id?: string
          ip?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_consents_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_ledger: {
        Row: {
          actor_user_id: string | null
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          id: string
          kind: Database["public"]["Enums"]["credit_ledger_kind"]
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          balance_after: number
          created_at?: string
          customer_id: string
          id?: string
          kind: Database["public"]["Enums"]["credit_ledger_kind"]
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          customer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["credit_ledger_kind"]
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_credit_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          code: string
          created_at: string
          default_discount_pct: number
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["customer_group_kind"]
          name: string
          requires_approval: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_discount_pct?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["customer_group_kind"]
          name: string
          requires_approval?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_discount_pct?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["customer_group_kind"]
          name?: string
          requires_approval?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups_map: {
        Row: {
          created_at: string
          customer_group_id: string
          customer_id: string
        }
        Insert: {
          created_at?: string
          customer_group_id: string
          customer_id: string
        }
        Update: {
          created_at?: string
          customer_group_id?: string
          customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_map_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_groups_map_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_groups_map_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
          pinned: boolean
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string
          enabled: boolean
          event_type: string
          id: string
          metadata: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id: string
          enabled?: boolean
          event_type: string
          id?: string
          metadata?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string
          enabled?: boolean
          event_type?: string
          id?: string
          metadata?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_notification_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notification_preferences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_sessions: {
        Row: {
          created_at: string
          customer_id: string
          device_fingerprint: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          last_seen_at: string
          metadata: Json
          started_at: string
          status: Database["public"]["Enums"]["portal_session_status"]
          store_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          device_fingerprint?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          metadata?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["portal_session_status"]
          store_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          device_fingerprint?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          metadata?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["portal_session_status"]
          store_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_portal_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_score_factors: {
        Row: {
          computed_at: string
          customer_id: string
          factor_code: string
          id: string
          value: number
          weight: number
        }
        Insert: {
          computed_at?: string
          customer_id: string
          factor_code: string
          id?: string
          value?: number
          weight?: number
        }
        Update: {
          computed_at?: string
          customer_id?: string
          factor_code?: string
          id?: string
          value?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_score_factors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_score_factors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_map: {
        Row: {
          created_at: string
          customer_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_map_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tag_map_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          store_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tax_profiles: {
        Row: {
          cnae: string | null
          created_at: string
          customer_id: string
          icms_taxpayer: boolean
          ie_isento: boolean
          notes: string | null
          regime: Database["public"]["Enums"]["tax_regime"] | null
          suframa: string | null
          updated_at: string
        }
        Insert: {
          cnae?: string | null
          created_at?: string
          customer_id: string
          icms_taxpayer?: boolean
          ie_isento?: boolean
          notes?: string | null
          regime?: Database["public"]["Enums"]["tax_regime"] | null
          suframa?: string | null
          updated_at?: string
        }
        Update: {
          cnae?: string | null
          created_at?: string
          customer_id?: string
          icms_taxpayer?: boolean
          ie_isento?: boolean
          notes?: string | null
          regime?: Database["public"]["Enums"]["tax_regime"] | null
          suframa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tax_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tax_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          code: string | null
          consent_data_processing: boolean
          consent_marketing_email: boolean
          consent_marketing_sms: boolean
          consent_marketing_whatsapp: boolean
          consent_updated_at: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          default_payment_terms: string | null
          default_price_list_id: string | null
          deleted_at: string | null
          doc_number: string | null
          doc_number_encrypted: string | null
          email: string | null
          gender: string | null
          id: string
          internal_notes: string | null
          legal_name: string | null
          marketing_opt_in: boolean
          municipal_registration: string | null
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          score: number
          score_updated_at: string | null
          segment: Database["public"]["Enums"]["customer_segment"]
          state_registration: string | null
          status: Database["public"]["Enums"]["customer_status"]
          store_id: string
          trade_name: string | null
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          code?: string | null
          consent_data_processing?: boolean
          consent_marketing_email?: boolean
          consent_marketing_sms?: boolean
          consent_marketing_whatsapp?: boolean
          consent_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          default_payment_terms?: string | null
          default_price_list_id?: string | null
          deleted_at?: string | null
          doc_number?: string | null
          doc_number_encrypted?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          internal_notes?: string | null
          legal_name?: string | null
          marketing_opt_in?: boolean
          municipal_registration?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          score?: number
          score_updated_at?: string | null
          segment?: Database["public"]["Enums"]["customer_segment"]
          state_registration?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          store_id: string
          trade_name?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          code?: string | null
          consent_data_processing?: boolean
          consent_marketing_email?: boolean
          consent_marketing_sms?: boolean
          consent_marketing_whatsapp?: boolean
          consent_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          default_payment_terms?: string | null
          default_price_list_id?: string | null
          deleted_at?: string | null
          doc_number?: string | null
          doc_number_encrypted?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          internal_notes?: string | null
          legal_name?: string | null
          marketing_opt_in?: boolean
          municipal_registration?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          score?: number
          score_updated_at?: string | null
          segment?: Database["public"]["Enums"]["customer_segment"]
          state_registration?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          store_id?: string
          trade_name?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_price_list_id_fkey"
            columns: ["default_price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          correlation_id: string | null
          created_at: string
          id: string
          notes: string | null
          outcome: Database["public"]["Enums"]["delivery_attempt_outcome"]
          proof_asset_id: string | null
          raw_payload: Json
          shipment_id: string
          signed_by: string | null
          store_id: string
          trace_id: string | null
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          correlation_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          outcome: Database["public"]["Enums"]["delivery_attempt_outcome"]
          proof_asset_id?: string | null
          raw_payload?: Json
          shipment_id: string
          signed_by?: string | null
          store_id: string
          trace_id?: string | null
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          correlation_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["delivery_attempt_outcome"]
          proof_asset_id?: string | null
          raw_payload?: Json
          shipment_id?: string
          signed_by?: string | null
          store_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_attempts_proof_asset_id_fkey"
            columns: ["proof_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_attempts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tracking_v"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "delivery_attempts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_event_subscriptions: {
        Row: {
          channel: string
          config: Json
          created_at: string
          event_pattern: string
          id: string
          is_active: boolean
          store_id: string | null
          target: string
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          event_pattern: string
          id?: string
          is_active?: boolean
          store_id?: string | null
          target: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          event_pattern?: string
          id?: string
          is_active?: boolean
          store_id?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_event_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          actor_user_id: string | null
          aggregate_id: string | null
          aggregate_type: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          payload: Json
          processed_at: string | null
          retry_count: number
          status: string
          store_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          aggregate_id?: string | null
          aggregate_type: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          store_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          aggregate_id?: string | null
          aggregate_type?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      event_delivery_log: {
        Row: {
          attempt: number
          delivered_at: string
          duration_ms: number | null
          error: string | null
          http_status: number | null
          id: string
          outbox_id: string
          response_excerpt: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          attempt: number
          delivered_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          outbox_id: string
          response_excerpt?: string | null
          status: string
          subscription_id?: string | null
        }
        Update: {
          attempt?: number
          delivered_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          outbox_id?: string
          response_excerpt?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_delivery_log_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "event_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delivery_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "domain_event_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_outbox: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          max_attempts: number
          metadata: Json
          occurred_at: string
          ordered: boolean
          payload: Json
          published_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          store_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          max_attempts?: number
          metadata?: Json
          occurred_at?: string
          ordered?: boolean
          payload?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          store_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          max_attempts?: number
          metadata?: Json
          occurred_at?: string
          ordered?: boolean
          payload?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_outbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      event_outbox_dead_letter: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          event_type: string
          failed_at: string
          id: string
          last_error: string | null
          metadata: Json
          original_outbox_id: string
          payload: Json
          reprocessed_at: string | null
          reprocessed_by: string | null
          store_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          event_type: string
          failed_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          original_outbox_id: string
          payload: Json
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          store_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          event_type?: string
          failed_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          original_outbox_id?: string
          payload?: Json
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_outbox_dead_letter_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          flag_id: string
          id: string
          reason: string | null
          scope_id: string | null
          scope_type: string
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          flag_id: string
          id?: string
          reason?: string | null
          scope_id?: string | null
          scope_type: string
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          flag_id?: string
          id?: string
          reason?: string | null
          scope_id?: string | null
          scope_type?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_overrides_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          created_by: string | null
          default_value: Json
          description: string | null
          enabled: boolean
          id: string
          key: string
          metadata: Json
          name: string
          rollout_strategy: Json
          store_scope: boolean
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_value?: Json
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          metadata?: Json
          name: string
          rollout_strategy?: Json
          store_scope?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_value?: Json
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          metadata?: Json
          name?: string
          rollout_strategy?: Json
          store_scope?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_credentials_keyring: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      fiscal_invoice_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          invoice_id: string
          message: string | null
          payload: Json
          status: Database["public"]["Enums"]["fiscal_invoice_status"] | null
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          invoice_id: string
          message?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["fiscal_invoice_status"] | null
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          invoice_id?: string
          message?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["fiscal_invoice_status"] | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          access_key: string | null
          cancel_protocol: string | null
          cancelled_at: string | null
          corrected_at: string | null
          correction_text: string | null
          created_at: string
          created_by: string | null
          danfe_url: string | null
          document_type: Database["public"]["Enums"]["fiscal_document_type"]
          external_id: string | null
          id: string
          idempotency_key: string | null
          issue_date: string | null
          metadata: Json
          number: string | null
          order_id: string | null
          payload: Json
          protocol: string | null
          provider_id: string
          rejection_code: string | null
          rejection_reason: string | null
          series: string | null
          status: Database["public"]["Enums"]["fiscal_invoice_status"]
          store_id: string
          total_amount: number | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          cancel_protocol?: string | null
          cancelled_at?: string | null
          corrected_at?: string | null
          correction_text?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          document_type?: Database["public"]["Enums"]["fiscal_document_type"]
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          issue_date?: string | null
          metadata?: Json
          number?: string | null
          order_id?: string | null
          payload?: Json
          protocol?: string | null
          provider_id: string
          rejection_code?: string | null
          rejection_reason?: string | null
          series?: string | null
          status?: Database["public"]["Enums"]["fiscal_invoice_status"]
          store_id: string
          total_amount?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          cancel_protocol?: string | null
          cancelled_at?: string | null
          corrected_at?: string | null
          correction_text?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          document_type?: Database["public"]["Enums"]["fiscal_document_type"]
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          issue_date?: string | null
          metadata?: Json
          number?: string | null
          order_id?: string | null
          payload?: Json
          protocol?: string | null
          provider_id?: string
          rejection_code?: string | null
          rejection_reason?: string | null
          series?: string | null
          status?: Database["public"]["Enums"]["fiscal_invoice_status"]
          store_id?: string
          total_amount?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "fiscal_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_providers: {
        Row: {
          adapter: string
          capabilities: Json
          config: Json
          created_at: string
          created_by: string | null
          credentials_encrypted: string | null
          credentials_fingerprint: string | null
          credentials_set_at: string | null
          credentials_set_by: string | null
          display_name: string
          environment: Database["public"]["Enums"]["fiscal_environment"]
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          priority: number
          store_id: string
          supported_documents: string[]
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          adapter: string
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name: string
          environment?: Database["public"]["Enums"]["fiscal_environment"]
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          priority?: number
          store_id: string
          supported_documents?: string[]
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          adapter?: string
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name?: string
          environment?: Database["public"]["Enums"]["fiscal_environment"]
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          priority?: number
          store_id?: string
          supported_documents?: string[]
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_providers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_webhook_inbox: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          external_event_id: string | null
          id: string
          processed_at: string | null
          provider_code: string
          provider_id: string | null
          raw_body: string
          raw_headers: Json
          signature_header: string | null
          signature_valid: boolean | null
          status: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          processed_at?: string | null
          provider_code: string
          provider_id?: string | null
          raw_body: string
          raw_headers?: Json
          signature_header?: string | null
          signature_valid?: boolean | null
          status?: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          processed_at?: string | null
          provider_code?: string
          provider_id?: string | null
          raw_body?: string
          raw_headers?: Json
          signature_header?: string | null
          signature_valid?: boolean | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_webhook_inbox_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "fiscal_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_webhook_inbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_events: {
        Row: {
          actor_kind: Database["public"]["Enums"]["fulfillment_event_actor"]
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          fulfillment_id: string
          id: string
          kind: Database["public"]["Enums"]["fulfillment_event_kind"]
          payload: Json
          store_id: string
          summary: string | null
          trace_id: string | null
        }
        Insert: {
          actor_kind?: Database["public"]["Enums"]["fulfillment_event_actor"]
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          fulfillment_id: string
          id?: string
          kind: Database["public"]["Enums"]["fulfillment_event_kind"]
          payload?: Json
          store_id: string
          summary?: string | null
          trace_id?: string | null
        }
        Update: {
          actor_kind?: Database["public"]["Enums"]["fulfillment_event_actor"]
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          fulfillment_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["fulfillment_event_kind"]
          payload?: Json
          store_id?: string
          summary?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_events_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_items: {
        Row: {
          created_at: string
          fulfillment_id: string
          id: string
          metadata: Json
          name: string | null
          order_item_id: string | null
          product_id: string | null
          quantity_allocated: number
          quantity_delivered: number
          quantity_packed: number
          quantity_picked: number
          quantity_requested: number
          quantity_shipped: number
          sku: string | null
          snapshot: Json
          store_id: string
          unit_volume_cm3: number | null
          unit_weight_g: number | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          fulfillment_id: string
          id?: string
          metadata?: Json
          name?: string | null
          order_item_id?: string | null
          product_id?: string | null
          quantity_allocated?: number
          quantity_delivered?: number
          quantity_packed?: number
          quantity_picked?: number
          quantity_requested: number
          quantity_shipped?: number
          sku?: string | null
          snapshot?: Json
          store_id: string
          unit_volume_cm3?: number | null
          unit_weight_g?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          fulfillment_id?: string
          id?: string
          metadata?: Json
          name?: string | null
          order_item_id?: string | null
          product_id?: string | null
          quantity_allocated?: number
          quantity_delivered?: number
          quantity_packed?: number
          quantity_picked?: number
          quantity_requested?: number
          quantity_shipped?: number
          sku?: string | null
          snapshot?: Json
          store_id?: string
          unit_volume_cm3?: number | null
          unit_weight_g?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_items_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_metadata: {
        Row: {
          created_at: string
          created_by: string | null
          fulfillment_id: string
          id: string
          is_pii: boolean
          is_secret: boolean
          key: string
          store_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fulfillment_id: string
          id?: string
          is_pii?: boolean
          is_secret?: boolean
          key: string
          store_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fulfillment_id?: string
          id?: string
          is_pii?: boolean
          is_secret?: boolean
          key?: string
          store_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_metadata_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_metadata_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillments: {
        Row: {
          allocated_at: string | null
          assigned_to: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          failure_code: string | null
          failure_message: string | null
          fulfillable_id: string
          fulfillable_type: Database["public"]["Enums"]["fulfillment_fulfillable_type"]
          fulfillment_number: string
          id: string
          metadata: Json
          packed_at: string | null
          picked_at: string | null
          priority: Database["public"]["Enums"]["fulfillment_priority"]
          schema_version: number
          shipped_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["fulfillment_status"]
          store_id: string
          trace_id: string | null
          type: Database["public"]["Enums"]["fulfillment_type"]
          updated_at: string
          version: number
          warehouse_id: string | null
        }
        Insert: {
          allocated_at?: string | null
          assigned_to?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fulfillable_id: string
          fulfillable_type?: Database["public"]["Enums"]["fulfillment_fulfillable_type"]
          fulfillment_number: string
          id?: string
          metadata?: Json
          packed_at?: string | null
          picked_at?: string | null
          priority?: Database["public"]["Enums"]["fulfillment_priority"]
          schema_version?: number
          shipped_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          store_id: string
          trace_id?: string | null
          type?: Database["public"]["Enums"]["fulfillment_type"]
          updated_at?: string
          version?: number
          warehouse_id?: string | null
        }
        Update: {
          allocated_at?: string | null
          assigned_to?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fulfillable_id?: string
          fulfillable_type?: Database["public"]["Enums"]["fulfillment_fulfillable_type"]
          fulfillment_number?: string
          id?: string
          metadata?: Json
          packed_at?: string | null
          picked_at?: string | null
          priority?: Database["public"]["Enums"]["fulfillment_priority"]
          schema_version?: number
          shipped_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          store_id?: string
          trace_id?: string | null
          type?: Database["public"]["Enums"]["fulfillment_type"]
          updated_at?: string
          version?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fulfillments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          created_at: string
          goods_receipt_id: string
          id: string
          notes: string | null
          purchase_order_item_id: string | null
          quantity_accepted: number
          quantity_received: number
          quantity_rejected: number
          unit_cost: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          goods_receipt_id: string
          id?: string
          notes?: string | null
          purchase_order_item_id?: string | null
          quantity_accepted: number
          quantity_received: number
          quantity_rejected?: number
          unit_cost: number
          variant_id: string
        }
        Update: {
          created_at?: string
          goods_receipt_id?: string
          id?: string
          notes?: string | null
          purchase_order_item_id?: string | null
          quantity_accepted?: number
          quantity_received?: number
          quantity_rejected?: number
          unit_cost?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          store_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          checked_at: string
          component: string
          details: Json
          id: string
          latency_ms: number | null
          status: Database["public"]["Enums"]["health_status"]
        }
        Insert: {
          checked_at?: string
          component: string
          details?: Json
          id?: string
          latency_ms?: number | null
          status: Database["public"]["Enums"]["health_status"]
        }
        Update: {
          checked_at?: string
          component?: string
          details?: Json
          id?: string
          latency_ms?: number | null
          status?: Database["public"]["Enums"]["health_status"]
        }
        Relationships: []
      }
      hold_policies: {
        Row: {
          auto_release_after_seconds: number | null
          blocks_transitions: Json
          code: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["order_hold_kind"]
          metadata: Json
          name: string
          store_id: string
          triggers: Json
          updated_at: string
        }
        Insert: {
          auto_release_after_seconds?: number | null
          blocks_transitions?: Json
          code: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["order_hold_kind"]
          metadata?: Json
          name: string
          store_id: string
          triggers?: Json
          updated_at?: string
        }
        Update: {
          auto_release_after_seconds?: number | null
          blocks_transitions?: Json
          code?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["order_hold_kind"]
          metadata?: Json
          name?: string
          store_id?: string
          triggers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hold_policies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          actor_user_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          expires_at: string
          id: string
          key: string
          request_hash: string
          resource_id: string | null
          resource_type: string | null
          response_body: Json | null
          response_hash: string | null
          response_status: number | null
          scope: string
          status: Database["public"]["Enums"]["idempotency_status"]
          store_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          expires_at: string
          id?: string
          key: string
          request_hash: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_hash?: string | null
          response_status?: number | null
          scope: string
          status?: Database["public"]["Enums"]["idempotency_status"]
          store_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          expires_at?: string
          id?: string
          key?: string
          request_hash?: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_hash?: string | null
          response_status?: number | null
          scope?: string
          status?: Database["public"]["Enums"]["idempotency_status"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string
          expected_quantity: number
          id: string
          inventory_count_id: string
          notes: string | null
          unit_cost: number | null
          updated_at: string
          variance: number | null
          variant_id: string
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          expected_quantity?: number
          id?: string
          inventory_count_id: string
          notes?: string | null
          unit_cost?: number | null
          updated_at?: string
          variance?: number | null
          variant_id: string
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          expected_quantity?: number
          id?: string
          inventory_count_id?: string
          notes?: string | null
          unit_cost?: number | null
          updated_at?: string
          variance?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          count_number: string
          count_type: string
          created_at: string
          id: string
          notes: string | null
          scheduled_date: string | null
          started_at: string | null
          status: string
          store_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          count_number: string
          count_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          count_number?: string
          count_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          id: string
          name: string
          recorded_at: string
          scope: string
          store_id: string | null
          tags: Json
          unit: string | null
          value: number
        }
        Insert: {
          id?: string
          name: string
          recorded_at?: string
          scope: string
          store_id?: string | null
          tags?: Json
          unit?: string | null
          value: number
        }
        Update: {
          id?: string
          name?: string
          recorded_at?: string
          scope?: string
          store_id?: string | null
          tags?: Json
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_channel_configs: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          config: Json
          created_at: string
          created_by: string | null
          credentials_secret_ref: string | null
          id: string
          is_active: boolean
          priority: number
          provider: string
          rate_limit_per_minute: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_secret_ref?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          provider: string
          rate_limit_per_minute?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_secret_ref?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          provider?: string
          rate_limit_per_minute?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_channel_configs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempt_number: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string
          notification_id: string
          provider: string | null
          provider_message_id: string | null
          provider_response: Json | null
          recipient_address: string | null
          retryable: boolean
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
          version: number
        }
        Insert: {
          attempt_number?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id: string
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_address?: string | null
          retryable?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          attempt_number?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_address?: string | null
          retryable?: boolean
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_notifications_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_events: {
        Row: {
          created_at: string
          delivery_id: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          delivery_id: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          delivery_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "notification_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_subscriptions: {
        Row: {
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at: string
          created_by: string | null
          event_type: string
          filter_expression: Json | null
          id: string
          is_active: boolean
          priority: Database["public"]["Enums"]["notification_priority"]
          recipient_resolver: string
          store_id: string | null
          template_code: string
          updated_at: string
        }
        Insert: {
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by?: string | null
          event_type: string
          filter_expression?: Json | null
          id?: string
          is_active?: boolean
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_resolver?: string
          store_id?: string | null
          template_code: string
          updated_at?: string
        }
        Update: {
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by?: string | null
          event_type?: string
          filter_expression?: Json | null
          id?: string
          is_active?: boolean
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_resolver?: string
          store_id?: string | null
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_event_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          locale: string
          status: Database["public"]["Enums"]["notification_template_status"]
          store_id: string | null
          subject: string | null
          updated_at: string
          variables: Json
          version: number
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          status?: Database["public"]["Enums"]["notification_template_status"]
          store_id?: string | null
          subject?: string | null
          updated_at?: string
          variables?: Json
          version?: number
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          status?: Database["public"]["Enums"]["notification_template_status"]
          store_id?: string | null
          subject?: string | null
          updated_at?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at: string
          customer_id: string | null
          dedupe_key: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          locale: string
          payload: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          recipient_email: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          scheduled_for: string | null
          source_aggregate: string | null
          source_aggregate_id: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["notification_status"]
          store_id: string | null
          template_code: string
          template_version: number | null
          updated_at: string
          version: number
        }
        Insert: {
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          customer_id?: string | null
          dedupe_key?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          locale?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string | null
          source_aggregate?: string | null
          source_aggregate_id?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          store_id?: string | null
          template_code: string
          template_version?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          customer_id?: string | null
          dedupe_key?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          locale?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string | null
          source_aggregate?: string | null
          source_aggregate_id?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          store_id?: string | null
          template_code?: string
          template_version?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "event_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          city: string | null
          complement: string | null
          country: string
          created_at: string
          district: string | null
          doc_number: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["order_address_kind"]
          number: string | null
          order_id: string
          phone: string | null
          postal_code: string | null
          recipient: string | null
          reference: string | null
          snapshot: Json
          state: string | null
          store_id: string
          street: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          district?: string | null
          doc_number?: string | null
          email?: string | null
          id?: string
          kind: Database["public"]["Enums"]["order_address_kind"]
          number?: string | null
          order_id: string
          phone?: string | null
          postal_code?: string | null
          recipient?: string | null
          reference?: string | null
          snapshot?: Json
          state?: string | null
          store_id: string
          street?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          district?: string | null
          doc_number?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_address_kind"]
          number?: string | null
          order_id?: string
          phone?: string | null
          postal_code?: string | null
          recipient?: string | null
          reference?: string | null
          snapshot?: Json
          state?: string | null
          store_id?: string
          street?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          metadata: Json
          order_id: string
          role: Database["public"]["Enums"]["order_assignment_role"]
          store_id: string
          unassigned_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          role?: Database["public"]["Enums"]["order_assignment_role"]
          store_id: string
          unassigned_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          role?: Database["public"]["Enums"]["order_assignment_role"]
          store_id?: string
          unassigned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          order_id: string
          store_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          order_id: string
          store_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_coupon_snapshots: {
        Row: {
          applied_value: number
          coupon_code: string
          coupon_id: string | null
          created_at: string
          id: string
          order_id: string
          schema_version: number
          snapshot: Json
          store_id: string
        }
        Insert: {
          applied_value?: number
          coupon_code: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          schema_version?: number
          snapshot: Json
          store_id: string
        }
        Update: {
          applied_value?: number
          coupon_code?: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          schema_version?: number
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_coupon_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_coupon_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_coupon_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_customer_snapshots: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          order_id: string
          schema_version: number
          snapshot: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id: string
          schema_version?: number
          snapshot: Json
          store_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string
          schema_version?: number
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_customer_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_customer_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_customer_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_fulfillments: {
        Row: {
          assigned_user_id: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          id: string
          items: Json
          metadata: Json
          order_id: string
          packed_at: string | null
          picked_at: string | null
          ready_at: string | null
          status: Database["public"]["Enums"]["order_fulfillment_status"]
          store_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          metadata?: Json
          order_id: string
          packed_at?: string | null
          picked_at?: string | null
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_fulfillment_status"]
          store_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          metadata?: Json
          order_id?: string
          packed_at?: string | null
          picked_at?: string | null
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_fulfillment_status"]
          store_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_holds: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["order_hold_kind"]
          order_id: string
          payload: Json
          policy_id: string | null
          reason: string
          released_at: string | null
          released_by: string | null
          released_reason: string | null
          status: Database["public"]["Enums"]["order_hold_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["order_hold_kind"]
          order_id: string
          payload?: Json
          policy_id?: string | null
          reason: string
          released_at?: string | null
          released_by?: string | null
          released_reason?: string | null
          status?: Database["public"]["Enums"]["order_hold_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_hold_kind"]
          order_id?: string
          payload?: Json
          policy_id?: string | null
          reason?: string
          released_at?: string | null
          released_by?: string | null
          released_reason?: string | null
          status?: Database["public"]["Enums"]["order_hold_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_holds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_holds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_holds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_holds_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hold_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          item_type: Database["public"]["Enums"]["order_item_type"]
          line_total: number
          list_price: number
          metadata: Json
          name: string
          order_id: string
          product_id: string | null
          qty: number
          sku: string | null
          snapshot: Json
          store_id: string
          tax_amount: number
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"]
          line_total?: number
          list_price?: number
          metadata?: Json
          name: string
          order_id: string
          product_id?: string | null
          qty?: number
          sku?: string | null
          snapshot?: Json
          store_id: string
          tax_amount?: number
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          item_type?: Database["public"]["Enums"]["order_item_type"]
          line_total?: number
          list_price?: number
          metadata?: Json
          name?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          sku?: string | null
          snapshot?: Json
          store_id?: string
          tax_amount?: number
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_ledger: {
        Row: {
          actor_user_id: string | null
          amount: number
          balance_after: number | null
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["order_ledger_kind"]
          order_id: string
          payload: Json
          reference_id: string | null
          reference_type: string | null
          store_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          balance_after?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["order_ledger_kind"]
          order_id: string
          payload?: Json
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["order_ledger_kind"]
          order_id?: string
          payload?: Json
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          id: string
          metadata: Json
          order_id: string
          owner_token: string
          owner_user_id: string | null
          scope: string
          store_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          id?: string
          metadata?: Json
          order_id: string
          owner_token: string
          owner_user_id?: string | null
          scope: string
          store_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          owner_token?: string
          owner_user_id?: string | null
          scope?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_locks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_locks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_locks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          metadata: Json
          order_id: string
          pinned: boolean
          store_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["order_note_visibility"]
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          pinned?: boolean
          store_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["order_note_visibility"]
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          pinned?: boolean
          store_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["order_note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json
          order_id: string
          order_item_id: string | null
          payment_id: string
          scope: Database["public"]["Enums"]["order_allocation_scope"]
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          order_item_id?: string | null
          payment_id: string
          scope: Database["public"]["Enums"]["order_allocation_scope"]
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          order_item_id?: string | null
          payment_id?: string
          scope?: Database["public"]["Enums"]["order_allocation_scope"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "order_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          gateway: string | null
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string | null
          method: Database["public"]["Enums"]["order_payment_method"]
          order_id: string
          payload: Json
          refunded_amount: number
          status: Database["public"]["Enums"]["order_payment_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          captured_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          method: Database["public"]["Enums"]["order_payment_method"]
          order_id: string
          payload?: Json
          refunded_amount?: number
          status?: Database["public"]["Enums"]["order_payment_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: string | null
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          method?: Database["public"]["Enums"]["order_payment_method"]
          order_id?: string
          payload?: Json
          refunded_amount?: number
          status?: Database["public"]["Enums"]["order_payment_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_pricing_snapshots: {
        Row: {
          created_at: string
          hash: string
          id: string
          order_id: string
          schema_version: number
          snapshot: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          order_id: string
          schema_version?: number
          snapshot: Json
          store_id: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          order_id?: string
          schema_version?: number
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_pricing_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pricing_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pricing_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_return_items: {
        Row: {
          condition: string | null
          created_at: string
          id: string
          metadata: Json
          order_id: string
          order_item_id: string
          qty: number
          refund_amount: number
          resaleable: boolean
          return_id: string
          store_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          order_item_id: string
          qty: number
          refund_amount?: number
          resaleable?: boolean
          return_id: string
          store_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          order_item_id?: string
          qty?: number
          refund_amount?: number
          resaleable?: boolean
          return_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_return_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "order_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      order_returns: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          inspected_at: string | null
          metadata: Json
          order_id: string
          reason: Database["public"]["Enums"]["order_return_reason"]
          reason_note: string | null
          received_at: string | null
          refund_amount: number
          restocking_fee: number
          rma_number: string
          status: Database["public"]["Enums"]["order_return_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_at?: string | null
          metadata?: Json
          order_id: string
          reason: Database["public"]["Enums"]["order_return_reason"]
          reason_note?: string | null
          received_at?: string | null
          refund_amount?: number
          restocking_fee?: number
          rma_number: string
          status?: Database["public"]["Enums"]["order_return_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_at?: string | null
          metadata?: Json
          order_id?: string
          reason?: Database["public"]["Enums"]["order_return_reason"]
          reason_note?: string | null
          received_at?: string | null
          refund_amount?: number
          restocking_fee?: number
          rma_number?: string
          status?: Database["public"]["Enums"]["order_return_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          carrier: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          estimated_delivery_at: string | null
          fulfillment_id: string | null
          id: string
          items: Json
          order_id: string
          payload: Json
          service: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_shipment_status"]
          store_id: string
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          estimated_delivery_at?: string | null
          fulfillment_id?: string | null
          id?: string
          items?: Json
          order_id: string
          payload?: Json
          service?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_shipment_status"]
          store_id: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          estimated_delivery_at?: string | null
          fulfillment_id?: string | null
          id?: string
          items?: Json
          order_id?: string
          payload?: Json
          service?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_shipment_status"]
          store_id?: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipping_snapshots: {
        Row: {
          carrier: string | null
          carrier_account_id: string | null
          created_at: string
          eta_days: number | null
          id: string
          order_id: string
          price: number | null
          provider_code: string | null
          quoted_at: string | null
          schema_version: number
          service: string | null
          snapshot: Json
          store_id: string
        }
        Insert: {
          carrier?: string | null
          carrier_account_id?: string | null
          created_at?: string
          eta_days?: number | null
          id?: string
          order_id: string
          price?: number | null
          provider_code?: string | null
          quoted_at?: string | null
          schema_version?: number
          service?: string | null
          snapshot: Json
          store_id: string
        }
        Update: {
          carrier?: string | null
          carrier_account_id?: string | null
          created_at?: string
          eta_days?: number | null
          id?: string
          order_id?: string
          price?: number | null
          provider_code?: string | null
          quoted_at?: string | null
          schema_version?: number
          service?: string | null
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipping_snapshots_carrier_account_id_fkey"
            columns: ["carrier_account_id"]
            isOneToOne: false
            referencedRelation: "shipping_carrier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipping_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipping_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipping_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_split_items: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          order_id: string
          order_item_id: string
          qty: number
          split_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          order_item_id: string
          qty: number
          split_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          order_item_id?: string
          qty?: number
          split_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_split_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_split_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_split_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_split_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_split_items_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "order_splits"
            referencedColumns: ["id"]
          },
        ]
      }
      order_splits: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          fulfilled_at: string | null
          id: string
          metadata: Json
          order_id: string
          reason: string | null
          split_number: number
          status: Database["public"]["Enums"]["order_split_status"]
          store_id: string
          supplier_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          fulfilled_at?: string | null
          id?: string
          metadata?: Json
          order_id: string
          reason?: string | null
          split_number: number
          status?: Database["public"]["Enums"]["order_split_status"]
          store_id: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          fulfilled_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          reason?: string | null
          split_number?: number
          status?: Database["public"]["Enums"]["order_split_status"]
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_splits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_splits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_splits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_splits_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_splits_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tag_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          order_id: string
          store_id: string
          tag_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          store_id: string
          tag_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          store_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tag_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tag_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tag_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tax_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          order_id: string
          schema_version: number
          snapshot: Json
          store_id: string
          total_tax: number
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          order_id: string
          schema_version?: number
          snapshot: Json
          store_id: string
          total_tax?: number
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          order_id?: string
          schema_version?: number
          snapshot?: Json
          store_id?: string
          total_tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_tax_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tax_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tax_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          actor_label: string | null
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["order_timeline_event"]
          id: string
          order_id: string
          payload: Json
          store_id: string
        }
        Insert: {
          actor_label?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["order_timeline_event"]
          id?: string
          order_id: string
          payload?: Json
          store_id: string
        }
        Update: {
          actor_label?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["order_timeline_event"]
          id?: string
          order_id?: string
          payload?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_instances: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          order_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          order_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_workflow_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          causation_id: string | null
          channel: string
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_phone: string | null
          discount_total: number
          fees_total: number
          id: string
          idempotency_key: string | null
          items_count: number
          metadata: Json
          order_number: string
          placed_at: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          shipping_total: number
          source_cart_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          tags: string[]
          tax_total: number
          total: number
          trace_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          channel?: string
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          discount_total?: number
          fees_total?: number
          id?: string
          idempotency_key?: string | null
          items_count?: number
          metadata?: Json
          order_number: string
          placed_at?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          shipping_total?: number
          source_cart_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          tags?: string[]
          tax_total?: number
          total?: number
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          channel?: string
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          discount_total?: number
          fees_total?: number
          id?: string
          idempotency_key?: string | null
          items_count?: number
          metadata?: Json
          order_number?: string
          placed_at?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"]
          shipping_total?: number
          source_cart_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          tags?: string[]
          tax_total?: number
          total?: number
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_cart_id_fkey"
            columns: ["source_cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_search: {
        Row: {
          channel: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          items_count: number
          order_id: string
          order_number: string
          placed_at: string | null
          search_tsv: unknown
          skus: string[]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          tags: string[]
          total: number
          updated_at: string
        }
        Insert: {
          channel?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          items_count?: number
          order_id: string
          order_number: string
          placed_at?: string | null
          search_tsv?: unknown
          skus?: string[]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          tags?: string[]
          total?: number
          updated_at?: string
        }
        Update: {
          channel?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          items_count?: number
          order_id?: string
          order_number?: string
          placed_at?: string | null
          search_tsv?: unknown
          skus?: string[]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          tags?: string[]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_search_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_search_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_search_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          created_at: string
          fulfillment_item_id: string
          id: string
          metadata: Json
          package_id: string
          quantity: number
          serial_numbers: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          fulfillment_item_id: string
          id?: string
          metadata?: Json
          package_id: string
          quantity: number
          serial_numbers?: Json
          store_id: string
        }
        Update: {
          created_at?: string
          fulfillment_item_id?: string
          id?: string
          metadata?: Json
          package_id?: string
          quantity?: number
          serial_numbers?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_items_fulfillment_item_id_fkey"
            columns: ["fulfillment_item_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          code: string
          created_at: string
          fulfillment_id: string
          height_cm: number | null
          id: string
          length_cm: number | null
          metadata: Json
          packed_at: string | null
          packed_by: string | null
          sealed_at: string | null
          status: Database["public"]["Enums"]["package_status"]
          store_id: string
          updated_at: string
          version: number
          void_reason: string | null
          voided_at: string | null
          volume_cm3: number | null
          weight_g: number | null
          width_cm: number | null
        }
        Insert: {
          code: string
          created_at?: string
          fulfillment_id: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          metadata?: Json
          packed_at?: string | null
          packed_by?: string | null
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          store_id: string
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          volume_cm3?: number | null
          weight_g?: number | null
          width_cm?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          fulfillment_id?: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          metadata?: Json
          packed_at?: string | null
          packed_by?: string | null
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          store_id?: string
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          volume_cm3?: number | null
          weight_g?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_adapters: {
        Row: {
          capabilities: Json
          config_schema: Json
          created_at: string
          display_name: string
          id: string
          provider: string
          release_notes: string | null
          released_at: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["payment_adapter_status"]
          supported_methods: Database["public"]["Enums"]["payment_method"][]
          updated_at: string
          version: string
          webhook_signature_scheme: string | null
        }
        Insert: {
          capabilities?: Json
          config_schema?: Json
          created_at?: string
          display_name: string
          id?: string
          provider: string
          release_notes?: string | null
          released_at?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["payment_adapter_status"]
          supported_methods?: Database["public"]["Enums"]["payment_method"][]
          updated_at?: string
          version: string
          webhook_signature_scheme?: string | null
        }
        Update: {
          capabilities?: Json
          config_schema?: Json
          created_at?: string
          display_name?: string
          id?: string
          provider?: string
          release_notes?: string | null
          released_at?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["payment_adapter_status"]
          supported_methods?: Database["public"]["Enums"]["payment_method"][]
          updated_at?: string
          version?: string
          webhook_signature_scheme?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_id: string
          store_id: string
          target_id: string | null
          target_type: Database["public"]["Enums"]["payment_allocation_target"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_id: string
          store_id: string
          target_id?: string | null
          target_type: Database["public"]["Enums"]["payment_allocation_target"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_id?: string
          store_id?: string
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["payment_allocation_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          adapter: string
          attempt_no: number
          correlation_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          gateway_id: string | null
          gateway_status: string | null
          http_status: number | null
          id: string
          idempotency_key: string | null
          latency_ms: number | null
          operation: Database["public"]["Enums"]["payment_attempt_operation"]
          payment_id: string
          request_payload: Json
          response_payload: Json
          retry_of: string | null
          started_at: string
          store_id: string
          trace_id: string | null
        }
        Insert: {
          adapter: string
          attempt_no: number
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          gateway_id?: string | null
          gateway_status?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          operation: Database["public"]["Enums"]["payment_attempt_operation"]
          payment_id: string
          request_payload?: Json
          response_payload?: Json
          retry_of?: string | null
          started_at?: string
          store_id: string
          trace_id?: string | null
        }
        Update: {
          adapter?: string
          attempt_no?: number
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          gateway_id?: string | null
          gateway_status?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          operation?: Database["public"]["Enums"]["payment_attempt_operation"]
          payment_id?: string
          request_payload?: Json
          response_payload?: Json
          retry_of?: string | null
          started_at?: string
          store_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_chargeback_evidences: {
        Row: {
          asset_id: string | null
          chargeback_id: string
          created_at: string
          description: string | null
          evidence_kind: string
          gateway_response: Json | null
          id: string
          payload: Json
          store_id: string
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          asset_id?: string | null
          chargeback_id: string
          created_at?: string
          description?: string | null
          evidence_kind: string
          gateway_response?: Json | null
          id?: string
          payload?: Json
          store_id: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          asset_id?: string | null
          chargeback_id?: string
          created_at?: string
          description?: string | null
          evidence_kind?: string
          gateway_response?: Json | null
          id?: string
          payload?: Json
          store_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_chargeback_evidences_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_chargeback_evidences_chargeback_id_fkey"
            columns: ["chargeback_id"]
            isOneToOne: false
            referencedRelation: "payment_chargebacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_chargeback_evidences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_chargebacks: {
        Row: {
          amount: number
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          evidence_due_at: string | null
          evidence_submitted_at: string | null
          fee_amount: number
          gateway_dispute_id: string | null
          gateway_id: string | null
          id: string
          liable_party: string | null
          metadata: Json
          network_reference: string | null
          opened_at: string
          outcome_note: string | null
          payment_id: string
          reason: Database["public"]["Enums"]["payment_chargeback_reason"]
          reason_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["payment_chargeback_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          amount: number
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency: string
          evidence_due_at?: string | null
          evidence_submitted_at?: string | null
          fee_amount?: number
          gateway_dispute_id?: string | null
          gateway_id?: string | null
          id?: string
          liable_party?: string | null
          metadata?: Json
          network_reference?: string | null
          opened_at?: string
          outcome_note?: string | null
          payment_id: string
          reason?: Database["public"]["Enums"]["payment_chargeback_reason"]
          reason_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["payment_chargeback_status"]
          store_id: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          evidence_due_at?: string | null
          evidence_submitted_at?: string | null
          fee_amount?: number
          gateway_dispute_id?: string | null
          gateway_id?: string | null
          id?: string
          liable_party?: string | null
          metadata?: Json
          network_reference?: string | null
          opened_at?: string
          outcome_note?: string | null
          payment_id?: string
          reason?: Database["public"]["Enums"]["payment_chargeback_reason"]
          reason_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["payment_chargeback_status"]
          store_id?: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_chargebacks_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_chargebacks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_chargebacks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credentials_keyring: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      payment_documents: {
        Row: {
          asset_id: string | null
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          kind: Database["public"]["Enums"]["payment_document_kind"]
          metadata: Json
          payment_id: string
          sent_at: string | null
          sent_to: string | null
          status: Database["public"]["Enums"]["payment_document_status"]
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind: Database["public"]["Enums"]["payment_document_kind"]
          metadata?: Json
          payment_id: string
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["payment_document_status"]
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind?: Database["public"]["Enums"]["payment_document_kind"]
          metadata?: Json
          payment_id?: string
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["payment_document_status"]
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["payment_event_actor"]
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          payment_id: string
          store_id: string
          trace_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["payment_event_actor"]
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          payment_id: string
          store_id: string
          trace_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["payment_event_actor"]
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          payment_id?: string
          store_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_adapter_bindings: {
        Row: {
          adapter_id: string
          config_overrides: Json
          created_at: string
          gateway_id: string
          id: string
          is_active: boolean
          pinned_at: string
          pinned_by: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          adapter_id: string
          config_overrides?: Json
          created_at?: string
          gateway_id: string
          id?: string
          is_active?: boolean
          pinned_at?: string
          pinned_by?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          adapter_id?: string
          config_overrides?: Json
          created_at?: string
          gateway_id?: string
          id?: string
          is_active?: boolean
          pinned_at?: string
          pinned_by?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_adapter_bindings_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "payment_adapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_gateway_adapter_bindings_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_gateway_adapter_bindings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          adapter: string
          capabilities: Json
          config: Json
          created_at: string
          created_by: string | null
          credentials_encrypted: string | null
          credentials_fingerprint: string | null
          credentials_set_at: string | null
          credentials_set_by: string | null
          display_name: string
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          priority: number
          store_id: string
          supported_currencies: string[]
          supported_methods: Database["public"]["Enums"]["payment_method"][]
          updated_at: string
          webhook_secret_encrypted: string | null
          webhook_secret_ref: string | null
        }
        Insert: {
          adapter: string
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          priority?: number
          store_id: string
          supported_currencies?: string[]
          supported_methods?: Database["public"]["Enums"]["payment_method"][]
          updated_at?: string
          webhook_secret_encrypted?: string | null
          webhook_secret_ref?: string | null
        }
        Update: {
          adapter?: string
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          priority?: number
          store_id?: string
          supported_currencies?: string[]
          supported_methods?: Database["public"]["Enums"]["payment_method"][]
          updated_at?: string
          webhook_secret_encrypted?: string | null
          webhook_secret_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_metadata: {
        Row: {
          created_at: string
          id: string
          is_pii: boolean
          is_secret: boolean
          key: string
          namespace: string
          payment_id: string
          store_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_pii?: boolean
          is_secret?: boolean
          key: string
          namespace: string
          payment_id: string
          store_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_pii?: boolean
          is_secret?: boolean
          key?: string
          namespace?: string
          payment_id?: string
          store_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_metadata_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_metadata_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          metadata: Json
          payment_id: string
          pinned: boolean
          store_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["payment_note_visibility"]
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_id: string
          pinned?: boolean
          store_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["payment_note_visibility"]
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_id?: string
          pinned?: boolean
          store_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["payment_note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_notes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation_discrepancies: {
        Row: {
          actual_amount: number | null
          created_at: string
          details: Json
          expected_amount: number | null
          id: string
          kind: Database["public"]["Enums"]["payment_reconciliation_discrepancy_kind"]
          payment_id: string | null
          reconciliation_id: string
          reconciliation_item_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          store_id: string
        }
        Insert: {
          actual_amount?: number | null
          created_at?: string
          details?: Json
          expected_amount?: number | null
          id?: string
          kind: Database["public"]["Enums"]["payment_reconciliation_discrepancy_kind"]
          payment_id?: string | null
          reconciliation_id: string
          reconciliation_item_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          store_id: string
        }
        Update: {
          actual_amount?: number | null
          created_at?: string
          details?: Json
          expected_amount?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_reconciliation_discrepancy_kind"]
          payment_id?: string | null
          reconciliation_id?: string
          reconciliation_item_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_discrepancie_reconciliation_item_id_fkey"
            columns: ["reconciliation_item_id"]
            isOneToOne: false
            referencedRelation: "payment_reconciliation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_discrepancies_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_discrepancies_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "payment_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_discrepancies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation_items: {
        Row: {
          amount: number
          created_at: string
          currency: string
          external_transaction_id: string | null
          fee_amount: number
          id: string
          matched_at: string | null
          matched_by: string | null
          net_amount: number
          payment_id: string | null
          posted_at: string | null
          raw_payload: Json
          reconciliation_id: string
          status: Database["public"]["Enums"]["payment_reconciliation_item_status"]
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          external_transaction_id?: string | null
          fee_amount?: number
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          net_amount?: number
          payment_id?: string | null
          posted_at?: string | null
          raw_payload?: Json
          reconciliation_id: string
          status?: Database["public"]["Enums"]["payment_reconciliation_item_status"]
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          external_transaction_id?: string | null
          fee_amount?: number
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          net_amount?: number
          payment_id?: string | null
          posted_at?: string | null
          raw_payload?: Json
          reconciliation_id?: string
          status?: Database["public"]["Enums"]["payment_reconciliation_item_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "payment_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliations: {
        Row: {
          created_at: string
          discrepant_items: number
          external_batch_id: string | null
          failure_message: string | null
          gateway_id: string
          id: string
          matched_items: number
          metadata: Json
          net_amount: number
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          reference: string
          source_file_asset_id: string | null
          status: Database["public"]["Enums"]["payment_reconciliation_status"]
          store_id: string
          total_amount: number
          total_fees: number
          total_items: number
          unmatched_items: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discrepant_items?: number
          external_batch_id?: string | null
          failure_message?: string | null
          gateway_id: string
          id?: string
          matched_items?: number
          metadata?: Json
          net_amount?: number
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          reference: string
          source_file_asset_id?: string | null
          status?: Database["public"]["Enums"]["payment_reconciliation_status"]
          store_id: string
          total_amount?: number
          total_fees?: number
          total_items?: number
          unmatched_items?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discrepant_items?: number
          external_batch_id?: string | null
          failure_message?: string | null
          gateway_id?: string
          id?: string
          matched_items?: number
          metadata?: Json
          net_amount?: number
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          reference?: string
          source_file_asset_id?: string | null
          status?: Database["public"]["Enums"]["payment_reconciliation_status"]
          store_id?: string
          total_amount?: number
          total_fees?: number
          total_items?: number
          unmatched_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliations_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_source_file_asset_id_fkey"
            columns: ["source_file_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refund_items: {
        Row: {
          allocation_id: string | null
          amount: number
          created_at: string
          id: string
          metadata: Json
          refund_id: string
          store_id: string
          transaction_id: string | null
        }
        Insert: {
          allocation_id?: string | null
          amount: number
          created_at?: string
          id?: string
          metadata?: Json
          refund_id: string
          store_id: string
          transaction_id?: string | null
        }
        Update: {
          allocation_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json
          refund_id?: string
          store_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_refund_items_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "payment_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_items_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "payment_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          external_reference: string | null
          failure_code: string | null
          failure_message: string | null
          gateway_id: string | null
          gateway_refund_id: string | null
          id: string
          metadata: Json
          payment_id: string
          processed_at: string | null
          reason: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["payment_refund_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency: string
          external_reference?: string | null
          failure_code?: string | null
          failure_message?: string | null
          gateway_id?: string | null
          gateway_refund_id?: string | null
          id?: string
          metadata?: Json
          payment_id: string
          processed_at?: string | null
          reason?: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["payment_refund_status"]
          store_id: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          external_reference?: string | null
          failure_code?: string | null
          failure_message?: string | null
          gateway_id?: string | null
          gateway_refund_id?: string | null
          id?: string
          metadata?: Json
          payment_id?: string
          processed_at?: string | null
          reason?: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["payment_refund_status"]
          store_id?: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_timeline: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["payment_timeline_event"]
          id: string
          payload: Json
          payment_id: string
          store_id: string
          summary: string | null
          trace_id: string | null
        }
        Insert: {
          actor_kind?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["payment_timeline_event"]
          id?: string
          payload?: Json
          payment_id: string
          store_id: string
          summary?: string | null
          trace_id?: string | null
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["payment_timeline_event"]
          id?: string
          payload?: Json
          payment_id?: string
          store_id?: string
          summary?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_timeline_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_timeline_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          attempt_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          direction: Database["public"]["Enums"]["payment_transaction_direction"]
          external_id: string | null
          gateway_id: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_transaction_kind"]
          metadata: Json
          occurred_at: string
          parent_transaction_id: string | null
          payment_id: string
          posted_at: string | null
          settlement_date: string | null
          store_id: string
          trace_id: string | null
        }
        Insert: {
          amount: number
          attempt_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          direction: Database["public"]["Enums"]["payment_transaction_direction"]
          external_id?: string | null
          gateway_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_transaction_kind"]
          metadata?: Json
          occurred_at?: string
          parent_transaction_id?: string | null
          payment_id: string
          posted_at?: string | null
          settlement_date?: string | null
          store_id: string
          trace_id?: string | null
        }
        Update: {
          amount?: number
          attempt_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          direction?: Database["public"]["Enums"]["payment_transaction_direction"]
          external_id?: string | null
          gateway_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_transaction_kind"]
          metadata?: Json
          occurred_at?: string
          parent_transaction_id?: string | null
          payment_id?: string
          posted_at?: string | null
          settlement_date?: string | null
          store_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_inbox: {
        Row: {
          attempts: number
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          external_event_id: string
          gateway_id: string | null
          headers: Json
          id: string
          last_error: string | null
          payment_id: string | null
          processed_at: string | null
          provider: string
          raw_payload: Json
          received_at: string
          signature: string | null
          signature_valid: boolean | null
          source_ip: string | null
          status: Database["public"]["Enums"]["payment_webhook_status"]
          store_id: string | null
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          external_event_id: string
          gateway_id?: string | null
          headers?: Json
          id?: string
          last_error?: string | null
          payment_id?: string | null
          processed_at?: string | null
          provider: string
          raw_payload: Json
          received_at?: string
          signature?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          status?: Database["public"]["Enums"]["payment_webhook_status"]
          store_id?: string | null
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          external_event_id?: string
          gateway_id?: string | null
          headers?: Json
          id?: string
          last_error?: string | null
          payment_id?: string | null
          processed_at?: string | null
          provider?: string
          raw_payload?: Json
          received_at?: string
          signature?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          status?: Database["public"]["Enums"]["payment_webhook_status"]
          store_id?: string | null
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_inbox_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_inbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_inbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_processing_log: {
        Row: {
          attempt_number: number
          duration_ms: number | null
          error_message: string | null
          id: string
          processed_at: string
          status: Database["public"]["Enums"]["payment_webhook_status"]
          webhook_id: string
        }
        Insert: {
          attempt_number: number
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          processed_at?: string
          status: Database["public"]["Enums"]["payment_webhook_status"]
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          processed_at?: string
          status?: Database["public"]["Enums"]["payment_webhook_status"]
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_processing_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "payment_webhook_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_captured: number
          amount_fee: number
          amount_gross: number
          amount_net: number
          amount_refunded: number
          authorized_at: string | null
          cancelled_at: string | null
          captured_at: string | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          gateway_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          amount_captured?: number
          amount_fee?: number
          amount_gross: number
          amount_net?: number
          amount_refunded?: number
          authorized_at?: string | null
          cancelled_at?: string | null
          captured_at?: string | null
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          expires_at?: string | null
          external_id?: string | null
          failed_at?: string | null
          gateway_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          amount_captured?: number
          amount_fee?: number
          amount_gross?: number
          amount_net?: number
          amount_refunded?: number
          authorized_at?: string | null
          cancelled_at?: string | null
          captured_at?: string | null
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          expires_at?: string | null
          external_id?: string | null
          failed_at?: string | null
          gateway_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          payable_id?: string
          payable_type?: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          store_id?: string
          trace_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      pick_list_items: {
        Row: {
          bin_location: string | null
          created_at: string
          fulfillment_id: string
          fulfillment_item_id: string
          id: string
          notes: string | null
          pick_list_id: string
          picked_at: string | null
          picked_by: string | null
          quantity_picked: number
          quantity_requested: number
          sku: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          bin_location?: string | null
          created_at?: string
          fulfillment_id: string
          fulfillment_item_id: string
          id?: string
          notes?: string | null
          pick_list_id: string
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number
          quantity_requested: number
          sku?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          bin_location?: string | null
          created_at?: string
          fulfillment_id?: string
          fulfillment_item_id?: string
          id?: string
          notes?: string | null
          pick_list_id?: string
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number
          quantity_requested?: number
          sku?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_items_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_fulfillment_item_id_fkey"
            columns: ["fulfillment_item_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          assigned_to: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          causation_id: string | null
          code: string
          completed_at: string | null
          completed_items: number
          correlation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          schema_version: number
          started_at: string | null
          status: Database["public"]["Enums"]["pick_list_status"]
          store_id: string
          strategy: Database["public"]["Enums"]["picking_strategy"]
          total_items: number
          trace_id: string | null
          updated_at: string
          version: number
          warehouse_id: string
        }
        Insert: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          code: string
          completed_at?: string | null
          completed_items?: number
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          schema_version?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          store_id: string
          strategy?: Database["public"]["Enums"]["picking_strategy"]
          total_items?: number
          trace_id?: string | null
          updated_at?: string
          version?: number
          warehouse_id: string
        }
        Update: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          causation_id?: string | null
          code?: string
          completed_at?: string | null
          completed_items?: number
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          schema_version?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          store_id?: string
          strategy?: Database["public"]["Enums"]["picking_strategy"]
          total_items?: number
          trace_id?: string | null
          updated_at?: string
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_customer_groups: {
        Row: {
          customer_group_id: string
          price_list_id: string
        }
        Insert: {
          customer_group_id: string
          price_list_id: string
        }
        Update: {
          customer_group_id?: string
          price_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_customer_groups_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_customer_groups_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          max_quantity: number | null
          min_quantity: number
          price: number
          price_list_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price: number
          price_list_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price?: number
          price_list_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          priority: number
          starts_at: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          name: string
          priority?: number
          starts_at?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          priority?: number
          starts_at?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          attribute_value_id: string | null
          created_at: string
          id: string
          product_id: string
          value_boolean: boolean | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          attribute_id: string
          attribute_value_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          value_boolean?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          attribute_id?: string
          attribute_value_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          value_boolean?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_attribute_value_id_fkey"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_color_media: {
        Row: {
          alt: string | null
          created_at: string
          duration_seconds: number | null
          external_id: string | null
          external_url: string | null
          height: number | null
          id: string
          is_cover: boolean
          is_hover_media: boolean
          media_type: Database["public"]["Enums"]["media_type"]
          product_color_id: string
          sort_order: number
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          external_url?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          is_hover_media?: boolean
          media_type: Database["public"]["Enums"]["media_type"]
          product_color_id: string
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          external_url?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          is_hover_media?: boolean
          media_type?: Database["public"]["Enums"]["media_type"]
          product_color_id?: string
          sort_order?: number
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_color_media_product_color_id_fkey"
            columns: ["product_color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colors: {
        Row: {
          attribute_value_id: string | null
          created_at: string
          hex: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          attribute_value_id?: string | null
          created_at?: string
          hex?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          attribute_value_id?: string | null
          created_at?: string
          hex?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_colors_attribute_value_id_fkey"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_relations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          position: number
          product_id: string
          related_product_id: string
          relation_type: Database["public"]["Enums"]["product_relation_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          product_id: string
          related_product_id: string
          relation_type?: Database["public"]["Enums"]["product_relation_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          product_id?: string
          related_product_id?: string
          relation_type?: Database["public"]["Enums"]["product_relation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "product_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_helpful_votes: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          review_id: string
          vote: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          review_id: string
          vote: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          review_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_review_helpful_votes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_review_helpful_votes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_media: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          review_id: string
          sort_order: number
          store_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          review_id: string
          sort_order?: number
          store_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          review_id?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_review_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_review_media_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string
          helpful_count: number
          id: string
          language: string
          metadata: Json
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          order_id: string | null
          order_item_id: string | null
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          store_id: string
          title: string | null
          unhelpful_count: number
          updated_at: string
          variant_id: string | null
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id: string
          helpful_count?: number
          id?: string
          language?: string
          metadata?: Json
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          store_id: string
          title?: string | null
          unhelpful_count?: number
          updated_at?: string
          variant_id?: string | null
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string
          helpful_count?: number
          id?: string
          language?: string
          metadata?: Json
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          store_id?: string
          title?: string | null
          unhelpful_count?: number
          updated_at?: string
          variant_id?: string | null
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          height_mm: number | null
          id: string
          internal_reference: string | null
          is_active: boolean
          length_mm: number | null
          product_color_id: string
          product_id: string
          size_attribute_value_id: string | null
          sku: string
          updated_at: string
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          height_mm?: number | null
          id?: string
          internal_reference?: string | null
          is_active?: boolean
          length_mm?: number | null
          product_color_id: string
          product_id: string
          size_attribute_value_id?: string | null
          sku: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          height_mm?: number | null
          id?: string
          internal_reference?: string | null
          is_active?: boolean
          length_mm?: number | null
          product_color_id?: string
          product_id?: string
          size_attribute_value_id?: string | null
          sku?: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_color_id_fkey"
            columns: ["product_color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_attribute_value_id_fkey"
            columns: ["size_attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          best_seller: boolean
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          name: string
          new_product: boolean
          on_sale: boolean
          published_at: string | null
          sale_channel: Database["public"]["Enums"]["sale_channel"]
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku_root: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          store_id: string
          tax_class: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          best_seller?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          name: string
          new_product?: boolean
          on_sale?: boolean
          published_at?: string | null
          sale_channel?: Database["public"]["Enums"]["sale_channel"]
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku_root: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id: string
          tax_class?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          best_seller?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          name?: string
          new_product?: boolean
          on_sale?: boolean
          published_at?: string | null
          sale_channel?: Database["public"]["Enums"]["sale_channel"]
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku_root?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id?: string
          tax_class?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked_reason: string | null
          created_at: string
          default_store_id: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          job_title: string | null
          last_login_at: string | null
          locale: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blocked_reason?: string | null
          created_at?: string
          default_store_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          job_title?: string | null
          last_login_at?: string | null
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blocked_reason?: string | null
          created_at?: string
          default_store_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          job_title?: string | null
          last_login_at?: string | null
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_store_id_fkey"
            columns: ["default_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tracking_access_log: {
        Row: {
          accessed_at: string
          id: string
          ip_hash: string | null
          result: string
          shipment_id: string | null
          store_id: string | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip_hash?: string | null
          result: string
          shipment_id?: string | null
          store_id?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          id?: string
          ip_hash?: string | null
          result?: string
          shipment_id?: string | null
          store_id?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_tracking_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "public_tracking_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tracking_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          hits: number
          id: string
          max_hits: number
          revoked_at: string | null
          shipment_id: string
          store_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          hits?: number
          id?: string
          max_hits?: number
          revoked_at?: string | null
          shipment_id: string
          store_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          hits?: number
          id?: string
          max_hits?: number
          revoked_at?: string | null
          shipment_id?: string
          store_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_tracking_tokens_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tracking_v"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "public_tracking_tokens_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_tracking_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          notes: string | null
          position: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          tax_amount: number
          total_amount: number
          unit_cost: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          position?: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          tax_amount?: number
          total_amount?: number
          unit_cost: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          position?: number
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          tax_amount?: number
          total_amount?: number
          unit_cost?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          payment_terms: string | null
          po_number: string
          shipping_cost: number
          status: string
          store_id: string
          subtotal: number
          supplier_id: string
          tax_amount: number
          total_amount: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms?: string | null
          po_number: string
          shipping_cost?: number
          status?: string
          store_id: string
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms?: string | null
          po_number?: string
          shipping_cost?: number
          status?: string
          store_id?: string
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipment_packages: {
        Row: {
          created_at: string
          id: string
          package_id: string
          shipment_id: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          shipment_id: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          shipment_id?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_packages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tracking_v"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_packages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_packages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          carrier_code: string | null
          causation_id: string | null
          code: string
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          declared_value: number | null
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          failure_code: string | null
          failure_message: string | null
          fulfillment_id: string
          id: string
          insurance_cost: number | null
          metadata: Json
          returned_at: string | null
          schema_version: number
          service_code: string | null
          service_name: string | null
          ship_from: Json
          ship_to: Json
          shipping_cost: number | null
          status: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          trace_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          version: number
          weight_g: number | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_code?: string | null
          causation_id?: string | null
          code: string
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declared_value?: number | null
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fulfillment_id: string
          id?: string
          insurance_cost?: number | null
          metadata?: Json
          returned_at?: string | null
          schema_version?: number
          service_code?: string | null
          service_name?: string | null
          ship_from?: Json
          ship_to?: Json
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          trace_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          version?: number
          weight_g?: number | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_code?: string | null
          causation_id?: string | null
          code?: string
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declared_value?: number | null
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          fulfillment_id?: string
          id?: string
          insurance_cost?: number | null
          metadata?: Json
          returned_at?: string | null
          schema_version?: number
          service_code?: string | null
          service_name?: string | null
          ship_from?: Json
          ship_to?: Json
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id?: string
          trace_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          version?: number
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carrier_accounts: {
        Row: {
          capabilities: Json
          config: Json
          created_at: string
          created_by: string | null
          credentials_encrypted: string | null
          credentials_fingerprint: string | null
          credentials_set_at: string | null
          credentials_set_by: string | null
          display_name: string
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          provider_code: string
          sandbox: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          provider_code: string
          sandbox?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: string | null
          credentials_fingerprint?: string | null
          credentials_set_at?: string | null
          credentials_set_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          provider_code?: string
          sandbox?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_carrier_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_credentials_keyring: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      shipping_labels: {
        Row: {
          asset_id: string | null
          carrier_label_id: string | null
          cost: number | null
          created_at: string
          currency: string | null
          format: Database["public"]["Enums"]["shipping_label_format"]
          id: string
          metadata: Json
          purchased_at: string
          shipment_id: string
          store_id: string
          url: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          asset_id?: string | null
          carrier_label_id?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          format?: Database["public"]["Enums"]["shipping_label_format"]
          id?: string
          metadata?: Json
          purchased_at?: string
          shipment_id: string
          store_id: string
          url?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          asset_id?: string | null
          carrier_label_id?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          format?: Database["public"]["Enums"]["shipping_label_format"]
          id?: string
          metadata?: Json
          purchased_at?: string
          shipment_id?: string
          store_id?: string
          url?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tracking_v"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipping_labels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          active: boolean
          carrier: string | null
          code: string
          config: Json
          created_at: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          kind: Database["public"]["Enums"]["shipping_method_kind"]
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          carrier?: string | null
          code: string
          config?: Json
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          kind: Database["public"]["Enums"]["shipping_method_kind"]
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          carrier?: string | null
          code?: string
          config?: Json
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["shipping_method_kind"]
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_oauth_states: {
        Row: {
          account_id: string | null
          code_verifier: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          provider_code: string
          redirect_uri: string
          return_to: string | null
          state: string
          store_id: string
        }
        Insert: {
          account_id?: string | null
          code_verifier: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider_code: string
          redirect_uri: string
          return_to?: string | null
          state: string
          store_id: string
        }
        Update: {
          account_id?: string | null
          code_verifier?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider_code?: string
          redirect_uri?: string
          return_to?: string | null
          state?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_oauth_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "shipping_carrier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_oauth_states_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_quotes: {
        Row: {
          carrier: string | null
          carrier_account_id: string | null
          cart_id: string
          created_at: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          expires_at: string | null
          id: string
          method_code: string
          method_id: string | null
          method_name: string
          payload: Json
          postal_code: string | null
          price: number
          provider_code: string | null
          quoted_at: string
          selected: boolean
          store_id: string
          weight_g: number | null
        }
        Insert: {
          carrier?: string | null
          carrier_account_id?: string | null
          cart_id: string
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          expires_at?: string | null
          id?: string
          method_code: string
          method_id?: string | null
          method_name: string
          payload?: Json
          postal_code?: string | null
          price: number
          provider_code?: string | null
          quoted_at?: string
          selected?: boolean
          store_id: string
          weight_g?: number | null
        }
        Update: {
          carrier?: string | null
          carrier_account_id?: string | null
          cart_id?: string
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          expires_at?: string | null
          id?: string
          method_code?: string
          method_id?: string | null
          method_name?: string
          payload?: Json
          postal_code?: string | null
          price?: number
          provider_code?: string | null
          quoted_at?: string
          selected?: boolean
          store_id?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_carrier_account_id_fkey"
            columns: ["carrier_account_id"]
            isOneToOne: false
            referencedRelation: "shipping_carrier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          active: boolean
          created_at: string
          free_above_subtotal: number | null
          id: string
          max_subtotal: number | null
          max_weight_g: number | null
          method_id: string
          min_subtotal: number | null
          min_weight_g: number
          price: number
          store_id: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          free_above_subtotal?: number | null
          id?: string
          max_subtotal?: number | null
          max_weight_g?: number | null
          method_id: string
          min_subtotal?: number | null
          min_weight_g?: number
          price: number
          store_id: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          free_above_subtotal?: number | null
          id?: string
          max_subtotal?: number | null
          max_weight_g?: number | null
          method_id?: string
          min_subtotal?: number | null
          min_weight_g?: number
          price?: number
          store_id?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_snapshots: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          payload: Json
          quote_id: string | null
          store_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          payload: Json
          quote_id?: string | null
          store_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          payload?: Json
          quote_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_snapshots_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_snapshots_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "shipping_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zone_postal_ranges: {
        Row: {
          created_at: string
          id: string
          postal_from: string
          postal_to: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          postal_from: string
          postal_to: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          postal_from?: string
          postal_to?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zone_postal_ranges_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          active: boolean
          country: string
          created_at: string
          id: string
          metadata: Json
          name: string
          states: string[]
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country?: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          states?: string[]
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          states?: string[]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          created_at: string
          id: string
          last_movement_at: string | null
          quantity_incoming: number
          quantity_on_hand: number
          quantity_reserved: number
          reorder_point: number | null
          reorder_quantity: number | null
          store_id: string
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_movement_at?: string | null
          quantity_incoming?: number
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          store_id: string
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_movement_at?: string | null
          quantity_incoming?: number
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          store_id?: string
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          occurred_at: string
          performed_by: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          store_id: string
          unit_cost: number | null
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          unit_cost?: number | null
          variant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          unit_cost?: number | null
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservation_ledger: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["reservation_ledger_kind"]
          metadata: Json
          qty: number
          reason: string | null
          reservation_id: string
          store_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["reservation_ledger_kind"]
          metadata?: Json
          qty: number
          reason?: string | null
          reservation_id: string
          store_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reservation_ledger_kind"]
          metadata?: Json
          qty?: number
          reason?: string | null
          reservation_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservation_ledger_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "stock_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          cart_id: string | null
          cart_item_id: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          order_id: string | null
          qty: number
          released_at: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          store_id: string
          updated_at: string
          variant_id: string
          warehouse_id: string | null
        }
        Insert: {
          cart_id?: string | null
          cart_item_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          metadata?: Json
          order_id?: string | null
          qty: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          store_id: string
          updated_at?: string
          variant_id: string
          warehouse_id?: string | null
        }
        Update: {
          cart_id?: string | null
          cart_item_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          qty?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          store_id?: string
          updated_at?: string
          variant_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity_received: number
          quantity_shipped: number
          stock_transfer_id: string
          unit_cost: number | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity_received?: number
          quantity_shipped: number
          stock_transfer_id: string
          unit_cost?: number | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity_received?: number
          quantity_shipped?: number
          stock_transfer_id?: string
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_stock_transfer_id_fkey"
            columns: ["stock_transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          destination_warehouse_id: string
          id: string
          notes: string | null
          origin_warehouse_id: string
          received_at: string | null
          received_by: string | null
          shipped_at: string | null
          shipped_by: string | null
          status: string
          store_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_warehouse_id: string
          id?: string
          notes?: string | null
          origin_warehouse_id: string
          received_at?: string | null
          received_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: string
          store_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_warehouse_id?: string
          id?: string
          notes?: string | null
          origin_warehouse_id?: string
          received_at?: string | null
          received_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: string
          store_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          store_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          store_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          store_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          cnpj: string | null
          created_at: string
          default_currency: string
          deleted_at: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          default_currency?: string
          deleted_at?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          legal_name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          store_id: string
          tax_id: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          legal_name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          store_id: string
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          legal_name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          store_id?: string
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sla_policies: {
        Row: {
          at_risk_threshold_pct: number
          business_hours_only: boolean
          created_at: string
          created_by: string | null
          description: string | null
          first_response_minutes: number
          id: string
          is_active: boolean
          match_category_id: string | null
          match_priority:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          match_source:
            | Database["public"]["Enums"]["support_ticket_source"]
            | null
          name: string
          pause_on_pending_customer: boolean
          priority: number
          resolution_minutes: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          at_risk_threshold_pct?: number
          business_hours_only?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_minutes: number
          id?: string
          is_active?: boolean
          match_category_id?: string | null
          match_priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          match_source?:
            | Database["public"]["Enums"]["support_ticket_source"]
            | null
          name: string
          pause_on_pending_customer?: boolean
          priority?: number
          resolution_minutes: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          at_risk_threshold_pct?: number
          business_hours_only?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          match_category_id?: string | null
          match_priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          match_source?:
            | Database["public"]["Enums"]["support_ticket_source"]
            | null
          name?: string
          pause_on_pending_customer?: boolean
          priority?: number
          resolution_minutes?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sla_policies_match_category_id_fkey"
            columns: ["match_category_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sla_policies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_assignments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          assigned_to_user_id: string | null
          id: string
          reason: string | null
          team: string | null
          ticket_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          id?: string
          reason?: string | null
          team?: string | null
          ticket_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          id?: string
          reason?: string | null
          team?: string | null
          ticket_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_support_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          actor_customer_id: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          ticket_id: string
        }
        Insert: {
          actor_customer_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          ticket_id: string
        }
        Update: {
          actor_customer_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_actor_customer_id_fkey"
            columns: ["actor_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "support_ticket_events_actor_customer_id_fkey"
            columns: ["actor_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_support_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_message_attachments: {
        Row: {
          asset_id: string | null
          created_at: string
          filename: string
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_url: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          filename: string
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_url?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_message_attachments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          attachments_count: number
          author_customer_id: string | null
          author_type: Database["public"]["Enums"]["support_message_author_type"]
          author_user_id: string | null
          body: string
          body_format: string
          created_at: string
          id: string
          idempotency_key: string | null
          source: Database["public"]["Enums"]["support_ticket_source"] | null
          ticket_id: string
          visibility: Database["public"]["Enums"]["support_message_visibility"]
        }
        Insert: {
          attachments_count?: number
          author_customer_id?: string | null
          author_type: Database["public"]["Enums"]["support_message_author_type"]
          author_user_id?: string | null
          body: string
          body_format?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          source?: Database["public"]["Enums"]["support_ticket_source"] | null
          ticket_id: string
          visibility?: Database["public"]["Enums"]["support_message_visibility"]
        }
        Update: {
          attachments_count?: number
          author_customer_id?: string | null
          author_type?: Database["public"]["Enums"]["support_message_author_type"]
          author_user_id?: string | null
          body?: string
          body_format?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          source?: Database["public"]["Enums"]["support_ticket_source"] | null
          ticket_id?: string
          visibility?: Database["public"]["Enums"]["support_message_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_customer_id_fkey"
            columns: ["author_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "support_ticket_messages_author_customer_id_fkey"
            columns: ["author_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_support_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_watchers: {
        Row: {
          added_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_support_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_at: string | null
          assigned_to_user_id: string | null
          category_id: string | null
          closed_at: string | null
          created_at: string
          created_by_user_id: string | null
          customer_id: string | null
          description: string | null
          escalated_at: string | null
          escalation_level: number
          first_responded_at: string | null
          first_response_due_at: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          reopened_at: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          satisfaction_feedback: string | null
          satisfaction_score: number | null
          sla_policy_id: string | null
          sla_state: Database["public"]["Enums"]["support_sla_state"]
          source: Database["public"]["Enums"]["support_ticket_source"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          store_id: string | null
          subject: string
          team: string | null
          ticket_number: number
          updated_at: string
          version: number
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string | null
          description?: string | null
          escalated_at?: string | null
          escalation_level?: number
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          reopened_at?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          satisfaction_feedback?: string | null
          satisfaction_score?: number | null
          sla_policy_id?: string | null
          sla_state?: Database["public"]["Enums"]["support_sla_state"]
          source?: Database["public"]["Enums"]["support_ticket_source"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          store_id?: string | null
          subject: string
          team?: string | null
          ticket_number?: number
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          category_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string | null
          description?: string | null
          escalated_at?: string | null
          escalation_level?: number
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          reopened_at?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          satisfaction_feedback?: string | null
          satisfaction_score?: number | null
          sla_policy_id?: string | null
          sla_state?: Database["public"]["Enums"]["support_sla_state"]
          source?: Database["public"]["Enums"]["support_ticket_source"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          store_id?: string | null
          subject?: string
          team?: string | null
          ticket_number?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_orders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_admin_list_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "support_sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          source: string
          store_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          source: string
          store_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          source?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_secret: boolean
          key: string
          scope: Database["public"]["Enums"]["setting_scope"]
          store_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key: string
          scope?: Database["public"]["Enums"]["setting_scope"]
          store_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key?: string
          scope?: Database["public"]["Enums"]["setting_scope"]
          store_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          slug: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          slug: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      traces: {
        Row: {
          actor_user_id: string | null
          attributes: Json
          created_at: string
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          id: string
          kind: string
          operation: string
          parent_span_id: string | null
          span_id: string
          started_at: string
          status: string
          store_id: string | null
          trace_id: string
        }
        Insert: {
          actor_user_id?: string | null
          attributes?: Json
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          kind?: string
          operation: string
          parent_span_id?: string | null
          span_id: string
          started_at: string
          status?: string
          store_id?: string | null
          trace_id: string
        }
        Update: {
          actor_user_id?: string | null
          attributes?: Json
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          kind?: string
          operation?: string
          parent_span_id?: string | null
          span_id?: string
          started_at?: string
          status?: string
          store_id?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["tracking_event_kind"]
          location: string | null
          occurred_at: string
          raw_payload: Json
          shipment_id: string
          source: string
          store_id: string
          trace_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["tracking_event_kind"]
          location?: string | null
          occurred_at?: string
          raw_payload?: Json
          shipment_id: string
          source?: string
          store_id: string
          trace_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["tracking_event_kind"]
          location?: string | null
          occurred_at?: string
          raw_payload?: Json
          shipment_id?: string
          source?: string
          store_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tracking_v"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role_id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip: unknown
          last_seen_at: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      variant_attribute_values: {
        Row: {
          attribute_id: string
          attribute_value_id: string
          created_at: string
          id: string
          variant_id: string
        }
        Insert: {
          attribute_id: string
          attribute_value_id: string
          created_at?: string
          id?: string
          variant_id: string
        }
        Update: {
          attribute_id?: string
          attribute_value_id?: string
          created_at?: string
          id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_attribute_value_id_fkey"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: Json | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          store_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_applications: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          metadata: Json
          requested_group_id: string | null
          requested_price_list_id: string | null
          status: Database["public"]["Enums"]["wholesale_application_status"]
          store_id: string
          submitted_at: string | null
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          metadata?: Json
          requested_group_id?: string | null
          requested_price_list_id?: string | null
          status?: Database["public"]["Enums"]["wholesale_application_status"]
          store_id: string
          submitted_at?: string | null
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          metadata?: Json
          requested_group_id?: string | null
          requested_price_list_id?: string | null
          status?: Database["public"]["Enums"]["wholesale_application_status"]
          store_id?: string
          submitted_at?: string | null
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "wholesale_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_applications_requested_group_id_fkey"
            columns: ["requested_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_applications_requested_price_list_id_fkey"
            columns: ["requested_price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_applications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_applications_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          added_at: string
          id: string
          notes: string | null
          product_id: string
          sort_order: number
          store_id: string
          variant_id: string | null
          wishlist_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          notes?: string | null
          product_id: string
          sort_order?: number
          store_id: string
          variant_id?: string | null
          wishlist_id: string
        }
        Update: {
          added_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          sort_order?: number
          store_id?: string
          variant_id?: string | null
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          is_public: boolean
          items_count: number
          metadata: Json
          name: string
          share_token: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          is_public?: boolean
          items_count?: number
          metadata?: Json
          name?: string
          share_token?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          is_public?: boolean
          items_count?: number
          metadata?: Json
          name?: string
          share_token?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "wishlists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          aggregate_type: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          store_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          aggregate_type: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          store_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          aggregate_type?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          store_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          completed_at: string | null
          context: Json
          created_at: string
          current_state_id: string
          definition_id: string
          id: string
          sla_due_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["workflow_instance_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_state_id: string
          definition_id: string
          id?: string
          sla_due_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_instance_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_state_id?: string
          definition_id?: string
          id?: string
          sla_due_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_instance_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_current_state_id_fkey"
            columns: ["current_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_state_history: {
        Row: {
          actor_user_id: string | null
          duration_ms: number | null
          from_state_id: string | null
          id: string
          instance_id: string
          occurred_at: string
          payload: Json
          reason: string | null
          to_state_id: string
          transition_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          duration_ms?: number | null
          from_state_id?: string | null
          id?: string
          instance_id: string
          occurred_at?: string
          payload?: Json
          reason?: string | null
          to_state_id: string
          transition_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          duration_ms?: number | null
          from_state_id?: string | null
          id?: string
          instance_id?: string
          occurred_at?: string
          payload?: Json
          reason?: string | null
          to_state_id?: string
          transition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_state_history_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_state_history_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_state_history_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_state_history_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "workflow_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          code: string
          color: string | null
          created_at: string
          definition_id: string
          id: string
          is_final: boolean
          is_initial: boolean
          label: string
          metadata: Json
          sla_minutes: number | null
          sort_order: number
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          definition_id: string
          id?: string
          is_final?: boolean
          is_initial?: boolean
          label: string
          metadata?: Json
          sla_minutes?: number | null
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          definition_id?: string
          id?: string
          is_final?: boolean
          is_initial?: boolean
          label?: string
          metadata?: Json
          sla_minutes?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          code: string
          created_at: string
          definition_id: string
          from_state_id: string
          guard_expression: string | null
          id: string
          is_automatic: boolean
          label: string
          metadata: Json
          on_enter_actions: Json
          required_permission: string | null
          to_state_id: string
        }
        Insert: {
          code: string
          created_at?: string
          definition_id: string
          from_state_id: string
          guard_expression?: string | null
          id?: string
          is_automatic?: boolean
          label: string
          metadata?: Json
          on_enter_actions?: Json
          required_permission?: string | null
          to_state_id: string
        }
        Update: {
          code?: string
          created_at?: string
          definition_id?: string
          from_state_id?: string
          guard_expression?: string | null
          id?: string
          is_automatic?: boolean
          label?: string
          metadata?: Json
          on_enter_actions?: Json
          required_permission?: string | null
          to_state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      categories_tree: {
        Row: {
          children_count: number | null
          depth: number | null
          id: string | null
          is_active: boolean | null
          is_leaf: boolean | null
          level: number | null
          name: string | null
          parent_id: string | null
          path: string | null
          path_ids: string[] | null
          slug: string | null
          sort_order: number | null
          store_id: string | null
        }
        Insert: {
          children_count?: never
          depth?: number | null
          id?: string | null
          is_active?: boolean | null
          is_leaf?: never
          level?: number | null
          name?: string | null
          parent_id?: string | null
          path?: string | null
          path_ids?: string[] | null
          slug?: string | null
          sort_order?: number | null
          store_id?: string | null
        }
        Update: {
          children_count?: never
          depth?: number | null
          id?: string | null
          is_active?: boolean | null
          is_leaf?: never
          level?: number | null
          name?: string | null
          parent_id?: string | null
          path?: string | null
          path_ids?: string[] | null
          slug?: string | null
          sort_order?: number | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_dashboard_daily_v: {
        Row: {
          active_customers: number | null
          day: string | null
          open_tickets: number | null
          orders_24h: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_dashboard_v: {
        Row: {
          customer_id: string | null
          open_tickets: number | null
          store_id: string | null
          total_orders: number | null
          unread_notifications: number | null
        }
        Insert: {
          customer_id?: string | null
          open_tickets?: never
          store_id?: string | null
          total_orders?: never
          unread_notifications?: never
        }
        Update: {
          customer_id?: string | null
          open_tickets?: never
          store_id?: string | null
          total_orders?: never
          unread_notifications?: never
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_notifications_v: {
        Row: {
          channels: Database["public"]["Enums"]["notification_channel"][] | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          payload: Json | null
          read_at: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          store_id: string | null
          template_code: string | null
        }
        Insert: {
          channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          payload?: Json | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          store_id?: string | null
          template_code?: string | null
        }
        Update: {
          channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          payload?: Json | null
          read_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          store_id?: string | null
          template_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_orders_v: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_id: string | null
          id: string | null
          order_number: string | null
          placed_at: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          store_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string | null
          order_number?: string | null
          placed_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string | null
          order_number?: string | null
          placed_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_support_v: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string | null
          priority:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          sla_state: Database["public"]["Enums"]["support_sla_state"] | null
          status: Database["public"]["Enums"]["support_ticket_status"] | null
          store_id: string | null
          subject: string | null
          ticket_number: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          sla_state?: Database["public"]["Enums"]["support_sla_state"] | null
          status?: Database["public"]["Enums"]["support_ticket_status"] | null
          store_id?: string | null
          subject?: string | null
          ticket_number?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          priority?:
            | Database["public"]["Enums"]["support_ticket_priority"]
            | null
          sla_state?: Database["public"]["Enums"]["support_sla_state"] | null
          status?: Database["public"]["Enums"]["support_ticket_status"] | null
          store_id?: string | null
          subject?: string | null
          ticket_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_tracking_v: {
        Row: {
          created_at: string | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["shipment_status"] | null
          store_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"] | null
          store_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"] | null
          store_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_timeline_view: {
        Row: {
          actor_user_id: string | null
          customer_id: string | null
          data: Json | null
          event_id: string | null
          kind: string | null
          occurred_at: string | null
          source: string | null
        }
        Relationships: []
      }
      mv_customer_dashboard_daily: {
        Row: {
          active_customers: number | null
          day: string | null
          open_tickets: number | null
          orders_24h: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_orders_daily: {
        Row: {
          day: string | null
          gross_total: number | null
          net_total: number | null
          orders_count: number | null
          refunded_total: number | null
          store_id: string | null
          valid_orders_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_support_metrics_daily: {
        Row: {
          day: string | null
          sla_at_risk: number | null
          sla_breached: number | null
          store_id: string | null
          tickets_created: number | null
          tickets_resolved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_admin_list_v: {
        Row: {
          active_holds_count: number | null
          assigned_user_id: string | null
          cancelled_at: string | null
          channel: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_total: number | null
          fulfillments_count: number | null
          id: string | null
          items_count: number | null
          order_number: string | null
          paid_amount: number | null
          payments_count: number | null
          placed_at: string | null
          refunded_amount: number | null
          shipments_count: number | null
          shipping_total: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          store_id: string | null
          subtotal: number | null
          tags: string[] | null
          tax_total: number | null
          total: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_dashboard_v"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline_unified_v: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          order_id: string | null
          payload: Json | null
          source: string | null
          store_id: string | null
          title: string | null
        }
        Relationships: []
      }
      orders_daily_v: {
        Row: {
          day: string | null
          gross_total: number | null
          net_total: number | null
          orders_count: number | null
          refunded_total: number | null
          store_id: string | null
          valid_orders_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_admin_list_v: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          id: string | null
          internal_reference: string | null
          last_movement_at: string | null
          product_id: string | null
          product_name: string | null
          product_status: Database["public"]["Enums"]["product_status"] | null
          quantity_available: number | null
          quantity_incoming: number | null
          quantity_on_hand: number | null
          quantity_reserved: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string | null
          sku_root: string | null
          stock_status: string | null
          store_id: string | null
          updated_at: string | null
          variant_id: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_metrics_daily_v: {
        Row: {
          day: string | null
          sla_at_risk: number | null
          sla_breached: number | null
          store_id: string | null
          tickets_created: number | null
          tickets_resolved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _apply_support_sla_dates: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      _assert_fulfillment_permission: {
        Args: { p_permission: string; p_store_id: string; p_user_id: string }
        Returns: undefined
      }
      _is_customer_owner: { Args: { p_customer_id: string }; Returns: boolean }
      _order_admin_log: {
        Args: {
          _actor: string
          _audit_action: string
          _event: Database["public"]["Enums"]["order_timeline_event"]
          _label: string
          _new: Json
          _old: Json
          _order_id: string
          _payload: Json
          _store_id: string
        }
        Returns: undefined
      }
      _recompute_notification_status: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      _resolve_support_sla_policy: {
        Args: {
          p_category_id: string
          p_priority: Database["public"]["Enums"]["support_ticket_priority"]
          p_source: Database["public"]["Enums"]["support_ticket_source"]
          p_store_id: string
        }
        Returns: string
      }
      _seed_order_transition: {
        Args: {
          _code: string
          _def_id: string
          _from_code: string
          _state_map: Json
          _to_code: string
        }
        Returns: undefined
      }
      _seed_payment_transition: {
        Args: {
          _code: string
          _def_id: string
          _from_code: string
          _state_map: Json
          _to_code: string
        }
        Returns: undefined
      }
      acquire_order_lock: {
        Args: {
          _order_id: string
          _owner_token: string
          _scope: string
          _ttl_seconds?: number
        }
        Returns: Json
      }
      apply_coupon_to_cart: {
        Args: { _cart_id: string; _coupon_code: string }
        Returns: Json
      }
      asset_store_id: { Args: { _asset_id: string }; Returns: string }
      assets_usage_count: { Args: { _asset_id: string }; Returns: number }
      cart_accessible: { Args: { _cart_id: string }; Returns: boolean }
      cart_apply_pricing: { Args: { _cart_id: string }; Returns: undefined }
      cart_recalculate: {
        Args: { _cart_id: string }
        Returns: {
          billing_address_id: string | null
          converted_order_id: string | null
          created_at: string
          currency: string
          customer_group_id: string | null
          customer_id: string | null
          discount_total: number
          expires_at: string | null
          id: string
          items_count: number
          last_activity_at: string
          merged_into_cart_id: string | null
          metadata: Json
          price_list_id: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"]
          selected_shipping_quote_id: string | null
          session_token: string | null
          shipping_address_id: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["cart_status"]
          store_id: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "carts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cart_set_session_v1: { Args: { _token: string }; Returns: undefined }
      cart_store_id: { Args: { _cart_id: string }; Returns: string }
      claim_first_super_admin: { Args: never; Returns: Json }
      claim_outbox_batch: {
        Args: {
          _batch_size?: number
          _lock_seconds?: number
          _worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          max_attempts: number
          metadata: Json
          occurred_at: string
          ordered: boolean
          payload: Json
          published_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          store_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      color_store_id: { Args: { _color_id: string }; Returns: string }
      coupon_lookup_by_code_v1: {
        Args: { _code: string; _store_id: string }
        Returns: Json
      }
      current_customer_id: { Args: never; Returns: string }
      current_user_context: { Args: never; Returns: Json }
      customer_dashboard_refresh: { Args: never; Returns: undefined }
      customer_store_id: { Args: { _customer_id: string }; Returns: string }
      customer_timeline_refresh: { Args: never; Returns: undefined }
      decrypt_pii: { Args: { p_key: string; p_value: string }; Returns: string }
      delivery_attempt_register: {
        Args: {
          p_notes?: string
          p_outcome: Database["public"]["Enums"]["delivery_attempt_outcome"]
          p_proof_asset_id?: string
          p_raw_payload?: Json
          p_shipment_id: string
          p_signed_by?: string
        }
        Returns: string
      }
      emit_domain_event: {
        Args: {
          _aggregate_id: string
          _aggregate_type: string
          _event_type: string
          _metadata?: Json
          _payload?: Json
          _store_id: string
        }
        Returns: string
      }
      encrypt_pii: { Args: { p_key: string; p_value: string }; Returns: string }
      enqueue_outbox_event: {
        Args: {
          _aggregate_id: string
          _aggregate_type: string
          _causation_id?: string
          _correlation_id?: string
          _event_type: string
          _metadata?: Json
          _ordered?: boolean
          _payload?: Json
          _store_id: string
        }
        Returns: string
      }
      evaluate_feature_flag: {
        Args: { _key: string; _store_id?: string; _user_id?: string }
        Returns: Json
      }
      expire_stale_cart_reservations: { Args: never; Returns: number }
      fiscal_get_credentials: { Args: { _provider_id: string }; Returns: Json }
      fiscal_get_webhook_secret: {
        Args: { _provider_id: string }
        Returns: string
      }
      fiscal_record_cancellation: {
        Args: { _invoice_id: string; _protocol: string; _reason: string }
        Returns: undefined
      }
      fiscal_record_correction: {
        Args: { _invoice_id: string; _protocol: string; _text: string }
        Returns: undefined
      }
      fiscal_record_issuance: {
        Args: {
          _document_type: Database["public"]["Enums"]["fiscal_document_type"]
          _idempotency_key: string
          _order_id: string
          _payload?: Json
          _provider_id: string
          _store_id: string
        }
        Returns: string
      }
      fiscal_set_credentials: {
        Args: { _creds: Json; _provider_id: string }
        Returns: undefined
      }
      fiscal_set_webhook_secret: {
        Args: { _provider_id: string; _secret: string }
        Returns: undefined
      }
      fiscal_update_status: {
        Args: {
          _invoice_id: string
          _message?: string
          _patch?: Json
          _status: Database["public"]["Enums"]["fiscal_invoice_status"]
        }
        Returns: undefined
      }
      fiscal_webhook_ingest: {
        Args: {
          _body: string
          _event_type: string
          _external_event_id: string
          _headers: Json
          _provider_code: string
          _provider_id: string
          _signature_header: string
          _signature_valid: boolean
        }
        Returns: string
      }
      fiscal_webhook_mark_processed: {
        Args: { _error?: string; _inbox_id: string; _ok: boolean }
        Returns: undefined
      }
      fulfillment_allocate: {
        Args: {
          p_expected_version?: number
          p_fulfillment_id: string
          p_warehouse_id: string
        }
        Returns: undefined
      }
      fulfillment_apply_tracking: {
        Args: {
          _delivered?: boolean
          _events: Json
          _shipment_id: string
          _source?: string
          _tracking_code?: string
        }
        Returns: Json
      }
      fulfillment_create: {
        Args: {
          p_causation_id?: string
          p_correlation_id?: string
          p_customer_id?: string
          p_fulfillable_id: string
          p_fulfillable_type: Database["public"]["Enums"]["fulfillment_fulfillable_type"]
          p_items?: Json
          p_metadata?: Json
          p_priority?: Database["public"]["Enums"]["fulfillment_priority"]
          p_sla_due_at?: string
          p_store_id: string
          p_trace_id?: string
          p_type?: Database["public"]["Enums"]["fulfillment_type"]
          p_warehouse_id?: string
        }
        Returns: string
      }
      fulfillment_mark_delivered: {
        Args: { p_fulfillment_id: string }
        Returns: undefined
      }
      gr_store_id: { Args: { _gr_id: string }; Returns: string }
      has_permission: {
        Args: { _permission_code: string; _store_id?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_code: string; _store_id?: string; _user_id: string }
        Returns: boolean
      }
      ic_store_id: { Args: { _ic_id: string }; Returns: string }
      idempotency_begin: {
        Args: {
          _actor_user_id: string
          _key: string
          _request_hash: string
          _scope: string
          _store_id: string
          _ttl_seconds?: number
        }
        Returns: Json
      }
      idempotency_complete: {
        Args: {
          _error_code?: string
          _id: string
          _resource_id?: string
          _resource_type?: string
          _response_body: Json
          _response_hash: string
          _response_status: number
          _status: Database["public"]["Enums"]["idempotency_status"]
        }
        Returns: undefined
      }
      is_cart_owner: { Args: { _cart_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_outbox_failed: {
        Args: { _error: string; _id: string }
        Returns: undefined
      }
      mark_outbox_published: { Args: { _id: string }; Returns: undefined }
      merge_anonymous_cart: {
        Args: { _anonymous_cart_id: string; _customer_id: string }
        Returns: string
      }
      notification_consume_outbox_event: {
        Args: { p_event_id: string }
        Returns: number
      }
      notification_dispatch_worker: {
        Args: { p_batch?: number }
        Returns: number
      }
      notification_enqueue: {
        Args: {
          p_channels: Database["public"]["Enums"]["notification_channel"][]
          p_customer_id?: string
          p_dedupe_key?: string
          p_idempotency_key?: string
          p_locale?: string
          p_max_attempts?: number
          p_payload?: Json
          p_priority?: Database["public"]["Enums"]["notification_priority"]
          p_recipient_email?: string
          p_recipient_phone?: string
          p_recipient_user_id?: string
          p_scheduled_for?: string
          p_source_aggregate?: string
          p_source_aggregate_id?: string
          p_source_event_id?: string
          p_store_id: string
          p_template_code: string
        }
        Returns: string
      }
      notification_mark_delivery_bounced: {
        Args: { p_delivery_id: string; p_provider_response?: Json }
        Returns: undefined
      }
      notification_mark_delivery_delivered: {
        Args: { p_delivery_id: string; p_provider_response?: Json }
        Returns: undefined
      }
      notification_mark_delivery_failed: {
        Args: {
          p_delivery_id: string
          p_error_code: string
          p_error_message: string
          p_retryable: boolean
          p_version: number
        }
        Returns: undefined
      }
      notification_mark_delivery_sending: {
        Args: { p_delivery_id: string; p_provider: string; p_version: number }
        Returns: {
          attempt_number: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string
          notification_id: string
          provider: string | null
          provider_message_id: string | null
          provider_response: Json | null
          recipient_address: string | null
          retryable: boolean
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notification_mark_delivery_sent: {
        Args: {
          p_delivery_id: string
          p_provider_message_id: string
          p_provider_response: Json
          p_version: number
        }
        Returns: undefined
      }
      notification_mark_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      order_add_note: {
        Args: {
          _body: string
          _order_id: string
          _pinned?: boolean
          _visibility?: string
        }
        Returns: string
      }
      order_add_tag: {
        Args: { _order_id: string; _tag: string }
        Returns: undefined
      }
      order_assign_user: {
        Args: { _order_id: string; _role?: string; _user: string }
        Returns: string
      }
      order_cancel: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      order_create_from_cart: {
        Args: {
          _address: Json
          _cart_id: string
          _email: string
          _name: string
          _phone: string
        }
        Returns: string
      }
      order_persist_shipping_snapshot: {
        Args: { _cart_id: string; _order_id: string }
        Returns: string
      }
      order_remove_tag: {
        Args: { _order_id: string; _tag: string }
        Returns: undefined
      }
      order_store_id: { Args: { _order_id: string }; Returns: string }
      package_add_item: {
        Args: {
          p_fulfillment_item_id: string
          p_package_id: string
          p_quantity: number
          p_serial_numbers?: Json
        }
        Returns: string
      }
      package_create: {
        Args: { p_code?: string; p_fulfillment_id: string }
        Returns: string
      }
      package_seal: {
        Args: {
          p_height_cm?: number
          p_length_cm?: number
          p_package_id: string
          p_weight_g?: number
          p_width_cm?: number
        }
        Returns: undefined
      }
      payment_authorize: {
        Args: {
          _authorization_id: string
          _authorized_amount: number
          _expires_at?: string
          _gateway_id: string
          _metadata?: Json
          _payment_id: string
        }
        Returns: {
          amount_captured: number
          amount_fee: number
          amount_gross: number
          amount_net: number
          amount_refunded: number
          authorized_at: string | null
          cancelled_at: string | null
          captured_at: string | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          gateway_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_cancel: {
        Args: { _payment_id: string; _reason?: string }
        Returns: {
          amount_captured: number
          amount_fee: number
          amount_gross: number
          amount_net: number
          amount_refunded: number
          authorized_at: string | null
          cancelled_at: string | null
          captured_at: string | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          gateway_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_capture: {
        Args: {
          _amount: number
          _capture_id?: string
          _metadata?: Json
          _payment_id: string
        }
        Returns: {
          amount_captured: number
          amount_fee: number
          amount_gross: number
          amount_net: number
          amount_refunded: number
          authorized_at: string | null
          cancelled_at: string | null
          captured_at: string | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          gateway_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_chargeback_open: {
        Args: {
          _amount: number
          _evidence_due_at?: string
          _gateway_dispute_id?: string
          _metadata?: Json
          _payment_id: string
          _reason?: Database["public"]["Enums"]["payment_chargeback_reason"]
        }
        Returns: {
          amount: number
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          evidence_due_at: string | null
          evidence_submitted_at: string | null
          fee_amount: number
          gateway_dispute_id: string | null
          gateway_id: string | null
          id: string
          liable_party: string | null
          metadata: Json
          network_reference: string | null
          opened_at: string
          outcome_note: string | null
          payment_id: string
          reason: Database["public"]["Enums"]["payment_chargeback_reason"]
          reason_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["payment_chargeback_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_chargebacks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_chargeback_resolve: {
        Args: {
          _chargeback_id: string
          _fee_amount?: number
          _outcome: Database["public"]["Enums"]["payment_chargeback_status"]
          _outcome_note?: string
        }
        Returns: {
          amount: number
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          evidence_due_at: string | null
          evidence_submitted_at: string | null
          fee_amount: number
          gateway_dispute_id: string | null
          gateway_id: string | null
          id: string
          liable_party: string | null
          metadata: Json
          network_reference: string | null
          opened_at: string
          outcome_note: string | null
          payment_id: string
          reason: Database["public"]["Enums"]["payment_chargeback_reason"]
          reason_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["payment_chargeback_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_chargebacks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_fail: {
        Args: {
          _failure_code: string
          _failure_message: string
          _payment_id: string
        }
        Returns: {
          amount_captured: number
          amount_fee: number
          amount_gross: number
          amount_net: number
          amount_refunded: number
          authorized_at: string | null
          cancelled_at: string | null
          captured_at: string | null
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          gateway_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payable_id: string
          payable_type: Database["public"]["Enums"]["payment_payable_type"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_get_credentials: { Args: { _gateway_id: string }; Returns: Json }
      payment_get_webhook_secret: {
        Args: { _gateway_id: string }
        Returns: string
      }
      payment_reconciliation_match_item: {
        Args: { _item_id: string; _payment_id: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          external_transaction_id: string | null
          fee_amount: number
          id: string
          matched_at: string | null
          matched_by: string | null
          net_amount: number
          payment_id: string | null
          posted_at: string | null
          raw_payload: Json
          reconciliation_id: string
          status: Database["public"]["Enums"]["payment_reconciliation_item_status"]
          store_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_reconciliation_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_record_attempt: {
        Args: {
          _external_id?: string
          _gateway_code?: string
          _gateway_id: string
          _gateway_message?: string
          _http_status?: number
          _latency_ms?: number
          _operation: Database["public"]["Enums"]["payment_attempt_operation"]
          _payment_id: string
          _request_payload: Json
          _response_payload: Json
          _success: boolean
        }
        Returns: string
      }
      payment_record_timeline: {
        Args: {
          _actor_kind?: string
          _event_type: Database["public"]["Enums"]["payment_timeline_event"]
          _payload?: Json
          _payment_id: string
          _summary?: string
        }
        Returns: string
      }
      payment_refund_mark_failed: {
        Args: {
          _failure_code: string
          _failure_message: string
          _refund_id: string
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          external_reference: string | null
          failure_code: string | null
          failure_message: string | null
          gateway_id: string | null
          gateway_refund_id: string | null
          id: string
          metadata: Json
          payment_id: string
          processed_at: string | null
          reason: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["payment_refund_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_refund_mark_succeeded: {
        Args: { _gateway_refund_id?: string; _refund_id: string }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          external_reference: string | null
          failure_code: string | null
          failure_message: string | null
          gateway_id: string | null
          gateway_refund_id: string | null
          id: string
          metadata: Json
          payment_id: string
          processed_at: string | null
          reason: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["payment_refund_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_refund_request: {
        Args: {
          _amount: number
          _metadata?: Json
          _payment_id: string
          _reason?: Database["public"]["Enums"]["payment_refund_reason"]
          _reason_note?: string
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          external_reference: string | null
          failure_code: string | null
          failure_message: string | null
          gateway_id: string | null
          gateway_refund_id: string | null
          id: string
          metadata: Json
          payment_id: string
          processed_at: string | null
          reason: Database["public"]["Enums"]["payment_refund_reason"]
          reason_note: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["payment_refund_status"]
          store_id: string
          trace_id: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "payment_refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payment_set_credentials: {
        Args: { _creds: Json; _gateway_id: string }
        Returns: undefined
      }
      payment_set_webhook_secret: {
        Args: { _gateway_id: string; _secret: string }
        Returns: undefined
      }
      payment_store_id: { Args: { _payment_id: string }; Returns: string }
      payment_webhook_ingest: {
        Args: {
          _correlation_id?: string
          _event_type: string
          _external_event_id: string
          _gateway_id?: string
          _headers?: Json
          _payload: Json
          _payment_id?: string
          _provider: string
          _signature?: string
          _signature_valid?: boolean
          _source_ip?: string
          _store_id?: string
          _trace_id?: string
        }
        Returns: Json
      }
      payment_webhook_mark_failed: {
        Args: { _duration_ms?: number; _error: string; _webhook_id: string }
        Returns: undefined
      }
      payment_webhook_mark_processed: {
        Args: { _duration_ms?: number; _webhook_id: string }
        Returns: undefined
      }
      pick_list_assign: {
        Args: { p_pick_list_id: string; p_user_id: string }
        Returns: undefined
      }
      pick_list_complete: {
        Args: { p_pick_list_id: string }
        Returns: undefined
      }
      pick_list_confirm_pick: {
        Args: {
          p_bin_location?: string
          p_correlation_id?: string
          p_pick_list_item_id: string
          p_quantity_picked: number
          p_trace_id?: string
        }
        Returns: undefined
      }
      pick_list_create: {
        Args: {
          p_correlation_id?: string
          p_fulfillment_ids: string[]
          p_store_id: string
          p_strategy?: Database["public"]["Enums"]["picking_strategy"]
          p_trace_id?: string
          p_warehouse_id: string
        }
        Returns: string
      }
      pick_list_start: { Args: { p_pick_list_id: string }; Returns: undefined }
      po_store_id: { Args: { _po_id: string }; Returns: string }
      portal_cache_invalidate: {
        Args: { p_store_id?: string }
        Returns: undefined
      }
      portal_refresh_metrics: { Args: never; Returns: undefined }
      product_store_id: { Args: { _product_id: string }; Returns: string }
      public_tracking_resolve: {
        Args: { p_ip_hash?: string; p_token: string; p_user_agent?: string }
        Returns: Json
      }
      purge_expired_idempotency_keys: { Args: never; Returns: number }
      recompute_customer_score: {
        Args: { _customer_id: string }
        Returns: number
      }
      record_cart_timeline_event: {
        Args: {
          _cart_id: string
          _event_type: Database["public"]["Enums"]["cart_timeline_event"]
          _payload?: Json
        }
        Returns: string
      }
      record_health_check: {
        Args: {
          _component: string
          _details?: Json
          _latency_ms?: number
          _status: Database["public"]["Enums"]["health_status"]
        }
        Returns: string
      }
      record_metric: {
        Args: {
          _name: string
          _scope: string
          _store_id?: string
          _tags?: Json
          _unit?: string
          _value: number
        }
        Returns: string
      }
      record_order_lock_contention: {
        Args: {
          _order_id: string
          _reason?: string
          _scope: string
          _store_id: string
        }
        Returns: undefined
      }
      refresh_orders_daily: { Args: never; Returns: undefined }
      refresh_orders_search: { Args: { _order_id: string }; Returns: undefined }
      release_order_lock: {
        Args: { _order_id: string; _owner_token: string; _scope: string }
        Returns: boolean
      }
      release_stale_outbox_locks: { Args: never; Returns: number }
      release_stock_reservation: {
        Args: { _reason?: string; _reservation_id: string }
        Returns: undefined
      }
      remove_coupon_from_cart: {
        Args: { _cart_coupon_id: string }
        Returns: undefined
      }
      reserve_stock_for_cart_item: {
        Args: { _cart_item_id: string; _ttl_seconds?: number }
        Returns: string
      }
      seed_order_workflow: { Args: { _store_id: string }; Returns: string }
      seed_payment_workflow: { Args: { _store_id: string }; Returns: string }
      shipment_create_split: {
        Args: {
          p_carrier_code: string
          p_correlation_id?: string
          p_declared_value?: number
          p_estimated_delivery_at?: string
          p_fulfillment_id: string
          p_package_ids: string[]
          p_service_code: string
          p_ship_from?: Json
          p_ship_to?: Json
          p_trace_id?: string
        }
        Returns: string
      }
      shipment_dispatch: { Args: { p_shipment_id: string }; Returns: undefined }
      shipment_purchase_label: {
        Args: {
          p_carrier_label_id?: string
          p_cost?: number
          p_format?: Database["public"]["Enums"]["shipping_label_format"]
          p_label_url: string
          p_shipment_id: string
          p_tracking_number: string
          p_tracking_url: string
        }
        Returns: string
      }
      shipping_get_credentials: { Args: { _account_id: string }; Returns: Json }
      shipping_list_pending_tracking: {
        Args: { _limit?: number; _stale_minutes?: number; _store_id?: string }
        Returns: {
          carrier_code: string
          shipment_id: string
          store_id: string
          tracking_number: string
        }[]
      }
      shipping_oauth_consume_state: {
        Args: { _state: string }
        Returns: {
          account_id: string
          code_verifier: string
          id: string
          provider_code: string
          redirect_uri: string
          return_to: string
          store_id: string
        }[]
      }
      shipping_set_credentials: {
        Args: { _account_id: string; _creds: Json }
        Returns: undefined
      }
      st_store_id: { Args: { _st_id: string }; Returns: string }
      super_admin_exists: { Args: never; Returns: boolean }
      supplier_store_id: { Args: { _supplier_id: string }; Returns: string }
      support_recompute_sla_states: { Args: never; Returns: number }
      support_sla_breach_worker: { Args: never; Returns: number }
      support_sla_warning_worker: { Args: never; Returns: number }
      support_ticket_add_message: {
        Args: {
          p_author_type?: Database["public"]["Enums"]["support_message_author_type"]
          p_body: string
          p_idempotency_key?: string
          p_ticket_id: string
          p_visibility?: Database["public"]["Enums"]["support_message_visibility"]
        }
        Returns: string
      }
      support_ticket_assign: {
        Args: {
          p_assignee: string
          p_reason?: string
          p_team?: string
          p_ticket_id: string
          p_version?: number
        }
        Returns: undefined
      }
      support_ticket_change_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["support_ticket_status"]
          p_reason?: string
          p_ticket_id: string
          p_version?: number
        }
        Returns: undefined
      }
      support_ticket_create: {
        Args: {
          p_category_id?: string
          p_customer_id?: string
          p_description: string
          p_idempotency_key?: string
          p_order_id?: string
          p_priority?: Database["public"]["Enums"]["support_ticket_priority"]
          p_source?: Database["public"]["Enums"]["support_ticket_source"]
          p_store_id: string
          p_subject: string
        }
        Returns: string
      }
      support_ticket_escalate: {
        Args: {
          p_raise_priority?: boolean
          p_reason: string
          p_ticket_id: string
          p_version?: number
        }
        Returns: undefined
      }
      tracking_event_ingest: {
        Args: {
          p_description?: string
          p_kind: Database["public"]["Enums"]["tracking_event_kind"]
          p_location?: string
          p_occurred_at: string
          p_raw_payload?: Json
          p_shipment_id: string
          p_source?: string
        }
        Returns: string
      }
      user_store_ids: { Args: { _user_id: string }; Returns: string[] }
      validate_coupon: {
        Args: { _cart_id: string; _coupon_id: string; _customer_id?: string }
        Returns: Json
      }
      variant_store_id: { Args: { _variant_id: string }; Returns: string }
      warehouse_store_id: { Args: { _warehouse_id: string }; Returns: string }
    }
    Enums: {
      address_type: "main" | "shipping" | "billing" | "commercial"
      asset_context:
        | "product"
        | "category"
        | "brand"
        | "collection"
        | "banner"
        | "institutional"
        | "marketing"
        | "other"
      asset_driver: "supabase" | "external" | "youtube" | "vimeo"
      asset_job_status:
        | "pending"
        | "uploading"
        | "processing"
        | "done"
        | "failed"
        | "canceled"
      asset_kind:
        | "image"
        | "video"
        | "youtube"
        | "vimeo"
        | "pdf"
        | "svg"
        | "other"
      asset_status: "active" | "archived"
      attribute_input_type: "select" | "text" | "number" | "boolean"
      cart_price_source:
        | "catalog"
        | "price_list"
        | "promo"
        | "coupon"
        | "manual"
      cart_status: "active" | "merged" | "abandoned" | "converted" | "expired"
      cart_timeline_event:
        | "created"
        | "item_added"
        | "item_removed"
        | "qty_changed"
        | "price_changed"
        | "coupon_applied"
        | "coupon_removed"
        | "shipping_calculated"
        | "shipping_selected"
        | "address_set"
        | "merged"
        | "abandoned"
        | "recovered"
        | "converted"
        | "expired"
        | "reservation_created"
        | "reservation_released"
        | "reservation_extended"
      collection_type: "manual" | "smart"
      coupon_ledger_kind:
        | "applied"
        | "removed"
        | "validated"
        | "rejected"
        | "expired"
        | "limit_reached"
        | "consumed"
      coupon_scope: "cart" | "shipping" | "category" | "product" | "collection"
      coupon_type: "percent" | "fixed" | "free_shipping"
      credit_ledger_kind:
        | "credit"
        | "debit"
        | "refund"
        | "adjustment"
        | "expiration"
      customer_group_kind:
        | "varejo"
        | "atacado"
        | "vip"
        | "representante"
        | "distribuidor"
        | "revendedor"
      customer_segment:
        | "retail"
        | "wholesale"
        | "rep"
        | "distributor"
        | "reseller"
        | "vip"
      customer_status: "active" | "inactive" | "blocked"
      customer_type: "pf" | "pj"
      delivery_attempt_outcome:
        | "success"
        | "customer_absent"
        | "address_issue"
        | "refused"
        | "damaged"
        | "rescheduled"
        | "other"
      fiscal_document_type: "nfe" | "nfce" | "nfse" | "cte"
      fiscal_environment: "production" | "sandbox"
      fiscal_invoice_status:
        | "pending"
        | "processing"
        | "authorized"
        | "denied"
        | "cancelled"
        | "corrected"
        | "error"
      fulfillment_event_actor: "system" | "user" | "carrier" | "customer"
      fulfillment_event_kind:
        | "created"
        | "allocated"
        | "status_changed"
        | "item_added"
        | "item_removed"
        | "note_added"
        | "carrier_assigned"
        | "escalated"
        | "sla_breached"
      fulfillment_fulfillable_type: "order"
      fulfillment_priority: "low" | "normal" | "high" | "urgent"
      fulfillment_status:
        | "pending"
        | "allocated"
        | "picking"
        | "picked"
        | "packing"
        | "packed"
        | "awaiting_shipment"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "failed"
      fulfillment_type: "standard" | "express" | "pickup" | "digital"
      health_status: "ok" | "degraded" | "down" | "unknown"
      idempotency_status: "in_flight" | "succeeded" | "failed"
      media_type: "image" | "video" | "youtube" | "vimeo"
      notification_channel: "email" | "in_app" | "whatsapp" | "push" | "sms"
      notification_delivery_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "bounced"
        | "retrying"
        | "abandoned"
      notification_priority: "low" | "normal" | "high" | "critical"
      notification_status:
        | "pending"
        | "processing"
        | "sent"
        | "partially_delivered"
        | "failed"
        | "cancelled"
      notification_template_status: "draft" | "active" | "archived"
      order_address_kind: "billing" | "shipping"
      order_allocation_scope: "item" | "shipping" | "tax" | "fee" | "total"
      order_assignment_role:
        | "owner"
        | "fulfillment"
        | "support"
        | "finance"
        | "reviewer"
      order_fulfillment_status:
        | "pending"
        | "picking"
        | "packed"
        | "ready"
        | "partially_fulfilled"
        | "fulfilled"
        | "cancelled"
      order_hold_kind:
        | "payment"
        | "fraud"
        | "inventory"
        | "manual_review"
        | "address"
        | "custom"
      order_hold_status: "active" | "released" | "expired"
      order_item_type:
        | "physical"
        | "digital"
        | "service"
        | "bundle"
        | "shipping"
        | "fee"
        | "discount"
      order_ledger_kind:
        | "charge"
        | "capture"
        | "refund"
        | "chargeback"
        | "adjustment_credit"
        | "adjustment_debit"
        | "fee"
      order_note_visibility: "internal" | "customer" | "system"
      order_payment_method:
        | "pix"
        | "credit_card"
        | "debit_card"
        | "boleto"
        | "bank_transfer"
        | "wallet"
        | "store_credit"
        | "manual"
        | "other"
      order_payment_status:
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "voided"
        | "chargeback"
      order_return_reason:
        | "defect"
        | "wrong_item"
        | "damaged"
        | "not_as_described"
        | "no_longer_wanted"
        | "late_delivery"
        | "other"
      order_return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "in_transit"
        | "received"
        | "inspected"
        | "completed"
        | "cancelled"
      order_shipment_status:
        | "pending"
        | "ready"
        | "dispatched"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "returned"
      order_split_status: "draft" | "confirmed" | "fulfilled" | "cancelled"
      order_status:
        | "draft"
        | "pending_payment"
        | "authorized"
        | "paid"
        | "on_hold"
        | "awaiting_fulfillment"
        | "partially_fulfilled"
        | "fulfilled"
        | "awaiting_shipment"
        | "partially_shipped"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "returned"
      order_timeline_event:
        | "created"
        | "status_changed"
        | "hold_added"
        | "hold_released"
        | "payment_authorized"
        | "payment_captured"
        | "payment_failed"
        | "payment_refunded"
        | "fulfillment_created"
        | "fulfillment_completed"
        | "shipment_dispatched"
        | "shipment_delivered"
        | "return_requested"
        | "return_completed"
        | "note_added"
        | "document_generated"
        | "tag_added"
        | "tag_removed"
        | "assigned"
        | "rule_applied"
        | "system"
      outbox_status: "pending" | "processing" | "published" | "failed" | "dead"
      package_status: "open" | "sealed" | "voided"
      payment_adapter_status:
        | "experimental"
        | "active"
        | "deprecated"
        | "retired"
      payment_allocation_target:
        | "order_item"
        | "shipping"
        | "tax"
        | "discount"
        | "marketplace_seller"
        | "platform_fee"
      payment_attempt_operation:
        | "authorize"
        | "capture"
        | "cancel"
        | "refund"
        | "query"
        | "tokenize"
      payment_chargeback_reason:
        | "fraudulent"
        | "product_not_received"
        | "product_unacceptable"
        | "duplicate"
        | "credit_not_processed"
        | "subscription_cancelled"
        | "general"
        | "other"
      payment_chargeback_status:
        | "opened"
        | "under_review"
        | "evidence_required"
        | "evidence_submitted"
        | "won"
        | "lost"
        | "accepted"
        | "cancelled"
      payment_document_kind:
        | "receipt"
        | "invoice"
        | "credit_note"
        | "authorization_proof"
        | "chargeback_evidence"
        | "refund_proof"
        | "other"
      payment_document_status: "draft" | "issued" | "sent" | "archived" | "void"
      payment_event_actor:
        | "system"
        | "user"
        | "gateway"
        | "webhook"
        | "workflow"
      payment_method:
        | "pix"
        | "credit_card"
        | "debit_card"
        | "boleto"
        | "wallet"
        | "bank_transfer"
        | "store_credit"
        | "gift_card"
      payment_note_visibility: "internal" | "staff" | "customer"
      payment_payable_type:
        | "order"
        | "subscription"
        | "wallet_topup"
        | "marketplace_split"
      payment_reconciliation_discrepancy_kind:
        | "amount_mismatch"
        | "status_mismatch"
        | "fee_mismatch"
        | "missing_in_psp"
        | "missing_in_platform"
        | "duplicate"
        | "other"
      payment_reconciliation_item_status:
        | "unmatched"
        | "matched"
        | "discrepant"
        | "ignored"
      payment_reconciliation_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "partially_matched"
      payment_refund_reason:
        | "customer_request"
        | "duplicate"
        | "fraudulent"
        | "order_cancelled"
        | "product_unavailable"
        | "return"
        | "chargeback"
        | "other"
      payment_refund_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
      payment_status:
        | "pending"
        | "authorized"
        | "partially_captured"
        | "captured"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed"
        | "cancelled"
        | "chargeback"
        | "closed"
      payment_timeline_event:
        | "created"
        | "authorized"
        | "captured"
        | "partially_captured"
        | "failed"
        | "cancelled"
        | "refund_requested"
        | "refund_succeeded"
        | "refund_failed"
        | "chargeback_opened"
        | "chargeback_resolved"
        | "reconciled"
        | "webhook_received"
        | "adapter_attempt"
        | "note_added"
        | "document_added"
      payment_transaction_direction: "credit" | "debit"
      payment_transaction_kind:
        | "authorization"
        | "capture"
        | "cancel"
        | "refund"
        | "partial_refund"
        | "chargeback"
        | "adjustment"
        | "fee"
        | "settlement"
      payment_webhook_status:
        | "received"
        | "processing"
        | "processed"
        | "failed"
        | "ignored"
        | "duplicate"
      pick_list_status:
        | "draft"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      picking_strategy: "single_order" | "batch" | "wave" | "zone"
      portal_session_status: "active" | "ended" | "revoked"
      product_relation_type: "related" | "cross_sell" | "up_sell"
      product_status: "draft" | "published" | "archived"
      product_visibility: "published" | "hidden" | "private" | "catalog_only"
      reservation_ledger_kind:
        | "reserve"
        | "release"
        | "consume"
        | "expire"
        | "extend"
      reservation_status: "active" | "released" | "consumed" | "expired"
      review_status: "pending" | "approved" | "rejected" | "flagged" | "removed"
      sale_channel: "varejo" | "atacado" | "ambos"
      sales_channel: "retail" | "wholesale"
      setting_scope: "global" | "store"
      shipment_status:
        | "created"
        | "label_purchased"
        | "ready"
        | "dispatched"
        | "in_transit"
        | "delivered"
        | "returned"
        | "lost"
        | "cancelled"
        | "failed"
      shipping_label_format: "pdf" | "png" | "zpl" | "epl"
      shipping_method_kind: "carrier" | "flat" | "free" | "pickup" | "table"
      support_message_author_type: "customer" | "agent" | "system"
      support_message_visibility: "public" | "internal"
      support_sla_state: "on_track" | "at_risk" | "breached" | "paused"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_source:
        | "portal"
        | "email"
        | "whatsapp"
        | "phone"
        | "chat"
        | "api"
        | "internal"
      support_ticket_status:
        | "open"
        | "pending_customer"
        | "pending_internal"
        | "on_hold"
        | "resolved"
        | "closed"
        | "cancelled"
      tax_regime: "mei" | "simples" | "presumido" | "real" | "isento"
      tracking_event_kind:
        | "created"
        | "label_purchased"
        | "pickup_scheduled"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivery_attempted"
        | "delivered"
        | "exception"
        | "returned"
        | "lost"
      wholesale_application_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "cancelled"
      workflow_instance_status: "active" | "completed" | "cancelled" | "failed"
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
      address_type: ["main", "shipping", "billing", "commercial"],
      asset_context: [
        "product",
        "category",
        "brand",
        "collection",
        "banner",
        "institutional",
        "marketing",
        "other",
      ],
      asset_driver: ["supabase", "external", "youtube", "vimeo"],
      asset_job_status: [
        "pending",
        "uploading",
        "processing",
        "done",
        "failed",
        "canceled",
      ],
      asset_kind: ["image", "video", "youtube", "vimeo", "pdf", "svg", "other"],
      asset_status: ["active", "archived"],
      attribute_input_type: ["select", "text", "number", "boolean"],
      cart_price_source: ["catalog", "price_list", "promo", "coupon", "manual"],
      cart_status: ["active", "merged", "abandoned", "converted", "expired"],
      cart_timeline_event: [
        "created",
        "item_added",
        "item_removed",
        "qty_changed",
        "price_changed",
        "coupon_applied",
        "coupon_removed",
        "shipping_calculated",
        "shipping_selected",
        "address_set",
        "merged",
        "abandoned",
        "recovered",
        "converted",
        "expired",
        "reservation_created",
        "reservation_released",
        "reservation_extended",
      ],
      collection_type: ["manual", "smart"],
      coupon_ledger_kind: [
        "applied",
        "removed",
        "validated",
        "rejected",
        "expired",
        "limit_reached",
        "consumed",
      ],
      coupon_scope: ["cart", "shipping", "category", "product", "collection"],
      coupon_type: ["percent", "fixed", "free_shipping"],
      credit_ledger_kind: [
        "credit",
        "debit",
        "refund",
        "adjustment",
        "expiration",
      ],
      customer_group_kind: [
        "varejo",
        "atacado",
        "vip",
        "representante",
        "distribuidor",
        "revendedor",
      ],
      customer_segment: [
        "retail",
        "wholesale",
        "rep",
        "distributor",
        "reseller",
        "vip",
      ],
      customer_status: ["active", "inactive", "blocked"],
      customer_type: ["pf", "pj"],
      delivery_attempt_outcome: [
        "success",
        "customer_absent",
        "address_issue",
        "refused",
        "damaged",
        "rescheduled",
        "other",
      ],
      fiscal_document_type: ["nfe", "nfce", "nfse", "cte"],
      fiscal_environment: ["production", "sandbox"],
      fiscal_invoice_status: [
        "pending",
        "processing",
        "authorized",
        "denied",
        "cancelled",
        "corrected",
        "error",
      ],
      fulfillment_event_actor: ["system", "user", "carrier", "customer"],
      fulfillment_event_kind: [
        "created",
        "allocated",
        "status_changed",
        "item_added",
        "item_removed",
        "note_added",
        "carrier_assigned",
        "escalated",
        "sla_breached",
      ],
      fulfillment_fulfillable_type: ["order"],
      fulfillment_priority: ["low", "normal", "high", "urgent"],
      fulfillment_status: [
        "pending",
        "allocated",
        "picking",
        "picked",
        "packing",
        "packed",
        "awaiting_shipment",
        "shipped",
        "in_transit",
        "delivered",
        "cancelled",
        "failed",
      ],
      fulfillment_type: ["standard", "express", "pickup", "digital"],
      health_status: ["ok", "degraded", "down", "unknown"],
      idempotency_status: ["in_flight", "succeeded", "failed"],
      media_type: ["image", "video", "youtube", "vimeo"],
      notification_channel: ["email", "in_app", "whatsapp", "push", "sms"],
      notification_delivery_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "bounced",
        "retrying",
        "abandoned",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: [
        "pending",
        "processing",
        "sent",
        "partially_delivered",
        "failed",
        "cancelled",
      ],
      notification_template_status: ["draft", "active", "archived"],
      order_address_kind: ["billing", "shipping"],
      order_allocation_scope: ["item", "shipping", "tax", "fee", "total"],
      order_assignment_role: [
        "owner",
        "fulfillment",
        "support",
        "finance",
        "reviewer",
      ],
      order_fulfillment_status: [
        "pending",
        "picking",
        "packed",
        "ready",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
      ],
      order_hold_kind: [
        "payment",
        "fraud",
        "inventory",
        "manual_review",
        "address",
        "custom",
      ],
      order_hold_status: ["active", "released", "expired"],
      order_item_type: [
        "physical",
        "digital",
        "service",
        "bundle",
        "shipping",
        "fee",
        "discount",
      ],
      order_ledger_kind: [
        "charge",
        "capture",
        "refund",
        "chargeback",
        "adjustment_credit",
        "adjustment_debit",
        "fee",
      ],
      order_note_visibility: ["internal", "customer", "system"],
      order_payment_method: [
        "pix",
        "credit_card",
        "debit_card",
        "boleto",
        "bank_transfer",
        "wallet",
        "store_credit",
        "manual",
        "other",
      ],
      order_payment_status: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
        "voided",
        "chargeback",
      ],
      order_return_reason: [
        "defect",
        "wrong_item",
        "damaged",
        "not_as_described",
        "no_longer_wanted",
        "late_delivery",
        "other",
      ],
      order_return_status: [
        "requested",
        "approved",
        "rejected",
        "in_transit",
        "received",
        "inspected",
        "completed",
        "cancelled",
      ],
      order_shipment_status: [
        "pending",
        "ready",
        "dispatched",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
      ],
      order_split_status: ["draft", "confirmed", "fulfilled", "cancelled"],
      order_status: [
        "draft",
        "pending_payment",
        "authorized",
        "paid",
        "on_hold",
        "awaiting_fulfillment",
        "partially_fulfilled",
        "fulfilled",
        "awaiting_shipment",
        "partially_shipped",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
        "partially_refunded",
        "returned",
      ],
      order_timeline_event: [
        "created",
        "status_changed",
        "hold_added",
        "hold_released",
        "payment_authorized",
        "payment_captured",
        "payment_failed",
        "payment_refunded",
        "fulfillment_created",
        "fulfillment_completed",
        "shipment_dispatched",
        "shipment_delivered",
        "return_requested",
        "return_completed",
        "note_added",
        "document_generated",
        "tag_added",
        "tag_removed",
        "assigned",
        "rule_applied",
        "system",
      ],
      outbox_status: ["pending", "processing", "published", "failed", "dead"],
      package_status: ["open", "sealed", "voided"],
      payment_adapter_status: [
        "experimental",
        "active",
        "deprecated",
        "retired",
      ],
      payment_allocation_target: [
        "order_item",
        "shipping",
        "tax",
        "discount",
        "marketplace_seller",
        "platform_fee",
      ],
      payment_attempt_operation: [
        "authorize",
        "capture",
        "cancel",
        "refund",
        "query",
        "tokenize",
      ],
      payment_chargeback_reason: [
        "fraudulent",
        "product_not_received",
        "product_unacceptable",
        "duplicate",
        "credit_not_processed",
        "subscription_cancelled",
        "general",
        "other",
      ],
      payment_chargeback_status: [
        "opened",
        "under_review",
        "evidence_required",
        "evidence_submitted",
        "won",
        "lost",
        "accepted",
        "cancelled",
      ],
      payment_document_kind: [
        "receipt",
        "invoice",
        "credit_note",
        "authorization_proof",
        "chargeback_evidence",
        "refund_proof",
        "other",
      ],
      payment_document_status: ["draft", "issued", "sent", "archived", "void"],
      payment_event_actor: ["system", "user", "gateway", "webhook", "workflow"],
      payment_method: [
        "pix",
        "credit_card",
        "debit_card",
        "boleto",
        "wallet",
        "bank_transfer",
        "store_credit",
        "gift_card",
      ],
      payment_note_visibility: ["internal", "staff", "customer"],
      payment_payable_type: [
        "order",
        "subscription",
        "wallet_topup",
        "marketplace_split",
      ],
      payment_reconciliation_discrepancy_kind: [
        "amount_mismatch",
        "status_mismatch",
        "fee_mismatch",
        "missing_in_psp",
        "missing_in_platform",
        "duplicate",
        "other",
      ],
      payment_reconciliation_item_status: [
        "unmatched",
        "matched",
        "discrepant",
        "ignored",
      ],
      payment_reconciliation_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "partially_matched",
      ],
      payment_refund_reason: [
        "customer_request",
        "duplicate",
        "fraudulent",
        "order_cancelled",
        "product_unavailable",
        "return",
        "chargeback",
        "other",
      ],
      payment_refund_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
      ],
      payment_status: [
        "pending",
        "authorized",
        "partially_captured",
        "captured",
        "paid",
        "partially_refunded",
        "refunded",
        "failed",
        "cancelled",
        "chargeback",
        "closed",
      ],
      payment_timeline_event: [
        "created",
        "authorized",
        "captured",
        "partially_captured",
        "failed",
        "cancelled",
        "refund_requested",
        "refund_succeeded",
        "refund_failed",
        "chargeback_opened",
        "chargeback_resolved",
        "reconciled",
        "webhook_received",
        "adapter_attempt",
        "note_added",
        "document_added",
      ],
      payment_transaction_direction: ["credit", "debit"],
      payment_transaction_kind: [
        "authorization",
        "capture",
        "cancel",
        "refund",
        "partial_refund",
        "chargeback",
        "adjustment",
        "fee",
        "settlement",
      ],
      payment_webhook_status: [
        "received",
        "processing",
        "processed",
        "failed",
        "ignored",
        "duplicate",
      ],
      pick_list_status: [
        "draft",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      picking_strategy: ["single_order", "batch", "wave", "zone"],
      portal_session_status: ["active", "ended", "revoked"],
      product_relation_type: ["related", "cross_sell", "up_sell"],
      product_status: ["draft", "published", "archived"],
      product_visibility: ["published", "hidden", "private", "catalog_only"],
      reservation_ledger_kind: [
        "reserve",
        "release",
        "consume",
        "expire",
        "extend",
      ],
      reservation_status: ["active", "released", "consumed", "expired"],
      review_status: ["pending", "approved", "rejected", "flagged", "removed"],
      sale_channel: ["varejo", "atacado", "ambos"],
      sales_channel: ["retail", "wholesale"],
      setting_scope: ["global", "store"],
      shipment_status: [
        "created",
        "label_purchased",
        "ready",
        "dispatched",
        "in_transit",
        "delivered",
        "returned",
        "lost",
        "cancelled",
        "failed",
      ],
      shipping_label_format: ["pdf", "png", "zpl", "epl"],
      shipping_method_kind: ["carrier", "flat", "free", "pickup", "table"],
      support_message_author_type: ["customer", "agent", "system"],
      support_message_visibility: ["public", "internal"],
      support_sla_state: ["on_track", "at_risk", "breached", "paused"],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_source: [
        "portal",
        "email",
        "whatsapp",
        "phone",
        "chat",
        "api",
        "internal",
      ],
      support_ticket_status: [
        "open",
        "pending_customer",
        "pending_internal",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
      ],
      tax_regime: ["mei", "simples", "presumido", "real", "isento"],
      tracking_event_kind: [
        "created",
        "label_purchased",
        "pickup_scheduled",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivery_attempted",
        "delivered",
        "exception",
        "returned",
        "lost",
      ],
      wholesale_application_status: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "cancelled",
      ],
      workflow_instance_status: ["active", "completed", "cancelled", "failed"],
    },
  },
} as const
