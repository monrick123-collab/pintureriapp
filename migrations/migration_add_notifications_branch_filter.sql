-- Add target_branch_id to notifications for branch-specific notifications
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_branch_id TEXT REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_notifications_target_branch
    ON public.notifications(target_branch_id);
