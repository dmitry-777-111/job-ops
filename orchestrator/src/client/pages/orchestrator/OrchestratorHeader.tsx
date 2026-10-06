import { JobAgentMark } from "@client/components/JobAgentMark";
import { useInterfaceLanguage } from "@client/components/LanguagePreferencesMenu";
import { PageHeader, StatusIndicator } from "@client/components/layout";
import { translateUi } from "@client/lib/i18n";
import { PRODUCT_BRAND } from "@client/lib/product-brand";
import type { JobSource } from "@shared/types.js";
import {
  FileText,
  Loader2,
  MoreHorizontal,
  Play,
  Square,
  X,
} from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrchestratorHeaderProps {
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  isPipelineRunning: boolean;
  isCancelling: boolean;
  pipelineSources: JobSource[];
  hideRunAction?: boolean;
  isSearchComposerOpen?: boolean;
  onOpenAutomaticRun: () => void;
  onCancelPipeline: () => void;
  onOpenManualImport: () => void;
}

export const OrchestratorHeader: React.FC<OrchestratorHeaderProps> = ({
  navOpen,
  onNavOpenChange,
  isPipelineRunning,
  isCancelling,
  pipelineSources,
  hideRunAction = false,
  isSearchComposerOpen = false,
  onOpenAutomaticRun,
  onCancelPipeline,
  onOpenManualImport,
}) => {
  const interfaceLanguage = useInterfaceLanguage();
  const primaryAction = hideRunAction ? null : isPipelineRunning ? (
    <Button
      size="sm"
      onClick={onCancelPipeline}
      disabled={isCancelling}
      variant="destructive"
      className="gap-2"
    >
      {isCancelling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Square className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {isCancelling ? `Cancelling (${pipelineSources.length})` : `Cancel run`}
      </span>
    </Button>
  ) : (
    <Button
      size="sm"
      onClick={onOpenAutomaticRun}
      variant={isSearchComposerOpen ? "secondary" : "default"}
      className="gap-2"
      aria-pressed={isSearchComposerOpen}
    >
      {isSearchComposerOpen ? (
        <X className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {translateUi(
          isSearchComposerOpen ? "Close search" : "Run search",
          interfaceLanguage,
        )}
      </span>
    </Button>
  );
  const actions = (
    <div className="flex items-center gap-2">
      {primaryAction}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="More job actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={onOpenManualImport}
            className="cursor-pointer gap-2"
          >
            <FileText className="h-4 w-4" />
            {translateUi("Import job manually", interfaceLanguage)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <PageHeader
      icon={JobAgentMark}
      title={PRODUCT_BRAND.name}
      subtitle={translateUi("Admin workspace", interfaceLanguage)}
      badge={translateUi("System Admin", interfaceLanguage)}
      navOpen={navOpen}
      onNavOpenChange={onNavOpenChange}
      statusIndicator={
        isPipelineRunning ? (
          <StatusIndicator
            label={translateUi("Search running", interfaceLanguage)}
            variant="amber"
          />
        ) : undefined
      }
      actions={actions}
    />
  );
};
