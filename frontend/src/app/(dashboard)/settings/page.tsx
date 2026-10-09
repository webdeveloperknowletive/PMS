"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, BellRing, Camera, Check, LockKeyhole, Mail, Music2, ShieldCheck, Trash2, Upload, UserRound, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { usersApi } from "@/lib/api/users";
import { getApiErrorMessage } from "@/lib/api/client";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { notificationSettingsApi } from "@/lib/api/notifications";
import { chatApi } from "@/lib/api/chat";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PROFILE_AVATARS, profileAvatarSvg, profileAvatarToPng } from "@/lib/profile-avatars";
import { NOTIFICATION_SOUNDS, playNotificationSound, type NotificationSoundKey } from "@/lib/notification-sound";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState("");
  const [toastDurationSeconds, setToastDurationSeconds] = useState("");
  const [selectedSoundKey, setSelectedSoundKey] = useState<NotificationSoundKey>("gentle_chime");
  const [volumePercent, setVolumePercent] = useState(65);
  const [chatSoundKey, setChatSoundKey] = useState<NotificationSoundKey>("double_ping");
  const [chatMasterVolume, setChatMasterVolume] = useState(100);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const profilePictureInput = useRef<HTMLInputElement>(null);

  const reminderSetting = useQuery({
    queryKey: ["meeting-reminder-setting"],
    queryFn: notificationSettingsApi.getMeetingReminder,
    enabled: isAdmin,
  });
  useEffect(() => {
    if (reminderSetting.data) setReminderLeadMinutes(String(reminderSetting.data.lead_minutes));
  }, [reminderSetting.data]);

  const toastDurationSetting = useQuery({
    queryKey: ["notification-toast-duration"],
    queryFn: notificationSettingsApi.getToastDuration,
    enabled: isAdmin,
  });
  const notificationSoundSetting = useQuery({
    queryKey: ["notification-sound-setting"],
    queryFn: notificationSettingsApi.getSound,
    enabled: !!user,
  });
  const notificationVolumeSetting = useQuery({
    queryKey: ["notification-volume-setting", user?.user_id],
    queryFn: notificationSettingsApi.getVolume,
    enabled: !!user,
  });
  const chatOrganizationSettings = useQuery({
    queryKey: ["chat-organization-settings"],
    queryFn: chatApi.organizationSettings,
    enabled: isAdmin,
  });
  useEffect(() => {
    if (toastDurationSetting.data) setToastDurationSeconds(String(toastDurationSetting.data.duration_seconds));
  }, [toastDurationSetting.data]);
  useEffect(() => {
    if (notificationSoundSetting.data) setSelectedSoundKey(notificationSoundSetting.data.sound_key as NotificationSoundKey);
  }, [notificationSoundSetting.data]);
  useEffect(() => {
    if (notificationVolumeSetting.data) setVolumePercent(notificationVolumeSetting.data.volume_percent);
  }, [notificationVolumeSetting.data]);
  useEffect(() => {
    if (chatOrganizationSettings.data) {
      setChatSoundKey(chatOrganizationSettings.data.sound_key as NotificationSoundKey);
      setChatMasterVolume(chatOrganizationSettings.data.master_volume_percent);
    }
  }, [chatOrganizationSettings.data]);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user?.name, user?.email]);

  const updateProfile = useMutation({
    mutationFn: () => usersApi.updateProfile(user!.user_id, { name: name.trim(), email: email.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Your profile was updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateReminderSetting = useMutation({
    mutationFn: () => notificationSettingsApi.updateMeetingReminder(Number(reminderLeadMinutes)),
    onSuccess: (setting) => {
      queryClient.setQueryData(["meeting-reminder-setting"], setting);
      toast.success("Meeting reminder time updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateToastDuration = useMutation({
    mutationFn: () => notificationSettingsApi.updateToastDuration(Number(toastDurationSeconds)),
    onSuccess: (setting) => {
      queryClient.setQueryData(["notification-toast-duration"], setting);
      toast.success("Notification popup time updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateNotificationSound = useMutation({
    mutationFn: () => notificationSettingsApi.updateSound(selectedSoundKey),
    onSuccess: (setting) => {
      queryClient.setQueryData(["notification-sound-setting"], setting);
      toast.success("Workspace notification sound updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateNotificationVolume = useMutation({
    mutationFn: () => notificationSettingsApi.updateVolume(volumePercent),
    onSuccess: (setting) => {
      queryClient.setQueryData(["notification-volume-setting", user?.user_id], setting);
      toast.success("Your notification volume was updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateChatOrganizationSettings = useMutation({
    mutationFn: () => chatApi.updateOrganizationSettings({ sound_key: chatSoundKey, master_volume_percent: chatMasterVolume }),
    onSuccess: (setting) => {
      queryClient.setQueryData(["chat-organization-settings"], setting);
      toast.success("Organization chat sound updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateProfilePicture = useMutation({
    mutationFn: (file: File) => usersApi.uploadProfilePicture(user!.user_id, file),
    onSuccess: (updated) => {
      setUser(updated);
      setProfilePictureFile(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["profile-picture", user?.user_id] });
      setPhotoDialogOpen(false);
      toast.success("Profile photo updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const removeProfilePicture = useMutation({
    mutationFn: () => usersApi.removeProfilePicture(user!.user_id),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["profile-picture", user?.user_id] });
      setPhotoDialogOpen(false);
      toast.success("Profile photo removed");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const dirty = name.trim() !== user?.name || email.trim() !== user?.email;

  const choosePresetAvatar = async (avatar: typeof PROFILE_AVATARS[number]) => {
    try {
      const file = await profileAvatarToPng(avatar);
      updateProfilePicture.mutate(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare this avatar.");
    }
  };

  return (
    <div className="workspace-page animate-enter">
      <PageHeader title="Profile & settings" description="Manage your personal details and account preferences." />
      <div className="grid gap-5 xl:grid-cols-[1fr_0.65fr]">
        <Card className="overflow-hidden border-white/90">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-violet-600" /> Personal profile</CardTitle>
            <p className="text-xs text-slate-500">Your name and email are visible to your project teammates.</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-7 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-violet-50 to-sky-50 p-4">
              <div className="flex flex-col items-center gap-1">
                <div role="button" tabIndex={0} onClick={() => setPhotoDialogOpen(true)} onDoubleClick={() => setPhotoDialogOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPhotoDialogOpen(true); } }} className="cursor-zoom-in rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" aria-label="Open profile photo options">
                  <UserAvatar user={user} showName={false} size="lg" />
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-[11px] font-semibold text-violet-700" onClick={() => setPhotoDialogOpen(true)}>Manage photo</Button>
              </div>
              <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{user?.name}</p><p className="mt-1 truncate text-sm text-slate-500">{user?.email}</p></div>
              <span className="ml-auto hidden items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 sm:inline-flex"><ShieldCheck className="h-3 w-3" /> Account active</span>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); updateProfile.mutate(); }} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="profile-name">Full name</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="profile-name" autoComplete="name" className="pl-10" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required /></div></div>
              <div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="profile-email" type="email" autoComplete="email" className="pl-10" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} required /></div></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">Changes update your account immediately.</p><Button type="submit" disabled={!dirty || !name.trim() || !email.trim() || updateProfile.isPending}>{updateProfile.isPending ? "Saving..." : <><Check className="h-4 w-4" /> Save changes</>}</Button></div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {isAdmin && <Card className="border-violet-100">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Music2 className="h-4 w-4 text-violet-600" /> Chat message sound</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">Admins choose the chat tone for the organization and set its maximum volume. Each user can lower the sound from Chat settings.</p>
              <div className="space-y-2">
                {NOTIFICATION_SOUNDS.map((sound) => <div key={sound.key} className={`flex items-center gap-2 rounded-xl border p-3 ${chatSoundKey === sound.key ? "border-violet-400 bg-violet-50" : "border-slate-200"}`}>
                  <button type="button" onClick={() => setChatSoundKey(sound.key)} className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold">{sound.name}</span><span className="text-xs text-slate-500">{sound.description}</span></button>
                  <Button type="button" variant="outline" size="sm" onClick={() => playNotificationSound(sound.key, chatMasterVolume)} aria-label={`Preview ${sound.name}`}>Play</Button>
                </div>)}
              </div>
              <div className="space-y-2"><Label htmlFor="chat-master-volume">Organization chat volume limit: {chatMasterVolume}%</Label><input id="chat-master-volume" type="range" min={0} max={150} step={1} value={chatMasterVolume} onChange={(event) => setChatMasterVolume(Number(event.target.value))} className="w-full accent-violet-600" /><div className="flex justify-between text-[11px] text-slate-400"><span>Muted</span><span>Extra loud</span></div></div>
              <Button onClick={() => updateChatOrganizationSettings.mutate()} disabled={updateChatOrganizationSettings.isPending || (chatSoundKey === chatOrganizationSettings.data?.sound_key && chatMasterVolume === chatOrganizationSettings.data?.master_volume_percent)}>{updateChatOrganizationSettings.isPending ? "Saving..." : "Save chat sound"}</Button>
            </CardContent>
          </Card>}
          {isAdmin && <Card className="border-violet-100">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-violet-600" /> Meeting reminders</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-slate-600">Choose how many minutes before a meeting its reminder should appear. This setting applies only to meeting reminders.</p>
              <div className="space-y-2"><Label htmlFor="meeting-reminder-minutes">Remind before meeting (minutes)</Label><Input id="meeting-reminder-minutes" type="number" min={1} max={1440} value={reminderLeadMinutes} onChange={(event) => setReminderLeadMinutes(event.target.value)} disabled={reminderSetting.isLoading} /></div>
              <Button className="mt-4" onClick={() => updateReminderSetting.mutate()} disabled={!reminderLeadMinutes || Number(reminderLeadMinutes) < 1 || Number(reminderLeadMinutes) > 1440 || Number(reminderLeadMinutes) === reminderSetting.data?.lead_minutes || updateReminderSetting.isPending}>{updateReminderSetting.isPending ? "Saving..." : "Save reminder time"}</Button>
            </CardContent>
          </Card>}
          {isAdmin && <Card className="border-violet-100">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-violet-600" /> Notification popups</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-slate-600">Choose how many seconds a new notification popup stays visible. The notification itself remains in the Notifications page until it is marked as read.</p>
              <div className="space-y-2"><Label htmlFor="notification-popup-seconds">Show popup for (seconds)</Label><Input id="notification-popup-seconds" type="number" min={1} max={60} value={toastDurationSeconds} onChange={(event) => setToastDurationSeconds(event.target.value)} disabled={toastDurationSetting.isLoading} /></div>
              <Button className="mt-4" onClick={() => updateToastDuration.mutate()} disabled={!toastDurationSeconds || Number(toastDurationSeconds) < 1 || Number(toastDurationSeconds) > 60 || Number(toastDurationSeconds) === toastDurationSetting.data?.duration_seconds || updateToastDuration.isPending}>{updateToastDuration.isPending ? "Saving..." : "Save popup time"}</Button>
            </CardContent>
          </Card>}
          {isAdmin && <Card className="border-violet-100">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Music2 className="h-4 w-4 text-violet-600" /> Workspace notification sound</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">Choose the sound everyone hears for new notifications. Team members can adjust only their own volume.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {NOTIFICATION_SOUNDS.map((sound) => <div key={sound.key} className={`flex items-center gap-2 rounded-xl border p-3 transition ${selectedSoundKey === sound.key ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200" : "border-slate-200 bg-white"}`}>
                  <button type="button" onClick={() => setSelectedSoundKey(sound.key)} className="min-w-0 flex-1 text-left" aria-pressed={selectedSoundKey === sound.key}>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">{selectedSoundKey === sound.key && <Check className="h-3.5 w-3.5 text-violet-600" />}{sound.name}</span>
                    <span className="mt-1 block text-xs leading-4 text-slate-500">{sound.description}</span>
                  </button>
                  <Button type="button" variant="outline" size="sm" onClick={() => playNotificationSound(sound.key, volumePercent)} aria-label={`Preview ${sound.name}`}>Play</Button>
                </div>)}
              </div>
              <Button onClick={() => updateNotificationSound.mutate()} disabled={selectedSoundKey === notificationSoundSetting.data?.sound_key || updateNotificationSound.isPending}>{updateNotificationSound.isPending ? "Saving..." : "Save workspace sound"}</Button>
            </CardContent>
          </Card>}
          <Card className="border-sky-100">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Volume2 className="h-4 w-4 text-sky-600" /> My notification volume</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-slate-600">Set how loud notification sounds are for your account. This changes only your volume; the Admin chooses the sound.</p>
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 shrink-0 text-slate-500" />
                <input id="notification-volume" type="range" min={0} max={100} step={1} value={volumePercent} onChange={(event) => setVolumePercent(Number(event.target.value))} className="h-2 flex-1 cursor-pointer accent-violet-600" aria-label="Notification sound volume" />
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-700">{volumePercent}%</span>
              </div>
              <div className="mt-1 flex justify-between pl-7 text-[11px] text-slate-400"><span>Muted</span><span>Full volume</span></div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => playNotificationSound((notificationSoundSetting.data?.sound_key ?? "gentle_chime") as NotificationSoundKey, volumePercent)} disabled={volumePercent === 0}><Music2 className="h-4 w-4" /> Preview</Button>
                <Button onClick={() => updateNotificationVolume.mutate()} disabled={volumePercent === notificationVolumeSetting.data?.volume_percent || updateNotificationVolume.isPending}>{updateNotificationVolume.isPending ? "Saving..." : "Save my volume"}</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/90">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-sky-600" /> Account security</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-6 text-slate-600">Use a unique password to protect your workspace. If you need to reset it, we’ll guide you through the recovery flow.</p><Button asChild variant="outline" className="mt-4"><a href="/forgot-password">Reset password <ArrowUpRight className="h-4 w-4" /></a></Button></CardContent>
          </Card>
          <Card className="border-violet-100 bg-gradient-to-br from-violet-50/90 to-white">
            <CardContent className="flex gap-3 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-800">Your workspace is protected</p><p className="mt-1 text-xs leading-5 text-slate-500">Access to projects and tools follows your assigned roles and permissions.</p></div></CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={photoDialogOpen} onOpenChange={(open) => { setPhotoDialogOpen(open); if (!open) setProfilePictureFile(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogTitle className="text-center">Profile photo</DialogTitle>
          <DialogDescription className="text-center">Double-clicking your profile photo opens these options. Upload your own photo or choose a ready-made avatar.</DialogDescription>
          <div className="flex flex-col items-center gap-3 py-2">
            <UserAvatar user={user} showName={false} size="xl" />
            <p className="text-sm font-medium text-slate-700">{user?.name}</p>
          </div>
          <input ref={profilePictureInput} id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { setProfilePictureFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => profilePictureInput.current?.click()} disabled={updateProfilePicture.isPending}><Upload className="h-4 w-4" /> Update image</Button>
            <Button type="button" variant="outline" onClick={() => removeProfilePicture.mutate()} disabled={!user?.profile_picture_url || removeProfilePicture.isPending}><Trash2 className="h-4 w-4" /> Remove image</Button>
          </div>
          {profilePictureFile && <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3"><p className="min-w-0 flex-1 truncate text-xs text-slate-600">{profilePictureFile.name}</p><Button size="sm" onClick={() => updateProfilePicture.mutate(profilePictureFile)} disabled={updateProfilePicture.isPending}>{updateProfilePicture.isPending ? "Uploading..." : "Save image"}</Button></div>}
          <div className="space-y-3">
            {(["Girls", "Boys"] as const).map((group) => <section key={group} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">{group}</h3>
              <div className="grid grid-cols-3 gap-3">
                {PROFILE_AVATARS.filter((avatar) => avatar.group === group).map((avatar) => <button key={avatar.id} type="button" onClick={() => choosePresetAvatar(avatar)} disabled={updateProfilePicture.isPending} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-2 transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50" aria-label={`Use ${avatar.name} avatar`}>
                  <img src={`data:image/svg+xml,${encodeURIComponent(profileAvatarSvg(avatar))}`} alt={`${avatar.name} avatar`} className="h-16 w-16 rounded-full" />
                  <span className="text-xs font-medium text-slate-700">{avatar.name}</span>
                </button>)}
              </div>
            </section>)}
          </div>
          <div className="flex items-center justify-center gap-1 text-xs text-slate-500"><Camera className="h-3.5 w-3.5" /> Choose any avatar to apply it to your profile.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
