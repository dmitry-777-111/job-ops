import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceTextInputButton } from "./VoiceTextInputButton";

type FakeRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

const originalSpeechRecognition = (
  window as typeof window & { SpeechRecognition?: unknown }
).SpeechRecognition;
const originalWebkitSpeechRecognition = (
  window as typeof window & { webkitSpeechRecognition?: unknown }
).webkitSpeechRecognition;

afterEach(() => {
  const target = window as typeof window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  target.SpeechRecognition = originalSpeechRecognition;
  target.webkitSpeechRecognition = originalWebkitSpeechRecognition;
});

describe("VoiceTextInputButton", () => {
  it("stays hidden when browser speech recognition is unavailable", () => {
    const target = window as typeof window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    delete target.SpeechRecognition;
    delete target.webkitSpeechRecognition;

    render(<VoiceTextInputButton onTranscript={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Add strategy context by voice" }),
    ).not.toBeInTheDocument();
  });

  it("returns a final transcript when browser capability is available", () => {
    let instance: FakeRecognitionInstance | null = null;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: FakeRecognitionInstance["onresult"] = null;
      onerror: FakeRecognitionInstance["onerror"] = null;
      onend: FakeRecognitionInstance["onend"] = null;
      start = vi.fn();
      stop = vi.fn();

      constructor() {
        instance = this;
      }
    }

    (
      window as typeof window & {
        webkitSpeechRecognition?: typeof FakeRecognition;
      }
    ).webkitSpeechRecognition = FakeRecognition;

    const onTranscript = vi.fn();
    render(<VoiceTextInputButton onTranscript={onTranscript} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add strategy context by voice" }),
    );

    expect(instance?.start).toHaveBeenCalledTimes(1);
    instance?.onresult?.({
      results: [
        { 0: { transcript: "  higher income with customer contact  " } },
      ],
    });

    expect(onTranscript).toHaveBeenCalledWith(
      "higher income with customer contact",
    );
  });
});
