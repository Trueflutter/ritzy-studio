-- M1b (codex cross-model review, S2): database-enforced integrity for the S2
-- revision bookkeeping. Additive; no data rewrite. Existing rows verified valid
-- before apply (the only linked critique references a true revision).
--
-- 1. room_design_specs.concept_id must belong to room_design_specs.room_id, so a
--    direct PostgREST write cannot create a cross-room spec. The trigger's
--    SELECT runs under the caller's RLS, which strengthens the check for
--    authenticated writers (a concept they cannot see cannot be referenced).
create or replace function public.enforce_design_spec_concept_room()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.concepts c
    where c.id = new.concept_id and c.room_id = new.room_id
  ) then
    raise exception 'room_design_specs.concept_id must reference a concept in the same room';
  end if;
  return new;
end;
$$;

create trigger room_design_specs_concept_room
  before insert or update on public.room_design_specs
  for each row execute function public.enforce_design_spec_concept_room();

-- 2. concept_critiques.concept_version_link may only reference a revision OF the
--    critiqued concept (parent_concept_id = the critique's concept), so lineage
--    claims on the concepts screen cannot be forged or misattached.
create or replace function public.enforce_critique_version_link()
returns trigger
language plpgsql
as $$
begin
  if new.concept_version_link is not null and not exists (
    select 1 from public.concepts c
    where c.id = new.concept_version_link
      and c.parent_concept_id = new.concept_id
  ) then
    raise exception 'concept_version_link must reference a revision of the critiqued concept';
  end if;
  return new;
end;
$$;

create trigger concept_critiques_version_link
  before insert or update on public.concept_critiques
  for each row execute function public.enforce_critique_version_link();
