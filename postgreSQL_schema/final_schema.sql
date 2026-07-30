-- ============================================================================
-- PROJECT MANAGEMENT PLATFORM — DATABASE SCHEMA
-- Engine target : PostgreSQL 14+
-- Primary keys  : UUID (gen_random_uuid())
-- Source        : DATABASE_TABLES.docx + project_management_erd.eraser
-- ============================================================================
-- Notes on design decisions (read before running in prod):
--   1. All surrogate keys are UUID, generated server-side via gen_random_uuid()
--      (pgcrypto). Swap for uuid-ossp's uuid_generate_v4() if preferred.
--   2. TIMESTAMPTZ is used everywhere instead of TIMESTAMP to avoid timezone
--      bugs. DATE is used only where the source doc explicitly says DATE.
--   3. Audit / "who did this" columns (generated_by, moved_by, organizer,
--      created_by) are nullable with ON DELETE SET NULL, so history is kept
--      even if the acting user is removed. Structural FKs (project_id,
--      team_id, task_id, etc.) are NOT NULL with ON DELETE CASCADE, since a
--      child row is meaningless without its parent.
--   4. CHECK constraints are added only where the source doc explicitly
--      enumerates a closed set of values (risk_level, complexity,
--      report_format). Free-text classification columns (document_type,
--      notification_type, event_type, report_type) are left open (VARCHAR)
--      so new categories don't require a migration.
--   5. Every FK column has a supporting b-tree index (Postgres does not do
--      this automatically), plus extra indexes for common lookup patterns.
--   6. updated_at columns are kept in sync via a shared trigger function.
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ============================================================================
-- SHARED TRIGGER FUNCTION: keep updated_at current on every UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. USERS
-- ============================================================================
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_is_active  ON users (is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS 'All system users. Never store plain-text passwords — password_hash only.';

-- ============================================================================
-- 2. ROLES
-- ============================================================================
CREATE TABLE roles (
    role_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name   VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_roles_role_name UNIQUE (role_name)
);

COMMENT ON TABLE roles IS 'Defines user permissions (RBAC).';

-- ============================================================================
-- 3. USER_ROLE (many-to-many bridge: users <-> roles)
-- ============================================================================
CREATE TABLE user_role (
    user_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    role_id      UUID NOT NULL REFERENCES roles (role_id) ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_role_user_id ON user_role (user_id);
CREATE INDEX idx_user_role_role_id ON user_role (role_id);

COMMENT ON TABLE user_role IS 'Supports multiple roles per user (flexible authorization).';

-- ============================================================================
-- 4. PROJECTS
-- ============================================================================
CREATE TABLE projects (
    project_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(200) NOT NULL,
    description  TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_status     ON projects (status);
CREATE INDEX idx_projects_created_at ON projects (created_at);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE projects IS 'Main business entity — stores project information.';

-- ============================================================================
-- 5. TEAM_LEADS (one-to-one extension of users)
-- ============================================================================
CREATE TABLE team_leads (
    team_lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_team_leads_user_id UNIQUE (user_id)   -- enforces 1:1 with users
);

COMMENT ON TABLE team_leads IS 'Every Team Lead is a User; only promoted users get a record here (1:1 with users).';

-- ============================================================================
-- 6. TEAMS
-- ============================================================================
CREATE TABLE teams (
    team_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects (project_id)    ON DELETE CASCADE,
    team_lead_id  UUID NOT NULL REFERENCES team_leads (team_lead_id) ON DELETE RESTRICT,
    team_name     VARCHAR(150) NOT NULL,
    description   TEXT,
    max_members   INTEGER NOT NULL DEFAULT 10 CHECK (max_members > 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_project_id   ON teams (project_id);
CREATE INDEX idx_teams_team_lead_id ON teams (team_lead_id);
CREATE INDEX idx_teams_status       ON teams (status);

CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE teams IS 'Project teams. One Team has exactly one Team Lead; a Team Lead can manage multiple Teams.';

-- ============================================================================
-- 7. TEAM_MEMBERS (many-to-many bridge: users <-> teams)
-- ============================================================================
CREATE TABLE team_members (
    member_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id        UUID NOT NULL REFERENCES teams (team_id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    joined_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    responsibility VARCHAR(100),

    CONSTRAINT uq_team_members UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON team_members (team_id);
CREATE INDEX idx_team_members_user_id ON team_members (user_id);

COMMENT ON TABLE team_members IS 'Assigns users to teams; a user may belong to multiple teams.';

-- ============================================================================
-- 8. AI_SPRINT_PLANS
--    (created before TASKS because tasks.sprint_plan_id references it)
-- ============================================================================
CREATE TABLE ai_sprint_plans (
    sprint_plan_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    generated_by            UUID REFERENCES users (user_id) ON DELETE SET NULL,
    sprint_name             VARCHAR(150) NOT NULL,
    sprint_goal             TEXT NOT NULL,
    sprint_duration_days    INTEGER NOT NULL CHECK (sprint_duration_days > 0),
    suggested_tasks         JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_story_points  INTEGER,
    ai_model                VARCHAR(100) NOT NULL,
    prompt                  TEXT NOT NULL,
    ai_response             JSONB NOT NULL,
    confidence_score        NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Generated',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sprint_plans_project_id   ON ai_sprint_plans (project_id);
CREATE INDEX idx_ai_sprint_plans_generated_by ON ai_sprint_plans (generated_by);
CREATE INDEX idx_ai_sprint_plans_status       ON ai_sprint_plans (status);

CREATE TRIGGER trg_ai_sprint_plans_updated_at
    BEFORE UPDATE ON ai_sprint_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE ai_sprint_plans IS 'AI-generated sprint plans. Stores both prompt and output for auditing.';

-- ============================================================================
-- 9. TASKS
-- ============================================================================
CREATE TABLE tasks (
    task_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects (project_id)          ON DELETE CASCADE,
    user_id         UUID REFERENCES users (user_id)                        ON DELETE SET NULL,
    sprint_plan_id  UUID REFERENCES ai_sprint_plans (sprint_plan_id)        ON DELETE SET NULL,
    parent_task_id  UUID REFERENCES tasks (task_id)                        ON DELETE CASCADE,
    task_name       VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'TODO',
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    due_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project_id     ON tasks (project_id);
CREATE INDEX idx_tasks_user_id        ON tasks (user_id);
CREATE INDEX idx_tasks_sprint_plan_id ON tasks (sprint_plan_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks (parent_task_id);
CREATE INDEX idx_tasks_status         ON tasks (status);

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tasks IS 'Work items. parent_task_id supports subtasks (self-referencing).';

-- ============================================================================
-- 10. MILESTONES
-- ============================================================================
CREATE TABLE milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    due_date     DATE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project_id ON milestones (project_id);
CREATE INDEX idx_milestones_due_date   ON milestones (due_date);

COMMENT ON TABLE milestones IS 'Tracks major project deliveries; used in Gantt views.';

-- ============================================================================
-- 11. DOCUMENTS
-- ============================================================================
CREATE TABLE documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    file_url    TEXT,
    version     VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project_id ON documents (project_id);

COMMENT ON TABLE documents IS 'Project documentation; supports versioning.';

-- ============================================================================
-- 12. WORKFLOWS
-- ============================================================================
CREATE TABLE workflows (
    workflow_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects (project_id)      ON DELETE CASCADE,
    team_lead_id   UUID NOT NULL REFERENCES team_leads (team_lead_id)  ON DELETE RESTRICT,
    workflow_name  VARCHAR(100) NOT NULL,
    description    TEXT,
    workflow_type  VARCHAR(50) NOT NULL DEFAULT 'Task Workflow',
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_project_id   ON workflows (project_id);
CREATE INDEX idx_workflows_team_lead_id ON workflows (team_lead_id);

CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE workflows IS 'Configurable task/approval workflows per project.';

-- ============================================================================
-- 13. AI_RISK_PREDICTIONS
-- ============================================================================
CREATE TABLE ai_risk_predictions (
    prediction_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    task_id            UUID REFERENCES tasks (task_id)                ON DELETE SET NULL,
    risk_type          VARCHAR(100) NOT NULL,
    risk_level         VARCHAR(10) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    probability        NUMERIC(5,2) NOT NULL CHECK (probability BETWEEN 0 AND 100),
    impact             VARCHAR(50),
    recommendation     TEXT NOT NULL,
    ai_model           VARCHAR(100) NOT NULL,
    prompt             TEXT NOT NULL,
    prediction_result  JSONB NOT NULL,
    confidence_score   NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_risk_predictions_project_id ON ai_risk_predictions (project_id);
CREATE INDEX idx_ai_risk_predictions_task_id    ON ai_risk_predictions (task_id);
CREATE INDEX idx_ai_risk_predictions_risk_level ON ai_risk_predictions (risk_level);

COMMENT ON TABLE ai_risk_predictions IS 'AI-predicted project/task risks; feeds dashboard risk widgets.';

-- ============================================================================
-- 14. AI_DOCUMENT_GENERATIONS
-- ============================================================================
CREATE TABLE ai_document_generations (
    document_generation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    generated_by            UUID REFERENCES users (user_id)               ON DELETE SET NULL,
    document_type           VARCHAR(100) NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    prompt                  TEXT NOT NULL,
    generated_content       TEXT NOT NULL,
    document_url            TEXT,
    version                 VARCHAR(20) NOT NULL DEFAULT '1.0',
    ai_model                VARCHAR(100) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'Generated',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_document_generations_project_id   ON ai_document_generations (project_id);
CREATE INDEX idx_ai_document_generations_generated_by ON ai_document_generations (generated_by);

COMMENT ON TABLE ai_document_generations IS 'AI-generated documentation (SRS, MOM, BRD, etc.), versioned.';

-- ============================================================================
-- 15. AI_TASK_ESTIMATIONS
-- ============================================================================
CREATE TABLE ai_task_estimations (
    estimation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id            UUID NOT NULL REFERENCES tasks (task_id)       ON DELETE CASCADE,
    project_id         UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    estimated_hours    NUMERIC(6,2) NOT NULL CHECK (estimated_hours >= 0),
    estimated_cost     NUMERIC(12,2) CHECK (estimated_cost >= 0),
    complexity         VARCHAR(10) NOT NULL CHECK (complexity IN ('Low', 'Medium', 'High')),
    story_points       INTEGER CHECK (story_points >= 0),
    ai_reasoning       TEXT,
    prompt             TEXT NOT NULL,
    ai_model           VARCHAR(100) NOT NULL,
    confidence_score   NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_task_estimations_task_id    ON ai_task_estimations (task_id);
CREATE INDEX idx_ai_task_estimations_project_id ON ai_task_estimations (project_id);

COMMENT ON TABLE ai_task_estimations IS 'AI-predicted effort/cost per task; supports agile planning.';

-- ============================================================================
-- 16. AI_MEETING_SUMMARIES
-- ============================================================================
CREATE TABLE ai_meeting_summaries (
    summary_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    created_by     UUID REFERENCES users (user_id)                ON DELETE SET NULL,
    meeting_title  VARCHAR(255) NOT NULL,
    meeting_date   TIMESTAMPTZ NOT NULL,
    transcript     TEXT NOT NULL,
    summary        TEXT NOT NULL,
    action_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
    decisions      JSONB DEFAULT '[]'::jsonb,
    attendees      JSONB DEFAULT '[]'::jsonb,
    ai_model       VARCHAR(100) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_meeting_summaries_project_id  ON ai_meeting_summaries (project_id);
CREATE INDEX idx_ai_meeting_summaries_created_by  ON ai_meeting_summaries (created_by);
CREATE INDEX idx_ai_meeting_summaries_meeting_date ON ai_meeting_summaries (meeting_date);

COMMENT ON TABLE ai_meeting_summaries IS 'AI-generated meeting summaries; can auto-create tasks from action_items.';

-- ============================================================================
-- 17. KANBAN_COLUMNS
-- ============================================================================
CREATE TABLE kanban_columns (
    column_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    column_name VARCHAR(100) NOT NULL,
    position    INTEGER NOT NULL,
    color       VARCHAR(20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_kanban_columns_project_position UNIQUE (project_id, position)
);

CREATE INDEX idx_kanban_columns_project_id ON kanban_columns (project_id);

COMMENT ON TABLE kanban_columns IS 'Board columns (e.g. To Do / In Progress); supports drag-and-drop ordering.';

-- ============================================================================
-- 18. KANBAN_TASKS
-- ============================================================================
CREATE TABLE kanban_tasks (
    kanban_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID NOT NULL REFERENCES tasks (task_id)            ON DELETE CASCADE,
    column_id      UUID NOT NULL REFERENCES kanban_columns (column_id) ON DELETE CASCADE,
    position       INTEGER NOT NULL,
    moved_by       UUID REFERENCES users (user_id)                     ON DELETE SET NULL,
    moved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_kanban_tasks_task_id UNIQUE (task_id)   -- a task sits in exactly one Kanban slot
);

CREATE INDEX idx_kanban_tasks_task_id   ON kanban_tasks (task_id);
CREATE INDEX idx_kanban_tasks_column_id ON kanban_tasks (column_id);
CREATE INDEX idx_kanban_tasks_moved_by  ON kanban_tasks (moved_by);

COMMENT ON TABLE kanban_tasks IS 'Maps tasks to Kanban board columns; tracks movement history.';

-- ============================================================================
-- 19. GANTT_TASKS
-- ============================================================================
CREATE TABLE gantt_tasks (
    gantt_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    task_id          UUID NOT NULL REFERENCES tasks (task_id)       ON DELETE CASCADE,
    dependency_task  UUID REFERENCES gantt_tasks (gantt_id)         ON DELETE SET NULL,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    progress         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_gantt_tasks_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_gantt_tasks_project_id      ON gantt_tasks (project_id);
CREATE INDEX idx_gantt_tasks_task_id         ON gantt_tasks (task_id);
CREATE INDEX idx_gantt_tasks_dependency_task ON gantt_tasks (dependency_task);

COMMENT ON TABLE gantt_tasks IS 'Timeline data for Gantt charts; dependency_task is a self-reference for critical-path analysis.';

-- ============================================================================
-- 20. CALENDAR_EVENTS
-- ============================================================================
CREATE TABLE calendar_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    organizer       UUID REFERENCES users (user_id)                ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    event_type      VARCHAR(50) NOT NULL,
    start_datetime  TIMESTAMPTZ NOT NULL,
    end_datetime    TIMESTAMPTZ NOT NULL,
    location        VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_calendar_events_datetime_range CHECK (end_datetime >= start_datetime)
);

CREATE INDEX idx_calendar_events_project_id     ON calendar_events (project_id);
CREATE INDEX idx_calendar_events_organizer      ON calendar_events (organizer);
CREATE INDEX idx_calendar_events_start_datetime ON calendar_events (start_datetime);

COMMENT ON TABLE calendar_events IS 'Project calendar; can sync with external calendars.';

-- ============================================================================
-- 21. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
    notification_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users (user_id)       ON DELETE CASCADE,
    project_id           UUID REFERENCES projects (project_id)          ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    message              TEXT NOT NULL,
    notification_type    VARCHAR(50) NOT NULL,
    is_read              BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_project_id ON notifications (project_id);
CREATE INDEX idx_notifications_unread     ON notifications (user_id) WHERE is_read = FALSE;

COMMENT ON TABLE notifications IS 'User notifications; supports email, push, and in-app delivery.';

-- ============================================================================
-- 22. REPORTS
-- ============================================================================
CREATE TABLE reports (
    report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
    generated_by    UUID REFERENCES users (user_id)                ON DELETE SET NULL,
    report_name     VARCHAR(255) NOT NULL,
    report_type     VARCHAR(100) NOT NULL,
    report_format   VARCHAR(10) NOT NULL CHECK (report_format IN ('PDF', 'Excel', 'CSV')),
    file_url        TEXT,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          VARCHAR(30) NOT NULL DEFAULT 'Completed'
);

CREATE INDEX idx_reports_project_id   ON reports (project_id);
CREATE INDEX idx_reports_generated_by ON reports (generated_by);

COMMENT ON TABLE reports IS 'Generated reports; supports export in multiple formats.';

COMMIT;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
