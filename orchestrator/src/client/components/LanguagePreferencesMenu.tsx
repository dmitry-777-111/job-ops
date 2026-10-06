import * as api from "@client/api";
import { useSettings } from "@client/hooks/useSettings";
import { queryKeys } from "@client/lib/queryKeys";
import type { ChatStyleManualLanguage, InterfaceLanguage } from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Globe2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { INTERFACE_LANGUAGE_OPTIONS, translateUi } from "../lib/i18n";

const STORAGE_KEY = "pathfinder.interfaceLanguage";
const LANGUAGE_EVENT = "pathfinder:language";

const applicationOptions: Array<{
  value: "auto" | InterfaceLanguage;
  label: string;
  manual?: ChatStyleManualLanguage;
}> = [
  { value: "auto", label: "Auto — match vacancy" },
  { value: "en", label: "English", manual: "english" },
  { value: "es", label: "Español", manual: "spanish" },
  { value: "fr", label: "Français", manual: "french" },
  { value: "ru", label: "Русский", manual: "russian" },
  { value: "de", label: "Deutsch", manual: "german" },
];

function readLocalInterfaceLanguage(): InterfaceLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (INTERFACE_LANGUAGE_OPTIONS.some((option) => option.value === value)) {
      return value as InterfaceLanguage;
    }
  } catch {
    // Ignore storage restrictions.
  }
  return "en";
}

export function useInterfaceLanguage(): InterfaceLanguage {
  const [language, setLanguage] = useState<InterfaceLanguage>(
    readLocalInterfaceLanguage,
  );

  useEffect(() => {
    const sync = () => setLanguage(readLocalInterfaceLanguage());
    window.addEventListener(LANGUAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return language;
}

function setLocalInterfaceLanguage(language: InterfaceLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage restrictions.
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function InterfaceLanguageMenu() {
  const interfaceLanguage = useInterfaceLanguage();

  const selectInterfaceLanguage = (language: InterfaceLanguage) => {
    setLocalInterfaceLanguage(language);
    if (!api.hasAuthenticatedSession()) return;
    void api.updateSettings({ interfaceLanguage: language }).catch(() => {
      // Keep the local preference even if the server is temporarily unavailable.
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          aria-label="Interface language"
        >
          <Globe2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">
            {interfaceLanguage}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          {translateUi("Interface language", interfaceLanguage)}
        </DropdownMenuLabel>
        {INTERFACE_LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => selectInterfaceLanguage(option.value)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {interfaceLanguage === option.value ? (
              <Check className="h-4 w-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function currentApplicationLanguage(
  mode: string | undefined,
  manual: string | undefined,
): "auto" | InterfaceLanguage {
  if (mode !== "manual") return "auto";
  switch (manual) {
    case "spanish":
      return "es";
    case "french":
      return "fr";
    case "russian":
      return "ru";
    case "german":
      return "de";
    default:
      return "en";
  }
}

export function LanguagePreferencesMenu() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const interfaceLanguage = useInterfaceLanguage();
  const applicationLanguage = useMemo(
    () =>
      currentApplicationLanguage(
        settings?.chatStyleLanguageMode?.value,
        settings?.chatStyleManualLanguage?.value,
      ),
    [
      settings?.chatStyleLanguageMode?.value,
      settings?.chatStyleManualLanguage?.value,
    ],
  );

  useEffect(() => {
    const serverLanguage = settings?.interfaceLanguage?.value;
    if (!serverLanguage || serverLanguage === interfaceLanguage) return;
    setLocalInterfaceLanguage(serverLanguage);
  }, [interfaceLanguage, settings?.interfaceLanguage?.value]);

  const save = async (update: Parameters<typeof api.updateSettings>[0]) => {
    const next = await api.updateSettings(update);
    queryClient.setQueryData(queryKeys.settings.current(), next);
    return next;
  };

  const setInterfaceLanguage = async (language: InterfaceLanguage) => {
    setLocalInterfaceLanguage(language);
    if (!settings) return;
    try {
      await save({ interfaceLanguage: language });
    } catch {
      toast.error("Could not save interface language");
    }
  };

  const setApplicationLanguage = async (value: "auto" | InterfaceLanguage) => {
    if (!settings) return;
    try {
      if (value === "auto") {
        await save({ chatStyleLanguageMode: "match-job-description" });
      } else {
        const option = applicationOptions.find((item) => item.value === value);
        if (!option?.manual) return;
        await save({
          chatStyleLanguageMode: "manual",
          chatStyleManualLanguage: option.manual,
        });
      }
      toast.success("Application language saved");
    } catch {
      toast.error("Could not save application language");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          aria-label="Language settings"
        >
          <Globe2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">
            {interfaceLanguage}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {translateUi("Interface language", interfaceLanguage)}
        </DropdownMenuLabel>
        {INTERFACE_LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => void setInterfaceLanguage(option.value)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {interfaceLanguage === option.value ? (
              <Check className="h-4 w-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {translateUi("Resume & application language", interfaceLanguage)}
        </DropdownMenuLabel>
        <div className="px-2 pb-1 text-xs text-muted-foreground">
          Independent from the interface language.
        </div>
        {applicationOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            disabled={!settings}
            onSelect={() => void setApplicationLanguage(option.value)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {applicationLanguage === option.value ? (
              <Check className="h-4 w-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
