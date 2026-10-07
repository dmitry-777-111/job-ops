import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseResumeStep } from "./BaseResumeStep";

const defaultProps = {
  baseResumeValidation: {
    checked: false,
    hydrated: true,
    valid: false,
    message: null,
  },
  baseResumeValue: null,
  hasRxResumeAccess: false,
  importingResumeFileName: null,
  isBusy: false,
  isImportingResume: false,
  isResumeReady: false,
  isRxResumeSelfHosted: false,
  resumeSetupMode: "upload" as const,
  rxresumeApiKey: "",
  rxresumeApiKeyHint: null,
  rxresumeUrl: "",
  rxresumeValidation: {
    checked: false,
    hydrated: true,
    valid: false,
    message: null,
  },
  onImportResumeFile: vi.fn(),
  onResumeSetupModeChange: vi.fn(),
  onRxresumeApiKeyChange: vi.fn(),
  onRxresumeSelfHostedChange: vi.fn(),
  onRxresumeUrlChange: vi.fn(),
  onTemplateResumeChange: vi.fn(),
};

describe("BaseResumeStep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the file picker and imports the selected resume", () => {
    const onImportResumeFile = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <BaseResumeStep
        {...defaultProps}
        onImportResumeFile={onImportResumeFile}
      />,
    );

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(
      screen.getByRole("button", { name: /upload resume file/i }),
    );
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(["resume"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImportResumeFile).toHaveBeenCalledWith(file);
  });

  it("imports a resume dropped onto the upload zone", () => {
    const onImportResumeFile = vi.fn().mockResolvedValue(undefined);
    render(
      <BaseResumeStep
        {...defaultProps}
        onImportResumeFile={onImportResumeFile}
      />,
    );

    const file = new File(["resume"], "resume.pdf", {
      type: "application/pdf",
    });
    fireEvent.drop(screen.getByTestId("resume-drop-zone"), {
      dataTransfer: { files: [file] },
    });

    expect(onImportResumeFile).toHaveBeenCalledWith(file);
  });

  it("shows optimistic resume import progress while a file import is running", () => {
    vi.useFakeTimers();

    render(
      <BaseResumeStep
        {...defaultProps}
        importingResumeFileName="resume.pdf"
        isBusy
        isImportingResume
      />,
    );

    expect(screen.getByText("Importing resume")).toBeInTheDocument();
    expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("Reading file")).toHaveLength(1);
    expect(screen.queryByText("Preparing import")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Extracting resume text"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload resume file/i }),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Still working. Larger PDFs and DOCX files can take a little longer.",
      ),
    ).toBeInTheDocument();
  });

  it("uses a longer optimistic import profile for Codex", () => {
    vi.useFakeTimers();

    render(
      <BaseResumeStep
        {...defaultProps}
        importingResumeFileName="resume.pdf"
        isBusy
        isImportingResume
        selectedProvider="codex"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Still working. Larger PDFs and DOCX files can take a little longer.",
      ),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(35_000);
    });

    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Still working. Codex imports can take around a minute for larger resumes.",
      ),
    ).toBeInTheDocument();
  });

  it("shows only document upload copy when Reactive Resume is disabled", () => {
    render(<BaseResumeStep {...defaultProps} allowReactiveResume={false} />);

    expect(screen.getByText("PDF / DOCX")).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /use reactive resume/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Reactive Resume JSON/i)).not.toBeInTheDocument();
  });

  it("keeps Reactive Resume collapsed until the user opens other import methods", () => {
    render(<BaseResumeStep {...defaultProps} allowReactiveResume />);

    expect(
      screen.getByRole("button", { name: "Other import methods" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect Reactive Resume" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Other import methods" }),
    );

    expect(
      screen.getByRole("button", { name: "Connect Reactive Resume" }),
    ).toBeInTheDocument();
  });

  it("hides self-hosted Reactive Resume controls when disabled", () => {
    render(
      <BaseResumeStep
        {...defaultProps}
        allowSelfHostedReactiveResume={false}
        resumeSetupMode="rxresume"
      />,
    );

    expect(
      screen.queryByText("Self-hosted Reactive Resume?"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom URL")).not.toBeInTheDocument();
  });
});
