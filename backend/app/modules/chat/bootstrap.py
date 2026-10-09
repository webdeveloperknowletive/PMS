"""Create additive chat tables for existing installations."""

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.chat.model import ChatConversation, ChatConversationFavorite, ChatConversationMember, ChatMessage, ChatMessageReaction, ChatUserSetting
from app.modules.notifications.model import NotificationSetting


def ensure_chat_schema() -> None:
    for table in (ChatConversation.__table__, ChatConversationMember.__table__, ChatMessage.__table__, ChatMessageReaction.__table__, ChatUserSetting.__table__, ChatConversationFavorite.__table__):
        table.create(bind=engine, checkfirst=True)
    with engine.begin() as connection:
        if inspect(connection).has_table("notifications"):
            columns = {column["name"] for column in inspect(connection).get_columns("notifications")}
            if "chat_conversation_id" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE notifications ADD COLUMN chat_conversation_id UUID "
                    "REFERENCES chat_conversations(conversation_id) ON DELETE SET NULL"
                )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_notifications_chat_conversation_id "
                "ON notifications (chat_conversation_id)"
            )
        if inspect(connection).has_table("chat_messages"):
            columns = {column["name"] for column in inspect(connection).get_columns("chat_messages")}
            additions = {
                "message_type": "VARCHAR(20) NOT NULL DEFAULT 'TEXT'",
                "attachment_filename": "VARCHAR(255)",
                "attachment_mime_type": "VARCHAR(255)",
                "attachment_original_name": "VARCHAR(255)",
                "reply_to_message_id": "UUID REFERENCES chat_messages(message_id) ON DELETE SET NULL",
            }
            for column_name, definition in additions.items():
                if column_name not in columns:
                    connection.exec_driver_sql(f"ALTER TABLE chat_messages ADD COLUMN {column_name} {definition}")
        if inspect(connection).has_table("chat_user_settings"):
            columns = {column["name"] for column in inspect(connection).get_columns("chat_user_settings")}
            if "volume_percent" not in columns:
                connection.exec_driver_sql("ALTER TABLE chat_user_settings ADD COLUMN volume_percent INTEGER NOT NULL DEFAULT 70")
            if "font_size" not in columns:
                connection.exec_driver_sql("ALTER TABLE chat_user_settings ADD COLUMN font_size VARCHAR(12) NOT NULL DEFAULT 'medium'")
            if "theme" not in columns:
                connection.exec_driver_sql("ALTER TABLE chat_user_settings ADD COLUMN theme VARCHAR(8) NOT NULL DEFAULT 'light'")

    with Session(bind=engine) as db:
        changed = False
        for key, value in (("chat_sound_key", "double_ping"), ("chat_master_volume_percent", "100")):
            if db.get(NotificationSetting, key) is None:
                db.add(NotificationSetting(setting_key=key, setting_value=value))
                changed = True
        if changed:
            db.commit()
