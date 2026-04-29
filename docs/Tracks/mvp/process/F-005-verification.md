# F-005 Verification: Room Image Upload And Asset Storage

## Feature

`F-005 Room Image Upload And Asset Storage`

## Scope

Implemented protected room photo upload and private asset storage.

Boundaries touched:

- `apps/web`
- `packages/db`
- `packages/domain`
- `packages/ui`

## Implementation Summary

- Added protected room photo route:
  - `/projects/[projectId]/rooms/[roomId]/photos`
- Added `RoomPhotoUploader` client component.
- Uploaded room photos to private Supabase Storage bucket `room-assets`.
- Enforced storage path convention:
  - `<user-id>/<room-id>/<file-name>`
- Inserted uploaded image metadata into `room_assets`.
- Created signed URLs for existing room photos.
- Displayed uploaded photos as square thumbnails without cropping the actual image content.
- Added upload status, error, and retry states.
- Updated new project creation redirect to continue into the photo step.
- Updated dashboard project cards to open the first room's photo step.

## Verification Commands

Passed:

```bash
pnpm check
curl -I -s http://localhost:3001/projects/test/rooms/test/photos
```

Route behavior:

- Unauthenticated room photo route redirects to `/login`.

Supabase storage smoke test:

- Signed up a temporary local user.
- Created a project and room through authenticated RLS client.
- Uploaded a test PNG to private `room-assets` storage.
- Inserted matching `room_assets` row.
- Created signed URL for the uploaded asset.
- Deleted test storage object, project, and user.

Design scan:

```bash
rg -n "#000000|#FFFFFF|#fff|#000|dark:|rounded-(full|lg|md|xl)|shadow-(md|lg|xl|2xl)|Inter|Roboto|Arial|system-ui|spinner|magic|purple" apps/web packages/ui
```

Result: no UI violations. The only match was `esModuleInterop` in `tsconfig.json`.

## Result

Passed.

## Deferrals

- AI room analysis is deferred to F-007.
- Brief capture begins in F-006.
- Continue-to-brief CTA is intentionally disabled until F-006 adds the target route.
