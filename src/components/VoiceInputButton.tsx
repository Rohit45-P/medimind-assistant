import { useState } from "react";
import { Mic, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listen, speak } from "@/lib/voice";
import { toast } from "sonner";

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceInputButton({ onResult, placeholder, className }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);

  const handleListen = () => {
    if (isListening) return;

    setIsListening(true);
    toast("Listening...", { id: "voice-input" });
    
    const session = listen(
      (text) => {
        onResult(text);
        setIsListening(false);
        toast.success("Voice captured", { id: "voice-input" });
        speak(`Captured: ${text}`, { rate: 1.2 });
      },
      () => {
        setIsListening(false);
      },
      (err) => {
        setIsListening(false);
        toast.error(err, { id: "voice-input" });
      }
    );

    if (!session) {
      setIsListening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 rounded-full transition-all duration-300 ${
        isListening ? "text-destructive animate-pulse bg-destructive/10" : "text-primary hover:bg-primary/10"
      } ${className}`}
      onClick={handleListen}
      title={placeholder || "Use voice input"}
    >
      {isListening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
