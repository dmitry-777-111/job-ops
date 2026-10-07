import { zodResolver } from "@hookform/resolvers/zod";
import type { StageEvent } from "@shared/types.js";
import { STAGE_LABELS } from "@shared/types.js";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { VoiceTextInputButton } from "@/client/components/VoiceTextInputButton";
import { evidenceKindForStage } from "@/client/lib/evidence";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const logEventSchema = z
  .object({
    stage: z.string(),
    title: z.string().min(1, "Title is required"),
    date: z.string().min(1, "Date is required"),
    notes: z.string().optional(),
    reasonCode: z.string().optional(),
    salary: z.string().optional(),
    evidenceNote: z.string().optional(),
    interviewDebrief: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (evidenceKindForStage(value.stage) && !value.evidenceNote?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceNote"],
        message:
          "Describe the evidence you personally verified, including source and date.",
      });
    }
  });

export type LogEventFormValues = z.infer<typeof logEventSchema>;

interface LogEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog: (values: LogEventFormValues, eventId?: string) => Promise<void>;
  editingEvent?: StageEvent | null;
  jobTitle?: string;
  employer?: string;
}

const STAGE_OPTIONS = [
  { label: "No Stage Change (Keep current status)", value: "no_change" },
  { label: STAGE_LABELS.applied, value: "applied" },
  { label: STAGE_LABELS.recruiter_screen, value: "recruiter_screen" },
  { label: STAGE_LABELS.assessment, value: "assessment" },
  { label: STAGE_LABELS.hiring_manager_screen, value: "hiring_manager_screen" },
  { label: STAGE_LABELS.technical_interview, value: "technical_interview" },
  { label: STAGE_LABELS.onsite, value: "onsite" },
  { label: STAGE_LABELS.offer, value: "offer" },
  { label: "Rejected", value: "rejected" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: STAGE_LABELS.closed, value: "closed" },
];

const REASON_CODES = ["Skills", "Visa", "Timing", "Culture", "Unknown"];

const INTERVIEW_DEBRIEF_STAGES = new Set([
  "recruiter_screen",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
]);

const toDateTimeLocal = (value: Date) => {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes(),
  )}`;
};

export const LogEventModal: React.FC<LogEventModalProps> = ({
  isOpen,
  onClose,
  onLog,
  editingEvent,
  jobTitle,
  employer,
}) => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LogEventFormValues>({
    resolver: zodResolver(logEventSchema),
    defaultValues: {
      stage: "no_change",
      title: "Update",
      date: toDateTimeLocal(new Date()),
      notes: "",
    },
  });

  const selectedStage = watch("stage");
  const interviewDebrief = watch("interviewDebrief") ?? "";

  React.useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        reset({
          stage:
            editingEvent.outcome === "rejected"
              ? "rejected"
              : editingEvent.toStage,
          title: editingEvent.metadata?.eventLabel || "",
          date: toDateTimeLocal(new Date(editingEvent.occurredAt * 1000)),
          notes: editingEvent.metadata?.note || "",
          interviewDebrief: editingEvent.metadata?.interviewDebrief || "",
          evidenceNote:
            editingEvent.metadata?.evidence?.note ||
            editingEvent.metadata?.evidence?.sourceId ||
            editingEvent.metadata?.evidence?.sourceUrl ||
            "",
          reasonCode: editingEvent.metadata?.reasonCode || undefined,
          salary: editingEvent.metadata?.externalUrl?.startsWith("Salary: ")
            ? editingEvent.metadata.externalUrl.replace("Salary: ", "")
            : undefined,
        });
      } else {
        reset({
          stage: "no_change",
          title: "Update",
          date: toDateTimeLocal(new Date()),
          notes: "",
          interviewDebrief: "",
        });
      }
    }
  }, [isOpen, reset, editingEvent]);

  React.useEffect(() => {
    // Only auto-update title if we're not editing or if the title is empty/default
    if (!editingEvent) {
      if (selectedStage === "no_change") {
        setValue("title", "Update");
      } else {
        const option = STAGE_OPTIONS.find((o) => o.value === selectedStage);
        if (option) {
          setValue("title", option.label);
        }
      }
    }
  }, [selectedStage, setValue, editingEvent]);

  const onSubmit = async (values: LogEventFormValues) => {
    await onLog(values, editingEvent?.id);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent
        data-testid="log-event-modal"
        className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {editingEvent ? "Edit Event" : "Log Event"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {editingEvent
              ? "Update the details of this event."
              : jobTitle
                ? `Record a new update or stage change for ${jobTitle}${
                    employer ? ` at ${employer}` : ""
                  }.`
                : "Record a new update or stage change for this application."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel>New Stage</FieldLabel>
            <Controller
              name="stage"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.stage]} />
          </Field>

          <Field>
            <FieldLabel>Event Title</FieldLabel>
            <Input {...register("title")} placeholder="e.g. Recruiter Screen" />
            <FieldError errors={[errors.title]} />
          </Field>

          <Field>
            <FieldLabel>Date</FieldLabel>
            <Input type="datetime-local" {...register("date")} />
            <FieldError errors={[errors.date]} />
          </Field>

          <Field>
            <FieldLabel>Notes (Optional)</FieldLabel>
            <Textarea {...register("notes")} placeholder="Add details..." />
            <FieldError errors={[errors.notes]} />
          </Field>

          {INTERVIEW_DEBRIEF_STAGES.has(selectedStage) ? (
            <Field>
              <FieldLabel>Interview debrief (optional)</FieldLabel>
              <Textarea
                {...register("interviewDebrief")}
                placeholder="What did they ask? What felt difficult? What signals did you notice?"
              />
              <div className="flex flex-wrap items-center gap-2">
                <VoiceTextInputButton
                  idleLabel="Talk to TJAgent"
                  startAriaLabel="Add interview debrief by voice"
                  onTranscript={(text) =>
                    setValue(
                      "interviewDebrief",
                      [interviewDebrief.trim(), text].filter(Boolean).join(" "),
                      { shouldDirty: true },
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Speak naturally; TJAgent converts it to text for review.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                After the interview, tell TJAgent what happened. It will compare
                your account with the real outcome before suggesting what to
                improve next.
              </p>
            </Field>
          ) : null}

          {evidenceKindForStage(selectedStage) && (
            <Field>
              <FieldLabel htmlFor="evidence-note">
                Verified evidence (required)
              </FieldLabel>
              <Textarea
                id="evidence-note"
                {...register("evidenceNote")}
                placeholder="Describe the confirmation you checked, its source and date."
              />
              <p className="text-xs text-muted-foreground">
                Saving confirms you personally verified this evidence. AI
                classifications are not evidence.
              </p>
              <FieldError errors={[errors.evidenceNote]} />
            </Field>
          )}

          {selectedStage === "rejected" && (
            <Field className="animate-in fade-in slide-in-from-top-1 duration-200">
              <FieldLabel>Reason</FieldLabel>
              <Controller
                name="reasonCode"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}

          {selectedStage === "offer" && (
            <Field className="animate-in fade-in slide-in-from-top-1 duration-200">
              <FieldLabel>Salary / Details</FieldLabel>
              <Input {...register("salary")} placeholder="e.g. £50k + bonus" />
            </Field>
          )}

          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel type="button" onClick={onClose}>
              Cancel
            </AlertDialogCancel>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingEvent
                  ? "Save Changes"
                  : "Log Event"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
