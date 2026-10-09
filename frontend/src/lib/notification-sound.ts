let notificationAudioContext: AudioContext | null = null;

export const NOTIFICATION_SOUNDS = [
  { key: "gentle_chime", name: "Gentle chime", description: "A polished, rising three-note chime.", waveform: "sine", notes: [784, 988, 1175], noteLength: 0.18, gap: 0.15 },
  { key: "soft_bell", name: "Soft bell", description: "A warm, rounded bell for everyday updates.", waveform: "sine", notes: [659, 988], noteLength: 0.25, gap: 0.22 },
  { key: "double_ping", name: "Double ping", description: "Two crisp pings that are easy to notice.", waveform: "triangle", notes: [880, 880], noteLength: 0.12, gap: 0.2 },
  { key: "clear_drop", name: "Clear drop", description: "A short descending tone for a new alert.", waveform: "sine", notes: [1046, 784, 698], noteLength: 0.15, gap: 0.12 },
  { key: "focus_ping", name: "Focus ping", description: "One confident ping with a clean finish.", waveform: "triangle", notes: [740, 1109], noteLength: 0.2, gap: 0.16 },
  { key: "bright_alert", name: "Bright alert", description: "A bright, upbeat three-note notification.", waveform: "sine", notes: [784, 988, 1318], noteLength: 0.18, gap: 0.13 },
] as const;

export type NotificationSoundKey = (typeof NOTIFICATION_SOUNDS)[number]["key"];

export function enableNotificationSound() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    notificationAudioContext ??= new window.AudioContext();
    if (notificationAudioContext.state === "suspended") void notificationAudioContext.resume().catch(() => undefined);
  } catch {
    // Sound remains optional when the browser doesn't support audio.
  }
}

/** Plays one of the built-in tones without requiring uploaded sound files. */
export function playNotificationSound(soundKey: NotificationSoundKey = "gentle_chime", volumePercent = 65) {
  if (typeof window === "undefined") return;
  if (!window.AudioContext) return;

  try {
    notificationAudioContext ??= new window.AudioContext();
    const context = notificationAudioContext;
    void context.resume().then(() => {
      const sound = NOTIFICATION_SOUNDS.find((option) => option.key === soundKey) ?? NOTIFICATION_SOUNDS[0];
      // The previous cap (0.16) was too quiet on many laptop speakers.
      // Raise the useful output level while keeping the volume slider in control.
      const normalizedVolume = Math.max(0, Math.min(150, volumePercent)) / 100;
      const amplitude = Math.min(0.9, 0.58 * Math.pow(normalizedVolume, 1.15));
      if (amplitude === 0) return;
      sound.notes.forEach((frequency, index) => {
        const start = context.currentTime + index * sound.gap;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = sound.waveform;
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(amplitude, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.noteLength);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + sound.noteLength);
      });
    }).catch(() => undefined);
  } catch {
    // Browsers may mute sounds until the user has interacted with the page.
  }
}
