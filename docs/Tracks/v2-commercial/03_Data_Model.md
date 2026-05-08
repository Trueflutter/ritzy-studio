# 03 Data Model

## Principles

- Postgres remains the system of record.
- Room images and generated renders remain in object storage.
- Product facts remain source-backed.
- Commercial entitlement is checked server-side.
- Retailer clicks are routed through tracked redirect records.
- Discount claims are campaign-backed.

## Existing MVP Entities To Preserve

- `projects`
- `rooms`
- `room_assets`
- `room_measurements`
- `design_briefs`
- `clarifying_questions`
- `concepts`
- `concept_critiques`
- `retailers`
- `products`
- `product_dimensions`
- `product_images`
- `product_embeddings`
- `shopping_lists`
- `shopping_list_items`
- `render_jobs`
- `ingestion_runs`

## New Or Extended Entities

### user_profiles

Commercial profile for authenticated users.

Key fields:

- `user_id`
- `display_name`
- `intended_mode`: `homeowner | designer | both | unknown`
- `onboarding_completed_at`
- `country`
- `currency_preference`
- `created_at`
- `updated_at`

### designer_accounts

Professional designer billing/account state.

Key fields:

- `id`
- `owner_user_id`
- `business_name`
- `billing_customer_id`
- `subscription_status`
- `plan_key`
- `current_period_start`
- `current_period_end`
- `trial_ends_at`
- `cancel_at`
- `created_at`
- `updated_at`

### homeowner_rooms

Optional convenience layer when a homeowner creates a room without a full designer-style project.

Key fields:

- `id`
- `user_id`
- `room_id`
- `friendly_name`
- `created_at`

Implementation note:

This may be unnecessary if the existing `projects` table can support homeowner projects with simplified UI. Decide during V2-002.

### room_unlocks

Paid entitlement for a homeowner room.

Key fields:

- `id`
- `room_id`
- `user_id`
- `status`: `pending | active | refunded | expired | revoked`
- `price_aed`
- `billing_provider`
- `billing_checkout_id`
- `billing_payment_id`
- `unlocked_at`
- `expires_at`
- `created_at`
- `updated_at`

### subscriptions

Normalized subscription records for designers.

Key fields:

- `id`
- `user_id`
- `designer_account_id`
- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `plan_key`
- `status`
- `amount_usd`
- `billing_interval`
- `current_period_start`
- `current_period_end`
- `created_at`
- `updated_at`

### entitlement_events

Append-only entitlement ledger.

Key fields:

- `id`
- `user_id`
- `room_id`
- `subscription_id`
- `event_type`
- `source`
- `metadata_json`
- `created_at`

### retailer_partnerships

Commercial/data relationship with a retailer.

Key fields:

- `id`
- `retailer_id`
- `status`: `prospect | negotiating | active | paused | ended`
- `data_access_route`: `api | affiliate_feed | retailer_feed | trade_feed | approved_crawl | public_fallback | manual_recovery`
- `commercial_model`: `affiliate | cpa | cpc | fixed_fee | discount_only | unknown`
- `contact_name`
- `contact_email`
- `contract_url`
- `terms_summary`
- `image_usage_allowed`
- `discount_supported`
- `conversion_reporting_supported`
- `created_at`
- `updated_at`

### retailer_feeds

Feed/API source configuration.

Key fields:

- `id`
- `retailer_id`
- `partnership_id`
- `source_type`
- `source_url`
- `auth_type`
- `schedule`
- `last_success_at`
- `last_failure_at`
- `status`
- `field_mapping_json`
- `created_at`
- `updated_at`

### discount_campaigns

Retailer-specific discount program.

Key fields:

- `id`
- `retailer_id`
- `partnership_id`
- `name`
- `discount_type`: `percent | amount | auto_link | none`
- `discount_value`
- `starts_at`
- `ends_at`
- `status`
- `terms`
- `eligible_category_rules_json`
- `created_at`
- `updated_at`

### discount_codes

Codes available for assignment.

Key fields:

- `id`
- `campaign_id`
- `code`
- `status`: `available | assigned | consumed | expired | revoked`
- `assigned_to_user_id`
- `assigned_room_id`
- `assigned_at`
- `expires_at`
- `consumed_at`
- `metadata_json`
- `created_at`
- `updated_at`

### outbound_clicks

Tracked retailer link click.

Key fields:

- `id`
- `user_id`
- `room_id`
- `shopping_list_item_id`
- `product_id`
- `retailer_id`
- `discount_code_id`
- `signed_token_hash`
- `destination_url`
- `attribution_params_json`
- `clicked_at`
- `ip_country`
- `user_agent_hash`

Privacy note:

Avoid storing raw IP addresses unless there is a specific legal/commercial reason.

### affiliate_conversions

Imported or webhook-received retailer conversion events.

Key fields:

- `id`
- `retailer_id`
- `outbound_click_id`
- `discount_code_id`
- `external_order_id_hash`
- `currency`
- `gross_amount`
- `commission_amount`
- `conversion_status`
- `converted_at`
- `raw_payload_json`
- `created_at`

### visual_style_options

Canonical style cards.

Key fields:

- `id`
- `slug`
- `name`
- `plain_language_description`
- `image_asset_url`
- `room_type`
- `style_tags`
- `sort_order`
- `active`
- `created_at`
- `updated_at`

### user_style_preferences

Captured visual preference signals.

Key fields:

- `id`
- `user_id`
- `room_id`
- `style_option_id`
- `signal`: `liked | disliked | neutral`
- `created_at`

## Entitlement Rules

A user can access unlocked retailer links for a room when one of these is true:

- They own an active `room_unlock` for that room.
- They have an active designer subscription and own or can access the room.
- They have an admin/test entitlement.

All checks must run server-side.

## Reporting Rules

- Every outbound retailer click must be traceable to product, room, user, and retailer.
- Conversion imports may be incomplete and must not be treated as the only attribution truth.
- Reports should minimize personal data.
