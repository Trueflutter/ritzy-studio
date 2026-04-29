# Database Package

`@ritzy-studio/db` owns database-facing TypeScript types for the application.

The canonical schema is currently:

`supabase/migrations/20260429114000_initial_schema.sql`

The TypeScript database types in `src/types.ts` were generated from the local Supabase schema. Once the hosted Supabase project is linked, regenerate them from the live schema with:

```bash
supabase gen types typescript --linked > packages/db/src/types.ts
```

Do not hand-edit generated types after that point.
