import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CircleCheck,
  Clock3,
  Globe2,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  UpdateProfileInputSchema,
  type AuthenticatedUser,
  type SessionSummary,
  type UpdateProfileInput,
} from "@moneymind/shared";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { FormField } from "@/components/auth/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { describeAuthError } from "@/lib/auth-errors";
import { fieldInputClass } from "@/lib/form-styles";
import { useAuth } from "@/providers/auth-provider";

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
] as const;

const LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
  { value: "fr-FR", label: "Français (France)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "it-IT", label: "Italiano (Italia)" },
  { value: "nl-NL", label: "Nederlands (Nederland)" },
  { value: "ja-JP", label: "日本語 (日本)" },
  { value: "zh-CN", label: "中文 (中国)" },
  { value: "hi-IN", label: "हिन्दी (भारत)" },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return value || "MM";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";

  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "unknown OS";

  return `${browser} on ${os}`;
}

function isMobileDevice(session: SessionSummary): boolean {
  return /Mobile|Android|iPhone|iPad/i.test(session.userAgent ?? "");
}

export default function ProfilePage() {
  usePageTitle("Profile");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your profile…" />;
  }

  return (
    <AppShell>
      <ProfileView user={user} />
    </AppShell>
  );
}

function ProfileView({ user }: { user: AuthenticatedUser }) {
  const { updateProfile, logout, logoutAll } = useAuth();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"device" | "all" | null>(null);
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInputSchema),
    defaultValues: {
      name: user.name,
      timezone: user.timezone,
      locale: user.locale,
    },
    mode: "onBlur",
  });

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: api.sessions,
    staleTime: 10_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);

    try {
      await updateProfile(values);
      reset(values);
      setSaved(true);
    } catch (error) {
      setFormError(describeAuthError(error, "Could not save your profile. Please try again."));
    }
  });

  const handleLogout = async () => {
    setActionError(null);
    setBusy("device");

    try {
      await logout();
    } catch (error) {
      setActionError(describeAuthError(error, "Could not sign out. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const handleLogoutAll = async () => {
    setActionError(null);
    setBusy("all");

    try {
      await logoutAll();
    } catch (error) {
      setActionError(describeAuthError(error, "Could not sign out every session."));
    } finally {
      setBusy(null);
      setConfirmingLogoutAll(false);
    }
  };

  const timezoneOptions = TIMEZONES.includes(user.timezone as (typeof TIMEZONES)[number])
    ? TIMEZONES
    : [user.timezone, ...TIMEZONES];

  const localeOptions = LOCALES.some((locale) => locale.value === user.locale)
    ? LOCALES
    : [{ value: user.locale, label: user.locale }, ...LOCALES];

  const sessions = [...(sessionsQuery.data ?? [])].sort(
    (a, b) => Number(b.current) - Number(a.current),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="gap-1.5 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Phase 2 · Identity &amp; data
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[1.75rem]">
            Profile &amp; security
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Manage how you appear in MoneyMind, your reporting preferences, and every device that
            can reach your workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>
              Your name is visible only to you. Time zone and locale drive reporting periods and
              number formatting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              {formError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-[11px] leading-5 text-destructive"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <p>{formError}</p>
                </div>
              ) : null}

              {saved ? (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3 text-[11px] leading-5 text-emerald-700 dark:text-emerald-300"
                >
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <p>Profile saved. Your next session picks up these preferences.</p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="profile-name" label="Name" error={errors.name?.message}>
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "profile-name-error" : undefined}
                    className={fieldInputClass(errors.name?.message)}
                    {...register("name")}
                  />
                </FormField>

                <FormField id="profile-email" label="Email">
                  <Input
                    id="profile-email"
                    value={user.email}
                    readOnly
                    disabled
                    aria-describedby="profile-email-hint"
                  />
                  <p id="profile-email-hint" className="text-[11px] text-muted-foreground">
                    Email changes are not available in Phase 2.
                  </p>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="profile-timezone"
                  label="Time zone"
                  error={errors.timezone?.message}
                  hint="IANA zone used for budgets and month boundaries."
                >
                  <Select
                    id="profile-timezone"
                    aria-invalid={Boolean(errors.timezone)}
                    aria-describedby={
                      errors.timezone ? "profile-timezone-error" : "profile-timezone-hint"
                    }
                    className={fieldInputClass(errors.timezone?.message)}
                    {...register("timezone")}
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  id="profile-locale"
                  label="Locale"
                  error={errors.locale?.message}
                  hint="Controls currency, date and number formatting."
                >
                  <Select
                    id="profile-locale"
                    aria-invalid={Boolean(errors.locale)}
                    aria-describedby={
                      errors.locale ? "profile-locale-error" : "profile-locale-hint"
                    }
                    className={fieldInputClass(errors.locale?.message)}
                    {...register("locale")}
                  >
                    {localeOptions.map((locale) => (
                      <option key={locale.value} value={locale.value}>
                        {locale.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !isDirty}
                  className="min-w-28"
                >
                  {isSubmitting ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check aria-hidden="true" />
                      Save changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your identity and workspace membership.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-sky-500/20 text-sm font-semibold text-primary">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <dl className="space-y-3 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <UserRound aria-hidden="true" className="size-3.5" />
                  Workspace
                </dt>
                <dd className="text-right font-medium">{user.workspace.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  Role
                </dt>
                <dd>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                    {user.workspace.role}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe2 aria-hidden="true" className="size-3.5" />
                  Base currency
                </dt>
                <dd className="font-mono font-medium">{user.workspace.baseCurrency}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  Member since
                </dt>
                <dd className="font-medium">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound aria-hidden="true" className="size-3.5" />
                  Email
                </dt>
                <dd>
                  <Badge
                    variant={user.emailVerified ? "success" : "outline"}
                    className="px-1.5 py-0 text-[9px]"
                  >
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </dd>
              </div>
            </dl>

            <Separator />

            {actionError ? (
              <p role="alert" className="text-[11px] leading-5 text-destructive">
                {actionError}
              </p>
            ) : null}

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void handleLogout()}
                disabled={busy !== null}
              >
                <LogOut aria-hidden="true" />
                {busy === "device" ? "Signing out…" : "Sign out"}
              </Button>

              {confirmingLogoutAll ? (
                <div className="space-y-2 rounded-xl border border-destructive/25 bg-destructive/[0.04] p-2.5">
                  <p className="text-[10px] leading-5 text-muted-foreground">
                    This revokes every refresh token, including other browsers and devices.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleLogoutAll()}
                      disabled={busy !== null}
                    >
                      {busy === "all" ? "Revoking…" : "Yes, sign out all"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingLogoutAll(false)}
                      disabled={busy !== null}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmingLogoutAll(true)}
                  disabled={busy !== null}
                >
                  <ShieldCheck aria-hidden="true" />
                  Sign out every device
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>
              Each sign-in gets its own refresh token. Revoking one ends only that device.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void sessionsQuery.refetch()}
            disabled={sessionsQuery.isFetching}
          >
            {sessionsQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {sessionsQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-56" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : sessionsQuery.isError ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.04] px-4 py-6 text-center"
            >
              <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
              <p className="text-xs font-semibold">Sessions could not be loaded</p>
              <p className="text-[11px] text-muted-foreground">
                {describeAuthError(sessionsQuery.error, "Please try again.")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void sessionsQuery.refetch()}
                disabled={sessionsQuery.isFetching}
              >
                Retry
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {sessions.map((session) => {
                const DeviceIcon = isMobileDevice(session) ? Smartphone : Monitor;
                const revoking =
                  revokeMutation.isPending && revokeMutation.variables === session.id;

                return (
                  <li
                    key={session.id}
                    className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <DeviceIcon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium">{deviceLabel(session.userAgent)}</p>
                        {session.current ? (
                          <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                            This device
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {session.ipAddress ?? "IP unavailable"} · last used{" "}
                        {formatDateTime(session.lastUsedAt)} · expires{" "}
                        {formatDate(session.expiresAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start text-muted-foreground hover:text-destructive sm:self-center"
                      onClick={() => revokeMutation.mutate(session.id)}
                      disabled={session.current || revokeMutation.isPending}
                      title={
                        session.current ? "Use Sign out to end this session" : "Revoke this session"
                      }
                    >
                      <LogOut aria-hidden="true" />
                      {revoking ? "Revoking…" : "Revoke"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {revokeMutation.isError ? (
            <p role="alert" className="mt-3 text-[11px] text-destructive">
              {describeAuthError(revokeMutation.error, "Could not revoke that session.")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
