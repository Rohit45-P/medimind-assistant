import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listen, speak } from "@/lib/voice";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function VoiceAssistant() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const stopListenRef = useRef<(() => void) | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array(12).fill(0));

  // Simulated waveform animation
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setWaveform(prev => prev.map(() => Math.floor(Math.random() * 80) + 20));
      }, 100);
    } else {
      setWaveform(Array(12).fill(0));
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!user || profile?.role !== "patient") return null;

  const handleToggleRecord = (isEmergencyMode = false) => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(isEmergencyMode);
    }
  };

  const startRecording = (isEmergencyMode = false) => {
    setTranscript("");
    setIsRecording(true);
    const session = listen(
      (text) => setTranscript(text),
      () => {
        setIsRecording(false);
      },
      (err) => {
        setIsRecording(false);
        toast.error(err);
      }
    );
    if (session) {
      stopListenRef.current = session.stop;
      if (isEmergencyMode) {
        toast("Emergency Voice Mode Active", { 
          icon: <PhoneCall className="w-4 h-4 text-white" />,
          className: "bg-destructive text-white border-none shadow-glow"
        });
        speak("Emergency mode activated. Speak your message.");
      }
    } else {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (stopListenRef.current) {
      stopListenRef.current();
      stopListenRef.current = null;
    }
    setIsRecording(false);
    if (transcript) {
      processVoiceNote(transcript);
    }
  };

  const processVoiceNote = async (text: string) => {
    setIsProcessing(true);
    try {
      const res = await apiFetch("/api/voice-notes", {
        method: "POST",
        body: JSON.stringify({ transcript: text }),
      });
      
      toast.success(res.message);
      speak(res.message);

      if (res.is_emergency) {
        toast("⚠️ Emergency detected. Redirecting to profile...", {
          duration: 5000,
          className: "bg-destructive text-destructive-foreground border-none shadow-glow",
        });
        navigate(`/emergency/${user.id}`);
      }
    } catch (err: any) {
      toast.error("Failed to process voice input");
      speak("Sorry, I couldn't process your note.");
    } finally {
      setIsProcessing(false);
      setTranscript("");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 animate-fade-up">
      {/* Transcript Popup */}
      {(isRecording || isProcessing || transcript) && (
        <div className="glass-card p-5 rounded-3xl mb-2 w-80 shadow-glow border-primary/40 backdrop-blur-2xl animate-scale-in origin-bottom-right bg-card/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isRecording ? (
                <div className="flex gap-1.5 items-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                  <span className="text-[10px] font-bold text-destructive uppercase tracking-widest">Live</span>
                </div>
              ) : isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : null}
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                MediRecall Assistant
              </span>
            </div>
            {isRecording && <span className="text-[10px] font-medium text-muted-foreground animate-pulse">Listening...</span>}
          </div>
          
          <p className="text-sm font-semibold text-foreground leading-relaxed min-h-[48px]">
            {transcript || <span className="text-muted-foreground/60 italic font-normal">Speak naturally...</span>}
          </p>
          
          {/* Animated Waveform */}
          {isRecording && (
            <div className="flex items-end justify-center gap-1.5 mt-6 h-12 px-2">
              {waveform.map((height, i) => (
                <div 
                  key={i} 
                  className="w-1.5 bg-gradient-to-t from-primary to-primary-glow rounded-full transition-all duration-150 ease-out shadow-sm" 
                  style={{ height: `${height}%` }} 
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {/* Emergency Voice Button */}
        {!isRecording && (
          <Button
            variant="destructive"
            size="icon"
            onClick={() => handleToggleRecord(true)}
            className="w-12 h-12 rounded-full shadow-lg hover-bounce bg-gradient-to-br from-red-500 to-destructive animate-pulse-soft border-none"
            title="Emergency Quick Voice"
          >
            <PhoneCall className="w-5 h-5 text-white" />
          </Button>
        )}

        {/* Main Microphone Button */}
        <Button
          onClick={() => handleToggleRecord(false)}
          disabled={isProcessing}
          className={`w-16 h-16 rounded-full shadow-elegant hover-bounce flex items-center justify-center transition-all duration-500 relative group border-none ${
            isRecording 
              ? "bg-destructive scale-110 shadow-glow" 
              : "bg-gradient-primary"
          }`}
        >
          {isRecording ? (
            <Square className="w-6 h-6 fill-current text-white animate-pulse" />
          ) : (
            <Mic className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
          )}
          
          {/* Outer glow ring for recording */}
          {isRecording && (
            <div className="absolute inset-[-4px] rounded-full border-4 border-destructive/30 animate-ping" />
          )}
        </Button>
      </div>
    </div>
  );
}

