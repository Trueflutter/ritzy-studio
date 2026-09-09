-- S4: one live or succeeded view check row per render job and view key.
--
-- The final render's planned views each open an ai_jobs row of type
-- render_view_check BEFORE any paid call, as a lease (status running, its
-- expiry in input_summary.leaseUntil), and close it succeeded with the
-- outcome and the asset it judged. This index is what makes the lease
-- exclusive under at-least-once delivery: a duplicate delivery that tries to
-- open a second lease for the same view gets a unique violation and adopts
-- instead of paying. A failed row does not block the key, so an expired
-- lease reclaimed by compare-and-swap (running to failed) frees it for the
-- next delivery. Additive: no column, no data change, and no rows of this
-- type exist before the code that writes them deploys.

create unique index if not exists ai_jobs_render_view_check_lease_idx
  on public.ai_jobs ((input_summary ->> 'renderJobId'), (input_summary ->> 'viewKey'))
  where job_type = 'render_view_check' and status in ('running', 'succeeded');
