import * as api from "@client/api";
import {
  LanguagePreferencesMenu,
  useInterfaceLanguage,
} from "@client/components/LanguagePreferencesMenu";
import { PageHeader, PageMain } from "@client/components/layout";
import { translateUi } from "@client/lib/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Languages, Link2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CandidateSettingsPage() {
  const language = useInterfaceLanguage();
  const [password, setPassword] = useState("");
  const meQuery = useQuery({
    queryKey: ["auth", "me", "candidate-settings"],
    queryFn: api.getCurrentAuthUser,
    retry: false,
  });
  const passwordMutation = useMutation({
    mutationFn: api.changeOwnPassword,
    onSuccess: () => {
      setPassword("");
      toast.success("Password changed");
    },
    onError: () => toast.error("Could not change password"),
  });

  return (
    <>
      <PageHeader
        icon={Link2}
        title="Profile & connections"
        subtitle="Personal preferences, languages, account security and connected job-search channels"
      />
      <PageMain>
        <section className="mx-auto max-w-4xl space-y-4">
          <article className="rounded-xl border border-border/60 bg-card/70 p-5">
            <div className="flex items-start gap-3">
              <Languages className="mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <h2 className="font-semibold">Languages</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your interface language and the language used for resumes,
                  cover letters and application packages are independent.
                </p>
                <div className="mt-4">
                  <LanguagePreferencesMenu />
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-card/70 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">
                    AI-assisted career intelligence
                  </h2>
                  <Badge variant="outline">
                    {translateUi("AI-assisted", language)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pathfinder uses AI to explain fit, tailor application
                  materials and surface profile improvements. Provider, model
                  and infrastructure controls are managed separately by the
                  system administrator.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI never silently changes verified career facts, hard
                  constraints or your active strategy.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-card/70 p-5">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">Account & security</h2>
                  <Badge variant="secondary">Candidate</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {meQuery.data?.displayName ||
                    meQuery.data?.username ||
                    "Current account"}
                  {meQuery.data?.workspaceName
                    ? ` · ${meQuery.data.workspaceName}`
                    : ""}
                </div>
                <div className="mt-4 flex max-w-lg flex-col gap-2 sm:flex-row">
                  <Input
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder="New password"
                    type="password"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={passwordMutation.isPending || password.length < 8}
                    onClick={() => passwordMutation.mutate(password)}
                  >
                    Change password
                  </Button>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-dashed border-border/70 p-5">
            <h2 className="font-semibold">Connected job-search channels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              LinkedIn, Indeed, Job Bank and employer-site profile improvement
              signals will appear here as those channels are connected and
              measured.
            </p>
          </article>
        </section>
      </PageMain>
    </>
  );
}
