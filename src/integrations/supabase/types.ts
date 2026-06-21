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
          id: string
          input_type: Database["public"]["Enums"]["attribute_input_type"]
          is_color: boolean
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
          id?: string
          input_type?: Database["public"]["Enums"]["attribute_input_type"]
          is_color?: boolean
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
          id?: string
          input_type?: Database["public"]["Enums"]["attribute_input_type"]
          is_color?: boolean
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
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          path: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          path?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          path?: string | null
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
          id: string
          is_required: boolean
          is_variant_axis: boolean
          sort_order: number
        }
        Insert: {
          attribute_id: string
          category_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          is_variant_axis?: boolean
          sort_order?: number
        }
        Update: {
          attribute_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          is_variant_axis?: boolean
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
            referencedRelation: "customers"
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
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipping_snapshots: {
        Row: {
          carrier: string | null
          created_at: string
          eta_days: number | null
          id: string
          order_id: string
          price: number | null
          schema_version: number
          service: string | null
          snapshot: Json
          store_id: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          eta_days?: number | null
          id?: string
          order_id: string
          price?: number | null
          schema_version?: number
          service?: string | null
          snapshot: Json
          store_id: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          eta_days?: number | null
          id?: string
          order_id?: string
          price?: number | null
          schema_version?: number
          service?: string | null
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
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
            referencedRelation: "orders"
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
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      shipping_quotes: {
        Row: {
          carrier: string | null
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
          selected: boolean
          store_id: string
          weight_g: number | null
        }
        Insert: {
          carrier?: string | null
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
          selected?: boolean
          store_id: string
          weight_g?: number | null
        }
        Update: {
          carrier?: string | null
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
          selected?: boolean
          store_id?: string
          weight_g?: number | null
        }
        Relationships: [
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
          name: string
          slug: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
    }
    Functions: {
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
      current_user_context: { Args: never; Returns: Json }
      customer_store_id: { Args: { _customer_id: string }; Returns: string }
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
      order_store_id: { Args: { _order_id: string }; Returns: string }
      po_store_id: { Args: { _po_id: string }; Returns: string }
      product_store_id: { Args: { _product_id: string }; Returns: string }
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
      st_store_id: { Args: { _st_id: string }; Returns: string }
      super_admin_exists: { Args: never; Returns: boolean }
      supplier_store_id: { Args: { _supplier_id: string }; Returns: string }
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
      health_status: "ok" | "degraded" | "down" | "unknown"
      idempotency_status: "in_flight" | "succeeded" | "failed"
      media_type: "image" | "video" | "youtube" | "vimeo"
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
      product_status: "draft" | "published" | "archived"
      product_visibility: "published" | "hidden" | "private" | "catalog_only"
      reservation_ledger_kind:
        | "reserve"
        | "release"
        | "consume"
        | "expire"
        | "extend"
      reservation_status: "active" | "released" | "consumed" | "expired"
      sale_channel: "varejo" | "atacado" | "ambos"
      setting_scope: "global" | "store"
      shipping_method_kind: "carrier" | "flat" | "free" | "pickup" | "table"
      tax_regime: "mei" | "simples" | "presumido" | "real" | "isento"
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
      health_status: ["ok", "degraded", "down", "unknown"],
      idempotency_status: ["in_flight", "succeeded", "failed"],
      media_type: ["image", "video", "youtube", "vimeo"],
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
      sale_channel: ["varejo", "atacado", "ambos"],
      setting_scope: ["global", "store"],
      shipping_method_kind: ["carrier", "flat", "free", "pickup", "table"],
      tax_regime: ["mei", "simples", "presumido", "real", "isento"],
      workflow_instance_status: ["active", "completed", "cancelled", "failed"],
    },
  },
} as const
