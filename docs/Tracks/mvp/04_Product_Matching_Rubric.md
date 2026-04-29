# 04 Product Matching Rubric

## Purpose

This rubric defines how Ritzy Studio evaluates candidate products against an approved design concept. It prevents matching logic from being invented ad hoc in code or prompts.

## Matching Dimensions

### Category Fit

Determines whether the product is the correct kind of object.

Examples:

- sofa to sofa
- accent chair to armchair/lounge chair
- coffee table to coffee table
- rug to rug
- pendant light to pendant/ceiling light

Category fit is a hard filter for required anchor items.

### Style Fit

Measures whether the product supports the approved concept direction.

Signals:

- text tags
- product description
- retailer category
- image embedding
- LLM-enriched style tags
- designer critique history

### Color Fit

Measures palette alignment.

Signals:

- structured color field
- extracted dominant product image colors
- brief color preferences
- concept palette

### Material Fit

Measures whether visible material supports the concept.

Signals:

- retailer material field
- description extraction
- product image tagging

### Budget Fit

Measures price fit for the total room budget and the category-level target.

Budget fit must support substitution requests such as:

- cheaper
- premium
- same look, lower price
- keep total under budget

### Dimension Fit

Measures likely physical fit.

Rules:

- verified dimensions beat estimated dimensions
- missing dimensions must be shown as missing
- photo-only room estimates cannot certify fit
- products with missing dimensions may still be suggested with a warning

### Availability Confidence

Measures whether the product appears purchasable.

Values:

- `verified`: current product page says in stock or equivalent
- `assumed`: product page exists but stock was not explicit
- `estimated`: inferred from listing presence
- `unknown`: not available

### Retailer Confidence

Measures trust in the product source.

Signals:

- official product page
- fresh extraction timestamp
- structured data availability
- stable URL
- approved feed or trade source

### Visual Similarity

Measures whether the product visually resembles the concept object.

Signals:

- product image embedding
- vision model tags
- shape, silhouette, color, material
- concept region/object description

## Match Explanation Contract

Every recommended product should include a short explanation in prose:

- why it matches
- which attributes are verified
- which attributes are assumed
- what is uncertain

Percent confidence scores are forbidden in user-facing UI. Use prose terms from the design system:

- verified
- assumed
- estimated

## Ranking Order

Default ranking:

1. category fit
2. availability confidence
3. style fit
4. budget fit
5. color/material fit
6. dimension fit
7. visual similarity
8. retailer preference

Designer overrides can change ranking within a substitution request.

## Hard Rejection Rules

Reject a product when:

- category is clearly wrong
- price exceeds explicit maximum for that item unless designer requested premium options
- product URL is missing
- product image is missing
- retailer source is blocked or disallowed for current ingestion mode
- product is clearly out of stock and no backorder option is shown

## Missing Data Rules

Missing data does not always reject a product. It must be shown.

Examples:

- Missing dimensions: "Dimensions not verified."
- Stale price: "Price last checked 12 days ago."
- Availability unknown: "Availability not confirmed."

## Substitution Rules

Substitution requests must preserve the rest of the selected design unless the designer asks otherwise.

Examples:

- "cheaper armchairs" changes only armchairs
- "warmer wood" changes wood-finish items
- "less bulky sofa" changes sofa candidates and prioritizes smaller depth/width
- "only Home Centre" filters retailer

## Final Shopping List Rule

The shopping list must be assembled only from selected product records. It must never be inferred from generated pixels.
