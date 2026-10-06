import { useInterfaceLanguage } from "@client/components/LanguagePreferencesMenu";
import { translateUi } from "@client/lib/i18n";
import { PRODUCT_BRAND } from "@client/lib/product-brand";
import { BaseResumeSelection } from "@client/pages/settings/components/BaseResumeSelection";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import type React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { ValidationState } from "../types";
import { InlineValidation } from "./InlineValidation";

export const RxResumeStep: React.FC<{
  baseResumeValue: string | null;
  isBusy: boolean;
  isResumeReady: boolean;
  hasRxResumeAccess: boolean;
  allowSelfHosted?: boolean;
  isSelfHosted: boolean;
  rxresumeApiKey: string;
  rxresumeUrl: string;
  rxresumeValidation: ValidationState;
  rxresumeApiKeyHint: string | null | undefined;
  onTemplateResumeChange: (value: string | null) => void;
  onSelfHostedChange: (next: boolean) => void;
  onRxresumeApiKeyChange: (value: string) => void;
  onRxresumeUrlChange: (value: string) => void;
}> = ({
  baseResumeValue,
  allowSelfHosted = true,
  hasRxResumeAccess,
  isBusy,
  isResumeReady,
  isSelfHosted,
  onTemplateResumeChange,
  onRxresumeApiKeyChange,
  onRxresumeUrlChange,
  onSelfHostedChange,
  rxresumeApiKey,
  rxresumeApiKeyHint,
  rxresumeUrl,
  rxresumeValidation,
}) => {
  const interfaceLanguage = useInterfaceLanguage();
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          {translateUi(
            "Use Reactive Resume if your current resume already lives there. Once connected, " +
              PRODUCT_BRAND.name +
              " can use that resume for matching, fit assessment, tailoring, and application workflows.",
            interfaceLanguage,
          )}
        </div>

        <SettingsInput
          label={translateUi("v5 API key", interfaceLanguage)}
          inputProps={{
            name: "rxresumeApiKey",
            value: rxresumeApiKey,
            onChange: (event) =>
              onRxresumeApiKeyChange(event.currentTarget.value),
          }}
          type="password"
          placeholder={translateUi("Enter v5 API key", interfaceLanguage)}
          helper={
            rxresumeApiKeyHint
              ? translateUi(
                  "Leave blank to keep the saved v5 API key.",
                  interfaceLanguage,
                )
              : undefined
          }
          disabled={isBusy}
        />

        {allowSelfHosted ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
            <label
              htmlFor="rxresume-self-hosted"
              className="flex cursor-pointer items-start gap-3"
            >
              <Checkbox
                id="rxresume-self-hosted"
                checked={isSelfHosted}
                onCheckedChange={(checked) =>
                  onSelfHostedChange(Boolean(checked))
                }
                disabled={isBusy}
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {translateUi(
                    "Self-hosted Reactive Resume?",
                    interfaceLanguage,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {translateUi(
                    "Turn this on only if you run your own instance and need a custom base URL.",
                    interfaceLanguage,
                  )}
                </p>
              </div>
            </label>
          </div>
        ) : null}

        {allowSelfHosted && isSelfHosted ? (
          <SettingsInput
            label={translateUi("Custom URL", interfaceLanguage)}
            inputProps={{
              name: "rxresumeUrl",
              value: rxresumeUrl,
              onChange: (event) =>
                onRxresumeUrlChange(event.currentTarget.value),
            }}
            type="url"
            placeholder="https://rxresu.me"
            helper={translateUi(
              "Enter the root URL for your self-hosted Reactive Resume instance, such as https://resume.yourdomain.com.",
              interfaceLanguage,
            )}
            disabled={isBusy}
          />
        ) : null}

        {hasRxResumeAccess ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {translateUi("Template resume", interfaceLanguage)}
              </div>
              <p className="text-xs text-muted-foreground">
                {translateUi(
                  "Choose the resume " +
                    PRODUCT_BRAND.name +
                    " should use as the source for matching, fit assessment, and tailored applications.",
                  interfaceLanguage,
                )}
              </p>
            </div>
            <BaseResumeSelection
              value={baseResumeValue}
              onValueChange={onTemplateResumeChange}
              hasRxResumeAccess={hasRxResumeAccess}
              disabled={isBusy}
            />
            {isResumeReady ? (
              <div className="text-xs text-muted-foreground">
                {translateUi(
                  "You already have a usable resume source, so this selection stays optional.",
                  interfaceLanguage,
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <InlineValidation
        state={rxresumeValidation}
        successMessage={translateUi(
          "Reactive Resume connection verified.",
          interfaceLanguage,
        )}
      />
    </div>
  );
};
