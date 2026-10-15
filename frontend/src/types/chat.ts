export interface ChatContact {
  user_id: string;
  name: string;
  email: string;
  profile_picture_url?: string | null;
  roles: string[];
  is_group_admin?: boolean;
}

export interface ChatMessage {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_roles: string[];
  body: string;
  message_type: "TEXT" | "IMAGE" | "FILE" | "AUDIO";
  attachment_name: string | null;
  attachment_url: string | null;
  sender_profile_picture_url: string | null;
  reply_to_message_id: string | null;
  reply_to_sender_name: string | null;
  reply_to_body: string | null;
  reactions: ChatReaction[];
  sent_at: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface ChatConversation {
  conversation_id: string;
  conversation_type: "DIRECT" | "TEAM" | "GROUP";
  name: string;
  created_by_user_id: string;
  peer_user_id?: string | null;
  peer_profile_picture_url?: string | null;
  team_id: string | null;
  team_name: string | null;
  member_count: number;
  members: ChatContact[];
  unread_count: number;
  is_favorite: boolean;
  last_message: ChatMessage | null;
  created_at: string;
}

export interface ChatSettings {
  notifications_enabled: boolean;
  volume_percent: number;
  font_size: "small" | "medium" | "large";
  theme: "light" | "dark";
}

export interface ChatOrganizationSettings {
  sound_key: string;
  master_volume_percent: number;
}
