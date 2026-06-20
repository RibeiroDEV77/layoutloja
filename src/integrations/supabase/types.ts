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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      color_store_id: { Args: { _color_id: string }; Returns: string }
      has_permission: {
        Args: { _permission_code: string; _store_id?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_code: string; _store_id?: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      product_store_id: { Args: { _product_id: string }; Returns: string }
      user_store_ids: { Args: { _user_id: string }; Returns: string[] }
      variant_store_id: { Args: { _variant_id: string }; Returns: string }
    }
    Enums: {
      attribute_input_type: "select" | "text" | "number" | "boolean"
      collection_type: "manual" | "smart"
      customer_group_kind:
        | "varejo"
        | "atacado"
        | "vip"
        | "representante"
        | "distribuidor"
        | "revendedor"
      media_type: "image" | "video" | "youtube" | "vimeo"
      product_status: "draft" | "published" | "archived"
      product_visibility: "published" | "hidden" | "private" | "catalog_only"
      sale_channel: "varejo" | "atacado" | "ambos"
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
      attribute_input_type: ["select", "text", "number", "boolean"],
      collection_type: ["manual", "smart"],
      customer_group_kind: [
        "varejo",
        "atacado",
        "vip",
        "representante",
        "distribuidor",
        "revendedor",
      ],
      media_type: ["image", "video", "youtube", "vimeo"],
      product_status: ["draft", "published", "archived"],
      product_visibility: ["published", "hidden", "private", "catalog_only"],
      sale_channel: ["varejo", "atacado", "ambos"],
    },
  },
} as const
