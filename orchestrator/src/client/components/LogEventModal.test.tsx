import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LogEventModal } from "./LogEventModal";

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/client/components/VoiceTextInputButton", () => ({
  VoiceTextInputButton: ({
    onTranscript,
  }: {
    onTranscript: (text: string) => void;
  }) => (
    <button
      type="button"
      aria-label="Add interview debrief by voice"
      onClick={() =>
        onTranscript(
          "They asked about weekend availability and customer conflict.",
        )
      }
    >
      Talk to TJAgent
    </button>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

describe("LogEventModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a voice transcript to the interview debrief field", async () => {
    render(<LogEventModal isOpen onClose={vi.fn()} onLog={vi.fn()} />);

    const stageSelect = screen.getAllByTestId("select")[0];
    fireEvent.change(stageSelect, { target: { value: "recruiter_screen" } });

    const debrief = await screen.findByPlaceholderText(
      "What did they ask? What felt difficult? What signals did you notice?",
    );
    fireEvent.change(debrief, {
      target: { value: "It was a short screening." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Add interview debrief by voice" }),
    );

    expect(debrief).toHaveValue(
      "It was a short screening. They asked about weekend availability and customer conflict.",
    );
  });

  it("shows the rejection reason selector and submits the form", async () => {
    const onLog = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<LogEventModal isOpen onClose={onClose} onLog={onLog} />);

    const stageSelect = screen.getAllByTestId("select")[0];
    fireEvent.change(stageSelect, { target: { value: "rejected" } });

    expect(screen.getByText("Reason")).toBeInTheDocument();

    const reasonSelect = screen.getAllByTestId("select")[1];
    fireEvent.change(reasonSelect, { target: { value: "Visa" } });
    fireEvent.click(screen.getByRole("button", { name: /log event/i }));
    await screen.findByText(
      "Describe the evidence you personally verified, including source and date.",
    );
    expect(onLog).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Verified evidence (required)"), {
      target: { value: "Employer rejection email received 2026-10-01" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log event/i }));

    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "rejected", reasonCode: "Visa" }),
        undefined,
      ),
    );
  });

  it("blocks submit when the title is cleared", async () => {
    const onLog = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<LogEventModal isOpen onClose={onClose} onLog={onLog} />);

    const titleInput = screen.getByPlaceholderText("e.g. Recruiter Screen");
    fireEvent.change(titleInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /log event/i }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(onLog).not.toHaveBeenCalled();
  });

  it("keeps the modal scrollable on small screens", () => {
    render(<LogEventModal isOpen onClose={vi.fn()} onLog={vi.fn()} />);

    expect(screen.getByTestId("log-event-modal")).toHaveClass(
      "max-h-[calc(100vh-2rem)]",
      "overflow-y-auto",
    );
  });
});
