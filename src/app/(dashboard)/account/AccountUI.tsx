"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  email: string;
  name: string;
  role: "admin" | "client";
  clientRole: "viewer" | "operator" | "client_admin" | null;
  mfaEnabled: boolean;
  passkeyCount: number;
  ssoProvider: "entra" | null;
};
type Policy = {
  passkeysEnabled: boolean;
  entraEnabled: boolean;
  mfaEnforced: string[];
};

export function AccountUI({
  initial,
  authPolicy,
}: {
  initial: Me;
  authPolicy: Policy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const effectiveRole = initial.role === "admin" ? "admin" : initial.clientRole ?? "viewer";
  const mfaRequired = authPolicy.mfaEnforced.includes(effectiveRole);

  async function setMfa(enable: boolean) {
    if (!enable && mfaRequired) {
      alert(
        `MFA is required for the "${effectiveRole}" role. Ask your platform admin to relax the policy first.`
      );
      return;
    }
    setBusy("mfa");
    await fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: enable ? "enable" : "disable" }),
    });
    setBusy(null);
    router.refresh();
  }

  async function passkeyAction(action: "register" | "removeAll") {
    setBusy("passkey");
    await fetch("/api/account/passkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Section title="Profile">
        <Row label="Name" value={initial.name} />
        <Row label="Email" value={initial.email} mono />
        <Row
          label="Role"
          value={
            initial.role === "admin"
              ? "Platform admin"
              : `${initial.clientRole} (tenant)`
          }
        />
        {initial.ssoProvider === "entra" && (
          <Row label="Sign-in" value="Microsoft Entra ID (SSO)" />
        )}
      </Section>

      <Section
        title="Multi-factor authentication"
        subtitle={
          mfaRequired
            ? "Required for your role — cannot be disabled."
            : "Adds a one-time code to your sign-in."
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">
              Status:{" "}
              <span
                className={
                  initial.mfaEnabled ? "text-emerald-400" : "text-amber-400"
                }
              >
                {initial.mfaEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="text-xs text-muted">
              Authenticator app (TOTP). SMS is intentionally not supported.
            </div>
          </div>
          {initial.mfaEnabled ? (
            <button
              onClick={() => setMfa(false)}
              disabled={busy === "mfa" || mfaRequired}
              className="btn text-sm text-red-400 hover:bg-red-950/40"
            >
              Disable
            </button>
          ) : (
            <button
              onClick={() => setMfa(true)}
              disabled={busy === "mfa"}
              className="btn btn-primary text-sm"
            >
              {busy === "mfa" ? "..." : "Enable MFA"}
            </button>
          )}
        </div>
        {!initial.mfaEnabled && (
          <div className="text-xs text-muted bg-[#0b0e14] border border-border rounded-md p-2">
            <strong>Demo:</strong> Real flow would generate a TOTP secret,
            show a QR code, and ask you to enter a 6-digit code to verify.
            Clicking "Enable MFA" here just flips a flag.
          </div>
        )}
      </Section>

      <Section
        title="Passkeys"
        subtitle={
          authPolicy.passkeysEnabled
            ? "Sign in with FaceID / Windows Hello / a hardware key."
            : "Disabled by your platform admin."
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">
              Registered:{" "}
              <span className="text-white">{initial.passkeyCount}</span>
            </div>
            <div className="text-xs text-muted">
              Replaces password sign-in on supported devices.
            </div>
          </div>
          <div className="flex gap-2">
            {initial.passkeyCount > 0 && (
              <button
                onClick={() => passkeyAction("removeAll")}
                disabled={busy === "passkey" || !authPolicy.passkeysEnabled}
                className="btn text-sm text-red-400 hover:bg-red-950/40"
              >
                Remove all
              </button>
            )}
            <button
              onClick={() => passkeyAction("register")}
              disabled={busy === "passkey" || !authPolicy.passkeysEnabled}
              className="btn btn-primary text-sm"
            >
              {busy === "passkey" ? "..." : "Register passkey"}
            </button>
          </div>
        </div>
        <div className="text-xs text-muted bg-[#0b0e14] border border-border rounded-md p-2">
          <strong>Demo:</strong> Real flow uses{" "}
          <code>navigator.credentials.create</code> (WebAuthn) and stores the
          public key + credentialID server-side. Clicking "Register" here
          increments a counter.
        </div>
      </Section>

      {authPolicy.entraEnabled && initial.ssoProvider !== "entra" && (
        <Section title="Microsoft Entra ID" subtitle="Single sign-on">
          <div className="text-sm">
            Your organization supports signing in with Entra ID. Sign out and
            choose "Sign in with Microsoft" on the login page to link your
            account.
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="text-muted">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : ""}>{value}</div>
    </div>
  );
}
