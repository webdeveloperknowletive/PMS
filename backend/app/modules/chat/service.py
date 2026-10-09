from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.modules.chat.model import ChatConversation, ChatConversationFavorite, ChatConversationMember, ChatMessage, ChatMessageReaction, ChatUserSetting
from app.modules.notifications.model import Notification, NotificationSetting
from app.modules.roles.model import Role, UserRole
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User

CHAT_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "chat"
ALLOWED_REACTIONS = {"👍", "👎", "❤️", "😂", "🎉", "👀"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _roles(db: Session, user_id: UUID) -> list[str]:
    return [row[0] for row in db.query(Role.role_name).join(UserRole, UserRole.role_id == Role.role_id)
            .filter(UserRole.user_id == user_id).order_by(Role.role_name).all()]


def _contact(db: Session, user: User) -> dict:
    return {"user_id": user.user_id, "name": user.name, "email": user.email,
            "profile_picture_url": user.profile_picture_url, "roles": _roles(db, user.user_id)}


def contacts(db: Session, current_user: User) -> list[dict]:
    users = db.query(User).filter(User.is_active.is_(True), User.user_id != current_user.user_id).order_by(User.name).all()
    return [_contact(db, user) for user in users]


def _conversation(db: Session, conversation_id: UUID) -> ChatConversation:
    conversation = db.get(ChatConversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return conversation


def _team_member_ids(db: Session, team_id: UUID) -> set[UUID]:
    member_ids = db.query(TeamMember.user_id).join(User, User.user_id == TeamMember.user_id).filter(
        TeamMember.team_id == team_id, User.is_active.is_(True)
    ).all()
    lead_ids = db.query(TeamLead.user_id).join(Team, Team.team_lead_id == TeamLead.team_lead_id).join(
        User, User.user_id == TeamLead.user_id
    ).filter(Team.team_id == team_id, User.is_active.is_(True)).all()
    return {row[0] for row in member_ids + lead_ids}


def _is_member(db: Session, conversation: ChatConversation, user_id: UUID) -> bool:
    if conversation.conversation_type == "DIRECT":
        return db.get(ChatConversationMember, (conversation.conversation_id, user_id)) is not None
    if conversation.created_by == user_id:
        return True
    if conversation.team_id:
        # Team group access follows current team membership, including later changes.
        return user_id in _team_member_ids(db, conversation.team_id)
    return db.get(ChatConversationMember, (conversation.conversation_id, user_id)) is not None


def _require_member(db: Session, conversation: ChatConversation, user_id: UUID) -> ChatConversationMember:
    if not _is_member(db, conversation, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat.")
    member = db.get(ChatConversationMember, (conversation.conversation_id, user_id))
    if member is None:
        member = ChatConversationMember(conversation_id=conversation.conversation_id, user_id=user_id, last_read_at=_now())
        db.add(member)
        db.commit()
    return member


def _effective_member_ids(db: Session, conversation: ChatConversation) -> set[UUID]:
    if conversation.team_id:
        return _team_member_ids(db, conversation.team_id) | {conversation.created_by}
    rows = db.query(ChatConversationMember.user_id).filter(
        ChatConversationMember.conversation_id == conversation.conversation_id
    ).all()
    return {row[0] for row in rows}


def _message_read(db: Session, message: ChatMessage, current_user_id: UUID | None = None) -> dict:
    sender = db.get(User, message.sender_id)
    quoted = db.get(ChatMessage, message.reply_to_message_id) if message.reply_to_message_id else None
    quoted_sender = db.get(User, quoted.sender_id) if quoted else None
    rows = db.query(ChatMessageReaction.emoji, ChatMessageReaction.user_id).filter(
        ChatMessageReaction.message_id == message.message_id
    ).all()
    reactions = {}
    for emoji, user_id in rows:
        item = reactions.setdefault(emoji, {"emoji": emoji, "count": 0, "reacted": False})
        item["count"] += 1
        item["reacted"] = item["reacted"] or user_id == current_user_id
    return {
        "message_id": message.message_id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_name": sender.name if sender else "Former member",
        "sender_roles": _roles(db, message.sender_id),
        "body": message.body,
        "message_type": message.message_type or "TEXT",
        "attachment_name": message.attachment_original_name,
        "attachment_url": f"/chat/conversations/{message.conversation_id}/messages/{message.message_id}/attachment" if message.attachment_filename else None,
        "sender_profile_picture_url": sender.profile_picture_url if sender else None,
        "reply_to_message_id": message.reply_to_message_id,
        "reply_to_sender_name": quoted_sender.name if quoted_sender else None,
        "reply_to_body": quoted.body if quoted else None,
        "reactions": list(reactions.values()),
        "sent_at": message.sent_at,
    }


def list_conversations(db: Session, current_user: User) -> list[dict]:
    user_team_ids = db.query(TeamMember.team_id).filter(TeamMember.user_id == current_user.user_id).union(
        db.query(Team.team_id).join(TeamLead, TeamLead.team_lead_id == Team.team_lead_id)
        .filter(TeamLead.user_id == current_user.user_id)
    )
    member_check = exists().where(
        ChatConversationMember.conversation_id == ChatConversation.conversation_id,
        ChatConversationMember.user_id == current_user.user_id,
    )
    conversations = db.query(ChatConversation).filter(or_(member_check, ChatConversation.team_id.in_(user_team_ids))) \
        .order_by(ChatConversation.created_at.desc()).all()
    favorite_ids = {row[0] for row in db.query(ChatConversationFavorite.conversation_id).filter(
        ChatConversationFavorite.user_id == current_user.user_id
    ).all()}

    results = []
    for conversation in conversations:
        if not _is_member(db, conversation, current_user.user_id):
            continue
        ids = _effective_member_ids(db, conversation)
        member_users = db.query(User).filter(User.user_id.in_(ids), User.is_active.is_(True)).order_by(User.name).all() if ids else []
        last_message = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation.conversation_id) \
            .order_by(ChatMessage.sent_at.desc()).first()
        member = db.get(ChatConversationMember, (conversation.conversation_id, current_user.user_id))
        unread_query = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation.conversation_id,
            ChatMessage.sender_id != current_user.user_id,
        )
        if member and member.last_read_at:
            unread_query = unread_query.filter(ChatMessage.sent_at > member.last_read_at)
        unread_count = unread_query.count()
        team = db.get(Team, conversation.team_id) if conversation.team_id else None
        if conversation.conversation_type in {"TEAM", "GROUP"}:
            display_name = conversation.name or (team.team_name if team else "Team chat")
            peer_id = None
            peer_picture = None
        else:
            peer_id = next((user_id for user_id in ids if user_id != current_user.user_id), None)
            peer = db.get(User, peer_id) if peer_id else None
            display_name = peer.name if peer else "Direct chat"
            peer_picture = peer.profile_picture_url if peer else None
        results.append({
            "conversation_id": conversation.conversation_id,
            "conversation_type": conversation.conversation_type,
            "name": display_name,
            "created_by_user_id": conversation.created_by,
            "peer_user_id": peer_id,
            "peer_profile_picture_url": peer_picture,
            "team_id": conversation.team_id,
            "team_name": team.team_name if team else None,
            "member_count": len(ids),
            "members": [_contact(db, member_user) for member_user in member_users],
            "unread_count": unread_count,
            "is_favorite": conversation.conversation_id in favorite_ids,
            "last_message": _message_read(db, last_message, current_user.user_id) if last_message else None,
            "created_at": conversation.created_at,
        })
    results.sort(key=lambda row: row["last_message"]["sent_at"] if row["last_message"] else row["created_at"], reverse=True)
    return results


def open_direct(db: Session, current_user: User, other_user_id: UUID) -> dict:
    if current_user.user_id == other_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose another organization member.")
    other = db.query(User).filter(User.user_id == other_user_id, User.is_active.is_(True)).first()
    if other is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization member not found.")
    low_id, high_id = sorted((str(current_user.user_id), str(other_user_id)))
    direct_key = f"{low_id}:{high_id}"
    conversation = db.query(ChatConversation).filter(ChatConversation.direct_key == direct_key).first()
    if conversation is None:
        conversation = ChatConversation(conversation_type="DIRECT", direct_key=direct_key, created_by=current_user.user_id)
        db.add(conversation)
        db.flush()
        now = _now()
        db.add_all([
            ChatConversationMember(conversation_id=conversation.conversation_id, user_id=current_user.user_id, last_read_at=now),
            ChatConversationMember(conversation_id=conversation.conversation_id, user_id=other_user_id, last_read_at=now),
        ])
        try:
            db.commit()
        except Exception:
            db.rollback()
            conversation = db.query(ChatConversation).filter(ChatConversation.direct_key == direct_key).first()
            if conversation is None:
                raise
    return next(row for row in list_conversations(db, current_user) if row["conversation_id"] == conversation.conversation_id)


def create_team_group(db: Session, current_user: User, team_id: UUID) -> dict:
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")
    existing = db.query(ChatConversation).filter(ChatConversation.team_id == team_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This team already has a group chat.")
    conversation = ChatConversation(
        conversation_type="TEAM", name=team.team_name, team_id=team.team_id, created_by=current_user.user_id,
    )
    db.add(conversation)
    db.flush()
    db.add(ChatConversationMember(conversation_id=conversation.conversation_id, user_id=current_user.user_id, last_read_at=_now()))
    recipients = _team_member_ids(db, team.team_id) - {current_user.user_id}
    if recipients:
        settings = {row.user_id: row.notifications_enabled for row in db.query(ChatUserSetting).filter(
            ChatUserSetting.user_id.in_(recipients)
        ).all()}
        db.add_all(Notification(
            user_id=user_id,
            project_id=None,
            chat_conversation_id=conversation.conversation_id,
            title=f"Team chat created: {team.team_name}"[:255],
            message=f"{current_user.name} created a group chat for your team.",
            notification_type="Chat Group Created",
        ) for user_id in recipients if settings.get(user_id, True))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This team already has a group chat.")
    return next(row for row in list_conversations(db, current_user) if row["conversation_id"] == conversation.conversation_id)


def create_group(db: Session, current_user: User, name: str, member_ids: list[UUID]) -> dict:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Enter a group name.")
    if not member_ids:
        raise HTTPException(status_code=422, detail="Choose at least one member for the group.")
    requested_ids = set(member_ids) | {current_user.user_id}
    active_users = db.query(User).filter(User.user_id.in_(requested_ids), User.is_active.is_(True)).all()
    active_ids = {user.user_id for user in active_users}
    if active_ids != requested_ids:
        raise HTTPException(status_code=404, detail="One or more selected organization members are unavailable.")
    conversation = ChatConversation(
        conversation_type="GROUP", name=name, created_by=current_user.user_id,
    )
    db.add(conversation)
    db.flush()
    now = _now()
    db.add_all(ChatConversationMember(
        conversation_id=conversation.conversation_id,
        user_id=user_id,
        last_read_at=now if user_id == current_user.user_id else None,
    ) for user_id in requested_ids)
    recipients = requested_ids - {current_user.user_id}
    settings = {row.user_id: row.notifications_enabled for row in db.query(ChatUserSetting).filter(
        ChatUserSetting.user_id.in_(recipients)
    ).all()} if recipients else {}
    db.add_all(Notification(
        user_id=user_id,
        project_id=None,
        chat_conversation_id=conversation.conversation_id,
        title=f"Added to group: {name}"[:255],
        message=f"{current_user.name} added you to the {name} chat group.",
        notification_type="Chat Group Created",
    ) for user_id in recipients if settings.get(user_id, True))
    db.commit()
    return next(row for row in list_conversations(db, current_user) if row["conversation_id"] == conversation.conversation_id)


def get_messages(db: Session, current_user: User, conversation_id: UUID, limit: int = 100) -> list[dict]:
    conversation = _conversation(db, conversation_id)
    member = _require_member(db, conversation, current_user.user_id)
    messages = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation_id) \
        .order_by(ChatMessage.sent_at.desc()).limit(min(max(limit, 1), 100)).all()
    latest_message = messages[0] if messages else None
    has_new_message = member.last_read_at is None or bool(
        latest_message and latest_message.sent_at > member.last_read_at
    )
    notifications_marked = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.chat_conversation_id == conversation_id,
        Notification.is_read.is_(False),
    ).update({Notification.is_read: True}, synchronize_session=False)
    if has_new_message or notifications_marked:
        member.last_read_at = _now()
        db.commit()
    return [_message_read(db, message, current_user.user_id) for message in reversed(messages)]


def send_message(db: Session, current_user: User, conversation_id: UUID, body: str, reply_to_message_id: UUID | None = None) -> dict:
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    body = body.strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Type a message before sending.")
    if reply_to_message_id and not db.query(ChatMessage).filter(
        ChatMessage.message_id == reply_to_message_id, ChatMessage.conversation_id == conversation_id
    ).first():
        raise HTTPException(status_code=404, detail="The message you are replying to was not found.")
    message = ChatMessage(conversation_id=conversation_id, sender_id=current_user.user_id, body=body,
                          reply_to_message_id=reply_to_message_id)
    db.add(message)
    db.flush()
    if conversation.conversation_type in {"TEAM", "GROUP"}:
        room_name = conversation.name or "group chat"
    else:
        room_name = "your direct chat"
    recipient_ids = _effective_member_ids(db, conversation) - {current_user.user_id}
    if recipient_ids:
        settings = {row.user_id: row.notifications_enabled for row in db.query(ChatUserSetting).filter(
            ChatUserSetting.user_id.in_(recipient_ids)
        ).all()}
        db.add_all(Notification(
            user_id=user_id,
            project_id=None,
            title=f"New message in {room_name}"[:255],
            message=f"{current_user.name}: {body[:220]}",
            notification_type="Chat Message",
            chat_conversation_id=conversation.conversation_id,
        ) for user_id in recipient_ids if settings.get(user_id, True))
    db.commit()
    db.refresh(message)
    return _message_read(db, message, current_user.user_id)


def delete_message(db: Session, current_user: User, conversation_id: UUID, message_id: UUID) -> None:
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    message = db.query(ChatMessage).filter(ChatMessage.message_id == message_id,
                                           ChatMessage.conversation_id == conversation_id).first()
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    if message.sender_id != current_user.user_id and not has_permission(db, current_user, "roles.manage"):
        raise HTTPException(status_code=403, detail="You can delete only your own messages.")
    attachment = CHAT_UPLOAD_DIR / Path(message.attachment_filename).name if message.attachment_filename else None
    db.delete(message)
    db.commit()
    if attachment:
        attachment.unlink(missing_ok=True)


def toggle_reaction(db: Session, current_user: User, conversation_id: UUID, message_id: UUID, emoji: str) -> dict:
    if emoji not in ALLOWED_REACTIONS:
        raise HTTPException(status_code=422, detail="Choose one of the available reactions.")
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    message = db.query(ChatMessage).filter(ChatMessage.message_id == message_id,
                                           ChatMessage.conversation_id == conversation_id).first()
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    reaction = db.query(ChatMessageReaction).filter_by(message_id=message_id, user_id=current_user.user_id, emoji=emoji).first()
    if reaction:
        db.delete(reaction)
    else:
        db.add(ChatMessageReaction(message_id=message_id, user_id=current_user.user_id, emoji=emoji))
    db.commit()
    db.refresh(message)
    return _message_read(db, message, current_user.user_id)


async def send_attachment(db: Session, current_user: User, conversation_id: UUID, upload: UploadFile) -> dict:
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    original_name = Path(upload.filename or "attachment").name.replace("\x00", "")[:255] or "attachment"
    mime_type = upload.content_type or "application/octet-stream"
    kind = "AUDIO" if mime_type.startswith("audio/") else "IMAGE" if mime_type.startswith("image/") else "FILE"
    stored_name = f"{uuid4().hex}.bin"
    CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = CHAT_UPLOAD_DIR / stored_name
    try:
        with path.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                output.write(chunk)
        if path.stat().st_size == 0:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="The selected file is empty.")
        label = "Voice message" if kind == "AUDIO" else "Image" if kind == "IMAGE" else original_name
        message = ChatMessage(conversation_id=conversation_id, sender_id=current_user.user_id, body=label,
                              message_type=kind, attachment_filename=stored_name,
                              attachment_mime_type=mime_type, attachment_original_name=original_name)
        db.add(message)
        db.flush()
        recipients = _effective_member_ids(db, conversation) - {current_user.user_id}
        if recipients:
            prefs = {row.user_id: row.notifications_enabled for row in db.query(ChatUserSetting).filter(ChatUserSetting.user_id.in_(recipients)).all()}
            room = conversation.name or "your direct chat"
            db.add_all(Notification(user_id=user_id, project_id=None, chat_conversation_id=conversation_id,
                                    title=f"New message in {room}"[:255],
                                    message=f"{current_user.name} sent {label}"[:255],
                                    notification_type="Chat Message")
                        for user_id in recipients if prefs.get(user_id, True))
        db.commit()
        db.refresh(message)
        return _message_read(db, message)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise


def attachment_path(db: Session, current_user: User, conversation_id: UUID, message_id: UUID) -> tuple[Path, str, str]:
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    message = db.query(ChatMessage).filter(ChatMessage.message_id == message_id,
                                           ChatMessage.conversation_id == conversation_id).first()
    if not message or not message.attachment_filename:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    path = CHAT_UPLOAD_DIR / Path(message.attachment_filename).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file is missing.")
    return path, message.attachment_original_name or "attachment", message.attachment_mime_type or "application/octet-stream"


def get_settings(db: Session, current_user: User) -> dict:
    setting = db.get(ChatUserSetting, current_user.user_id)
    return {"notifications_enabled": setting.notifications_enabled if setting else True,
            "volume_percent": setting.volume_percent if setting else 70,
            "font_size": setting.font_size if setting else "medium",
            "theme": setting.theme if setting else "light"}


def update_settings(db: Session, current_user: User, notifications_enabled: bool, volume_percent: int,
                    font_size: str = "medium", theme: str = "light") -> dict:
    setting = db.get(ChatUserSetting, current_user.user_id)
    if setting is None:
        setting = ChatUserSetting(user_id=current_user.user_id, notifications_enabled=notifications_enabled,
                                  volume_percent=volume_percent, font_size=font_size, theme=theme)
        db.add(setting)
    else:
        setting.notifications_enabled = notifications_enabled
        setting.volume_percent = volume_percent
        setting.font_size = font_size
        setting.theme = theme
    db.commit()
    return {"notifications_enabled": notifications_enabled, "volume_percent": volume_percent,
            "font_size": font_size, "theme": theme}


def update_favorite(db: Session, current_user: User, conversation_id: UUID, is_favorite: bool) -> dict:
    conversation = _conversation(db, conversation_id)
    _require_member(db, conversation, current_user.user_id)
    favorite = db.query(ChatConversationFavorite).filter_by(
        conversation_id=conversation_id, user_id=current_user.user_id
    ).first()
    if is_favorite and favorite is None:
        db.add(ChatConversationFavorite(conversation_id=conversation_id, user_id=current_user.user_id))
    elif not is_favorite and favorite is not None:
        db.delete(favorite)
    db.commit()
    return {"is_favorite": is_favorite}


def get_organization_settings(db: Session) -> dict:
    sound = db.get(NotificationSetting, "chat_sound_key")
    volume = db.get(NotificationSetting, "chat_master_volume_percent")
    return {"sound_key": sound.setting_value if sound else "double_ping",
            "master_volume_percent": int(volume.setting_value) if volume else 100}


def update_organization_settings(db: Session, sound_key: str, master_volume_percent: int) -> dict:
    values = {"chat_sound_key": sound_key, "chat_master_volume_percent": str(master_volume_percent)}
    for key, value in values.items():
        setting = db.get(NotificationSetting, key)
        if setting is None:
            db.add(NotificationSetting(setting_key=key, setting_value=value))
        else:
            setting.setting_value = value
    db.commit()
    return get_organization_settings(db)
