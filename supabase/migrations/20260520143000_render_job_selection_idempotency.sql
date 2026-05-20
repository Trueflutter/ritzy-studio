create unique index if not exists render_jobs_final_render_selection_once_idx
  on public.render_jobs (
    room_id,
    concept_id,
    shopping_list_id,
    ((input_summary ->> 'selectionKey'))
  )
  where input_summary ? 'selectionKey'
    and status in ('queued', 'running');
