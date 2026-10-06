import { Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useInterfaceLanguage } from "@/client/components/LanguagePreferencesMenu";
import { translateUi } from "@/client/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_PROFILE_URLS = 6;

export function JobProfilesStep(props: {
  initialUrls: string[];
  busy: boolean;
  onBack: () => void;
  onSave: (urls: string[]) => void | Promise<void>;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  const [urls, setUrls] = useState<string[]>(
    props.initialUrls.length > 0
      ? props.initialUrls.slice(0, MAX_PROFILE_URLS)
      : [""],
  );

  const normalizedUrls = useMemo(
    () => urls.map((url) => url.trim()).filter(Boolean),
    [urls],
  );

  const invalid = normalizedUrls.some((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol !== "http:" && parsed.protocol !== "https:";
    } catch {
      return true;
    }
  });

  const updateUrl = (index: number, value: string) => {
    setUrls((current) =>
      current.map((url, currentIndex) =>
        currentIndex === index ? value : url,
      ),
    );
  };

  const removeUrl = (index: number) => {
    setUrls((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [""];
    });
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {translateUi("Job-platform profiles", interfaceLanguage)}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {translateUi(
            "Add links to your job-platform profiles",
            interfaceLanguage,
          )}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {translateUi(
            "Paste links to the profiles you use on job-search platforms. The JobAgent will later use them to assess profile completeness, positioning and consistency and suggest improvements.",
            interfaceLanguage,
          )}
        </p>
      </div>

      <div className="space-y-3">
        {urls.map((url, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: empty URL rows are positional form fields
          <div className="flex gap-2" key={index}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <Input
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => updateUrl(index, event.currentTarget.value)}
              placeholder={translateUi(
                "https://example.com/your-profile",
                interfaceLanguage,
              )}
              aria-label={`${translateUi(
                "Job-platform profile link",
                interfaceLanguage,
              )} ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeUrl(index)}
              aria-label={translateUi("Remove link", interfaceLanguage)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {invalid ? (
        <p className="text-sm text-destructive">
          {translateUi(
            "Use a full http:// or https:// profile link.",
            interfaceLanguage,
          )}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={props.onBack}
          disabled={props.busy}
        >
          {translateUi("Back", interfaceLanguage)}
        </Button>
        <div className="flex flex-wrap gap-2">
          {urls.length < MAX_PROFILE_URLS ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setUrls((current) => [...current, ""])}
              disabled={props.busy}
            >
              <Plus className="h-4 w-4" />
              {translateUi("Add another link", interfaceLanguage)}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={props.busy}
            onClick={() => props.onSave([])}
          >
            {translateUi("Skip for now", interfaceLanguage)}
          </Button>
          <Button
            type="button"
            disabled={props.busy || invalid}
            onClick={() => props.onSave(normalizedUrls)}
          >
            {translateUi(
              props.busy ? "Saving..." : "Save and finish",
              interfaceLanguage,
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {translateUi("You can add up to 6 profile links.", interfaceLanguage)}
      </p>
    </div>
  );
}
