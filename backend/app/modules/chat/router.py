from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.modules.chat import service
from app.modules.chat.schema import (
    ChatContactRead,
    ChatConversationRead,
    ChatGroupCreate,
    ChatMessageCreate,
    ChatMessageRead,
    ChatFavoriteRead,
    ChatFavoriteUpdate,
    ChatReactionUpdate,
    ChatOrganizationSettingsRead,
    ChatOrganizationSettingsUpdate,
    ChatSettingsRead,
    ChatSettingsUpdate,
)
from app.modules.roles.permissions import can_manage_roles
from app.modules.users.model import User
from db.session import get_db

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/contacts", response_model=list[ChatContactRead])
async def get_chat_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.contacts(db, current_user)


@router.get("/conversations", response_model=list[ChatConversationRead])
async def get_chat_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_conversations(db, current_user)


@router.post("/direct/{other_user_id}", response_model=ChatConversationRead, status_code=status.HTTP_200_OK)
async def open_direct_chat(other_user_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.open_direct(db, current_user, other_user_id)


@router.put("/conversations/{conversation_id}/favorite", response_model=ChatFavoriteRead)
async def update_chat_favorite(conversation_id: UUID, payload: ChatFavoriteUpdate,
                               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.update_favorite(db, current_user, conversation_id, payload.is_favorite)


@router.post("/groups", response_model=ChatConversationRead, status_code=status.HTTP_201_CREATED)
async def create_team_chat(payload: ChatGroupCreate, current_user: User = Depends(can_manage_roles), db: Session = Depends(get_db)):
    if payload.team_id:
        return service.create_team_group(db, current_user, payload.team_id)
    return service.create_group(db, current_user, payload.name or "", payload.member_ids)


@router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageRead])
async def get_chat_messages(
    conversation_id: UUID,
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_messages(db, current_user, conversation_id, limit)


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
async def send_chat_message(
    conversation_id: UUID,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.send_message(db, current_user, conversation_id, payload.body, payload.reply_to_message_id)


@router.post("/conversations/{conversation_id}/attachments", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
async def send_chat_attachment(
    conversation_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await service.send_attachment(db, current_user, conversation_id, file)


@router.delete("/conversations/{conversation_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_message(conversation_id: UUID, message_id: UUID,
                              current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service.delete_message(db, current_user, conversation_id, message_id)


@router.post("/conversations/{conversation_id}/messages/{message_id}/reactions", response_model=ChatMessageRead)
async def toggle_chat_reaction(conversation_id: UUID, message_id: UUID, payload: ChatReactionUpdate,
                               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.toggle_reaction(db, current_user, conversation_id, message_id, payload.emoji)


@router.get("/conversations/{conversation_id}/messages/{message_id}/attachment")
async def get_chat_attachment(
    conversation_id: UUID,
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path, filename, media_type = service.attachment_path(db, current_user, conversation_id, message_id)
    return FileResponse(path, media_type=media_type, filename=filename, content_disposition_type="attachment")


@router.get("/settings", response_model=ChatSettingsRead)
async def get_chat_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_settings(db, current_user)


@router.put("/settings", response_model=ChatSettingsRead)
async def update_chat_settings(
    payload: ChatSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_settings(db, current_user, payload.notifications_enabled, payload.volume_percent,
                                   payload.font_size, payload.theme)


@router.get("/settings/organization", response_model=ChatOrganizationSettingsRead)
async def get_chat_organization_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_organization_settings(db)


@router.put("/settings/organization", response_model=ChatOrganizationSettingsRead)
async def update_chat_organization_settings(
    payload: ChatOrganizationSettingsUpdate,
    current_user: User = Depends(can_manage_roles),
    db: Session = Depends(get_db),
):
    return service.update_organization_settings(db, payload.sound_key, payload.master_volume_percent)
