-- ==============================================================================
-- 🧠 CORTEXOS PRODUCTION DATABASE SCHEMA
-- Target Database: Supabase PostgreSQL 15+
-- Features: Strict UUIDs, Cascading Foreign Keys, Automated Triggers,
--           Optimized Indexes, and Hardened Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Auto-update `updated_at` timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.users (Operator & Team Profiles)
-- Mirrors Supabase auth.users with public profile attributes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer', 'founder')),
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    current_status TEXT DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'coding', 'in_flow', 'away')),
    active_project_id UUID, -- Foreign key added below after projects table creation
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure username column exists if updating existing table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Index on email, username & status for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(current_status);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.projects (Project Registry & Cloud Metadata)
-- Stores synchronized metadata, tech stack, and cloud workspace states
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'client', 'experiment', 'archived')),
    category TEXT NOT NULL DEFAULT 'web' CHECK (category IN ('web', 'mobile', 'desktop', 'ai', 'backend', 'utility')),
    tech_stack TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    local_path TEXT NOT NULL,
    git_repository_url TEXT,
    git_branch TEXT DEFAULT 'main',
    dev_command TEXT,
    port INTEGER DEFAULT 3000,
    disk_size_mb NUMERIC(10, 2) DEFAULT 0.00,
    total_time_spent_seconds BIGINT NOT NULL DEFAULT 0,
    last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    cloud_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_project_name UNIQUE (owner_id, name)
);

-- Add self-referencing foreign key to users table for active project
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_active_project'
    ) THEN
        ALTER TABLE public.users 
        ADD CONSTRAINT fk_users_active_project 
        FOREIGN KEY (active_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for lightning fast filtering & sorting
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON public.projects(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_tech_stack ON public.projects USING GIN (tech_stack);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.team_collaborators (Multi-Developer Workspace Access)
-- Defines permissions and team allocations per project
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer')),
    permissions JSONB NOT NULL DEFAULT '{"can_run_dev": true, "can_backup": false, "can_edit_settings": false}'::jsonb,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_collaborator UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_project ON public.team_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON public.team_collaborators(user_id);

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.time_tracking_logs (Work Sessions & Activity Radar)
-- Records discrete and cumulative work blocks with duration and notes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_tracking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_task_note TEXT DEFAULT '',
    git_commit_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_project ON public.time_tracking_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON public.time_tracking_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_started_at ON public.time_tracking_logs(started_at DESC);

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC TRIGGERS FOR updated_at
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_users_updated_at ON public.users;
CREATE TRIGGER tr_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_projects_updated_at ON public.projects;
CREATE TRIGGER tr_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_team_collaborators_updated_at ON public.team_collaborators;
CREATE TRIGGER tr_team_collaborators_updated_at
BEFORE UPDATE ON public.team_collaborators
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TRIGGER: Synchronize auth.users to public.users upon registration
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, username, role, avatar_url, bio, current_status, settings)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        CASE 
            WHEN LOWER(TRIM(NEW.email)) = 'cabdulrahman36@gmail.com' THEN 'founder' 
            ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'developer') 
        END,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'avatarUrl', ''),
        COALESCE(NEW.raw_user_meta_data->>'bio', 'CortexOS Developer'),
        'online',
        jsonb_build_object('username', COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
        username = COALESCE(EXCLUDED.username, public.users.username),
        role = CASE 
            WHEN LOWER(TRIM(EXCLUDED.email)) = 'cabdulrahman36@gmail.com' THEN 'founder' 
            ELSE public.users.role 
        END,
        avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.users.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Enterprise grade: Users can only see/mutate what they own or are assigned to
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_tracking_logs ENABLE ROW LEVEL SECURITY;

-- 8.1 Users policies
DROP POLICY IF EXISTS "Users can view all registered team members" ON public.users;
CREATE POLICY "Users can view all registered team members"
ON public.users FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.users;
DROP POLICY IF EXISTS "Founder has full access to update users" ON public.users;
CREATE POLICY "Users can update their own profile or founder manages all"
ON public.users FOR UPDATE
TO authenticated
USING (
    auth.uid() = id OR 
    (auth.jwt()->>'email') = 'cabdulrahman36@gmail.com'
)
WITH CHECK (
    auth.uid() = id OR 
    (auth.jwt()->>'email') = 'cabdulrahman36@gmail.com'
);


-- 8.1.1 Helper functions to break RLS infinite recursion (42P17)
CREATE OR REPLACE FUNCTION public.check_is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_collaborators
        WHERE project_id = p_project_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.check_is_project_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_collaborators
        WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.check_is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = p_project_id AND owner_id = p_user_id
    );
$$;

-- 8.2 Projects policies
DROP POLICY IF EXISTS "Owners and collaborators can view projects" ON public.projects;
CREATE POLICY "Owners and collaborators can view projects"
ON public.projects FOR SELECT
TO authenticated, anon
USING (
    is_public = true OR
    owner_id = auth.uid() OR
    (auth.uid() IS NOT NULL AND public.check_is_project_member(id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners and Admin collaborators can update projects" ON public.projects;
CREATE POLICY "Owners and Admin collaborators can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
    owner_id = auth.uid() OR
    (auth.uid() IS NOT NULL AND public.check_is_project_admin(id, auth.uid()))
);

DROP POLICY IF EXISTS "Only project owners can delete projects" ON public.projects;
CREATE POLICY "Only project owners can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- 8.3 Team Collaborators policies
DROP POLICY IF EXISTS "Collaborators can view team roster" ON public.team_collaborators;
CREATE POLICY "Collaborators can view team roster"
ON public.team_collaborators FOR SELECT
TO authenticated, anon
USING (
    user_id = auth.uid() OR
    (auth.uid() IS NOT NULL AND public.check_is_project_owner(project_id, auth.uid())) OR
    (auth.uid() IS NOT NULL AND public.check_is_project_member(project_id, auth.uid()))
);

DROP POLICY IF EXISTS "Project owners can manage team collaborators" ON public.team_collaborators;
CREATE POLICY "Project owners can manage team collaborators"
ON public.team_collaborators FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL AND public.check_is_project_owner(project_id, auth.uid())
);

-- 8.4 Time Tracking Logs policies
DROP POLICY IF EXISTS "Collaborators can view time tracking logs" ON public.time_tracking_logs;
CREATE POLICY "Collaborators can view time tracking logs"
ON public.time_tracking_logs FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    (auth.uid() IS NOT NULL AND public.check_is_project_owner(project_id, auth.uid())) OR
    (auth.uid() IS NOT NULL AND public.check_is_project_member(project_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert their own time tracking logs" ON public.time_tracking_logs;
CREATE POLICY "Users can insert their own time tracking logs"
ON public.time_tracking_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 9. TABLE: public.friendships (Global Developer Network & Friends System)
-- Real-time presence, friend requests, activity tracking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_friendship_pair UNIQUE (sender_id, receiver_id),
    CONSTRAINT no_self_friending CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_sender ON public.friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- Auto-update updated_at for friendships
DROP TRIGGER IF EXISTS trigger_set_timestamp_friendships ON public.friendships;
CREATE TRIGGER trigger_set_timestamp_friendships
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies for friendships
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
CREATE POLICY "Users can view their friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friendships;
CREATE POLICY "Users can update received friend requests"
ON public.friendships FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid() OR sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove friendships" ON public.friendships;
CREATE POLICY "Users can remove friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. REALTIME REPLICATION CONFIGURATION
-- Enables WebSocket push events so frontend clients receive instant updates
-- without polling or burning database REST API quotas.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friendships'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_collaborators'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.team_collaborators;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Realtime publication configuration deferred to Supabase dashboard.';
END $$;