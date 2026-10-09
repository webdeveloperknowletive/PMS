"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, FileText, MessageCircle, Mic, Paperclip, Plus, Search, Send, Settings2, Smile, Square, Star, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import { chatApi } from "@/lib/api/chat";
import { getApiErrorMessage } from "@/lib/api/client";
import type { ChatContact, ChatConversation, ChatMessage, ChatSettings } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { playNotificationSound } from "@/lib/notification-sound";

type ChatScreen = "inbox" | "contacts" | "groups" | "settings" | "thread";
type ConversationFilter = "all" | "unread" | "favorites" | "groups";
const CHAT_QUERY_KEY = ["chat-conversations"];
const CHAT_REACTIONS = ["👍", "👎", "❤️", "😂", "🎉", "👀"] as const;

function ChatAttachment({ message, conversationId }: { message: NonNullable<ChatConversation["last_message"]>; conversationId: string }) {
  const file = useQuery({ queryKey: ["chat-attachment", conversationId, message.message_id], queryFn: () => chatApi.attachment(conversationId, message.message_id), enabled: !!message.attachment_url, staleTime: 10 * 60_000 });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.data) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(file.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file.data]);
  if (!message.attachment_url) return null;
  if (file.isLoading) return <p className="my-1 text-xs opacity-70">Loading attachment…</p>;
  if (!url) return <p className="my-1 text-xs opacity-70">Attachment unavailable</p>;
  if (message.message_type === "IMAGE") return <img src={url} alt={message.attachment_name ?? "Chat image"} className="my-1 max-h-48 max-w-[220px] rounded-lg object-contain" />;
  if (message.message_type === "AUDIO") return <audio controls src={url} className="my-2 max-w-[230px]" />;
  return <a href={url} download={message.attachment_name ?? "attachment"} className="my-1 flex items-center gap-2 rounded-lg bg-black/5 p-2 text-xs underline"><FileText className="h-4 w-4 shrink-0" /><span className="max-w-44 truncate">{message.attachment_name ?? "Download file"}</span></a>;
}

function displayRoles(roles: string[]) {
  return roles.length ? `(${roles.join(", ")})` : "(Member)";
}

function chatDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function chatDayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (chatDayKey(value) === chatDayKey(today.toISOString())) return "Today";
  if (chatDayKey(value) === chatDayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function ChatWidget() {
  const user = useAuthStore((state) => state.user);
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<ChatScreen>("inbox");
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [groupMembersOpen, setGroupMembersOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const widgetRoot = useRef<HTMLDivElement>(null);
  const emojiPickerRoot = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recorderStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const conversations = useQuery({
    queryKey: CHAT_QUERY_KEY,
    queryFn: chatApi.conversations,
    enabled: !!user,
    refetchInterval: open ? 1200 : 3500,
  });
  const activeConversation = conversations.data?.find((item) => item.conversation_id === activeId) ?? null;

  const contacts = useQuery({
    queryKey: ["chat-contacts"],
    queryFn: chatApi.contacts,
    enabled: open && (screen === "contacts" || screen === "inbox" || screen === "groups"),
  });
  const settings = useQuery({
    queryKey: ["chat-settings", user?.user_id],
    queryFn: chatApi.settings,
    enabled: !!user,
  });
  const orgSettings = useQuery({
    queryKey: ["chat-organization-settings"],
    queryFn: chatApi.organizationSettings,
    enabled: open && screen === "settings" && isAdmin,
  });
  const messages = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () => chatApi.messages(activeId!),
    enabled: open && screen === "thread" && !!activeId,
    refetchInterval: 1000,
  });
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("chat-window-state", { detail: open }));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!widgetRoot.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  useEffect(() => {
    if (!reactionMessageId && !contextMenu) return;
    const closeMessagePopups = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (reactionMessageId && !target.closest(`[data-chat-message-id="${reactionMessageId}"]`)) {
        setReactionMessageId(null);
      }
      if (contextMenu && !target.closest("[data-chat-context-menu]")) {
        setContextMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeMessagePopups);
    return () => document.removeEventListener("pointerdown", closeMessagePopups);
  }, [reactionMessageId, contextMenu]);
  useEffect(() => {
    if (!emojiPickerOpen) return;
    const closeEmojiPicker = (event: PointerEvent) => {
      if (!emojiPickerRoot.current?.contains(event.target as Node)) setEmojiPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeEmojiPicker);
    return () => document.removeEventListener("pointerdown", closeEmojiPicker);
  }, [emojiPickerOpen]);
  useEffect(() => {
    if (!groupMembersOpen) return;
    const closeGroupMembers = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-group-members-panel]") && !target.closest("[data-group-name-trigger]")) setGroupMembersOpen(false);
    };
    document.addEventListener("pointerdown", closeGroupMembers);
    return () => document.removeEventListener("pointerdown", closeGroupMembers);
  }, [groupMembersOpen]);
  useEffect(() => () => recorderStream.current?.getTracks().forEach((track) => track.stop()), []);
  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (contacts.data ?? []).filter((contact) =>
      !term || `${contact.name} ${contact.email} ${contact.roles.join(" ")}`.toLowerCase().includes(term)
    );
  }, [contacts.data, search]);

  useEffect(() => {
    if (screen === "thread" && messages.data) {
      messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [messages.data, queryClient, screen]);

  const openDirect = useMutation({
    mutationFn: (contact: ChatContact) => chatApi.openDirect(contact.user_id),
    onSuccess: (conversation) => {
      queryClient.setQueryData(CHAT_QUERY_KEY, (current: ChatConversation[] | undefined) => [conversation, ...(current ?? []).filter((item) => item.conversation_id !== conversation.conversation_id)]);
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      setActiveId(conversation.conversation_id);
      setScreen("thread");
      setSearch("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const createGroup = useMutation({
    mutationFn: () => chatApi.createGroup(groupName, selectedGroupMemberIds),
    onSuccess: (conversation) => {
      queryClient.setQueryData(CHAT_QUERY_KEY, (current: ChatConversation[] | undefined) => [conversation, ...(current ?? []).filter((item) => item.conversation_id !== conversation.conversation_id)]);
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      setActiveId(conversation.conversation_id);
      setScreen("thread");
      setGroupName("");
      setSelectedGroupMemberIds([]);
      toast.success(`Group chat created: ${conversation.name}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const sendMessage = useMutation({
    mutationFn: () => chatApi.sendMessage(activeId!, draft, replyTo?.message_id),
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const refreshMessages = () => {
    queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] });
    queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
  };
  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(activeId!, messageId),
    onSuccess: () => { setContextMenu(null); refreshMessages(); toast.success("Message deleted"); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const reactToMessage = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => chatApi.toggleReaction(activeId!, messageId, emoji),
    onSuccess: () => { setReactionMessageId(null); refreshMessages(); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const updateSettings = useMutation({
    mutationFn: (setting: ChatSettings) => chatApi.updateSettings(setting),
    onSuccess: (setting) => {
      queryClient.setQueryData(["chat-settings", user?.user_id], setting);
      toast.success("Chat preferences saved");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const updateFavorite = useMutation({
    mutationFn: ({ conversationId, isFavorite }: { conversationId: string; isFavorite: boolean }) => chatApi.updateFavorite(conversationId, isFavorite),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(CHAT_QUERY_KEY, (current: ChatConversation[] | undefined) => current?.map((item) => item.conversation_id === variables.conversationId ? { ...item, is_favorite: variables.isFavorite } : item));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const uploadAttachment = useMutation({
    mutationFn: (file: File) => chatApi.uploadAttachment(activeId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const toggleRecording = async () => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); setIsRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast.error("Voice recording is not supported by this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStream.current = stream;
      const instance = new MediaRecorder(stream);
      recorder.current = instance;
      audioChunks.current = [];
      instance.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      instance.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); recorderStream.current = null;
        const blob = new Blob(audioChunks.current, { type: instance.mimeType || "audio/webm" });
        if (blob.size) uploadAttachment.mutate(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
      };
      instance.start(); setIsRecording(true);
    } catch { toast.error("Allow microphone access to record a voice message."); }
  };

  const unreadCount = (conversations.data ?? []).reduce((total, conversation) => total + conversation.unread_count, 0);
  const visibleConversations = useMemo(() => (conversations.data ?? []).filter((conversation) => {
    if (conversationFilter === "unread") return conversation.unread_count > 0;
    if (conversationFilter === "favorites") return conversation.is_favorite;
    if (conversationFilter === "groups") return conversation.conversation_type !== "DIRECT";
    return true;
  }), [conversations.data, conversationFilter]);

  const showScreen = (next: ChatScreen) => {
    setScreen(next);
    setSearch("");
    setGroupMembersOpen(false);
  };

  const downloadMessageAttachment = async (messageId: string, filename: string) => {
    try {
      const blob = await chatApi.attachment(activeId!, messageId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setContextMenu(null);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const addEmojiToDraft = (emoji: string) => setDraft((value) => value ? `${value}${emoji}` : emoji);
  const savePersonalChatSettings = (changes: Partial<ChatSettings>) => updateSettings.mutate({
    notifications_enabled: settings.data?.notifications_enabled ?? true,
    volume_percent: settings.data?.volume_percent ?? 70,
    font_size: settings.data?.font_size ?? "medium",
    theme: settings.data?.theme ?? "light",
    ...changes,
  });

  if (!user) return null;

  return (
    <div ref={widgetRoot} className="fixed bottom-5 right-5 z-40">
      {open && <section data-chat-theme={settings.data?.theme ?? "light"} data-chat-font-size={settings.data?.font_size ?? "medium"} className="chat-widget relative mb-3 flex h-[min(620px,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:w-[390px]" aria-label="Connect chat">
        <header className="flex min-h-[68px] shrink-0 items-center gap-3 bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-2 text-white">
          {screen !== "inbox" && <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" aria-label="Back to chats" onClick={() => showScreen("inbox")}><ArrowLeft /></Button>}
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white p-0.5"><img src="/sprintix-logo-hd.png" alt="SprintIX" className="h-full w-full rounded-[10px] object-contain" /></div>
          <div className="min-w-0 flex-1">
            {screen === "thread" && activeConversation?.conversation_type !== "DIRECT" ? <button data-group-name-trigger type="button" aria-expanded={groupMembersOpen} aria-label={`View members of ${activeConversation?.name ?? "group"}`} onClick={() => setGroupMembersOpen((open) => !open)} className="block max-w-full truncate text-left text-sm font-semibold hover:underline">{activeConversation?.name}</button> : <h2 className="truncate text-sm font-semibold">{screen === "thread" ? activeConversation?.name ?? "Chat" : screen === "contacts" ? "New message" : screen === "groups" ? "Create group chat" : screen === "settings" ? "Chat settings" : "Connect"}</h2>}
            {screen === "thread" && activeConversation?.conversation_type !== "DIRECT" ? <p className="truncate text-[11px] text-violet-100">{activeConversation?.member_count ?? 0} members</p> : <p className="truncate text-[11px] text-violet-100">{screen === "thread" ? "Direct chat" : "Talk with people in your organization"}</p>}
          </div>
          {screen !== "settings" && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/15 hover:text-white" aria-label="Chat settings" title="Chat settings" onClick={() => showScreen("settings")}><Settings2 /></Button>}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" aria-label="Close chat" onClick={() => setOpen(false)}><X /></Button>
        </header>

        {groupMembersOpen && screen === "thread" && activeConversation && activeConversation.conversation_type !== "DIRECT" && <div data-group-members-panel className="absolute left-3 right-3 top-[72px] z-30 max-h-[min(360px,70vh)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-semibold">{activeConversation.name}</p><p className="text-xs text-slate-500">Group members · {activeConversation.members?.length ?? activeConversation.member_count}</p><span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Created by Admin</span></div><button type="button" onClick={() => setGroupMembersOpen(false)} aria-label="Close group details" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button></div>
          <div className="chat-scroll-area max-h-72 overflow-y-auto p-2">{(activeConversation.members ?? []).map((member) => { const isCreator = member.user_id === activeConversation.created_by_user_id; return <div key={member.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-violet-50"><UserAvatar user={member} showName={false} size="md" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{member.name}</span><span className="block truncate text-xs text-slate-500">{member.roles.length ? member.roles.join(", ") : "Member"}</span></span>{isCreator && <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[9px] font-semibold text-violet-700">Created by Admin</span>}</div>; })}</div>
        </div>}

        {screen === "inbox" && <>
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            {isAdmin && <Button size="sm" variant="outline" onClick={() => showScreen("groups")}><Users /> Create team group</Button>}
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
            {([ ["all", "All"], ["unread", "Unread"], ["favorites", "Favorites"], ["groups", "Groups"] ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setConversationFilter(key)} aria-pressed={conversationFilter === key} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${conversationFilter === key ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"}`}>{label}{key === "unread" && unreadCount > 0 ? ` ${unreadCount}` : ""}</button>)}
          </div>
          <div className="chat-scroll-area flex-1 overflow-y-auto p-2">
            {conversations.isLoading ? <p className="p-5 text-center text-sm text-slate-500">Loading chats…</p> : (conversations.data ?? []).length === 0 ? <div className="px-5 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><MessageCircle /></div><p className="mt-3 text-sm font-semibold text-slate-800">No chats yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Start a private chat with any active organization member.</p><Button className="mt-4" size="sm" onClick={() => showScreen("contacts")}><Plus /> Start a chat</Button></div> : visibleConversations.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No chats match this filter.</p> : <div className="space-y-1">{visibleConversations.map((conversation) => <div key={conversation.conversation_id} className="flex items-center gap-1 rounded-xl pr-1 transition hover:bg-violet-50">
              <button type="button" onClick={() => { setActiveId(conversation.conversation_id); setScreen("thread"); }} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left">
                {conversation.conversation_type !== "DIRECT" ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><Users className="h-5 w-5" /></div> : <UserAvatar user={conversation.peer_user_id ? { user_id: conversation.peer_user_id, name: conversation.name, profile_picture_url: conversation.peer_profile_picture_url } : null} showName={false} size="md" />}
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-800">{conversation.name}</span>{conversation.conversation_type !== "DIRECT" && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-600">{conversation.conversation_type === "TEAM" ? "Team" : "Group"}</span>}</span><span className="chat-list-preview mt-1 block truncate text-xs text-slate-500">{conversation.last_message ? `${conversation.last_message.sender_name}: ${conversation.last_message.body}` : conversation.conversation_type !== "DIRECT" ? `${conversation.member_count} members` : "No messages yet"}</span></span>
                {conversation.unread_count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>}
              </button>
              <button type="button" aria-label={conversation.is_favorite ? `Remove ${conversation.name} from favorites` : `Add ${conversation.name} to favorites`} title={conversation.is_favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => updateFavorite.mutate({ conversationId: conversation.conversation_id, isFavorite: !conversation.is_favorite })} className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-500"> <Star className={`h-4 w-4 ${conversation.is_favorite ? "fill-amber-400 text-amber-500" : ""}`} /></button>
            </div>)}</div>}
          </div>
          <footer className="border-t border-slate-100 px-4 py-2 text-center text-[10px] text-slate-400">Chat with organization members using their assigned roles.</footer>
        </>}

        {screen === "inbox" && <span className="group absolute bottom-14 right-4 z-20">
          <Button size="icon" className="h-11 w-11 rounded-full shadow-lg shadow-violet-700/30" aria-label="New Chat" onClick={() => showScreen("contacts")}><Plus className="h-5 w-5" /></Button>
          <span role="tooltip" className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block group-focus-within:block">New Chat</span>
        </span>}

        {screen === "contacts" && <>
          <div className="border-b border-slate-100 p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or role..." className="pl-9" /></div></div>
          <div className="chat-scroll-area flex-1 overflow-y-auto p-2">{filteredContacts.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{contacts.isLoading ? "Loading organization members…" : "No members found."}</p> : filteredContacts.map((contact) => <button key={contact.user_id} type="button" onClick={() => openDirect.mutate(contact)} disabled={openDirect.isPending} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-violet-50 disabled:opacity-60">
            <UserAvatar user={contact} showName={false} size="md" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{contact.name} <span className="font-normal text-slate-500">{displayRoles(contact.roles)}</span></span><span className="mt-0.5 block truncate text-xs text-slate-500">{contact.email}</span></span><MessageCircle className="h-4 w-4 text-violet-500" />
          </button>)}</div>
        </>}

        {screen === "groups" && isAdmin && <div className="chat-scroll-area flex-1 overflow-y-auto p-3">
          <div className="mb-3 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-900">Create a chat group by giving it a name and choosing organization members. You are included automatically.</div>
          <div className="space-y-3">
            <div><Label htmlFor="chat-group-name">Group name</Label><Input id="chat-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Website launch" maxLength={150} className="mt-1" /></div>
            <div className="flex items-center justify-between"><Label>Choose members</Label><span className="text-xs text-slate-500">{selectedGroupMemberIds.length} selected</span></div>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organization members..." className="pl-9" /></div>
            <div className="chat-scroll-area max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1">{contacts.isLoading ? <p className="p-4 text-center text-sm text-slate-500">Loading members…</p> : filteredContacts.length ? filteredContacts.map((contact) => {
              const selected = selectedGroupMemberIds.includes(contact.user_id);
              return <button key={contact.user_id} type="button" aria-pressed={selected} onClick={() => setSelectedGroupMemberIds((ids) => selected ? ids.filter((id) => id !== contact.user_id) : [...ids, contact.user_id])} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left ${selected ? "bg-violet-50" : "hover:bg-slate-50"}`}><UserAvatar user={contact} showName={false} size="sm" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{contact.name} <span className="font-normal text-slate-500">{displayRoles(contact.roles)}</span></span><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300"}`}>{selected && <Check className="h-3 w-3" />}</span></button>;
            }) : <p className="p-4 text-center text-sm text-slate-500">No organization members found.</p>}</div>
            <Button className="w-full" disabled={!groupName.trim() || selectedGroupMemberIds.length === 0 || createGroup.isPending} onClick={() => createGroup.mutate()}><Users className="h-4 w-4" />{createGroup.isPending ? "Creating group…" : "Create group"}</Button>
          </div>
        </div>}

        {screen === "settings" && <div className="flex-1 p-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Message notifications</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose whether new chat messages should also appear in your app notification list. You can still see unread counts in your chats.</p>
            <div className="mt-4 flex items-center justify-between"><Label htmlFor="chat-notification-toggle" className="text-sm">Notify me about new chats</Label><Switch id="chat-notification-toggle" checked={settings.data?.notifications_enabled ?? true} disabled={settings.isLoading || updateSettings.isPending} onCheckedChange={(checked) => savePersonalChatSettings({ notifications_enabled: checked })} /></div>
            <div className="mt-5 space-y-2"><Label htmlFor="chat-volume">My chat volume: {settings.data?.volume_percent ?? 70}%</Label><input id="chat-volume" type="range" min={0} max={100} value={settings.data?.volume_percent ?? 70} onChange={(event) => { const volume = Number(event.target.value); queryClient.setQueryData(["chat-settings", user?.user_id], { notifications_enabled: settings.data?.notifications_enabled ?? true, volume_percent: volume, font_size: settings.data?.font_size ?? "medium", theme: settings.data?.theme ?? "light" }); }} className="w-full accent-violet-600" disabled={settings.isLoading} /><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => playNotificationSound((orgSettings.data?.sound_key ?? "double_ping") as Parameters<typeof playNotificationSound>[0], (settings.data?.volume_percent ?? 70) * (orgSettings.data?.master_volume_percent ?? 100) / 100)}>Preview chat sound</Button><Button type="button" size="sm" disabled={settings.isLoading || updateSettings.isPending} onClick={() => savePersonalChatSettings({})}>Save my volume</Button></div></div>
            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="chat-font-size" className="text-xs">Message font size</Label><select id="chat-font-size" value={settings.data?.font_size ?? "medium"} disabled={settings.isLoading || updateSettings.isPending} onChange={(event) => savePersonalChatSettings({ font_size: event.target.value as "small" | "medium" | "large" })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="chat-theme" className="text-xs">Chat theme</Label><select id="chat-theme" value={settings.data?.theme ?? "light"} disabled={settings.isLoading || updateSettings.isPending} onChange={(event) => savePersonalChatSettings({ theme: event.target.value as "light" | "dark" })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"><option value="light">Light</option><option value="dark">Dark</option></select></div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">These settings apply only to your own account. Your administrator manages team group chats.</p>
        </div>}

        {screen === "thread" && activeConversation && <>
          <div className="chat-scroll-area flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-3">
            {(messages.data ?? []).length === 0 && <div className="py-12 text-center"><MessageCircle className="mx-auto h-8 w-8 text-violet-300" /><p className="mt-3 text-sm font-medium text-slate-700">Start the conversation</p><p className="mt-1 text-xs text-slate-500">Messages are visible only to members of this chat.</p></div>}
            {(messages.data ?? []).map((message, index) => {
              const mine = message.sender_id === user.user_id;
              const previous = messages.data?.[index - 1];
              const showDay = !previous || chatDayKey(previous.sent_at) !== chatDayKey(message.sent_at);
              const sentDate = new Date(message.sent_at);
              const canDelete = mine || isAdmin;
              return <Fragment key={message.message_id}>
                {showDay && <div className="flex items-center gap-3 py-2" aria-label={`Messages for ${chatDayLabel(message.sent_at)}`}><span className="h-px flex-1 bg-slate-200" /><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-500">{chatDayLabel(message.sent_at)} · {sentDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span><span className="h-px flex-1 bg-slate-200" /></div>}
              <div key={message.message_id} data-chat-message-id={message.message_id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && <UserAvatar user={{ user_id: message.sender_id, name: message.sender_name, profile_picture_url: message.sender_profile_picture_url }} showName={false} size="sm" />}
                <div className="max-w-[85%]" onContextMenu={(event) => { event.preventDefault(); setReactionMessageId(null); setContextMenu({ messageId: message.message_id, x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 240) }); }}>
                <div onClick={() => setReactionMessageId(reactionMessageId === message.message_id ? null : message.message_id)} onDoubleClick={() => { setReplyTo(message); setReactionMessageId(null); }} title="Click for reactions · Double-click to reply · Right-click for options" className={`cursor-pointer rounded-2xl px-3 py-2 shadow-sm ${mine ? "rounded-br-md bg-violet-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                  {!mine && <p className="mb-1 text-[10px] font-semibold text-violet-700">{message.sender_name} <span className="font-normal text-slate-400">{displayRoles(message.sender_roles)}</span></p>}
                  {message.reply_to_body && <div className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-[10px] ${mine ? "border-violet-200 bg-violet-700/50 text-violet-50" : "border-violet-400 bg-slate-50 text-slate-600"}`}><strong>{message.reply_to_sender_name ?? "Reply"}</strong><p className="truncate">{message.reply_to_body}</p></div>}
                  {message.attachment_url ? <><p className={`whitespace-pre-wrap break-words leading-5 ${settings.data?.font_size === "small" ? "text-xs" : settings.data?.font_size === "large" ? "text-sm" : "text-[13px]"}`}>{message.message_type === "TEXT" ? message.body : ""}</p><ChatAttachment message={message} conversationId={activeId!} /></> : <p className={`whitespace-pre-wrap break-words leading-5 ${settings.data?.font_size === "small" ? "text-xs" : settings.data?.font_size === "large" ? "text-sm" : "text-[13px]"}`}>{message.body}</p>}
                  <p className={`mt-1 text-right text-[9px] ${mine ? "text-violet-100" : "text-slate-400"}`} title={sentDate.toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}>{sentDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</p>
                </div>
                {(reactionMessageId === message.message_id || message.reactions.length > 0) && <div className="mt-1 flex flex-wrap items-center gap-1">{CHAT_REACTIONS.map((emoji) => { const reaction = message.reactions.find((item) => item.emoji === emoji); if (!reaction && reactionMessageId !== message.message_id) return null; return <button key={emoji} type="button" onClick={(event) => { event.stopPropagation(); reactToMessage.mutate({ messageId: message.message_id, emoji }); }} className={`rounded-full border px-1.5 py-0.5 text-[11px] ${reaction?.reacted ? "border-violet-300 bg-violet-100" : "border-slate-200 bg-white"}`} title={`React with ${emoji}`}>{emoji}{reaction && <span className="ml-1 text-[9px]">{reaction.count}</span>}</button>; })}</div>}
                </div>
                {contextMenu?.messageId === message.message_id && <div data-chat-context-menu role="menu" className="fixed z-[70] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
                  <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={async () => { try { await navigator.clipboard.writeText(message.body); toast.success("Message copied"); } catch { toast.error("Could not copy this message."); } setContextMenu(null); }}><Copy className="h-3.5 w-3.5" /> Copy message</button>
                  {message.attachment_url && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => void downloadMessageAttachment(message.message_id, message.attachment_name ?? "attachment")}><Download className="h-3.5 w-3.5" /> Download {message.message_type === "IMAGE" ? "image" : "file"}</button>}
                  {canDelete && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50" onClick={() => { if (window.confirm("Delete this message?")) deleteMessage.mutate(message.message_id); else setContextMenu(null); }}><Trash2 className="h-3.5 w-3.5" /> Delete message</button>}
                </div>}
              </div>
              </Fragment>;
            })}
            <div ref={messagesEnd} />
          </div>
          <input ref={attachmentInput} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) uploadAttachment.mutate(file); event.currentTarget.value = ""; }} />
          <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) sendMessage.mutate(); }} className="flex shrink-0 flex-wrap items-end gap-1.5 border-t border-slate-100 bg-white p-3">
            {replyTo && <div className="flex w-full items-start gap-2 rounded-lg border-l-2 border-violet-500 bg-violet-50 px-2.5 py-1.5"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-violet-700">Replying to {replyTo.sender_name}</p><p className="truncate text-xs text-slate-600">{replyTo.body}</p></div><button type="button" onClick={() => setReplyTo(null)} className="px-1 text-slate-400 hover:text-slate-700" aria-label="Cancel reply">×</button></div>}
            <Button type="button" variant="ghost" size="icon" aria-label="Attach image or document" title="Attach image or document" disabled={uploadAttachment.isPending} onClick={() => attachmentInput.current?.click()}><Paperclip className="h-4 w-4" /></Button>
            <Button type="button" variant={isRecording ? "destructive" : "ghost"} size="icon" aria-label={isRecording ? "Stop voice recording" : "Record voice message"} title={isRecording ? "Stop and send voice message" : "Record voice message"} disabled={uploadAttachment.isPending} onClick={() => void toggleRecording()}>{isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
            <div ref={emojiPickerRoot} className="relative shrink-0">
              <Button type="button" variant="ghost" size="icon" aria-label="Open emoji picker" aria-expanded={emojiPickerOpen} title="Emoji" onClick={() => setEmojiPickerOpen((value) => !value)}><Smile className="h-5 w-5" /></Button>
              {emojiPickerOpen && <div role="group" aria-label="Quick chat reactions" className="absolute bottom-full left-0 z-[80] mb-2 grid w-[176px] grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {CHAT_REACTIONS.map((emoji) => <button key={emoji} type="button" aria-label={`Insert ${emoji} into message`} title={`Insert ${emoji}`} onClick={() => { addEmojiToDraft(emoji); setEmojiPickerOpen(false); }} className="flex h-8 w-6 items-center justify-center rounded-md text-sm transition hover:bg-violet-50">{emoji}</button>)}
              </div>}
            </div>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim() && !sendMessage.isPending) sendMessage.mutate(); } }} rows={1} maxLength={4000} placeholder={replyTo ? "Write your reply..." : "Write a message..."} className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim() || sendMessage.isPending}><Send className="h-4 w-4" /></Button>
          </form>
        </>}
      </section>}

      <Button size="icon" aria-label={open ? "Close Connect" : "Open Connect"} title="Connect" className="relative h-14 w-14 rounded-full shadow-xl shadow-violet-700/30" onClick={() => setOpen((value) => !value)}>
        {open ? <X className="h-6 w-6" /> : <img src="/sprintix-logo-hd.png" alt="" className="h-10 w-10 rounded-full object-contain" />}
        {!open && unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </Button>
    </div>
  );
}
