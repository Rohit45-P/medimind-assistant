// Voice utilities — Web Speech API
export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 1;
  u.pitch = opts?.pitch ?? 1;
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

export function listen(onResult: (text: string) => void, onEnd?: () => void, onError?: (err: string) => void): { stop: () => void } | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    onError?.("Speech recognition not supported in this browser (try Chrome/Edge).");
    return null;
  }
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e: any) => {
    const transcript = e.results[0][0].transcript;
    onResult(transcript);
  };
  r.onerror = (e: any) => {
    console.error("Speech recognition error:", e.error);
    onError?.(e.error === "not-allowed" ? "Microphone permission denied." : e.error);
  };
  r.onend = () => onEnd?.();
  try {
    r.start();
    return { stop: () => r.stop() };
  } catch (e) {
    onError?.("Microphone is already in use or blocked.");
    return null;
  }
}

export function requestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission);
  if (Notification.permission === "granted") return Promise.resolve("granted" as NotificationPermission);
  return Notification.requestPermission();
}

function playAlarmSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const playBeep = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880; // High-pitched bell
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.3);
    };
    playBeep(ctx.currentTime);
    playBeep(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio blocked or not supported", e);
  }
}

export function showNotification(title: string, body: string) {
  // Try to vibrate, even if notification permission is denied
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/favicon.ico" });
}
