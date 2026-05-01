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

export function listen(onResult: (text: string) => void, onEnd?: () => void): { stop: () => void } | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e: any) => {
    const transcript = e.results[0][0].transcript;
    onResult(transcript);
  };
  r.onend = () => onEnd?.();
  r.start();
  return { stop: () => r.stop() };
}

export function requestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission);
  if (Notification.permission === "granted") return Promise.resolve("granted" as NotificationPermission);
  return Notification.requestPermission();
}

export function showNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/favicon.ico" });
}
