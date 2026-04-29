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
      ai_jobs: {
        Row: {
          completed_at: string | null
          cost_estimate_usd: number | null
          created_at: string
          error_message: string | null
          id: string
          input_summary: Json
          job_type: string
          model: string
          output_summary: Json
          prompt_version: string | null
          provider: string
          status: Database["public"]["Enums"]["ai_job_status"]
        }
        Insert: {
          completed_at?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json
          job_type: string
          model: string
          output_summary?: Json
          prompt_version?: string | null
          provider: string
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Update: {
          completed_at?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json
          job_type?: string
          model?: string
          output_summary?: Json
          prompt_version?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Relationships: []
      }
      clarifying_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          created_at: string
          design_brief_id: string
          id: string
          question: string
          status: Database["public"]["Enums"]["question_status"]
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          design_brief_id: string
          id?: string
          question: string
          status?: Database["public"]["Enums"]["question_status"]
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          design_brief_id?: string
          id?: string
          question?: string
          status?: Database["public"]["Enums"]["question_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clarifying_questions_design_brief_id_fkey"
            columns: ["design_brief_id"]
            isOneToOne: false
            referencedRelation: "design_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_critiques: {
        Row: {
          concept_id: string
          created_at: string
          created_by_user_id: string
          critique_text: string
          id: string
        }
        Insert: {
          concept_id: string
          created_at?: string
          created_by_user_id: string
          critique_text: string
          id?: string
        }
        Update: {
          concept_id?: string
          created_at?: string
          created_by_user_id?: string
          critique_text?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_critiques_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_critiques_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          created_at: string
          description: string | null
          design_brief_id: string
          generation_job_id: string | null
          id: string
          parent_concept_id: string | null
          primary_image_asset_id: string | null
          room_id: string
          status: Database["public"]["Enums"]["concept_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          design_brief_id: string
          generation_job_id?: string | null
          id?: string
          parent_concept_id?: string | null
          primary_image_asset_id?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["concept_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          design_brief_id?: string
          generation_job_id?: string | null
          id?: string
          parent_concept_id?: string | null
          primary_image_asset_id?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["concept_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_design_brief_id_fkey"
            columns: ["design_brief_id"]
            isOneToOne: false
            referencedRelation: "design_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_parent_concept_id_fkey"
            columns: ["parent_concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_primary_image_asset_id_fkey"
            columns: ["primary_image_asset_id"]
            isOneToOne: false
            referencedRelation: "room_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      design_briefs: {
        Row: {
          avoid_notes: string | null
          budget_notes: string | null
          color_notes: string | null
          created_at: string
          functional_requirements: string | null
          id: string
          inspiration_notes: string | null
          room_id: string
          structured_json: Json
          style_notes: string | null
          updated_at: string
        }
        Insert: {
          avoid_notes?: string | null
          budget_notes?: string | null
          color_notes?: string | null
          created_at?: string
          functional_requirements?: string | null
          id?: string
          inspiration_notes?: string | null
          room_id: string
          structured_json?: Json
          style_notes?: string | null
          updated_at?: string
        }
        Update: {
          avoid_notes?: string | null
          budget_notes?: string | null
          color_notes?: string | null
          created_at?: string
          functional_requirements?: string | null
          id?: string
          inspiration_notes?: string | null
          room_id?: string
          structured_json?: Json
          style_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_briefs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          adapter_key: string
          completed_at: string | null
          error_summary: string | null
          id: string
          products_created: number
          products_failed: number
          products_seen: number
          products_updated: number
          retailer_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["ai_job_status"]
        }
        Insert: {
          adapter_key: string
          completed_at?: string | null
          error_summary?: string | null
          id?: string
          products_created?: number
          products_failed?: number
          products_seen?: number
          products_updated?: number
          retailer_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Update: {
          adapter_key?: string
          completed_at?: string | null
          error_summary?: string | null
          id?: string
          products_created?: number
          products_failed?: number
          products_seen?: number
          products_updated?: number
          retailer_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_dimensions: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          depth_cm: number | null
          diameter_cm: number | null
          height_cm: number | null
          id: string
          product_id: string
          source_text: string | null
          width_cm: number | null
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          depth_cm?: number | null
          diameter_cm?: number | null
          height_cm?: number | null
          id?: string
          product_id: string
          source_text?: string | null
          width_cm?: number | null
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          depth_cm?: number | null
          diameter_cm?: number | null
          height_cm?: number | null
          id?: string
          product_id?: string
          source_text?: string | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_dimensions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_embeddings: {
        Row: {
          created_at: string
          embedding_type: string
          id: string
          model: string
          product_id: string
          source_hash: string
          vector: string | null
        }
        Insert: {
          created_at?: string
          embedding_type: string
          id?: string
          model: string
          product_id: string
          source_hash: string
          vector?: string | null
        }
        Update: {
          created_at?: string
          embedding_type?: string
          id?: string
          model?: string
          product_id?: string
          source_hash?: string
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
          source: string | null
          storage_path: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
          source?: string | null
          storage_path?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
          source?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: string | null
          canonical_url: string
          category_normalized: string | null
          category_raw: string | null
          color: string | null
          color_tags: string[]
          created_at: string
          currency: string
          data_confidence: Database["public"]["Enums"]["confidence_level"]
          description: string | null
          enriched_at: string | null
          enrichment_model: string | null
          enrichment_source_hash: string | null
          external_sku: string | null
          id: string
          last_checked_at: string | null
          material: string | null
          material_tags: string[]
          name: string
          price_aed: number | null
          primary_image_url: string | null
          retailer_id: string
          room_tags: string[]
          sale_price_aed: number | null
          style_tags: string[]
          updated_at: string
        }
        Insert: {
          availability?: string | null
          canonical_url: string
          category_normalized?: string | null
          category_raw?: string | null
          color?: string | null
          color_tags?: string[]
          created_at?: string
          currency?: string
          data_confidence?: Database["public"]["Enums"]["confidence_level"]
          description?: string | null
          enriched_at?: string | null
          enrichment_model?: string | null
          enrichment_source_hash?: string | null
          external_sku?: string | null
          id?: string
          last_checked_at?: string | null
          material?: string | null
          material_tags?: string[]
          name: string
          price_aed?: number | null
          primary_image_url?: string | null
          retailer_id: string
          room_tags?: string[]
          sale_price_aed?: number | null
          style_tags?: string[]
          updated_at?: string
        }
        Update: {
          availability?: string | null
          canonical_url?: string
          category_normalized?: string | null
          category_raw?: string | null
          color?: string | null
          color_tags?: string[]
          created_at?: string
          currency?: string
          data_confidence?: Database["public"]["Enums"]["confidence_level"]
          description?: string | null
          enriched_at?: string | null
          enrichment_model?: string | null
          enrichment_source_hash?: string | null
          external_sku?: string | null
          id?: string
          last_checked_at?: string | null
          material?: string | null
          material_tags?: string[]
          name?: string
          price_aed?: number | null
          primary_image_url?: string | null
          retailer_id?: string
          room_tags?: string[]
          sale_price_aed?: number | null
          style_tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          budget_max_aed: number | null
          budget_min_aed: number | null
          client_name: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          owner_user_id: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          budget_max_aed?: number | null
          budget_min_aed?: number | null
          client_name?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          owner_user_id: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          budget_max_aed?: number | null
          budget_min_aed?: number | null
          client_name?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          owner_user_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      render_jobs: {
        Row: {
          completed_at: string | null
          concept_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_asset_ids: string[]
          input_summary: Json
          model: string | null
          output_asset_ids: string[]
          product_ids: string[]
          prompt_key: string | null
          prompt_version: string | null
          room_id: string
          shopping_list_id: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
        }
        Insert: {
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_asset_ids?: string[]
          input_summary?: Json
          model?: string | null
          output_asset_ids?: string[]
          product_ids?: string[]
          prompt_key?: string | null
          prompt_version?: string | null
          room_id: string
          shopping_list_id?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Update: {
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_asset_ids?: string[]
          input_summary?: Json
          model?: string | null
          output_asset_ids?: string[]
          product_ids?: string[]
          prompt_key?: string | null
          prompt_version?: string | null
          room_id?: string
          shopping_list_id?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "render_jobs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "render_jobs_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      retailers: {
        Row: {
          adapter_key: string
          country: string
          created_at: string
          domain: string
          id: string
          name: string
          robots_notes: string | null
          status: Database["public"]["Enums"]["retailer_status"]
          terms_notes: string | null
          updated_at: string
        }
        Insert: {
          adapter_key: string
          country?: string
          created_at?: string
          domain: string
          id?: string
          name: string
          robots_notes?: string | null
          status?: Database["public"]["Enums"]["retailer_status"]
          terms_notes?: string | null
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          country?: string
          created_at?: string
          domain?: string
          id?: string
          name?: string
          robots_notes?: string | null
          status?: Database["public"]["Enums"]["retailer_status"]
          terms_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      room_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          height_px: number | null
          id: string
          is_primary: boolean
          mime_type: string
          room_id: string
          storage_path: string
          width_px: number | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type: string
          room_id: string
          storage_path: string
          width_px?: number | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string
          room_id?: string
          storage_path?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "room_assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_measurements: {
        Row: {
          ceiling_height_cm: number | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          floor_plan_asset_id: string | null
          id: string
          notes: string | null
          room_depth_cm: number | null
          room_id: string
          source: Database["public"]["Enums"]["measurement_source"]
          wall_length_cm: number | null
        }
        Insert: {
          ceiling_height_cm?: number | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          floor_plan_asset_id?: string | null
          id?: string
          notes?: string | null
          room_depth_cm?: number | null
          room_id: string
          source: Database["public"]["Enums"]["measurement_source"]
          wall_length_cm?: number | null
        }
        Update: {
          ceiling_height_cm?: number | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          floor_plan_asset_id?: string | null
          id?: string
          notes?: string | null
          room_depth_cm?: number | null
          room_id?: string
          source?: Database["public"]["Enums"]["measurement_source"]
          wall_length_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "room_measurements_floor_plan_asset_id_fkey"
            columns: ["floor_plan_asset_id"]
            isOneToOne: false
            referencedRelation: "room_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_measurements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          project_id: string
          room_type: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          project_id: string
          room_type: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          category: string
          created_at: string
          dimension_fit_note: string | null
          id: string
          line_total_aed: number | null
          product_id: string
          quantity: number
          selection_reason: string | null
          shopping_list_id: string
          sort_order: number
          unit_price_aed: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          dimension_fit_note?: string | null
          id?: string
          line_total_aed?: number | null
          product_id: string
          quantity?: number
          selection_reason?: string | null
          shopping_list_id: string
          sort_order?: number
          unit_price_aed?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          dimension_fit_note?: string | null
          id?: string
          line_total_aed?: number | null
          product_id?: string
          quantity?: number
          selection_reason?: string | null
          shopping_list_id?: string
          sort_order?: number
          unit_price_aed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          concept_id: string | null
          created_at: string
          estimated_total_aed: number
          id: string
          room_id: string
          status: Database["public"]["Enums"]["shopping_list_status"]
          updated_at: string
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          estimated_total_aed?: number
          id?: string
          room_id: string
          status?: Database["public"]["Enums"]["shopping_list_status"]
          updated_at?: string
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          estimated_total_aed?: number
          id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["shopping_list_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_concept_owner: { Args: { concept_id: string }; Returns: boolean }
      is_design_brief_owner: {
        Args: { design_brief_id: string }
        Returns: boolean
      }
      is_project_owner: { Args: { project_id: string }; Returns: boolean }
      is_room_owner: { Args: { room_id: string }; Returns: boolean }
      is_shopping_list_owner: {
        Args: { shopping_list_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      asset_type:
        | "room_photo"
        | "floor_plan"
        | "thumbnail"
        | "concept_render"
        | "final_render"
      concept_status: "draft" | "generated" | "selected" | "rejected"
      confidence_level: "verified" | "assumed" | "estimated" | "unknown"
      measurement_source: "manual" | "floor_plan" | "annotation" | "estimated"
      project_status: "draft" | "active" | "archived"
      question_status: "open" | "answered" | "skipped"
      retailer_status: "active" | "paused" | "blocked" | "candidate"
      room_status:
        | "draft"
        | "briefing"
        | "concepting"
        | "sourcing"
        | "rendering"
        | "complete"
      shopping_list_status: "draft" | "approved" | "archived"
      user_role: "owner" | "designer" | "admin"
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
      ai_job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      asset_type: [
        "room_photo",
        "floor_plan",
        "thumbnail",
        "concept_render",
        "final_render",
      ],
      concept_status: ["draft", "generated", "selected", "rejected"],
      confidence_level: ["verified", "assumed", "estimated", "unknown"],
      measurement_source: ["manual", "floor_plan", "annotation", "estimated"],
      project_status: ["draft", "active", "archived"],
      question_status: ["open", "answered", "skipped"],
      retailer_status: ["active", "paused", "blocked", "candidate"],
      room_status: [
        "draft",
        "briefing",
        "concepting",
        "sourcing",
        "rendering",
        "complete",
      ],
      shopping_list_status: ["draft", "approved", "archived"],
      user_role: ["owner", "designer", "admin"],
    },
  },
} as const
