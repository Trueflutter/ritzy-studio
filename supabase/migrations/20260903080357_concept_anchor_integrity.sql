-- M3b (security review, S3b): database-enforced integrity for concept anchors.
--
-- The table shipped with an ownership policy on room_id alone, and two other
-- columns that carry ownership of their own. Postgres runs foreign key checks
-- as a privileged user, so the FKs to concepts and ai_jobs do not re-apply RLS,
-- and an authenticated writer could plant a row naming their OWN room and
-- SOMEONE ELSE'S concept. Concept ids are not secret; they appear in route
-- params and in the render's storage path.
--
-- Two consequences, and the second is the worse one. The row is a forged record
-- of what a paid render was built from, invisible to the victim because every
-- app read is scoped by room_id. And because uniqueness was global on
-- (concept_id, role_key), the planted row collides with the victim's own
-- single-statement upsert, whose ON CONFLICT update cannot satisfy the victim's
-- row policy; the whole statement fails, the handler logs and continues by
-- design, and the victim's concept silently loses every anchor. Sourcing then
-- re-decides those roles and the list carries a different sofa than the render,
-- which is the one defect this slice exists to remove.
--
-- Additive except for replacing the unique constraint with a correctly scoped
-- one. No data is rewritten; the table is days old and holds test rows only.

-- 1. A concept an anchor names must belong to the room the anchor names. The
--    SELECT runs under the caller's RLS, so an authenticated writer cannot even
--    reference a concept they cannot see.
create or replace function public.enforce_concept_anchor_room()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.concepts c
    where c.id = new.concept_id and c.room_id = new.room_id
  ) then
    raise exception 'concept_anchors.concept_id must reference a concept in the same room';
  end if;

  -- Same reasoning for the job that recorded the choice: a cost record from
  -- another room is a false provenance claim, not a harmless mislink.
  if new.selection_job_id is not null and not exists (
    select 1 from public.ai_jobs j
    where j.id = new.selection_job_id and j.room_id = new.room_id
  ) then
    raise exception 'concept_anchors.selection_job_id must reference a job for the same room';
  end if;

  return new;
end;
$$;

create trigger concept_anchors_room_integrity
  before insert or update on public.concept_anchors
  for each row execute function public.enforce_concept_anchor_room();

-- 2. Uniqueness scoped to the room as well, so one room's rows can never
--    collide with another's even if the trigger is ever bypassed by a
--    privileged path. The upsert's conflict target moves with it.
alter table public.concept_anchors
  drop constraint if exists concept_anchors_concept_id_role_key_key;

create unique index if not exists concept_anchors_room_concept_role_key
  on public.concept_anchors (room_id, concept_id, role_key);
