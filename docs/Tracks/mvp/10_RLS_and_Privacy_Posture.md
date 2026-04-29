# 10 RLS And Privacy Posture

## Status

Initial MVP posture.

## Principles

- Supabase Auth is the identity provider.
- User-owned project data is private by default.
- Retailer product catalog data is readable by authenticated users.
- Catalog writes are service-role only.
- Product embeddings are not user-readable.
- Room photos and generated renders are private storage assets.

## User-Owned Data

The following entities are scoped to the authenticated project owner:

- projects
- rooms
- room assets
- room measurements
- design briefs
- clarifying questions
- concepts
- concept critiques
- shopping lists
- shopping list items
- render jobs

RLS policies use ownership helper functions to traverse from child records to the owning project.

## Product Catalog Data

Retailers and products are shared catalog entities.

Authenticated users may read active/candidate retailers and product facts. Writes are reserved for service-role ingestion jobs.

## Storage

Private buckets:

- `room-assets`
- `generated-renders`

Storage object paths must begin with the authenticated user's UUID:

```text
<user-id>/<room-id>/<file-name>
```

Users may read/write their own `room-assets` folder. Generated renders are written by service-role jobs and readable by the owning user.

## Service Role

The service role is reserved for:

- retailer ingestion
- product writes
- product embeddings
- AI job orchestration
- generated render writes

Service-role keys must never be exposed to client components.

## Deferred

- team/project collaborator access
- client portal access
- fine-grained roles beyond owner/designer/admin profile field
