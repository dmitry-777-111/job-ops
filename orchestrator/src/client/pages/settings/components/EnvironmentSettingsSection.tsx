import * as api from "@client/api";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type { EnvSettingsValues } from "@client/pages/settings/types";
import { formatSecretHint } from "@client/pages/settings/utils";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { showErrorToast } from "@/client/lib/error-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type EnvironmentSettingsSectionProps = {
  values: EnvSettingsValues;
  isLoading: boolean;
  isSaving: boolean;
  layoutMode?: "accordion" | "panel";
};

const workspaceUsersQueryKey = ["workspaces", "users"] as const;
const currentAuthUserQueryKey = ["auth", "me"] as const;

function AccountManagementSection() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [useCurrentWorkspace, setUseCurrentWorkspace] = useState(false);
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState<
    Record<string, string>
  >({});

  const meQuery = useQuery({
    queryKey: currentAuthUserQueryKey,
    queryFn: api.getCurrentAuthUser,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: workspaceUsersQueryKey,
    queryFn: api.listWorkspaceUsers,
    enabled: meQuery.data?.isSystemAdmin === true,
  });

  const createUserMutation = useMutation({
    mutationFn: api.createWorkspaceUser,
    onSuccess: async () => {
      setUsername("");
      setDisplayName("");
      setPassword("");
      setUseCurrentWorkspace(false);
      await queryClient.invalidateQueries({ queryKey: workspaceUsersQueryKey });
      toast.success("User created");
    },
    onError: (error) => {
      showErrorToast(error, "Failed to create user");
    },
  });

  const disableUserMutation = useMutation({
    mutationFn: (input: { userId: string; isDisabled: boolean }) =>
      api.setWorkspaceUserDisabled(input.userId, input.isDisabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceUsersQueryKey });
      toast.success("User updated");
    },
    onError: (error) => {
      showErrorToast(error, "Failed to update user");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (input: { userId: string; password: string }) =>
      api.resetWorkspaceUserPassword(input.userId, input.password),
    onSuccess: async (_data, variables) => {
      setResetPasswordByUserId((current) => ({
        ...current,
        [variables.userId]: "",
      }));
      toast.success("Password reset");
    },
    onError: (error) => {
      showErrorToast(error, "Failed to reset password");
    },
  });

  if (!meQuery.data?.isSystemAdmin) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold">Workspace</div>
        <p className="text-sm text-muted-foreground">
          Signed in as {meQuery.data?.username ?? "a workspace user"}.
        </p>
      </div>
    );
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="text-sm font-semibold">Workspace Users</div>
        <p className="text-sm text-muted-foreground">
          Use an email address as the login. New users get a private workspace
          by default; attach only trusted users to your current workspace.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.currentTarget.value)}
          placeholder="Name"
        />
        <Input
          value={username}
          onChange={(event) => setUsername(event.currentTarget.value)}
          placeholder="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
        />
        <Input
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          placeholder="Temporary password"
          type="password"
          autoComplete="new-password"
        />
        <Button
          type="button"
          onClick={() =>
            createUserMutation.mutate({
              username,
              displayName: displayName || username,
              password,
              useCurrentWorkspace,
            })
          }
          disabled={
            createUserMutation.isPending ||
            username.trim().length === 0 ||
            password.length < 8
          }
        >
          Create
        </Button>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
        <input
          type="checkbox"
          checked={useCurrentWorkspace}
          onChange={(event) =>
            setUseCurrentWorkspace(event.currentTarget.checked)
          }
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="block font-medium">Use my current workspace</span>
          <span className="block text-xs text-muted-foreground">
            Use this only for your own personal login or another trusted user
            who should see the same existing jobs and settings. Leave it off for
            independent users.
          </span>
        </span>
      </label>

      <div className="divide-y divide-border rounded-md border border-border">
        {users.map((user) => {
          const resetPassword = resetPasswordByUserId[user.id] ?? "";
          return (
            <div
              className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
              key={user.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {user.displayName || user.username}
                  </span>
                  <Badge variant="outline">{user.username}</Badge>
                  {user.isSystemAdmin ? (
                    <Badge variant="secondary">System admin</Badge>
                  ) : null}
                  {user.isDisabled ? (
                    <Badge variant="destructive">Disabled</Badge>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {user.workspaceName}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={resetPassword}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setResetPasswordByUserId((current) => ({
                      ...current,
                      [user.id]: value,
                    }));
                  }}
                  placeholder="New password"
                  type="password"
                  autoComplete="new-password"
                  className="h-8 w-40"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    resetPasswordMutation.isPending || resetPassword.length < 8
                  }
                  onClick={() =>
                    resetPasswordMutation.mutate({
                      userId: user.id,
                      password: resetPassword,
                    })
                  }
                >
                  Reset
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  disableUserMutation.isPending || user.id === meQuery.data?.id
                }
                onClick={() =>
                  disableUserMutation.mutate({
                    userId: user.id,
                    isDisabled: !user.isDisabled,
                  })
                }
              >
                {user.isDisabled ? "Enable" : "Disable"}
              </Button>
            </div>
          );
        })}
        {users.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            No users found.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const EnvironmentSettingsSection: React.FC<
  EnvironmentSettingsSectionProps
> = ({ values, isLoading, isSaving, layoutMode }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<UpdateSettingsInput>();
  const { private: privateValues } = values;

  return (
    <SettingsSectionFrame
      mode={layoutMode}
      title="Environment & Workspaces"
      value="environment"
    >
      <div className="space-y-8">
        <div className="space-y-6">
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Service Accounts
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold">UKVisaJobs</div>
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsInput
                label="Email"
                inputProps={register("ukvisajobsEmail")}
                placeholder="you@example.com"
                disabled={isLoading || isSaving}
                error={errors.ukvisajobsEmail?.message as string | undefined}
              />
              <SettingsInput
                label="Password"
                inputProps={register("ukvisajobsPassword")}
                type="password"
                placeholder="Enter new password"
                disabled={isLoading || isSaving}
                error={errors.ukvisajobsPassword?.message as string | undefined}
                current={formatSecretHint(privateValues.ukvisajobsPasswordHint)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold">Adzuna</div>
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsInput
                label="App ID"
                inputProps={register("adzunaAppId")}
                placeholder="your-app-id"
                disabled={isLoading || isSaving}
                error={errors.adzunaAppId?.message as string | undefined}
              />
              <SettingsInput
                label="App Key"
                inputProps={register("adzunaAppKey")}
                type="password"
                placeholder="Enter new app key"
                disabled={isLoading || isSaving}
                error={errors.adzunaAppKey?.message as string | undefined}
                current={formatSecretHint(privateValues.adzunaAppKeyHint)}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Security
          </div>
          <AccountManagementSection />
        </div>
      </div>
    </SettingsSectionFrame>
  );
};
