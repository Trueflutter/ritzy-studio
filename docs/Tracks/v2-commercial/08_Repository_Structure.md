# 08 Repository Structure

## Existing Structure

Keep the current monorepo structure:

- `apps/web`
- `packages/ai`
- `packages/config`
- `packages/db`
- `packages/domain`
- `packages/ingestion`
- `packages/prompts`
- `packages/ui`

## V2 Additions By Boundary

### apps/web

- role selection routes
- homeowner guided onboarding
- visual style quiz UI
- billing checkout routes
- billing webhook route
- shopping preview/paywall UI
- redirect endpoint
- internal retailer reporting screens or exports

### packages/db

- user profile types
- entitlement schema
- subscription schema
- retailer partnership schema
- discount/campaign schema
- outbound click schema
- conversion schema

### packages/domain

- entitlement helpers
- pricing rules
- discount eligibility rules
- redirect token generation/validation contracts
- retailer campaign rules
- homeowner/designer mode policies

### packages/ingestion

- feed adapter contracts
- partnership-aware adapter metadata
- retailer feed mapping
- deactivation/stock refresh logic

### packages/prompts

- homeowner preference interpreter
- style-card generation/captioning
- shopping preview summarizer
- discount explanation prompt

### packages/ai

- preference interpretation
- style-card enrichment if needed
- product matching remains catalog-backed

### packages/ui

- role selection component
- visual style card
- locked preview component
- entitlement banner
- upgrade/paywall panel
- discount badge

## New Docs

- `docs/Tracks/v2-commercial/04_Pricing_And_Entitlements.md`
- `docs/Tracks/v2-commercial/05_Retailer_Partnership_And_Attribution.md`

## Boundary Rules

- Billing webhooks must not live only in UI components.
- Entitlement checks must be domain/server helpers.
- Redirect attribution must not be client-only.
- Retailer partnership config must not be hardcoded into components.
