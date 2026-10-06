import { PageHeader, PageMain } from "@client/components/layout";
import { useDesignResume } from "@client/hooks/useDesignResume";
import { useOnboardingStatus } from "@client/hooks/useOnboardingStatus";
import {
  formatCountryLabel,
  getCountryIso2Code,
} from "@shared/location-support.js";
import type {
  InterfaceLanguage,
  OnboardingRequirement,
  OnboardingRequirementId,
  OnboardingStatusResponse,
  ResumeProfile,
} from "@shared/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  MapPin,
  UserPlus,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import * as api from "@/client/api";
import { JobAgentMark } from "@/client/components/JobAgentMark";
import { useInterfaceLanguage } from "@/client/components/LanguagePreferencesMenu";
import { translateUi } from "@/client/lib/i18n";
import { PRODUCT_BRAND } from "@/client/lib/product-brand";
import { queryKeys } from "@/client/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { bucketDurationMs, trackProductEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { showErrorToast } from "../lib/error-toast";
import {
  getErrorCategory,
  getHttpStatusBucket,
  getTextLengthBucket,
} from "./onboarding/analytics";
import { BaseResumeStep } from "./onboarding/components/BaseResumeStep";
import { JobProfilesStep } from "./onboarding/components/JobProfilesStep";
import { LlmConnectionStep } from "./onboarding/components/LlmConnectionStep";
import { VoiceTextInputButton } from "./onboarding/components/VoiceTextInputButton";
import type { ValidationState } from "./onboarding/types";
import { useOnboardingFlow } from "./onboarding/useOnboardingFlow";

const STEP_ORDER: OnboardingRequirementId[] = [
  "profile",
  "strategy",
  "model",
  "resume",
  "job_profiles",
];
const ONBOARDING_COUNTRY_KEYS = [
  "canada",
  "united states",
  "russia",
  "china",
] as const;

const DISPLAY_LOCALE_BY_INTERFACE_LANGUAGE: Record<InterfaceLanguage, string> =
  {
    en: "en",
    es: "es",
    fr: "fr",
    ru: "ru",
    de: "de",
  };

function getOnboardingCountryOptions(language: InterfaceLanguage) {
  const displayNames = new Intl.DisplayNames(
    [DISPLAY_LOCALE_BY_INTERFACE_LANGUAGE[language]],
    { type: "region" },
  );
  return ONBOARDING_COUNTRY_KEYS.map((country) => {
    const iso2 = getCountryIso2Code(country);
    return {
      value: country,
      label: iso2
        ? displayNames.of(iso2) || formatCountryLabel(country)
        : formatCountryLabel(country),
    };
  });
}

function getRequirement(
  status: OnboardingStatusResponse | null,
  id: OnboardingRequirementId,
): OnboardingRequirement | null {
  return status?.requirements.find((item) => item.id === id) ?? null;
}

function toValidationState(
  requirement: OnboardingRequirement | null,
): ValidationState {
  return {
    valid: requirement?.status === "ready",
    message:
      requirement?.status === "ready" ? null : (requirement?.message ?? null),
    status: null,
    checked: Boolean(requirement),
    hydrated: Boolean(requirement),
  };
}

function stepTitle(id: OnboardingRequirementId): string {
  if (id === "profile") return "Your search";
  if (id === "strategy") return "Your strategy";
  if (id === "model") return "AI connection";
  if (id === "resume") return "Your resume";
  return "Job-platform profiles";
}

function getRequirementAnalyticsStatus(
  requirement: OnboardingRequirement | null,
) {
  return requirement?.status ?? "missing";
}

export const OnboardingPage: React.FC = () => {
  const [bootstrapState, setBootstrapState] = useState<
    "checking" | "account" | "launch" | "error"
  >("checking");
  const analyticsStartedAtRef = useRef(Date.now());
  const analyticsStartedRef = useRef(false);

  const trackStarted = useCallback(
    (
      entryState: "account_required" | "launch",
      nextStep: "account" | OnboardingRequirementId | "none",
      demoMode: boolean,
    ) => {
      if (analyticsStartedRef.current) return;
      analyticsStartedRef.current = true;
      trackProductEvent("onboarding_started", {
        entry_state: entryState,
        next_step: nextStep,
        has_session: api.hasAuthenticatedSession(),
        demo_mode: demoMode,
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void api
      .getAuthBootstrapStatus()
      .then((status) => {
        if (!cancelled)
          setBootstrapState(status.setupRequired ? "account" : "launch");
      })
      .catch(() => {
        if (!cancelled) setBootstrapState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bootstrapState === "account") {
      trackStarted("account_required", "account", false);
    }
  }, [bootstrapState, trackStarted]);

  if (bootstrapState === "checking") {
    return <LoadingState message="Preparing your workspace..." />;
  }
  if (bootstrapState === "error") {
    return (
      <LoadingState
        message={`${PRODUCT_BRAND.name} could not check the workspace setup. Refresh the page to try again.`}
      />
    );
  }
  if (bootstrapState === "account") {
    return <AccountSetup onComplete={() => setBootstrapState("launch")} />;
  }
  return (
    <LaunchSetup
      analyticsStartedAt={analyticsStartedAtRef.current}
      onStarted={(nextStep, demoMode) =>
        trackStarted("launch", nextStep, demoMode)
      }
    />
  );
};

function LoadingState({ message }: { message: string }) {
  return (
    <>
      <PageHeader
        icon={JobAgentMark}
        title={`Set up ${PRODUCT_BRAND.name}`}
        subtitle={message}
      />
      <PageMain>
        <Card className="border-border/60 shadow-none">
          <CardContent className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
            {message}
          </CardContent>
        </Card>
      </PageMain>
    </>
  );
}

function AccountSetup({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    trackProductEvent("onboarding_account_create_submitted", {
      username_length_bucket: getTextLengthBucket(normalizedUsername),
    });
    try {
      setBusy(true);
      await api.setupFirstAdmin({
        username: normalizedUsername,
        password,
        displayName: normalizedUsername,
      });
      trackProductEvent("onboarding_account_create_completed", {
        result: "success",
        credential_length_bucket: getTextLengthBucket(password),
      });
      onComplete();
      window.location.replace("/overview");
    } catch (error) {
      trackProductEvent("onboarding_account_create_completed", {
        result: "error",
        credential_length_bucket: getTextLengthBucket(password),
        error_category: getErrorCategory(error),
      });
      showErrorToast(error, "Could not create the workspace account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={UserPlus}
        title="Create your workspace account"
        subtitle={`This private account owns your ${PRODUCT_BRAND.name} workspace.`}
      />
      <PageMain>
        <Card className="mx-auto max-w-2xl border-border/60 shadow-none">
          <CardContent className="p-6 sm:p-8">
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-5">
                <Field label="Username">
                  <Input
                    aria-label="Username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <Input
                      aria-label="Password"
                      autoComplete="new-password"
                      className="pr-10"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                  {busy ? "Creating account..." : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageMain>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  return (
    <div className="space-y-2">
      <Label>{translateUi(label, interfaceLanguage)}</Label>
      {children}
    </div>
  );
}

function LaunchSetup({
  analyticsStartedAt,
  onStarted,
}: {
  analyticsStartedAt: number;
  onStarted: (
    nextStep: OnboardingRequirementId | "none",
    demoMode: boolean,
  ) => void;
}) {
  const queryClient = useQueryClient();
  const interfaceLanguage = useInterfaceLanguage();
  const onboarding = useOnboardingStatus();
  const flow = useOnboardingFlow();
  const designResume = useDesignResume();
  const profileQuery = useQuery<ResumeProfile>({
    queryKey: queryKeys.profile.current(),
    queryFn: api.getProfile,
    enabled: Boolean(
      designResume.status?.exists ||
        getRequirement(onboarding.status, "resume")?.details?.resumeId,
    ),
    retry: false,
  });
  const [selectedStep, setSelectedStep] =
    useState<OnboardingRequirementId | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [jobProfilesBusy, setJobProfilesBusy] = useState(false);
  const [strategyPreview, setStrategyPreview] =
    useState<api.CandidateStrategyOnboardingPreviewResponse["preview"]>(null);
  const [targetRoles, setTargetRoles] = useState("");
  const [excludedRoles, setExcludedRoles] = useState("");
  const [compensationFloor, setCompensationFloor] = useState("");
  const [usTravel, setUsTravel] = useState<"" | "open" | "limited" | "avoid">(
    "",
  );
  const [careerPriority, setCareerPriority] = useState("");
  const [country, setCountry] = useState("");
  const [cities, setCities] = useState("");
  const [workplaceTypes, setWorkplaceTypes] = useState<
    Array<"remote" | "hybrid" | "onsite">
  >(["remote", "hybrid"]);
  const [requiresVisaSponsorship, setRequiresVisaSponsorship] = useState(true);
  const completionTrackedRef = useRef(false);
  const lastStepViewRef = useRef<string | null>(null);
  const lastStatusCheckRef = useRef<string | null>(null);

  const status = onboarding.status;
  const showModel = status
    ? status.requirements.some((requirement) => requirement.id === "model")
    : true;
  const visibleSteps = status
    ? STEP_ORDER.filter((step) =>
        status.requirements.some((requirement) => requirement.id === step),
      )
    : STEP_ORDER.filter((step) => step !== "strategy");
  const activeStep = selectedStep ?? status?.nextRequirementId ?? "profile";
  const profileRequirement = getRequirement(status, "profile");
  const strategyRequirement = getRequirement(status, "strategy");
  const modelRequirement = getRequirement(status, "model");
  const resumeRequirement = getRequirement(status, "resume");
  const jobProfilesRequirement = getRequirement(status, "job_profiles");
  const activeRequirement = getRequirement(status, activeStep);
  const strategyQuestionsQuery = useQuery({
    queryKey: ["onboarding", "strategy", "questions"],
    queryFn: () => api.getOnboardingStrategyQuestions({}),
    enabled: activeStep === "strategy" && !strategyPreview,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!status || onboarding.checking) return;
    onStarted(status.nextRequirementId ?? "none", flow.demoMode);
  }, [flow.demoMode, onboarding.checking, onStarted, status]);

  useEffect(() => {
    if (!status || onboarding.checking) return;
    const key = `${activeStep}:${getRequirementAnalyticsStatus(activeRequirement)}`;
    if (lastStepViewRef.current === key) return;
    lastStepViewRef.current = key;
    trackProductEvent("onboarding_step_viewed", {
      step: activeStep,
      step_index: visibleSteps.indexOf(activeStep) + 1,
      requirement_status: getRequirementAnalyticsStatus(activeRequirement),
    });
  }, [
    activeRequirement,
    activeStep,
    onboarding.checking,
    status,
    visibleSteps,
  ]);

  useEffect(() => {
    if (!status || onboarding.checking) return;
    const key = JSON.stringify([
      status.complete,
      status.nextRequirementId,
      profileRequirement?.status,
      strategyRequirement?.status,
      modelRequirement?.status,
      resumeRequirement?.status,
      jobProfilesRequirement?.status,
    ]);
    if (lastStatusCheckRef.current === key) return;
    lastStatusCheckRef.current = key;
    trackProductEvent("onboarding_status_checked", {
      complete: status.complete,
      next_step: status.nextRequirementId ?? "none",
      profile_status: getRequirementAnalyticsStatus(profileRequirement),
      strategy_status: getRequirementAnalyticsStatus(strategyRequirement),
      model_status: getRequirementAnalyticsStatus(modelRequirement),
      resume_status: getRequirementAnalyticsStatus(resumeRequirement),
    });
  }, [
    modelRequirement,
    onboarding.checking,
    profileRequirement,
    strategyRequirement,
    resumeRequirement,
    jobProfilesRequirement,
    status,
  ]);

  const applyStatus = (next: OnboardingStatusResponse) => {
    if (next.complete && !completionTrackedRef.current) {
      completionTrackedRef.current = true;
      trackProductEvent("onboarding_completed", {
        duration_bucket: bucketDurationMs(Date.now() - analyticsStartedAt),
        completed_steps: next.requirements.filter(
          (requirement) => requirement.status === "ready",
        ).length,
      });
    }
    queryClient.setQueryData(queryKeys.onboarding.status(), next);
    setSelectedStep(next.nextRequirementId);
  };

  if (flow.demoMode || status?.complete) {
    return <Navigate to="/jobs/ready" replace />;
  }
  if (onboarding.checking) {
    return <LoadingState message="Loading your setup..." />;
  }

  const resumeSource =
    typeof resumeRequirement?.details?.confirmationSource === "string"
      ? resumeRequirement.details.confirmationSource
      : designResume.document?.id
        ? `local:${designResume.document.id}`
        : null;

  const saveProfile = async () => {
    const parsedCities = cities
      .split(/[\n,]/)
      .map((city) => city.trim())
      .filter(Boolean);
    trackProductEvent("onboarding_profile_save_submitted", {
      has_country: Boolean(country.trim()),
      city_count: parsedCities.length,
      workplace_type_count: workplaceTypes.length,
      requires_visa_sponsorship: requiresVisaSponsorship,
    });
    try {
      setProfileBusy(true);
      applyStatus(
        await api.saveOnboardingProfile({
          country: country.trim() || null,
          cities: parsedCities,
          workplaceTypes,
          requiresVisaSponsorship,
        }),
      );
      trackProductEvent("onboarding_profile_save_completed", {
        result: "success",
      });
    } catch (error) {
      trackProductEvent("onboarding_profile_save_completed", {
        result: "error",
        error_category: getErrorCategory(error),
        http_status_bucket: getHttpStatusBucket(error),
      });
      showErrorToast(error, "Could not save search preferences");
    } finally {
      setProfileBusy(false);
    }
  };

  const saveStrategyDraft = async () => {
    const parseList = (value: string) =>
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const targetRoleFamilies = parseList(targetRoles);
    const excludedRoleFamilies = parseList(excludedRoles);
    if (targetRoleFamilies.length === 0) {
      showErrorToast(
        new Error("Add at least one target role or role family."),
        "Could not prepare strategy",
      );
      return;
    }
    const parsedFloor = compensationFloor.trim()
      ? Number(compensationFloor.trim())
      : null;
    if (parsedFloor !== null && !Number.isFinite(parsedFloor)) {
      showErrorToast(
        new Error("Compensation floor must be a number or left blank."),
        "Could not prepare strategy",
      );
      return;
    }

    try {
      setStrategyBusy(true);
      const result = await api.saveOnboardingStrategyDraft({
        targetRoleFamilies,
        excludedRoleFamilies,
        compensationFloorCadAnnual: parsedFloor,
        usTravel: usTravel || null,
        careerPriority: careerPriority.trim() || null,
      });
      setStrategyPreview(result.preview);
      queryClient.setQueryData(queryKeys.onboarding.status(), result.status);
      setSelectedStep("strategy");
    } catch (error) {
      showErrorToast(error, "Could not prepare strategy");
    } finally {
      setStrategyBusy(false);
    }
  };

  const activateStrategy = async () => {
    if (!strategyPreview?.draft.id) return;
    try {
      setStrategyBusy(true);
      applyStatus(
        await api.activateOnboardingStrategy(strategyPreview.draft.id),
      );
      setStrategyPreview(null);
    } catch (error) {
      showErrorToast(error, "Could not confirm strategy");
    } finally {
      setStrategyBusy(false);
    }
  };

  const saveModel = async () => {
    const next = await flow.handleSaveModel();
    if (next) applyStatus(next);
  };

  const saveJobProfiles = async (urls: string[]) => {
    try {
      setJobProfilesBusy(true);
      applyStatus(await api.saveOnboardingJobProfiles(urls));
    } catch (error) {
      showErrorToast(error, "Could not save job-platform profiles");
    } finally {
      setJobProfilesBusy(false);
    }
  };

  const confirmResume = async () => {
    if (!resumeSource) return;
    const source = resumeSource.startsWith("rxresume:") ? "rxresume" : "local";
    trackProductEvent("onboarding_resume_confirm_submitted", { source });
    try {
      setConfirmBusy(true);
      applyStatus(await api.confirmOnboardingResume(resumeSource));
      trackProductEvent("onboarding_resume_confirm_completed", {
        result: "success",
        source,
      });
    } catch (error) {
      trackProductEvent("onboarding_resume_confirm_completed", {
        result: "error",
        source,
        error_category: getErrorCategory(error),
        http_status_bucket: getHttpStatusBucket(error),
      });
      showErrorToast(error, "Could not confirm this resume");
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={JobAgentMark}
        title={`Set up ${PRODUCT_BRAND.name}`}
        subtitle="A few focused choices, then you're in. You can review the strategy before it becomes active."
      />
      <PageMain>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav className="space-y-2" aria-label="Setup progress">
            {visibleSteps.map((step, index) => {
              const requirement = getRequirement(status, step);
              const complete = requirement?.status === "ready";
              const selected = step === activeStep;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (complete || step === status?.nextRequirementId)
                      setSelectedStep(step);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    selected
                      ? "bg-foreground text-background"
                      : complete
                        ? "hover:bg-muted"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                      selected && "border-background/30",
                    )}
                  >
                    {complete ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      {translateUi(stepTitle(step), interfaceLanguage)}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        selected
                          ? "text-background/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {translateUi(
                        complete
                          ? "Complete"
                          : step === status?.nextRequirementId
                            ? "Up next"
                            : "Locked",
                        interfaceLanguage,
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <Card className="min-w-0 border-border/60 shadow-none">
            <CardContent className="p-6 sm:p-8">
              {activeStep === "profile" ? (
                <ProfileStep
                  country={country}
                  cities={cities}
                  workplaceTypes={workplaceTypes}
                  requiresVisaSponsorship={requiresVisaSponsorship}
                  busy={profileBusy}
                  onCountryChange={setCountry}
                  onCitiesChange={setCities}
                  onWorkplaceTypesChange={setWorkplaceTypes}
                  onVisaChange={setRequiresVisaSponsorship}
                  onContinue={saveProfile}
                />
              ) : activeStep === "strategy" ? (
                <StrategyStep
                  targetRoles={targetRoles}
                  excludedRoles={excludedRoles}
                  compensationFloor={compensationFloor}
                  usTravel={usTravel}
                  careerPriority={careerPriority}
                  preview={strategyPreview}
                  adaptiveQuestions={
                    strategyQuestionsQuery.data?.questions ?? []
                  }
                  adaptiveSource={strategyQuestionsQuery.data?.source ?? null}
                  busy={strategyBusy}
                  onTargetRolesChange={setTargetRoles}
                  onExcludedRolesChange={setExcludedRoles}
                  onCompensationFloorChange={setCompensationFloor}
                  onUsTravelChange={setUsTravel}
                  onCareerPriorityChange={setCareerPriority}
                  onBack={() => setSelectedStep("profile")}
                  onEdit={() => setStrategyPreview(null)}
                  onPrepare={saveStrategyDraft}
                  onActivate={activateStrategy}
                />
              ) : activeStep === "model" ? (
                <StepShell
                  eyebrow="AI connection"
                  title={`Choose how ${PRODUCT_BRAND.name} should think`}
                  description={`Pick a provider first. ${PRODUCT_BRAND.name} saves the configuration only after the server verifies the connection.`}
                >
                  <LlmConnectionStep
                    apiKey={flow.watch("llmApiKey")}
                    baseUrl={flow.watch("llmBaseUrl")}
                    defaultModel={flow.settings?.model.default}
                    effectiveModel={flow.settings?.model.value}
                    isBusy={flow.isBusy}
                    llmKeyHint={flow.llmKeyHint}
                    model={flow.watch("model")}
                    savedBaseUrl={flow.settings?.llmBaseUrl.value}
                    savedProvider={flow.settings?.llmProvider.value}
                    selectedProvider={flow.selectedProvider}
                    validation={toValidationState(modelRequirement)}
                    onCodexAuthStatusChange={(codexStatus) => {
                      if (codexStatus.authenticated) return;
                      setSelectedStep("model");
                      void onboarding.refetch();
                    }}
                    onApiKeyChange={(value) =>
                      flow.setValue("llmApiKey", value)
                    }
                    onBaseUrlChange={(value) =>
                      flow.setValue("llmBaseUrl", value)
                    }
                    onModelChange={(value) => flow.setValue("model", value)}
                    onProviderChange={(value) =>
                      flow.setValue("llmProvider", value)
                    }
                  />
                  <StepActions
                    onBack={() =>
                      setSelectedStep(
                        strategyRequirement ? "strategy" : "profile",
                      )
                    }
                    onContinue={saveModel}
                    busy={flow.isBusy}
                    label="Connect and continue"
                  />
                </StepShell>
              ) : activeStep === "job_profiles" ? (
                <JobProfilesStep
                  initialUrls={
                    Array.isArray(jobProfilesRequirement?.details?.urls)
                      ? (jobProfilesRequirement.details.urls as string[])
                      : []
                  }
                  busy={jobProfilesBusy}
                  onBack={() => setSelectedStep("resume")}
                  onSave={saveJobProfiles}
                />
              ) : (
                <ResumeStep
                  flow={flow}
                  requirement={resumeRequirement}
                  profile={profileQuery.data ?? null}
                  hasResume={Boolean(resumeSource)}
                  busy={confirmBusy}
                  onBack={() =>
                    setSelectedStep(
                      showModel
                        ? "model"
                        : strategyRequirement
                          ? "strategy"
                          : "profile",
                    )
                  }
                  onConfirm={confirmResume}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </PageMain>
    </>
  );
}

function StepShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {translateUi(eyebrow, interfaceLanguage)}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {translateUi(title, interfaceLanguage)}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {translateUi(description, interfaceLanguage)}
        </p>
      </div>
      {children}
    </div>
  );
}

function StepActions({
  onBack,
  onContinue,
  busy,
  label,
}: {
  onBack?: () => void;
  onContinue: () => void | Promise<void>;
  busy: boolean;
  label: string;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-4 w-4" />
          {translateUi("Back", interfaceLanguage)}
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={() => void onContinue()} disabled={busy}>
        {busy
          ? translateUi("Saving...", interfaceLanguage)
          : translateUi(label, interfaceLanguage)}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ProfileStep(props: {
  country: string;
  cities: string;
  workplaceTypes: Array<"remote" | "hybrid" | "onsite">;
  requiresVisaSponsorship: boolean;
  busy: boolean;
  onCountryChange: (value: string) => void;
  onCitiesChange: (value: string) => void;
  onWorkplaceTypesChange: (
    value: Array<"remote" | "hybrid" | "onsite">,
  ) => void;
  onVisaChange: (value: boolean) => void;
  onContinue: () => void;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  const toggle = (value: "remote" | "hybrid" | "onsite") =>
    props.onWorkplaceTypesChange(
      props.workplaceTypes.includes(value)
        ? props.workplaceTypes.filter((item) => item !== value)
        : [...props.workplaceTypes, value],
    );
  return (
    <StepShell
      eyebrow="Your search"
      title="Where do you want to work?"
      description={`These preferences seed new runs and help ${PRODUCT_BRAND.name} prioritize location-aware and visa-sponsor sources. You can change them later.`}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country or market">
          <SearchableDropdown
            value={props.country}
            options={getOnboardingCountryOptions(interfaceLanguage)}
            onValueChange={props.onCountryChange}
            placeholder={translateUi("Select country", interfaceLanguage)}
            searchPlaceholder={translateUi(
              "Search country...",
              interfaceLanguage,
            )}
            emptyText={translateUi("No matching countries.", interfaceLanguage)}
            triggerClassName="h-10 w-full"
            ariaLabel={
              props.country
                ? formatCountryLabel(props.country)
                : translateUi("Select country", interfaceLanguage)
            }
            allowCustomValue={false}
          />
        </Field>
        <Field label="Preferred cities or regions (optional)">
          <Input
            value={props.cities}
            onChange={(event) => props.onCitiesChange(event.target.value)}
            placeholder={translateUi("London, Manchester", interfaceLanguage)}
          />
        </Field>
      </div>
      <div className="space-y-3">
        <Label>{translateUi("Workplace style", interfaceLanguage)}</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["remote", "hybrid", "onsite"] as const).map((value) => (
            <Label
              key={value}
              htmlFor={`workplace-${value}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-4 capitalize"
            >
              <Checkbox
                id={`workplace-${value}`}
                checked={props.workplaceTypes.includes(value)}
                onCheckedChange={() => toggle(value)}
              />
              {translateUi(
                value === "remote"
                  ? "Remote"
                  : value === "hybrid"
                    ? "Hybrid"
                    : "Onsite",
                interfaceLanguage,
              )}
            </Label>
          ))}
        </div>
      </div>
      <Label
        htmlFor="visa-sponsorship"
        className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/40 p-4"
      >
        <Checkbox
          id="visa-sponsorship"
          checked={props.requiresVisaSponsorship}
          onCheckedChange={(value) => props.onVisaChange(value === true)}
        />
        <span>
          <span className="block text-sm font-medium">
            {translateUi("I need employer visa sponsorship", interfaceLanguage)}
          </span>
          <span className="block text-sm text-muted-foreground">
            {translateUi(
              PRODUCT_BRAND.name +
                " will show sponsor information and favor sponsor-aware sources when available.",
              interfaceLanguage,
            )}
          </span>
        </span>
      </Label>
      <StepActions
        onContinue={props.onContinue}
        busy={props.busy || props.workplaceTypes.length === 0}
        label="Save and continue"
      />
    </StepShell>
  );
}

function StrategyStep(props: {
  targetRoles: string;
  excludedRoles: string;
  compensationFloor: string;
  usTravel: "" | "open" | "limited" | "avoid";
  careerPriority: string;
  preview: api.CandidateStrategyOnboardingPreviewResponse["preview"];
  adaptiveQuestions: api.CandidateStrategyOnboardingQuestion[];
  adaptiveSource: "ai" | "deterministic" | null;
  busy: boolean;
  onTargetRolesChange: (value: string) => void;
  onExcludedRolesChange: (value: string) => void;
  onCompensationFloorChange: (value: string) => void;
  onUsTravelChange: (value: "" | "open" | "limited" | "avoid") => void;
  onCareerPriorityChange: (value: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onPrepare: () => void | Promise<void>;
  onActivate: () => void | Promise<void>;
}) {
  const adaptiveById = new Map(
    props.adaptiveQuestions.map((question) => [question.id, question]),
  );
  const promptFor = (
    id: api.CandidateStrategyOnboardingQuestion["id"],
    fallback: string,
  ) => adaptiveById.get(id)?.prompt ?? fallback;

  if (props.preview) {
    return (
      <StepShell
        eyebrow="Strategy review"
        title={`Confirm what ${PRODUCT_BRAND.name} should optimize for`}
        description="This draft does not affect matching until you confirm it. Review the target roles and search-impact summary first."
      >
        <div className="space-y-4 rounded-xl border border-border/60 p-5">
          <div>
            <div className="text-sm font-medium">Target roles</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {props.preview.draft.targetRoleFamilies.join(", ")}
            </div>
          </div>
          {props.preview.draft.excludedRoleFamilies.length > 0 ? (
            <div>
              <div className="text-sm font-medium">Excluded roles</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {props.preview.draft.excludedRoleFamilies.join(", ")}
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-sm font-medium">Likely search impact</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {props.preview.delta.likelySearchImpact.length > 0 ? (
                props.preview.delta.likelySearchImpact.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>No material search-impact change detected.</li>
              )}
            </ul>
          </div>
          <div className="text-xs text-muted-foreground">
            Draft version {props.preview.draft.version}. Activation is explicit
            and can be changed later through a new version.
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={props.onEdit}
            disabled={props.busy}
          >
            Review answers
          </Button>
          <Button
            type="button"
            onClick={() => void props.onActivate()}
            disabled={props.busy}
          >
            {props.busy ? "Confirming..." : "Confirm strategy"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      eyebrow="Your strategy"
      title={`What should ${PRODUCT_BRAND.name} optimize for?`}
      description="Use plain text. Unknown optional answers stay unknown; they are not converted into hard exclusions. You will review a draft before it becomes active."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={promptFor("target_roles", "Target roles or role families")}
        >
          <Input
            value={props.targetRoles}
            onChange={(event) => props.onTargetRolesChange(event.target.value)}
            placeholder="Field Service Engineer, Commissioning, Technical Support"
          />
        </Field>
        <Field label="Roles to exclude (optional)">
          <Input
            value={props.excludedRoles}
            onChange={(event) =>
              props.onExcludedRolesChange(event.target.value)
            }
            placeholder="Pure sales, narrow maintenance-only roles"
          />
        </Field>
        <Field
          label={promptFor(
            "compensation_floor",
            "Minimum annual compensation in CAD (optional)",
          )}
        >
          <Input
            type="number"
            min="0"
            value={props.compensationFloor}
            onChange={(event) =>
              props.onCompensationFloorChange(event.target.value)
            }
            placeholder="70000"
          />
        </Field>
        <Field label={promptFor("us_travel", "United States travel")}>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["open", "Open"],
                ["limited", "Limited"],
                ["avoid", "Avoid"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={props.usTravel === value ? "default" : "outline"}
                onClick={() => props.onUsTravelChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </Field>
      </div>
      <Field
        label={promptFor(
          "career_priority",
          "Career priority or context (optional)",
        )}
      >
        <div className="space-y-2">
          <Input
            value={props.careerPriority}
            onChange={(event) =>
              props.onCareerPriorityChange(event.target.value)
            }
            placeholder="Higher income first; PR remains important but should not force a low-pay path"
          />
          <VoiceTextInputButton
            onTranscript={(transcript) =>
              props.onCareerPriorityChange(
                [props.careerPriority.trim(), transcript]
                  .filter(Boolean)
                  .join(" "),
              )
            }
          />
        </div>
      </Field>
      <div className="flex items-center justify-between border-t pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={props.onBack}
          disabled={props.busy}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => void props.onPrepare()}
          disabled={props.busy || props.targetRoles.trim().length === 0}
        >
          {props.busy ? "Preparing..." : "Review strategy"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </StepShell>
  );
}

function ResumeStep({
  flow,
  requirement,
  profile,
  hasResume,
  busy,
  onBack,
  onConfirm,
}: {
  flow: ReturnType<typeof useOnboardingFlow>;
  requirement: OnboardingRequirement | null;
  profile: ResumeProfile | null;
  hasResume: boolean;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const interfaceLanguage = useInterfaceLanguage();
  const experience = profile?.sections?.experience?.items ?? [];
  if (!hasResume) {
    return (
      <StepShell
        eyebrow="Your resume"
        title={`Load the resume ${PRODUCT_BRAND.name} should use`}
        description="Upload a file or connect Reactive Resume. After parsing, you'll review the result before anything is marked complete."
      >
        <BaseResumeStep
          allowReactiveResume
          baseResumeValidation={toValidationState(requirement)}
          baseResumeValue={flow.watch("rxresumeBaseResumeId")}
          hasRxResumeAccess={Boolean(flow.rxresumeApiKeyHint)}
          importingResumeFileName={flow.importingResumeFileName}
          isBusy={flow.isBusy}
          isImportingResume={flow.isImportingResume}
          isResumeReady={false}
          isRxResumeSelfHosted={flow.isRxResumeSelfHosted}
          resumeSetupMode={flow.resumeSetupMode}
          rxresumeApiKey={flow.watch("rxresumeApiKey")}
          rxresumeApiKeyHint={flow.rxresumeApiKeyHint}
          rxresumeUrl={flow.watch("rxresumeUrl")}
          rxresumeValidation={toValidationState(requirement)}
          selectedProvider={flow.selectedProvider}
          onImportResumeFile={flow.handleImportResumeFile}
          onResumeSetupModeChange={flow.setResumeSetupMode}
          onRxresumeApiKeyChange={(value) =>
            flow.setValue("rxresumeApiKey", value)
          }
          onRxresumeSelfHostedChange={flow.handleRxresumeSelfHostedChange}
          onRxresumeUrlChange={(value) => flow.setValue("rxresumeUrl", value)}
          onTemplateResumeChange={flow.handleTemplateResumeChange}
        />
        {flow.resumeSetupMode === "rxresume" ? (
          <StepActions
            onBack={onBack}
            onContinue={() => void flow.handleSaveRxresume()}
            busy={flow.isBusy}
            label="Check connection"
          />
        ) : (
          <div className="border-t pt-6">
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}
      </StepShell>
    );
  }
  return (
    <StepShell
      eyebrow="Resume review"
      title="Is this the right resume?"
      description="Confirm the parsed identity and recent experience. Completion is tied to this exact resume source, so replacing it requires confirmation again."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-h-80 rounded-xl border border-border/60 bg-muted/15 p-6">
          <div className="mb-6 border-b pb-5">
            <h3 className="text-2xl font-semibold">
              {profile?.basics?.name ||
                translateUi("Parsed resume", interfaceLanguage)}
            </h3>
            <p className="text-muted-foreground">
              {profile?.basics?.headline ||
                profile?.basics?.label ||
                translateUi("Review the imported details", interfaceLanguage)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {profile?.basics?.location?.city ||
                profile?.basics?.location?.region ||
                translateUi("No location detected", interfaceLanguage)}
            </p>
          </div>
          <div className="space-y-4">
            {experience.slice(0, 4).map((item) => (
              <div key={item.id} className="grid gap-1 sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-medium">{item.position}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.company}
                    {item.location ? ` ?? ${item.location}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{item.date}</div>
              </div>
            ))}
            {experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {translateUi(
                  "No experience entries were detected. Open Resume Studio to correct the document before confirming.",
                  interfaceLanguage,
                )}
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <FileCheck2 className="mb-3 h-5 w-5" />
            <div className="text-sm font-medium">
              {translateUi("Parsed successfully", interfaceLanguage)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {experience.length} {translateUi("experience", interfaceLanguage)}{" "}
              {translateUi(
                experience.length === 1 ? "entry" : "entries",
                interfaceLanguage,
              )}
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" asChild>
            <a href="/design-resume">
              <BriefcaseBusiness className="h-4 w-4" />
              {translateUi("Edit in Resume Studio", interfaceLanguage)}
            </a>
          </Button>
        </div>
      </div>
      <StepActions
        onBack={onBack}
        onContinue={onConfirm}
        busy={busy}
        label="Use this resume"
      />
    </StepShell>
  );
}
