"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Branding = {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string;
};

export function BrandingUI({ initial }: { initial: Branding }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Branding>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/admin/settings/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Preview branding={draft} />

      <div className="card p-4 sm:p-5 space-y-4">
        <Field label="Brand name">
          <input
            className="input w-full"
            value={draft.brandName}
            onChange={(e) =>
              setDraft({ ...draft, brandName: e.target.value })
            }
          />
        </Field>
        <Field label="Tagline">
          <input
            className="input w-full"
            value={draft.tagline}
            onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
            placeholder="One short line that appears under the brand"
          />
        </Field>
        <Field
          label="Logo URL"
          help="Square image, transparent background recommended. Leave empty to use the brand name only."
        >
          <input
            className="input w-full"
            value={draft.logoUrl ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, logoUrl: e.target.value || null })
            }
            placeholder="https://cdn.example.com/logo.png"
          />
        </Field>
        <Field label="Primary color" help="Used for buttons and accents.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-10 w-14 rounded cursor-pointer bg-transparent border border-border"
              value={draft.primaryColor}
              onChange={(e) =>
                setDraft({ ...draft, primaryColor: e.target.value })
              }
            />
            <input
              className="input flex-1 font-mono"
              value={draft.primaryColor}
              onChange={(e) =>
                setDraft({ ...draft, primaryColor: e.target.value })
              }
            />
          </div>
        </Field>
        <Field label="Support email">
          <input
            type="email"
            className="input w-full"
            value={draft.supportEmail}
            onChange={(e) =>
              setDraft({ ...draft, supportEmail: e.target.value })
            }
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-emerald-400 text-sm">Saved</span>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? "Saving..." : "Save branding"}
          </button>
        </div>
      </div>
    </div>
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

function Preview({ branding }: { branding: Branding }) {
  return (
    <div
      className="card p-4 sm:p-5 flex items-center gap-4"
      style={{ borderColor: branding.primaryColor }}
    >
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt=""
          className="h-12 w-12 rounded-md object-contain bg-[#0b0e14] border border-border"
        />
      ) : (
        <div
          className="h-12 w-12 rounded-md flex items-center justify-center font-bold text-lg"
          style={{ background: branding.primaryColor, color: "#fff" }}
        >
          {branding.brandName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{branding.brandName}</div>
        <div className="text-muted text-xs truncate">{branding.tagline}</div>
      </div>
      <button
        type="button"
        className="btn btn-primary text-sm"
        style={{ background: branding.primaryColor, borderColor: branding.primaryColor }}
      >
        Sample button
      </button>
    </div>
  );
}
