import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RecognitionResultEvent = {
  results?: ArrayLike<{
    0?: { transcript?: string };
  }>;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return (
    candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
  );
}

export function VoiceTextInputButton(props: {
  onTranscript: (text: string) => void;
}) {
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const Recognition = getRecognitionConstructor();

  if (!Recognition) return null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    if (listening) {
      stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-CA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) props.onTranscript(transcript);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={start}
      aria-label={
        listening ? "Stop voice input" : "Add strategy context by voice"
      }
    >
      {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {listening ? "Stop listening" : "Add by voice"}
    </Button>
  );
}
