import { requireUser } from "@/lib/session";
import { workflowsForUser } from "@/lib/access";
import { listWorkflows, listExecutions } from "@/lib/n8n";
import { errors as errorsStore } from "@/lib/store";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const user = await requireUser();
  const mappings = await workflowsForUser(user);
  const ids = [...new Set(mappings.map((m) => m.n8nWorkflowId))];
  const workflows = await listWorkflows(ids);

  const recentByWorkflow = await Promise.all(
    workflows.map(async (w) => ({
      workflow: w,
      executions: await listExecutions(w.id, 5),
    }))
  );

  const totalRuns = recentByWorkflow.reduce(
    (s, x) => s + x.executions.length,
    0
  );
  const errored = recentByWorkflow.reduce(
    (s, x) => s + x.executions.filter((e) => e.status === "error").length,
    0
  );
  const active = workflows.filter((w) => w.active).length;
  const unread = await errorsStore.unreadCountForWorkflows(ids);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Hi {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted">Here's what's happening with your automations.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Workflows" value={workflows.length} />
        <Stat label="Active" value={active} />
        <Stat
          label="Errors (last 5 / wf)"
          value={errored}
          tone={errored > 0 ? "danger" : "ok"}
        />
        <Stat
          label="Unread alerts"
          value={unread}
          tone={unread > 0 ? "danger" : "ok"}
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Recent activity</h2>
          <Link href="/workflows" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <table className="data hidden sm:table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Last run</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recentByWorkflow.flatMap(({ workflow, executions }) =>
                executions.slice(0, 1).map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/workflows/${workflow.id}`}
                        className="hover:underline"
                      >
                        {workflow.name}
                      </Link>
                    </td>
                    <td className="text-muted">
                      {new Date(e.startedAt).toLocaleString()}
                    </td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="text-muted">
                      {e.durationMs != null
                        ? `${(e.durationMs / 1000).toFixed(2)}s`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
              {totalRuns === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-8">
                    No runs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Mobile list */}
          <div className="sm:hidden">
            {recentByWorkflow.flatMap(({ workflow, executions }) =>
              executions.slice(0, 1).map((e) => (
                <Link
                  key={e.id}
                  href={`/workflows/${workflow.id}`}
                  className="list-row"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="row-title truncate">{workflow.name}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="row-meta flex justify-between">
                    <span>{new Date(e.startedAt).toLocaleString()}</span>
                    <span>
                      {e.durationMs != null
                        ? `${(e.durationMs / 1000).toFixed(2)}s`
                        : "—"}
                    </span>
                  </div>
                </Link>
              ))
            )}
            {totalRuns === 0 && (
              <div className="text-center text-muted py-8">No runs yet</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-red-400"
      : tone === "ok"
      ? "text-emerald-400"
      : "text-white";
  return (
    <div className="card px-5 py-4">
      <div className="label">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
