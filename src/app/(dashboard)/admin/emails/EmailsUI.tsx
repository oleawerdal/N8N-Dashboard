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

export function EmailsUI({
  templates,
  brandName,
}: {
  templates: Template[];
  brandName: string;
}) {
  const [active, setActive] = useState(templates[0]?.key);
  const t = templates.find((x) => x.key === active);
  if (!t) return null;
  return (
    <div className="space-y-3">
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
      <TemplateEditor key={t.key} template={t} brandName={brandName} />
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
