import { apiClient } from "./client";
import type { ChatContact, ChatConversation, ChatMessage, ChatOrganizationSettings, ChatSettings } from "@/types/chat";

export const chatApi = {
  contacts: async (): Promise<ChatContact[]> =>
    (await apiClient.get<ChatContact[]>("/chat/contacts")).data,
  conversations: async (): Promise<ChatConversation[]> =>
    (await apiClient.get<ChatConversation[]>("/chat/conversations")).data,
  openDirect: async (userId: string): Promise<ChatConversation> =>
    (await apiClient.post<ChatConversation>(`/chat/direct/${userId}`)).data,
  createGroup: async (name: string, memberIds: string[]): Promise<ChatConversation> =>
    (await apiClient.post<ChatConversation>("/chat/groups", { name, member_ids: memberIds })).data,
  updateFavorite: async (conversationId: string, isFavorite: boolean): Promise<{ is_favorite: boolean }> =>
    (await apiClient.put<{ is_favorite: boolean }>(`/chat/conversations/${conversationId}/favorite`, { is_favorite: isFavorite })).data,
  promoteGroupAdmin: async (conversationId: string, userId: string): Promise<ChatConversation> =>
    (await apiClient.put<ChatConversation>(`/chat/conversations/${conversationId}/members/${userId}/admin`)).data,
  messages: async (conversationId: string): Promise<ChatMessage[]> =>
    (await apiClient.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`)).data,
  sendMessage: async (conversationId: string, body: string, replyToMessageId?: string): Promise<ChatMessage> =>
    (await apiClient.post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, { body, reply_to_message_id: replyToMessageId ?? null })).data,
  deleteMessage: async (conversationId: string, messageId: string): Promise<void> =>
    (await apiClient.delete(`/chat/conversations/${conversationId}/messages/${messageId}`)).data,
  toggleReaction: async (conversationId: string, messageId: string, emoji: string): Promise<ChatMessage> =>
    (await apiClient.post<ChatMessage>(`/chat/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji })).data,
  settings: async (): Promise<ChatSettings> =>
    (await apiClient.get<ChatSettings>("/chat/settings")).data,
  updateSettings: async (settings: ChatSettings): Promise<ChatSettings> =>
    (await apiClient.put<ChatSettings>("/chat/settings", settings)).data,
  organizationSettings: async (): Promise<ChatOrganizationSettings> =>
    (await apiClient.get<ChatOrganizationSettings>("/chat/settings/organization")).data,
  updateOrganizationSettings: async (settings: ChatOrganizationSettings): Promise<ChatOrganizationSettings> =>
    (await apiClient.put<ChatOrganizationSettings>("/chat/settings/organization", settings)).data,
  uploadAttachment: async (conversationId: string, file: File): Promise<ChatMessage> => {
    const data = new FormData();
    data.append("file", file);
    return (await apiClient.post<ChatMessage>(`/chat/conversations/${conversationId}/attachments`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  attachment: async (conversationId: string, messageId: string): Promise<Blob> =>
    (await apiClient.get<Blob>(`/chat/conversations/${conversationId}/messages/${messageId}/attachment`, { responseType: "blob" })).data,
};
