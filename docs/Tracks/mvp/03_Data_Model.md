# 03 Data Model

## Principles

- Postgres is the system of record.
- Object storage holds images and generated media.
- Every AI output stores provenance.
- Every retailer product field stores source and freshness where practical.
- Missing product data is represented explicitly, not hidden.

## Core Entities

### users

Application users.

Key fields:

- `id`
- `email`
- `name`
- `role`
- `created_at`
- `updated_at`

### projects

Designer projects.

Key fields:

- `id`
- `owner_user_id`
- `name`
- `client_name`
- `location`
- `budget_min_aed`
- `budget_max_aed`
- `status`
- `created_at`
- `updated_at`
- `archived_at`

### rooms

Rooms within a project.

Key fields:

- `id`
- `project_id`
- `name`
- `room_type`
- `status`
- `notes`
- `created_at`
- `updated_at`

### room_assets

Uploaded room images and derivatives.

Key fields:

- `id`
- `room_id`
- `asset_type`
- `storage_path`
- `mime_type`
- `width_px`
- `height_px`
- `is_primary`
- `created_at`

### room_measurements

Manual and inferred room sizing data.

Key fields:

- `id`
- `room_id`
- `source`
- `wall_length_cm`
- `room_depth_cm`
- `ceiling_height_cm`
- `floor_plan_asset_id`
- `confidence`
- `notes`
- `created_at`

Allowed confidence values:

- `verified`
- `assumed`
- `estimated`
- `unknown`

### design_briefs

Structured designer intent.

Key fields:

- `id`
- `room_id`
- `style_notes`
- `color_notes`
- `budget_notes`
- `functional_requirements`
- `avoid_notes`
- `inspiration_notes`
- `structured_json`
- `created_at`
- `updated_at`

### clarifying_questions

AI-generated or system-generated questions.

Key fields:

- `id`
- `design_brief_id`
- `question`
- `answer`
- `status`
- `created_at`
- `answered_at`

### concepts

Initial or revised generated design concepts.

Key fields:

- `id`
- `room_id`
- `design_brief_id`
- `parent_concept_id`
- `title`
- `description`
- `status`
- `generation_job_id`
- `primary_image_asset_id`
- `created_at`
- `updated_at`

### concept_critiques

Designer feedback on concepts.

Key fields:

- `id`
- `concept_id`
- `critique_text`
- `created_by_user_id`
- `created_at`

### retailers

Retailer registry.

Key fields:

- `id`
- `name`
- `domain`
- `country`
- `adapter_key`
- `status`
- `robots_notes`
- `terms_notes`
- `created_at`
- `updated_at`

### products

Canonical product records.

Key fields:

- `id`
- `retailer_id`
- `external_sku`
- `canonical_url`
- `name`
- `description`
- `category_raw`
- `category_normalized`
- `price_aed`
- `sale_price_aed`
- `currency`
- `availability`
- `primary_image_url`
- `color`
- `material`
- `style_tags`
- `room_tags`
- `data_confidence`
- `last_checked_at`
- `created_at`
- `updated_at`

### product_dimensions

Product dimension records.

Key fields:

- `id`
- `product_id`
- `width_cm`
- `depth_cm`
- `height_cm`
- `diameter_cm`
- `source_text`
- `confidence`
- `created_at`

### product_images

Product image records.

Key fields:

- `id`
- `product_id`
- `image_url`
- `storage_path`
- `sort_order`
- `alt_text`
- `source`
- `created_at`

### product_embeddings

Search vectors.

Key fields:

- `id`
- `product_id`
- `embedding_type`
- `model`
- `vector`
- `source_hash`
- `created_at`

### ingestion_runs

Retailer ingestion job history.

Key fields:

- `id`
- `retailer_id`
- `adapter_key`
- `status`
- `started_at`
- `completed_at`
- `products_seen`
- `products_created`
- `products_updated`
- `products_failed`
- `error_summary`

### shopping_lists

Approved product sets for a concept or render.

Key fields:

- `id`
- `room_id`
- `concept_id`
- `status`
- `estimated_total_aed`
- `created_at`
- `updated_at`

### shopping_list_items

Selected products.

Key fields:

- `id`
- `shopping_list_id`
- `product_id`
- `category`
- `quantity`
- `unit_price_aed`
- `line_total_aed`
- `selection_reason`
- `dimension_fit_note`
- `sort_order`
- `created_at`
- `updated_at`

### render_jobs

Final render jobs.

Key fields:

- `id`
- `room_id`
- `concept_id`
- `shopping_list_id`
- `status`
- `prompt_version`
- `model`
- `input_asset_ids`
- `output_asset_ids`
- `error_message`
- `created_at`
- `completed_at`

### ai_jobs

Generic AI job ledger.

Key fields:

- `id`
- `job_type`
- `status`
- `provider`
- `model`
- `prompt_version`
- `input_summary`
- `output_summary`
- `cost_estimate_usd`
- `error_message`
- `created_at`
- `completed_at`

## Retention Posture

- Keep project and generated assets until explicitly deleted.
- Keep job metadata for audit and debugging.
- Do not store API keys or secrets in database rows.
- Store original room photos as private assets.
- Product images may be hotlinked only if allowed; otherwise cache where legally permitted.
