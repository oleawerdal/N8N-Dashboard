export function StatusBadge({
  status,
}: {
  status: "success" | "error" | "running" | "waiting" | "active" | "inactive";
}) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    success: { bg: "#0f2f1a", fg: "#3ee08a", label: "Success" },
    error: { bg: "#3a1414", fg: "#ff6b6b", label: "Error" },
    running: { bg: "#1a2236", fg: "#5b8def", label: "Running" },
    waiting: { bg: "#2a2412", fg: "#e5b75c", label: "Waiting" },
    active: { bg: "#0f2f1a", fg: "#3ee08a", label: "Active" },
    inactive: { bg: "#1f2733", fg: "#7d8794", label: "Inactive" },
  };
  const s = map[status] || map.inactive;
  return (
    <span
      style={{ background: s.bg, color: s.fg }}
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md"
    >
      {s.label}
    </span>
  );
}
