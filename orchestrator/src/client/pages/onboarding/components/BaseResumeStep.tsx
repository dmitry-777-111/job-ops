import { ChevronDown, FileText, Upload } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "@/client/components/LanguagePreferencesMenu";
import { translateUi } from "@/client/lib/i18n";
import type { LlmProviderId } from "@/client/pages/settings/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ResumeSetupMode, ValidationState } from "../types";
import { InlineValidation } from "./InlineValidation";
import { RxResumeStep } from "./RxResumeStep";

const RESUME_IMPORT_TOTAL_MS = 25_000;
const CODEX_RESUME_IMPORT_TOTAL_MS = 60_000;
const RESUME_IMPORT_TICK_MS = 250;
const RESUME_IMPORT_STEPS = [
  "Reading file",
  "Preparing import",
  "Extracting resume text",
  "Building Resume Studio document",
  "Saving baseline",
  "Finalizing setup",
] as const;
const DEFAULT_LONG_RUNNING_MESSAGE =
  "Still working. Larger PDFs and DOCX files can take a little longer.";
const CODEX_LONG_RUNNING_MESSAGE =
  "Still working. Codex imports can take around a minute for larger resumes.";

function getResumeImportProgressProfile(selectedProvider?: LlmProviderId) {
  if (selectedProvider === "codex") {
    return {
      totalMs: CODEX_RESUME_IMPORT_TOTAL_MS,
      longRunningMessage: CODEX_LONG_RUNNING_MESSAGE,
    };
  }

  return {
    totalMs: RESUME_IMPORT_TOTAL_MS,
    longRunningMessage: DEFAULT_LONG_RUNNING_MESSAGE,
  };
}

function ResumeImportProgress({
  fileName,
  selectedProvider,
}: {
  fileName: string | null;
  selectedProvider?: LlmProviderId;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const progressProfile = getResumeImportProgressProfile(selectedProvider);

  useEffect(() => {
    setElapsedMs(0);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, RESUME_IMPORT_TICK_MS);

    return () => window.clearInterval(interval);
  }, []);

  const cappedElapsedMs = Math.min(elapsedMs, progressProfile.totalMs);
  const activeStepIndex = Math.min(
    RESUME_IMPORT_STEPS.length - 1,
    Math.floor(
      (cappedElapsedMs / progressProfile.totalMs) * RESUME_IMPORT_STEPS.length,
    ),
  );
  const progressValue = Math.min(
    96,
    Math.max(6, Math.round((cappedElapsedMs / progressProfile.totalMs) * 96)),
  );
  const isLongRunning = elapsedMs >= progressProfile.totalMs;

  return (
    <output
      className="block rounded-lg border border-border/60 bg-muted/10 p-5"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Importing resume</div>
              <div className="truncate text-xs text-muted-foreground">
                {fileName ?? "Selected resume file"}
              </div>
            </div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {progressValue}%
            </div>
          </div>
          <Progress
            value={progressValue}
            className="h-1.5"
            aria-label="Resume import progress"
          />
          <p className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-sm leading-6 text-transparent motion-safe:animate-pulse">
            {isLongRunning
              ? progressProfile.longRunningMessage
              : RESUME_IMPORT_STEPS[activeStepIndex]}
          </p>
        </div>
      </div>
    </output>
  );
}

export const BaseResumeStep: React.FC<{
  allowReactiveResume?: boolean;
  allowSelfHostedReactiveResume?: boolean;
  baseResumeValidation: ValidationState;
  baseResumeValue: string | null;
  hasRxResumeAccess: boolean;
  importingResumeFileName: string | null;
  isBusy: boolean;
  isImportingResume: boolean;
  isResumeReady: boolean;
  isRxResumeSelfHosted: boolean;
  resumeSetupMode: ResumeSetupMode;
  rxresumeApiKey: string;
  rxresumeApiKeyHint: string | null | undefined;
  rxresumeUrl: string;
  rxresumeValidation: ValidationState;
  selectedProvider?: LlmProviderId;
  onImportResumeFile: (file: File) => Promise<void>;
  onResumeSetupModeChange: (mode: ResumeSetupMode) => void;
  onRxresumeApiKeyChange: (value: string) => void;
  onRxresumeSelfHostedChange: (next: boolean) => void;
  onRxresumeUrlChange: (value: string) => void;
  onTemplateResumeChange: (value: string | null) => void;
}> = ({
  allowReactiveResume = true,
  allowSelfHostedReactiveResume = true,
  baseResumeValidation,
  baseResumeValue,
  hasRxResumeAccess,
  importingResumeFileName,
  isBusy,
  isImportingResume,
  isResumeReady,
  isRxResumeSelfHosted,
  resumeSetupMode,
  rxresumeApiKey,
  rxresumeApiKeyHint,
  rxresumeUrl,
  rxresumeValidation,
  selectedProvider,
  onImportResumeFile,
  onResumeSetupModeChange,
  onRxresumeApiKeyChange,
  onRxresumeSelfHostedChange,
  onRxresumeUrlChange,
  onTemplateResumeChange,
}) => {
  const interfaceLanguage = useInterfaceLanguage();
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [showOtherImportMethods, setShowOtherImportMethods] = useState(
    resumeSetupMode === "rxresume",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-6" data-onboarding-target="resume-options">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            void onImportResumeFile(file);
          }
          event.currentTarget.value = "";
        }}
      />

      {isImportingResume ? (
        <ResumeImportProgress
          fileName={importingResumeFileName}
          selectedProvider={selectedProvider}
        />
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is supplemental; the nested upload button is the keyboard-accessible control.
        <div
          data-testid="resume-drop-zone"
          className={cn(
            "rounded-lg border border-border/60 bg-muted/10 p-5 transition-colors",
            isDraggingResume && "border-primary bg-primary/5",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingResume(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDraggingResume(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            ) {
              setIsDraggingResume(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingResume(false);
            const file = event.dataTransfer.files?.[0];
            if (file && !isBusy) {
              void onImportResumeFile(file);
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              <Upload className="h-4 w-4" />
              {translateUi("Upload resume file", interfaceLanguage)}
            </Button>
            <div className="text-xs text-muted-foreground">
              {allowReactiveResume
                ? "PDF / DOCX / Reactive Resume"
                : "PDF / DOCX"}
            </div>
            <div className="w-full text-xs text-muted-foreground">
              {translateUi(
                "Or drag and drop a resume file here.",
                interfaceLanguage,
              )}
            </div>
          </div>
        </div>
      )}

      <InlineValidation
        state={baseResumeValidation}
        successMessage={translateUi(
          "Your base resume is loaded and ready.",
          interfaceLanguage,
        )}
      />

      {allowReactiveResume ? (
        <>
          <div className="rounded-lg border border-border/60 bg-muted/5">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              onClick={() => setShowOtherImportMethods((visible) => !visible)}
              aria-expanded={showOtherImportMethods}
            >
              <span>
                {translateUi("Other import methods", interfaceLanguage)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showOtherImportMethods && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>

            {showOtherImportMethods ? (
              <div className="space-y-4 border-t border-border/60 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => onResumeSetupModeChange("rxresume")}
                  >
                    {translateUi("Connect Reactive Resume", interfaceLanguage)}
                  </Button>
                </div>

                {resumeSetupMode === "rxresume" ? (
                  <RxResumeStep
                    allowSelfHosted={allowSelfHostedReactiveResume}
                    baseResumeValue={baseResumeValue}
                    hasRxResumeAccess={hasRxResumeAccess}
                    isBusy={isBusy}
                    isResumeReady={isResumeReady}
                    isSelfHosted={isRxResumeSelfHosted}
                    rxresumeApiKey={rxresumeApiKey}
                    rxresumeApiKeyHint={rxresumeApiKeyHint}
                    rxresumeUrl={rxresumeUrl}
                    rxresumeValidation={rxresumeValidation}
                    onRxresumeApiKeyChange={onRxresumeApiKeyChange}
                    onRxresumeUrlChange={onRxresumeUrlChange}
                    onSelfHostedChange={onRxresumeSelfHostedChange}
                    onTemplateResumeChange={onTemplateResumeChange}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};
