-- Frozen starting schema for revision 20261010_01.
-- Later tables and columns belong to their Alembic revisions.
-- Do not regenerate this file from live application models.

-- table: organizations
CREATE TABLE organizations (
	organization_id UUID NOT NULL,
	name VARCHAR(180) NOT NULL,
	slug VARCHAR(80) NOT NULL,
	status VARCHAR(24) DEFAULT 'ACTIVE' NOT NULL,
	plan_code VARCHAR(32) DEFAULT 'TRIAL' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (organization_id)
);
CREATE UNIQUE INDEX ix_organizations_slug ON organizations (slug);

-- table: notification_settings
CREATE TABLE notification_settings (
	setting_key VARCHAR(100) NOT NULL,
	setting_value VARCHAR(255) NOT NULL,
	organization_id UUID NOT NULL,
	CONSTRAINT pk_notification_settings_org_key PRIMARY KEY (organization_id, setting_key),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_notification_settings_organization_id ON notification_settings (organization_id);

-- table: organization_subscriptions
CREATE TABLE organization_subscriptions (
	subscription_id UUID NOT NULL,
	organization_id UUID NOT NULL,
	billing_provider VARCHAR(32) DEFAULT 'none' NOT NULL,
	provider_customer_id VARCHAR(160),
	provider_subscription_id VARCHAR(160),
	plan_code VARCHAR(32) DEFAULT 'TRIAL' NOT NULL,
	status VARCHAR(24) DEFAULT 'TRIALING' NOT NULL,
	trial_ends_at TIMESTAMP WITH TIME ZONE,
	period_ends_at TIMESTAMP WITH TIME ZONE,
	cancel_at_period_end BOOLEAN DEFAULT 'false' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (subscription_id),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE,
	UNIQUE (provider_customer_id),
	UNIQUE (provider_subscription_id)
);
CREATE UNIQUE INDEX ix_organization_subscriptions_organization_id ON organization_subscriptions (organization_id);

-- table: permissions
CREATE TABLE permissions (
	permission_id UUID NOT NULL,
	code VARCHAR(100) NOT NULL,
	name VARCHAR(120) NOT NULL,
	description VARCHAR(255) NOT NULL,
	category VARCHAR(80) NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (permission_id),
	CONSTRAINT uq_permissions_org_code UNIQUE (organization_id, code),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_permissions_code ON permissions (code);
CREATE INDEX ix_permissions_organization_id ON permissions (organization_id);

-- table: projects
CREATE TABLE projects (
	project_id UUID NOT NULL,
	project_name VARCHAR(200) NOT NULL,
	description TEXT,
	status VARCHAR(20) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (project_id),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_projects_organization_id ON projects (organization_id);
CREATE INDEX ix_projects_status ON projects (status);

-- table: roles
CREATE TABLE roles (
	role_id UUID NOT NULL,
	role_name VARCHAR(100) NOT NULL,
	description VARCHAR(255),
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (role_id),
	CONSTRAINT uq_roles_org_name UNIQUE (organization_id, role_name),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_roles_organization_id ON roles (organization_id);

-- table: users
CREATE TABLE users (
	user_id UUID NOT NULL,
	name VARCHAR(150) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	is_active BOOLEAN NOT NULL,
	is_email_verified BOOLEAN DEFAULT 'true' NOT NULL,
	terms_accepted_at TIMESTAMP WITH TIME ZONE,
	terms_version VARCHAR(30),
	profile_picture_filename VARCHAR(255),
	profile_picture_mime_type VARCHAR(100),
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (user_id),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_organization_id ON users (organization_id);

-- table: ai_document_generations
CREATE TABLE ai_document_generations (
	document_generation_id UUID NOT NULL,
	project_id UUID NOT NULL,
	generated_by UUID,
	document_type VARCHAR(100) NOT NULL,
	title VARCHAR(255) NOT NULL,
	prompt TEXT NOT NULL,
	generated_content TEXT NOT NULL,
	document_url TEXT,
	version VARCHAR(20) NOT NULL,
	ai_model VARCHAR(100) NOT NULL,
	status VARCHAR(20) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (document_generation_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(generated_by) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_document_generations_generated_by ON ai_document_generations (generated_by);
CREATE INDEX ix_ai_document_generations_organization_id ON ai_document_generations (organization_id);
CREATE INDEX ix_ai_document_generations_project_id ON ai_document_generations (project_id);

-- table: ai_meeting_summaries
CREATE TABLE ai_meeting_summaries (
	summary_id UUID NOT NULL,
	project_id UUID NOT NULL,
	created_by UUID,
	meeting_title VARCHAR(255) NOT NULL,
	meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
	transcript TEXT NOT NULL,
	summary TEXT NOT NULL,
	action_items JSONB NOT NULL,
	decisions JSONB,
	attendees JSONB,
	ai_model VARCHAR(100) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (summary_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(created_by) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_meeting_summaries_created_by ON ai_meeting_summaries (created_by);
CREATE INDEX ix_ai_meeting_summaries_meeting_date ON ai_meeting_summaries (meeting_date);
CREATE INDEX ix_ai_meeting_summaries_organization_id ON ai_meeting_summaries (organization_id);
CREATE INDEX ix_ai_meeting_summaries_project_id ON ai_meeting_summaries (project_id);

-- table: ai_sprint_plans
CREATE TABLE ai_sprint_plans (
	sprint_plan_id UUID NOT NULL,
	project_id UUID NOT NULL,
	generated_by UUID,
	sprint_name VARCHAR(150) NOT NULL,
	sprint_goal TEXT NOT NULL,
	sprint_duration_days INTEGER NOT NULL,
	suggested_tasks JSONB NOT NULL,
	estimated_story_points INTEGER,
	ai_model VARCHAR(100) NOT NULL,
	prompt TEXT NOT NULL,
	ai_response JSONB NOT NULL,
	confidence_score NUMERIC(5, 2),
	status VARCHAR(30) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (sprint_plan_id),
	CONSTRAINT ck_ai_sprint_plans_duration_positive CHECK (sprint_duration_days > 0),
	CONSTRAINT ck_ai_sprint_plans_confidence_range CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(generated_by) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_sprint_plans_generated_by ON ai_sprint_plans (generated_by);
CREATE INDEX ix_ai_sprint_plans_organization_id ON ai_sprint_plans (organization_id);
CREATE INDEX ix_ai_sprint_plans_project_id ON ai_sprint_plans (project_id);
CREATE INDEX ix_ai_sprint_plans_status ON ai_sprint_plans (status);

-- table: calendar_events
CREATE TABLE calendar_events (
	event_id UUID NOT NULL,
	project_id UUID NOT NULL,
	organizer UUID,
	title VARCHAR(255) NOT NULL,
	description TEXT,
	event_type VARCHAR(50) NOT NULL,
	start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
	end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
	location VARCHAR(255),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (event_id),
	CONSTRAINT ck_calendar_events_datetime_range CHECK (end_datetime >= start_datetime),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(organizer) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_calendar_events_organization_id ON calendar_events (organization_id);
CREATE INDEX ix_calendar_events_organizer ON calendar_events (organizer);
CREATE INDEX ix_calendar_events_project_id ON calendar_events (project_id);
CREATE INDEX ix_calendar_events_start_datetime ON calendar_events (start_datetime);

-- table: chat_user_settings
CREATE TABLE chat_user_settings (
	user_id UUID NOT NULL,
	notifications_enabled BOOLEAN DEFAULT 'true' NOT NULL,
	volume_percent INTEGER DEFAULT '70' NOT NULL,
	font_size VARCHAR(12) DEFAULT 'medium' NOT NULL,
	theme VARCHAR(8) DEFAULT 'light' NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (user_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_user_settings_organization_id ON chat_user_settings (organization_id);

-- table: documents
CREATE TABLE documents (
	document_id UUID NOT NULL,
	project_id UUID NOT NULL,
	title VARCHAR(255) NOT NULL,
	file_url TEXT,
	version VARCHAR(20) NOT NULL,
	resource_type VARCHAR(20) DEFAULT 'FILE' NOT NULL,
	stored_filename VARCHAR(255),
	original_filename VARCHAR(255),
	mime_type VARCHAR(150),
	file_size BIGINT,
	created_by VARCHAR(255),
	updated_by VARCHAR(255),
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (document_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_documents_organization_id ON documents (organization_id);
CREATE INDEX ix_documents_project_id ON documents (project_id);

-- table: email_verification_tokens
CREATE TABLE email_verification_tokens (
	email_verification_token_id UUID NOT NULL,
	user_id UUID NOT NULL,
	token VARCHAR(512) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	is_used BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (email_verification_token_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	UNIQUE (token),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_email_verification_tokens_organization_id ON email_verification_tokens (organization_id);
CREATE INDEX ix_email_verification_tokens_user_id ON email_verification_tokens (user_id);

-- table: kanban_columns
CREATE TABLE kanban_columns (
	column_id UUID NOT NULL,
	project_id UUID NOT NULL,
	column_name VARCHAR(100) NOT NULL,
	position INTEGER NOT NULL,
	color VARCHAR(20),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (column_id),
	CONSTRAINT uq_kanban_columns_project_position UNIQUE (project_id, position),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_kanban_columns_organization_id ON kanban_columns (organization_id);
CREATE INDEX ix_kanban_columns_project_id ON kanban_columns (project_id);

-- table: login_history
CREATE TABLE login_history (
	login_history_id UUID NOT NULL,
	user_id UUID NOT NULL,
	ip_address VARCHAR(50),
	user_agent VARCHAR(500),
	login_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	logout_time TIMESTAMP WITH TIME ZONE,
	is_successful BOOLEAN NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (login_history_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_login_history_organization_id ON login_history (organization_id);
CREATE INDEX ix_login_history_user_id ON login_history (user_id);

-- table: milestones
CREATE TABLE milestones (
	milestone_id UUID NOT NULL,
	project_id UUID NOT NULL,
	title VARCHAR(255) NOT NULL,
	description TEXT,
	due_date DATE NOT NULL,
	is_completed BOOLEAN NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (milestone_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_milestones_due_date ON milestones (due_date);
CREATE INDEX ix_milestones_organization_id ON milestones (organization_id);
CREATE INDEX ix_milestones_project_id ON milestones (project_id);

-- table: notification_user_settings
CREATE TABLE notification_user_settings (
	user_id UUID NOT NULL,
	volume_percent INTEGER DEFAULT '65' NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (user_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_notification_user_settings_organization_id ON notification_user_settings (organization_id);

-- table: organization_invitations
CREATE TABLE organization_invitations (
	invitation_id UUID NOT NULL,
	organization_id UUID NOT NULL,
	email VARCHAR(255) NOT NULL,
	role_id UUID NOT NULL,
	invited_by_user_id UUID NOT NULL,
	token_hash VARCHAR(64) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	accepted_at TIMESTAMP WITH TIME ZONE,
	revoked_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (invitation_id),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE,
	FOREIGN KEY(role_id) REFERENCES roles (role_id) ON DELETE RESTRICT,
	FOREIGN KEY(invited_by_user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_organization_invitations_email ON organization_invitations (email);
CREATE INDEX ix_organization_invitations_organization_id ON organization_invitations (organization_id);
CREATE UNIQUE INDEX ix_organization_invitations_token_hash ON organization_invitations (token_hash);

-- table: password_reset_tokens
CREATE TABLE password_reset_tokens (
	password_reset_token_id UUID NOT NULL,
	user_id UUID NOT NULL,
	token VARCHAR(512) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	is_used BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (password_reset_token_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	UNIQUE (token),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_password_reset_tokens_organization_id ON password_reset_tokens (organization_id);
CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);

-- table: refresh_tokens
CREATE TABLE refresh_tokens (
	refresh_token_id UUID NOT NULL,
	user_id UUID NOT NULL,
	token VARCHAR(512) NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	is_revoked BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (refresh_token_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	UNIQUE (token),
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_refresh_tokens_organization_id ON refresh_tokens (organization_id);
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

-- table: reports
CREATE TABLE reports (
	report_id UUID NOT NULL,
	project_id UUID NOT NULL,
	generated_by UUID,
	report_name VARCHAR(255) NOT NULL,
	report_type VARCHAR(100) NOT NULL,
	report_format VARCHAR(10) NOT NULL,
	file_url TEXT,
	generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	status VARCHAR(30) NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (report_id),
	CONSTRAINT ck_reports_report_format CHECK (report_format IN ('PDF', 'Excel', 'CSV')),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(generated_by) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_reports_generated_by ON reports (generated_by);
CREATE INDEX ix_reports_organization_id ON reports (organization_id);
CREATE INDEX ix_reports_project_id ON reports (project_id);

-- table: role_permissions
CREATE TABLE role_permissions (
	role_permission_id UUID NOT NULL,
	role_id UUID NOT NULL,
	permission_id UUID NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (role_permission_id),
	CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id),
	FOREIGN KEY(role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
	FOREIGN KEY(permission_id) REFERENCES permissions (permission_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_role_permissions_organization_id ON role_permissions (organization_id);
CREATE INDEX ix_role_permissions_permission_id ON role_permissions (permission_id);
CREATE INDEX ix_role_permissions_role_id ON role_permissions (role_id);

-- table: team_leads
CREATE TABLE team_leads (
	team_lead_id UUID NOT NULL,
	user_id UUID NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (team_lead_id),
	UNIQUE (user_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_team_leads_organization_id ON team_leads (organization_id);

-- table: user_role
CREATE TABLE user_role (
	user_role_id UUID NOT NULL,
	user_id UUID NOT NULL,
	role_id UUID NOT NULL,
	assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (user_role_id),
	CONSTRAINT uq_user_role UNIQUE (user_id, role_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_user_role_organization_id ON user_role (organization_id);
CREATE INDEX ix_user_role_role_id ON user_role (role_id);
CREATE INDEX ix_user_role_user_id ON user_role (user_id);

-- table: tasks
CREATE TABLE tasks (
	task_id UUID NOT NULL,
	project_id UUID NOT NULL,
	user_id UUID,
	sprint_plan_id UUID,
	parent_task_id UUID,
	task_name VARCHAR(255) NOT NULL,
	description TEXT,
	status VARCHAR(20) NOT NULL,
	priority VARCHAR(20) NOT NULL,
	due_date DATE,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (task_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(sprint_plan_id) REFERENCES ai_sprint_plans (sprint_plan_id) ON DELETE SET NULL,
	FOREIGN KEY(parent_task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_tasks_organization_id ON tasks (organization_id);
CREATE INDEX ix_tasks_parent_task_id ON tasks (parent_task_id);
CREATE INDEX ix_tasks_project_id ON tasks (project_id);
CREATE INDEX ix_tasks_sprint_plan_id ON tasks (sprint_plan_id);
CREATE INDEX ix_tasks_status ON tasks (status);
CREATE INDEX ix_tasks_user_id ON tasks (user_id);

-- table: teams
CREATE TABLE teams (
	team_id UUID NOT NULL,
	project_id UUID NOT NULL,
	team_lead_id UUID NOT NULL,
	team_name VARCHAR(150) NOT NULL,
	description TEXT,
	max_members INTEGER NOT NULL,
	status VARCHAR(20) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (team_id),
	CONSTRAINT ck_teams_max_members_positive CHECK (max_members > 0),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(team_lead_id) REFERENCES team_leads (team_lead_id) ON DELETE RESTRICT,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_teams_organization_id ON teams (organization_id);
CREATE INDEX ix_teams_project_id ON teams (project_id);
CREATE INDEX ix_teams_status ON teams (status);
CREATE INDEX ix_teams_team_lead_id ON teams (team_lead_id);

-- table: workflows
CREATE TABLE workflows (
	workflow_id UUID NOT NULL,
	project_id UUID NOT NULL,
	team_lead_id UUID NOT NULL,
	workflow_name VARCHAR(100) NOT NULL,
	description TEXT,
	workflow_type VARCHAR(50) NOT NULL,
	is_default BOOLEAN NOT NULL,
	status VARCHAR(20) NOT NULL,
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (workflow_id),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(team_lead_id) REFERENCES team_leads (team_lead_id) ON DELETE RESTRICT,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_workflows_organization_id ON workflows (organization_id);
CREATE INDEX ix_workflows_project_id ON workflows (project_id);
CREATE INDEX ix_workflows_team_lead_id ON workflows (team_lead_id);

-- table: ai_risk_predictions
CREATE TABLE ai_risk_predictions (
	prediction_id UUID NOT NULL,
	project_id UUID NOT NULL,
	task_id UUID,
	risk_type VARCHAR(100) NOT NULL,
	risk_level VARCHAR(10) NOT NULL,
	probability NUMERIC(5, 2) NOT NULL,
	impact VARCHAR(50),
	recommendation TEXT NOT NULL,
	ai_model VARCHAR(100) NOT NULL,
	prompt TEXT NOT NULL,
	prediction_result JSONB NOT NULL,
	confidence_score NUMERIC(5, 2),
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (prediction_id),
	CONSTRAINT ck_ai_risk_predictions_risk_level CHECK (risk_level IN ('Low', 'Medium', 'High')),
	CONSTRAINT ck_ai_risk_predictions_probability_range CHECK (probability BETWEEN 0 AND 100),
	CONSTRAINT ck_ai_risk_predictions_confidence_range CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(task_id) REFERENCES tasks (task_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_risk_predictions_organization_id ON ai_risk_predictions (organization_id);
CREATE INDEX ix_ai_risk_predictions_project_id ON ai_risk_predictions (project_id);
CREATE INDEX ix_ai_risk_predictions_risk_level ON ai_risk_predictions (risk_level);
CREATE INDEX ix_ai_risk_predictions_task_id ON ai_risk_predictions (task_id);

-- table: ai_task_estimations
CREATE TABLE ai_task_estimations (
	estimation_id UUID NOT NULL,
	task_id UUID NOT NULL,
	project_id UUID NOT NULL,
	estimated_hours NUMERIC(6, 2) NOT NULL,
	estimated_cost NUMERIC(12, 2),
	complexity VARCHAR(10) NOT NULL,
	story_points INTEGER,
	ai_reasoning TEXT,
	prompt TEXT NOT NULL,
	ai_model VARCHAR(100) NOT NULL,
	confidence_score NUMERIC(5, 2),
	organization_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (estimation_id),
	CONSTRAINT ck_ai_task_estimations_hours_nonneg CHECK (estimated_hours >= 0),
	CONSTRAINT ck_ai_task_estimations_cost_nonneg CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
	CONSTRAINT ck_ai_task_estimations_complexity CHECK (complexity IN ('Low', 'Medium', 'High')),
	CONSTRAINT ck_ai_task_estimations_story_points_nonneg CHECK (story_points IS NULL OR story_points >= 0),
	CONSTRAINT ck_ai_task_estimations_confidence_range CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
	FOREIGN KEY(task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_task_estimations_organization_id ON ai_task_estimations (organization_id);
CREATE INDEX ix_ai_task_estimations_project_id ON ai_task_estimations (project_id);
CREATE INDEX ix_ai_task_estimations_task_id ON ai_task_estimations (task_id);

-- table: chat_conversations
CREATE TABLE chat_conversations (
	conversation_id UUID NOT NULL,
	conversation_type VARCHAR(16) NOT NULL,
	name VARCHAR(150),
	team_id UUID,
	direct_key VARCHAR(73),
	created_by UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (conversation_id),
	CONSTRAINT uq_chat_conversations_team UNIQUE (team_id),
	FOREIGN KEY(team_id) REFERENCES teams (team_id) ON DELETE CASCADE,
	UNIQUE (direct_key),
	FOREIGN KEY(created_by) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_conversations_organization_id ON chat_conversations (organization_id);
CREATE INDEX ix_chat_conversations_team_id ON chat_conversations (team_id);

-- table: gantt_tasks
CREATE TABLE gantt_tasks (
	gantt_id UUID NOT NULL,
	project_id UUID NOT NULL,
	task_id UUID NOT NULL,
	dependency_task UUID,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	progress NUMERIC(5, 2) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (gantt_id),
	CONSTRAINT ck_gantt_tasks_date_range CHECK (end_date >= start_date),
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
	FOREIGN KEY(dependency_task) REFERENCES gantt_tasks (gantt_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_gantt_tasks_dependency_task ON gantt_tasks (dependency_task);
CREATE INDEX ix_gantt_tasks_organization_id ON gantt_tasks (organization_id);
CREATE INDEX ix_gantt_tasks_project_id ON gantt_tasks (project_id);
CREATE INDEX ix_gantt_tasks_task_id ON gantt_tasks (task_id);

-- table: kanban_tasks
CREATE TABLE kanban_tasks (
	kanban_task_id UUID NOT NULL,
	task_id UUID NOT NULL,
	column_id UUID NOT NULL,
	position INTEGER NOT NULL,
	moved_by UUID,
	moved_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (kanban_task_id),
	UNIQUE (task_id),
	FOREIGN KEY(task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
	FOREIGN KEY(column_id) REFERENCES kanban_columns (column_id) ON DELETE CASCADE,
	FOREIGN KEY(moved_by) REFERENCES users (user_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_kanban_tasks_column_id ON kanban_tasks (column_id);
CREATE INDEX ix_kanban_tasks_moved_by ON kanban_tasks (moved_by);
CREATE INDEX ix_kanban_tasks_organization_id ON kanban_tasks (organization_id);

-- table: team_members
CREATE TABLE team_members (
	member_id UUID NOT NULL,
	team_id UUID NOT NULL,
	user_id UUID NOT NULL,
	joined_at DATE DEFAULT CURRENT_DATE NOT NULL,
	responsibility VARCHAR(100),
	organization_id UUID NOT NULL,
	PRIMARY KEY (member_id),
	CONSTRAINT uq_team_members UNIQUE (team_id, user_id),
	FOREIGN KEY(team_id) REFERENCES teams (team_id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_team_members_organization_id ON team_members (organization_id);
CREATE INDEX ix_team_members_team_id ON team_members (team_id);
CREATE INDEX ix_team_members_user_id ON team_members (user_id);

-- table: chat_conversation_favorites
CREATE TABLE chat_conversation_favorites (
	favorite_id UUID NOT NULL,
	conversation_id UUID NOT NULL,
	user_id UUID NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (favorite_id),
	CONSTRAINT uq_chat_favorite_user_conversation UNIQUE (conversation_id, user_id),
	FOREIGN KEY(conversation_id) REFERENCES chat_conversations (conversation_id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_conversation_favorites_conversation_id ON chat_conversation_favorites (conversation_id);
CREATE INDEX ix_chat_conversation_favorites_organization_id ON chat_conversation_favorites (organization_id);
CREATE INDEX ix_chat_conversation_favorites_user_id ON chat_conversation_favorites (user_id);

-- table: chat_conversation_members
CREATE TABLE chat_conversation_members (
	conversation_id UUID NOT NULL,
	user_id UUID NOT NULL,
	joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	last_read_at TIMESTAMP WITH TIME ZONE,
	is_group_admin BOOLEAN DEFAULT 'false' NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (conversation_id, user_id),
	FOREIGN KEY(conversation_id) REFERENCES chat_conversations (conversation_id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_conversation_members_organization_id ON chat_conversation_members (organization_id);
CREATE INDEX ix_chat_conversation_members_user_id ON chat_conversation_members (user_id);

-- table: chat_messages
CREATE TABLE chat_messages (
	message_id UUID NOT NULL,
	conversation_id UUID NOT NULL,
	sender_id UUID NOT NULL,
	body TEXT NOT NULL,
	message_type VARCHAR(20) DEFAULT 'TEXT' NOT NULL,
	attachment_filename VARCHAR(255),
	attachment_mime_type VARCHAR(255),
	attachment_original_name VARCHAR(255),
	reply_to_message_id UUID,
	sent_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (message_id),
	FOREIGN KEY(conversation_id) REFERENCES chat_conversations (conversation_id) ON DELETE CASCADE,
	FOREIGN KEY(sender_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(reply_to_message_id) REFERENCES chat_messages (message_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_messages_conversation_id ON chat_messages (conversation_id);
CREATE INDEX ix_chat_messages_conversation_sent ON chat_messages (conversation_id, sent_at);
CREATE INDEX ix_chat_messages_organization_id ON chat_messages (organization_id);
CREATE INDEX ix_chat_messages_reply_to_message_id ON chat_messages (reply_to_message_id);
CREATE INDEX ix_chat_messages_sender_id ON chat_messages (sender_id);

-- table: notifications
CREATE TABLE notifications (
	notification_id UUID NOT NULL,
	user_id UUID NOT NULL,
	project_id UUID,
	chat_conversation_id UUID,
	title VARCHAR(255) NOT NULL,
	message TEXT NOT NULL,
	notification_type VARCHAR(50) NOT NULL,
	is_read BOOLEAN NOT NULL,
	sent_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (notification_id),
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
	FOREIGN KEY(chat_conversation_id) REFERENCES chat_conversations (conversation_id) ON DELETE SET NULL,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_notifications_chat_conversation_id ON notifications (chat_conversation_id);
CREATE INDEX ix_notifications_organization_id ON notifications (organization_id);
CREATE INDEX ix_notifications_project_id ON notifications (project_id);
CREATE INDEX ix_notifications_user_id ON notifications (user_id);

-- table: chat_message_reactions
CREATE TABLE chat_message_reactions (
	reaction_id UUID NOT NULL,
	message_id UUID NOT NULL,
	user_id UUID NOT NULL,
	emoji VARCHAR(16) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	organization_id UUID NOT NULL,
	PRIMARY KEY (reaction_id),
	CONSTRAINT uq_chat_message_reaction_user UNIQUE (message_id, user_id, emoji),
	FOREIGN KEY(message_id) REFERENCES chat_messages (message_id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (user_id) ON DELETE CASCADE,
	FOREIGN KEY(organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_message_reactions_message_id ON chat_message_reactions (message_id);
CREATE INDEX ix_chat_message_reactions_organization_id ON chat_message_reactions (organization_id);
CREATE INDEX ix_chat_message_reactions_user_id ON chat_message_reactions (user_id);
