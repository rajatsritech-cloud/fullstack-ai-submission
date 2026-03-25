import { type KeyboardEvent, useRef, useState, useEffect } from "react";
import { ArrowUp, Mic, Plus } from "lucide-react";

type MessageInputProps = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setValue((prev) => prev + transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "52px";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = scrollHeight > 52 ? `${Math.min(scrollHeight, 200)}px` : "52px";
    }
  }, [value]);

  const hasValue = value.trim().length > 0;

  return (
    <div className={`relative w-full transition-all duration-300 ${hasValue ? "translate-y-[-1px] shadow-[0_12px_45px_rgba(0,0,0,0.08)]" : "shadow-[0_4px_30px_rgba(0,0,0,0.05)]"}`}>
      <div className={`relative w-full rounded-full cursor-text overflow-hidden bg-white dark:bg-[#1a1a1a] p-1.5 flex items-center gap-1 border transition-all duration-300 ${hasValue ? "border-black/25 dark:border-white/30 ring-2 ring-black/[0.03] dark:ring-white/[0.03]" : "border-black/10 dark:border-white/10 ring-1 ring-black/[0.02] dark:ring-transparent"}`}>
          <button className="flex items-center justify-center size-10 text-muted-foreground/60 hover:text-foreground transition-colors ml-1">
             <Plus className="size-[22px]" strokeWidth={2.2} />
          </button>

          <textarea
             ref={textareaRef}
             value={value}
             onChange={(e) => setValue(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder="Ask anything"
             disabled={disabled}
             rows={1}
             className="flex-1 min-w-0 resize-none bg-transparent py-2.5 outline-none placeholder:text-muted-foreground/50 text-[16.5px] leading-relaxed overflow-hidden"
          />

          <div className="flex items-center gap-1 mr-1">
              <button 
                onClick={toggleListening}
                disabled={disabled}
                className={`flex items-center justify-center size-10 rounded-full transition-all ${isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"}`}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                  <Mic className={`size-5 ${isListening ? "fill-current" : ""}`} />
              </button>
              
              <button 
                 onClick={handleSend}
                 disabled={disabled || !value.trim()}
                 className={`flex items-center justify-center size-9 rounded-full shadow-md transition-all ml-0.5 ${hasValue ? "bg-black dark:bg-white text-white dark:text-black opacity-100 scale-100" : "bg-muted text-muted-foreground opacity-20 scale-95"}`}
              >
                 <ArrowUp className="size-5" strokeWidth={3} />
              </button>
          </div>
      </div>
    </div>
  );
}
