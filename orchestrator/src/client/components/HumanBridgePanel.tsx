import * as api from "@client/api";
import {
  HUMAN_BRIDGE_LEVELS,
  type HumanBridgeContact,
  type HumanBridgeLevel,
} from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

function parseOptionalTimestamp(
  value: FormDataEntryValue | null,
): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatLocalDateTime(timestamp: number | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function readContactForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? "").trim(),
    role: String(data.get("role") ?? "").trim() || null,
    linkedinUrl: String(data.get("linkedinUrl") ?? "").trim() || null,
    influenceScore: Number(data.get("influenceScore") ?? 0),
    bridgeLevel: String(data.get("bridgeLevel") ?? "B0") as HumanBridgeLevel,
    bridgeEvidence: String(data.get("bridgeEvidence") ?? "").trim() || null,
    lastContactAt: parseOptionalTimestamp(data.get("lastContactAt")),
    outcome: String(data.get("outcome") ?? "").trim() || null,
    linkToJob: data.get("linkToJob") === "on",
  };
}

function ContactFields({
  contact,
  jobId,
}: {
  contact?: HumanBridgeContact;
  jobId: string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label>
        Name
        <input
          name="name"
          required
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.name ?? ""}
        />
      </label>
      <label>
        Role
        <input
          name="role"
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.role ?? ""}
        />
      </label>
      <label className="md:col-span-2">
        LinkedIn
        <input
          name="linkedinUrl"
          type="url"
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.linkedinUrl ?? ""}
          placeholder="https://www.linkedin.com/in/..."
        />
      </label>
      <label>
        Influence 0-3
        <select
          name="influenceScore"
          className="block w-full rounded border bg-background p-2"
          defaultValue={String(contact?.influenceScore ?? 0)}
        >
          {[0, 1, 2, 3].map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bridge
        <select
          name="bridgeLevel"
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.bridgeLevel ?? "B0"}
        >
          {HUMAN_BRIDGE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <label className="md:col-span-2">
        Bridge evidence
        <textarea
          name="bridgeEvidence"
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.bridgeEvidence ?? ""}
          placeholder="Verified relationship/source. Required for Influence > 0 or Bridge > B0."
        />
      </label>
      <label>
        Last contact
        <input
          name="lastContactAt"
          type="datetime-local"
          className="block w-full rounded border bg-background p-2"
          defaultValue={formatLocalDateTime(contact?.lastContactAt ?? null)}
        />
      </label>
      <label>
        Outcome
        <input
          name="outcome"
          className="block w-full rounded border bg-background p-2"
          defaultValue={contact?.outcome ?? ""}
          placeholder="No outreach / replied / referred / follow-up..."
        />
      </label>
      <label className="md:col-span-2 flex items-center gap-2 text-sm">
        <input
          name="linkToJob"
          type="checkbox"
          defaultChecked={contact ? contact.jobId === jobId : true}
        />
        Link this person to this vacancy as well as the company
      </label>
    </div>
  );
}

export function HumanBridgePanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["job-human-bridge", jobId];
  const context = useQuery({
    queryKey,
    queryFn: () => api.getJobHumanBridgeContext(jobId),
  });

  const create = useMutation({
    mutationFn: (form: HTMLFormElement) =>
      api.createHumanBridgeContact(jobId, readContactForm(form)),
    onSuccess: async (_, form) => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useMutation({
    mutationFn: ({
      contactId,
      form,
    }: {
      contactId: string;
      form: HTMLFormElement;
    }) => api.updateHumanBridgeContact(jobId, contactId, readContactForm(form)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  if (context.isLoading) {
    return (
      <section className="my-4 rounded border p-3">
        Loading Human Bridge...
      </section>
    );
  }

  const error = context.error || create.error || update.error;
  return (
    <section className="my-4 space-y-4 rounded border p-3">
      <div>
        <h3 className="font-semibold">Human Bridge</h3>
        <p className="text-sm text-muted-foreground">
          Company and people are separate entities. Bridge can affect outreach
          priority, but it never overrides hard requirements or exclusions.
        </p>
        <p className="text-sm">
          Company: <strong>{context.data?.company.name ?? "unknown"}</strong>
        </p>
      </div>

      {error && (
        <div className="rounded border border-destructive/40 p-2 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Human Bridge request failed"}
        </div>
      )}

      <form
        className="space-y-3 rounded border border-dashed p-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(event.currentTarget);
        }}
      >
        <h4 className="font-medium">Add person</h4>
        <ContactFields jobId={jobId} />
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? "Saving..." : "Add Human Bridge contact"}
        </Button>
      </form>

      <div className="space-y-3">
        {(context.data?.contacts ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No Human Bridge contacts recorded for this company.
          </p>
        )}
        {(context.data?.contacts ?? []).map((contact) => (
          <form
            key={contact.id}
            className="space-y-3 rounded border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({
                contactId: contact.id,
                form: event.currentTarget,
              });
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>{contact.name}</strong>
                {contact.role ? (
                  <span className="text-muted-foreground">
                    {" "}
                    - {contact.role}
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                Influence {contact.influenceScore} / Bridge{" "}
                {contact.bridgeLevel}
              </span>
            </div>
            <ContactFields contact={contact} jobId={jobId} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={update.isPending}
            >
              Save contact
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}
