import { PipelineProgress } from "@client/components";
import { useInterfaceLanguage } from "@client/components/LanguagePreferencesMenu";
import { useWelcomeMessage } from "@client/hooks/useWelcomeMessage";
import { translateUi } from "@client/lib/i18n";
import type { JobStatus } from "@shared/types.js";
import type React from "react";

interface OrchestratorSummaryProps {
  stats: Record<JobStatus, number>;
  isPipelineRunning: boolean;
}

export const OrchestratorSummary: React.FC<OrchestratorSummaryProps> = ({
  isPipelineRunning,
}) => {
  const welcomeText = useWelcomeMessage();
  const interfaceLanguage = useInterfaceLanguage();
  const localizedWelcome =
    interfaceLanguage === "en"
      ? welcomeText
      : translateUi("Welcome back. The jobs missed you.", interfaceLanguage);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium tracking-tight">
          {localizedWelcome}
        </h1>
      </div>

      {isPipelineRunning && (
        <div>
          <PipelineProgress isRunning={isPipelineRunning} />
        </div>
      )}
    </section>
  );
};
