-- Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- If null, refers to a role
    target_role TEXT, -- e.g., 'ADMIN', 'WAREHOUSE'. If null, refers to a specific user
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT, -- e.g., '/restocks'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Setup RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow reading own notifications or notifications directed to own role
CREATE POLICY "Users can view own or role notifications"
    ON public.notifications FOR SELECT
    USING (
        user_id = auth.uid() OR
        target_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
        target_role = 'ALL'
    );

-- Allow inserting notifications (e.g. from system or admins)
CREATE POLICY "Anyone can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- Allow users to update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (
        user_id = auth.uid() OR
        target_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
        target_role = 'ALL'
    );
