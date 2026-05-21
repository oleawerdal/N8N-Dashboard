"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Template = {
  key: string;
  label: string;
  sample: Record<string, string>;
  subject: string;
  body: string;
};

type MailConfig = {
  provider: "smtp2go" | "none";
  apiKeySet: boolean;
  fromEmail: string;
  fromName: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
};

export function EmailsUI({
  templates,
  brandName,
  mail,
}: {
  templates: Template[];
  brandName: string;
  mail: MailConfig;
}) {
  const [active, setActive] = useState(templates[0]?.key);
  const t = templates.find((x) => x.key === active);
  return (
    <div className="space-y-6">
      <MailProvider initial={mail} />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Templates</h2>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {templates.map((x) => (
          <button
            key={x.key}
            onClick={() => setActive(x.key)}
            className={`px-3 py-1.5 rounded-md text-sm shrink-0 ${
              x.key === active
                ? "bg-[#1c222d] text-white border border-border"
                : "text-muted hover:text-white"
            }`}
          >
            {x.label}
          </button>
        ))}
        </div>
        {t && <TemplateEditor key={t.key} template={t} brandName={brandName} />}
      </div>
    </div>
  );
}

function MailProvider({ initial }: { initial: MailConfig }) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    provider: initial.provider,
    fromEmail: initial.fromEmail,
    fromName: initial.fromName,
  });
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<
    { ok: boolean; text: string } | null
  >(null);
  const [testTo, setTestTo] = useState("");

  async function save() {
    setBusy("save");
    setSaveMsg(null);
    const body: Record<string, unknown> = {
      provider: draft.provider,
      fromEmail: draft.fromEmail,
      fromName: draft.fromName,
    };
    if (apiKey) body.apiKey = apiKey;
    const res = await fetch("/api/admin/settings/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      setSaveMsg("Save failed");
    } else {
      setSaveMsg("Saved");
      setApiKey("");
      router.refresh();
    }
  }

  async function sendTest() {
    setBusy("test");
    setTestMsg(null);
    const res = await fetch("/api/admin/settings/mail/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo || undefined }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      sentTo?: string;
    };
    setBusy(null);
    if (j.ok) {
      setTestMsg({ ok: true, text: `Sent to ${j.sentTo}` });
      router.refresh();
    } else {
      setTestMsg({ ok: false, text: j.error || "Failed" });
    }
  }

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Mail provider</h2>
          <p className="text-xs text-muted">
            Used for invites, password resets, and any system mail.
          </p>
        </div>
        <ProviderBadge
          provider={initial.provider}
          configured={initial.apiKeySet}
        />
      </div>

      <Field label="Provider">
        <select
          className="input w-full"
          value={draft.provider}
          onChange={(e) =>
            setDraft({
              ...draft,
              provider: e.target.value as "smtp2go" | "none",
            })
          }
        >
          <option value="none">Disabled (no mail sent)</option>
          <option value="smtp2go">SMTP2Go API</option>
        </select>
      </Field>

      {draft.provider === "smtp2go" && (
        <>
          <Field
            label="SMTP2Go API key"
            help={
              initial.apiKeySet
                ? "An API key is configured. Enter a new value to rotate it."
                : "Get this from SMTP2Go → Settings → API Keys. Stored server-side only."
            }
          >
            <input
              type="password"
              className="input w-full font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                initial.apiKeySet
                  ? "•••••• (unchanged)"
                  : "api-XXXXXXXXXXXXXXXXXXXX"
              }
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="From email" help="Must be a verified sender on SMTP2Go.">
              <input
                type="email"
                className="input w-full"
                value={draft.fromEmail}
                onChange={(e) =>
                  setDraft({ ...draft, fromEmail: e.target.value })
                }
                placeholder="noreply@yourdomain.com"
              />
            </Field>
            <Field label="From name">
              <input
                className="input w-full"
                value={draft.fromName}
                onChange={(e) =>
                  setDraft({ ...draft, fromName: e.target.value })
                }
                placeholder="Your brand"
              />
            </Field>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="text-sm text-muted">
          {initial.lastTestAt && (
            <>
              Last test:{" "}
              <span
                className={
                  initial.lastTestOk ? "text-emerald-400" : "text-red-400"
                }
              >
                {initial.lastTestOk ? "ok" : "failed"}
              </span>{" "}
              at {new Date(initial.lastTestAt).toLocaleString()}
              {!initial.lastTestOk && initial.lastTestError && (
                <div className="text-xs text-red-400/80">
                  {initial.lastTestError}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {saveMsg && (
            <span
              className={
                saveMsg === "Saved" ? "text-emerald-400 text-sm self-center" : "text-red-400 text-sm self-center"
              }
            >
              {saveMsg}
            </span>
          )}
          <button
            onClick={save}
            disabled={busy === "save"}
            className="btn btn-primary"
          >
            {busy === "save" ? "Saving..." : "Save provider"}
          </button>
        </div>
      </div>

      {draft.provider === "smtp2go" && initial.apiKeySet && (
        <div className="border-t border-border pt-4 space-y-2">
          <div className="label">Send test email</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              className="input flex-1"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Leave empty to send to your own email"
            />
            <button
              onClick={sendTest}
              disabled={busy === "test"}
              className="btn"
            >
              {busy === "test" ? "Sending..." : "Send test"}
            </button>
          </div>
          {testMsg && (
            <div
              className={`text-sm ${
                testMsg.ok ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {testMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderBadge({
  provider,
  configured,
}: {
  provider: "smtp2go" | "none";
  configured: boolean;
}) {
  if (provider === "none") {
    return (
      <span className="px-2 py-1 rounded-md text-xs bg-gray-800/40 text-gray-400 border border-gray-700/50">
        Disabled
      </span>
    );
  }
  const ok = configured;
  return (
    <span
      className={`px-2 py-1 rounded-md text-xs border ${
        ok
          ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
          : "bg-amber-950/40 text-amber-300 border-amber-800/50"
      }`}
    >
      {ok ? "SMTP2Go configured" : "API key missing"}
    </span>
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

function TemplateEditor({
  template,
  brandName,
}: {
  template: Template;
  brandName: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const vars = { brandName, ...template.sample };
  const previewSubject = render(subject, vars);
  const previewBody = render(body, vars);

  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/admin/settings/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: template.key, subject, body }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="card p-4 space-y-3">
        <div>
          <div className="label mb-1">Subject</div>
          <input
            className="input w-full"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <div className="label mb-1">Body</div>
          <textarea
            className="input w-full font-mono text-xs"
            rows={Math.max(10, body.split("\n").length)}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <div className="label mb-1">Available variables</div>
          <div className="flex flex-wrap gap-1">
            {Object.keys(vars).map((k) => (
              <code
                key={k}
                className="text-xs bg-[#0b0e14] border border-border rounded px-1.5 py-0.5"
              >
                {"{{" + k + "}}"}
              </code>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 items-center">
          {saved && <span className="text-emerald-400 text-sm">Saved</span>}
          <button
            onClick={save}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? "Saving..." : "Save template"}
          </button>
        </div>
      </div>
      <div className="card p-4 space-y-2 bg-[#0b0e14]">
        <div className="label">Preview</div>
        <div className="border border-border rounded-md p-3 space-y-2 bg-[#11151c]">
          <div className="text-xs text-muted">Subject:</div>
          <div className="font-medium">{previewSubject}</div>
        </div>
        <pre className="border border-border rounded-md p-3 text-sm whitespace-pre-wrap font-sans bg-[#11151c]">
          {previewBody}
        </pre>
      </div>
    </div>
  );
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `{{${k}}}`
  );
}
