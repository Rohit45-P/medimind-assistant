// Voice utilities — Web Speech API

// ─── Internal audio unlock state ───────────────────────────────────────────
// Browsers block audio until the user has interacted with the page.
// We unlock it on the first click/tap and cache the AudioContext.
let _audioCtx: AudioContext | null = null;
let _audioUnlocked = false;
let _speechUnlocked = false;

/** Call once after any user gesture (click / keydown) to unlock audio & speech. */
export function unlockAudio() {
  if (_audioUnlocked && _speechUnlocked) return;

  // Unlock AudioContext
  if (!_audioUnlocked) {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        _audioCtx = new AudioCtxClass();
        // Play a 0-volume beep to satisfy autoplay policy
        const buf = _audioCtx.createBuffer(1, 1, 22050);
        const src = _audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(_audioCtx.destination);
        src.start(0);
        _audioUnlocked = true;
      }
    } catch (_) {
      /* ignore */
    }
  }

  // Unlock SpeechSynthesis — fire a silent utterance so future calls are allowed
  if (!_speechUnlocked && typeof window !== "undefined" && window.speechSynthesis) {
    try {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      _speechUnlocked = true;
    } catch (_) {
      /* ignore */
    }
  }
}

// ─── Speech ─────────────────────────────────────────────────────────────────
export function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel any current speech first
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate   = opts?.rate   ?? 0.95;
  u.pitch  = opts?.pitch  ?? 1.05;
  u.volume = opts?.volume ?? 1;
  u.lang   = "en-US";

  // Pick a natural English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Microsoft") || v.default)
  );
  if (preferred) u.voice = preferred;

  // Workaround: Chrome sometimes pauses after ~15s of synthesis.
  // Resume if paused before speaking.
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  window.speechSynthesis.speak(u);

  // Chrome bug: synthesis can stall — resume it after 250ms if still not speaking
  setTimeout(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 250);
}

// ─── Alarm sound ─────────────────────────────────────────────────────────────
export function playAlarmSound() {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    // Reuse unlocked context or create a new one
    const ctx: AudioContext = _audioCtx ?? new AudioCtxClass();
    _audioCtx = ctx;

    // Resume in case it was suspended
    if (ctx.state === "suspended") {
      ctx.resume().then(() => _fireBeeps(ctx));
    } else {
      _fireBeeps(ctx);
    }
  } catch (e) {
    console.warn("Audio blocked or not supported", e);
  }
}

function _fireBeeps(ctx: AudioContext) {
  const playBeep = (time: number, freq: number, duration: number, vol: number) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  };

  const t = ctx.currentTime;
  // Three ascending bell tones — sounds like a medication alarm
  playBeep(t + 0.0, 660, 0.25, 0.35);
  playBeep(t + 0.3, 880, 0.25, 0.35);
  playBeep(t + 0.6, 1100, 0.35, 0.40);
}

// ─── Speech recognition ───────────────────────────────────────────────────
export function listen(
  onResult: (text: string) => void,
  onEnd?: () => void,
  onError?: (err: string) => void
): { stop: () => void } | null {
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

// ─── Browser notifications ────────────────────────────────────────────────
export function requestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission);
  if (Notification.permission === "granted") return Promise.resolve("granted" as NotificationPermission);
  return Notification.requestPermission();
}

export function showNotification(title: string, body: string) {
  // 1. Play the alarm beeps
  playAlarmSound();

  // 2. Vibrate on mobile devices
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([400, 150, 400, 150, 800]);
  }

  // 3. System-level browser notification (works even when tab is minimised)
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: true, // notification stays until dismissed
    });
  }
}
