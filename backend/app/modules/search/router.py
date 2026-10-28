from fastapi import APIRouter, Depends, Query
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import has_permission, is_system_role_assigned
from app.modules.audit.model import AuditEvent
from app.modules.calendar.model import CalendarEvent
from app.modules.chat.model import ChatConversation, ChatConversationMember, ChatMessage
from app.modules.documentation.model import Document
from app.modules.projects import service as project_service
from app.modules.projects.model import Project, ProjectGoal, ProjectRelease
from app.modules.reports.model import Report
from app.modules.tasks import service as task_service
from app.modules.roles.model import Role, UserRole
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User


router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(8, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    term = q.strip()
    if len(term) < 2:
        return []
    per_category = max(1, (limit + 9) // 10)
    escaped = term.replace("!", "!!").replace("%", "!%").replace("_", "!_")
    pattern = f"%{escaped}%"
    projects = project_service.get_projects(db, current_user, skip=0, limit=500)
    project_by_id = {project.project_id: project for project in projects}
    project_ids = set(project_by_id)
    results: list[dict] = []

    for task in task_service.get_tasks(db, current_user=current_user, limit=per_category, search=term):
        if task.project_id in project_ids:
            results.append({"id": str(task.task_id), "type": "Task", "title": task.task_name,
                            "subtitle": project_by_id[task.project_id].project_name, "href": f"/projects/{task.project_id}#project-work"})
    project_matches = [project for project in projects if term.casefold() in project.project_name.casefold() or term.casefold() in (project.description or "").casefold()]
    for project in project_matches[:per_category]:
        results.append({"id": str(project.project_id), "type": "Project", "title": project.project_name,
                        "subtitle": project.status, "href": f"/projects/{project.project_id}"})

    for goal in db.query(ProjectGoal).filter(
        ProjectGoal.organization_id == current_user.organization_id,
        ProjectGoal.project_id.in_(project_ids) if project_ids else False,
        ProjectGoal.name.ilike(pattern, escape="!"),
    ).limit(per_category).all():
        results.append({"id": str(goal.goal_id), "type": "Goal", "title": goal.name,
                        "subtitle": project_by_id[goal.project_id].project_name, "href": f"/projects/{goal.project_id}#project-goals"})
    for release in db.query(ProjectRelease).filter(
        ProjectRelease.organization_id == current_user.organization_id,
        ProjectRelease.project_id.in_(project_ids) if project_ids else False,
        ProjectRelease.name.ilike(pattern, escape="!"),
    ).limit(per_category).all():
        results.append({"id": str(release.release_id), "type": "Release", "title": release.name,
                        "subtitle": project_by_id[release.project_id].project_name, "href": f"/projects/{release.project_id}#project-releases"})

    if project_ids and has_permission(db, current_user, "documents.view"):
        for document in db.query(Document).filter(
            Document.organization_id == current_user.organization_id,
            Document.project_id.in_(project_ids),
            Document.title.ilike(pattern, escape="!"),
        ).limit(per_category).all():
            results.append({"id": str(document.document_id), "type": "Document", "title": document.title,
                            "subtitle": project_by_id[document.project_id].project_name, "href": "/documentation"})
    if project_ids and has_permission(db, current_user, "reports.view"):
        for report in db.query(Report).filter(
            Report.organization_id == current_user.organization_id,
            Report.project_id.in_(project_ids),
            Report.report_name.ilike(pattern, escape="!"),
        ).limit(per_category).all():
            results.append({"id": str(report.report_id), "type": "Report", "title": report.report_name,
                            "subtitle": project_by_id[report.project_id].project_name, "href": "/reports"})

    if has_permission(db, current_user, "users.view"):
        people_query = db.query(User).filter(
            User.organization_id == current_user.organization_id,
            User.is_active.is_(True),
            or_(User.name.ilike(pattern, escape="!"), User.email.ilike(pattern, escape="!")),
        )
        if not is_system_role_assigned(db, current_user):
            people_query = people_query.filter(
                ~User.user_roles.any(UserRole.role.has(Role.is_system.is_(True)))
            )
        for person in people_query.order_by(User.name.asc()).limit(per_category).all():
            results.append({"id": str(person.user_id), "type": "Person", "title": person.name,
                            "subtitle": "Workspace member", "href": "/users"})

    if has_permission(db, current_user, "calendar.view"):
        visible_calendar_event = or_(
            CalendarEvent.calendar_scope == "ORGANIZATION",
            (CalendarEvent.calendar_scope == "PERSONAL") & (CalendarEvent.calendar_owner_id == current_user.user_id),
        )
        for event in db.query(CalendarEvent).filter(
            CalendarEvent.organization_id == current_user.organization_id,
            visible_calendar_event,
            or_(CalendarEvent.title.ilike(pattern, escape="!"), CalendarEvent.description.ilike(pattern, escape="!")),
        ).order_by(CalendarEvent.start_datetime.asc()).limit(per_category).all():
            results.append({"id": str(event.event_id), "type": "Event", "title": event.title,
                            "subtitle": event.event_type, "href": "/calendar"})

    if has_permission(db, current_user, "chat.conversations.view") and has_permission(db, current_user, "chat.messages.view"):
        user_team_ids = db.query(TeamMember.team_id).filter(
            TeamMember.user_id == current_user.user_id,
            TeamMember.organization_id == current_user.organization_id,
        ).union(
            db.query(Team.team_id).join(TeamLead, TeamLead.team_lead_id == Team.team_lead_id).filter(
                TeamLead.user_id == current_user.user_id,
                Team.organization_id == current_user.organization_id,
            )
        )
        is_chat_member = exists().where(
            ChatConversationMember.conversation_id == ChatConversation.conversation_id,
            ChatConversationMember.user_id == current_user.user_id,
            ChatConversationMember.organization_id == current_user.organization_id,
        )
        visible_chat = or_(
            is_chat_member,
            ChatConversation.team_id.in_(user_team_ids),
            ChatConversation.created_by == current_user.user_id,
        )
        messages = db.query(ChatMessage, ChatConversation, User.name).join(
            ChatConversation, ChatConversation.conversation_id == ChatMessage.conversation_id,
        ).join(User, User.user_id == ChatMessage.sender_id).filter(
            ChatMessage.organization_id == current_user.organization_id,
            ChatConversation.organization_id == current_user.organization_id,
            visible_chat,
            ChatMessage.body.ilike(pattern, escape="!"),
        ).order_by(ChatMessage.sent_at.desc()).limit(per_category).all()
        for message, conversation, sender_name in messages:
            title = message.body.strip().replace("\n", " ")
            if len(title) > 120:
                title = title[:117] + "…"
            results.append({"id": str(message.message_id), "type": "Chat message", "title": title,
                            "subtitle": conversation.name or f"Direct chat · {sender_name}",
                            "href": "/chat", "action": "OPEN_CHAT",
                            "conversation_id": str(conversation.conversation_id)})

    if has_permission(db, current_user, "roles.manage"):
        for event in db.query(AuditEvent).filter(
            AuditEvent.organization_id == current_user.organization_id,
            or_(AuditEvent.actor_name.ilike(pattern, escape="!"), AuditEvent.path.ilike(pattern, escape="!")),
        ).order_by(AuditEvent.created_at.desc()).limit(per_category).all():
            results.append({"id": str(event.event_id), "type": "Audit event",
                            "title": f"{event.method} {event.path}",
                            "subtitle": f"{event.actor_name} · {event.status_code}", "href": "/audit-logs"})

    return results[:limit]
