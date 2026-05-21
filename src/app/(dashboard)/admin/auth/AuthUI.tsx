"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthSettings = {
  emailPassword: { enabled: boolean };
  entra: {
    enabled: boolean;
    tenantId: string;
    clientId: string;
    clientSecretSet: boolean;
    allowedDomains: string;
  };
  mfa: { enforced: ("admin" | "client_admin" | "operator" | "viewer")[] };
  passkeys: { enabled: boolean };
};

const ROLES: ("admin" | "client_admin" | "operator" | "viewer")[] = [
  "admin",
  "client_admin",
  "operator",
  "viewer",
];

export function AuthUI({ initial }: { initial: AuthSettings }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AuthSettings>(initial);
  const [entraSecret, setEntraSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/admin/settings/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, entraSecret: entraSecret || undefined }),
    });
    setBusy(false);
    setSaved(true);
    setEntraSecret("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Section
        title="Email + Password"
        subtitle="Built-in local accounts."
        enabled={draft.emailPassword.enabled}
        onToggle={(v) =>
          setDraft({ ...draft, emailPassword: { enabled: v } })
        }
      />

      <Section
        title="Microsoft Entra ID (SSO)"
        subtitle="OAuth 2.0 / OpenID Connect sign-in for Azure AD users."
        enabled={draft.entra.enabled}
        onToggle={(v) =>
          setDraft({ ...draft, entra: { ...draft.entra, enabled: v } })
        }
      >
        {draft.entra.enabled && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Field label="Directory (tenant) ID">
              <input
                className="input w-full font-mono text-xs"
                value={draft.entra.tenantId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entra: { ...draft.entra, tenantId: e.target.value },
                  })
                }
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
            <Field label="Application (client) ID">
              <input
                className="input w-full font-mono text-xs"
                value={draft.entra.clientId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entra: { ...draft.entra, clientId: e.target.value },
                  })
                }
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
            <Field
              label="Client secret"
              help={
                draft.entra.clientSecretSet
                  ? "Secret is set. Enter a new value to rotate."
                  : "Required to complete the OAuth code exchange."
              }
            >
              <input
                type="password"
                className="input w-full"
                value={entraSecret}
                onChange={(e) => setEntraSecret(e.target.value)}
                placeholder={
                  draft.entra.clientSecretSet ? "•••••• (unchanged)" : "Paste the secret value"
                }
              />
            </Field>
            <Field
              label="Allowed email domains"
              help="Comma-separated. Only users whose email matches will be auto-provisioned. Leave empty to allow all."
            >
              <input
                className="input w-full"
                value={draft.entra.allowedDomains}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entra: {
                      ...draft.entra,
                      allowedDomains: e.target.value,
                    },
                  })
                }
                placeholder="acme.com, globex.com"
              />
            </Field>
            <div className="text-xs bg-[#0b0e14] border border-border rounded-md p-3 space-y-1">
              <div className="text-muted">
                <strong>Redirect URI</strong> to register in Azure portal:
              </div>
              <code className="block break-all font-mono">
                https://your-domain/api/auth/entra/callback
              </code>
              <div className="text-muted">
                <strong>Demo:</strong> The OAuth flow is not wired in this
                prototype. Saving stores the config so it's ready to flip on
                once we add the OAuth code-exchange route.
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Passkeys (WebAuthn)"
        subtitle="Let users replace passwords with FaceID, Windows Hello, or hardware keys."
        enabled={draft.passkeys.enabled}
        onToggle={(v) => setDraft({ ...draft, passkeys: { enabled: v } })}
      />

      <Section
        title="Multi-factor authentication"
        subtitle="Require a second factor for the selected roles."
      >
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => {
            const checked = draft.mfa.enforced.includes(r);
            return (
              <label
                key={r}
                className={`flex items-center gap-2 p-2 rounded-md border text-sm cursor-pointer ${
                  checked
                    ? "border-accent bg-[#1c222d]"
                    : "border-border bg-[#0b0e14]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.mfa.enforced, r]
                      : draft.mfa.enforced.filter((x) => x !== r);
                    setDraft({ ...draft, mfa: { enforced: next } });
                  }}
                />
                {r}
              </label>
            );
          })}
        </div>
      </Section>

      <div className="flex justify-end gap-3 items-center">
        {saved && <span className="text-emerald-400 text-sm">Saved</span>}
        <button onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? "Saving..." : "Save authentication settings"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {onToggle && (
          <Toggle value={!!enabled} onChange={onToggle} />
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? "bg-emerald-500" : "bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
      {help && <div className="text-xs text-muted mt-1">{help}</div>}
    </div>
  );
}
