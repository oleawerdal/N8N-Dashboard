import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { userCanAccessWorkflow } from "@/lib/access";
import { getWorkflow, listExecutions } from "@/lib/n8n";
import { StatusBadge } from "@/components/StatusBadge";
import { RunButton } from "./RunButton";

export const dynamic = "force-dynamic";

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!userCanAccessWorkflow(user, id)) redirect("/workflows");
  const workflow = await getWorkflow(id);
  if (!workflow) notFound();
  const executions = await listExecutions(id, 25);

  const successCount = executions.filter((e) => e.status === "success").length;
  const errorCount = executions.filter((e) => e.status === "error").length;
  const avgMs =
    executions.filter((e) => e.durationMs != null).reduce(
      (s, e) => s + (e.durationMs || 0),
      0
    ) /
    Math.max(1, executions.filter((e) => e.durationMs != null).length);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/workflows"
            className="text-sm text-muted hover:text-white"
          >
            ← Workflows
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{workflow.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted">
            <StatusBadge status={workflow.active ? "active" : "inactive"} />
            <span>ID: {workflow.id}</span>
            <span>·</span>
            <span>Updated {new Date(workflow.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        {user.role === "admin" || user.clientRole === "operator" ? (
          <RunButton workflowId={workflow.id} />
        ) : (
          <div className="text-xs text-muted text-right max-w-xs">
            View-only access · ask your admin for operator role to run manually
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Runs (last 25)" value={executions.length.toString()} />
        <Stat
          label="Success rate"
          value={
            executions.length
              ? `${Math.round(
                  (successCount / executions.length) * 100
                )}%`
              : "—"
          }
        />
        <Stat
          label="Avg duration"
          value={
            isFinite(avgMs) && avgMs > 0
              ? `${(avgMs / 1000).toFixed(2)}s`
              : "—"
          }
        />
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent executions</h2>
        <div className="card overflow-hidden">
          <table className="data">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Duration</th>
                <th>Slowest node</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e) => {
                const slowest = [...e.nodes].sort(
                  (a, b) => b.executionTimeMs - a.executionTimeMs
                )[0];
                return (
                  <tr key={e.id}>
                    <td>{new Date(e.startedAt).toLocaleString()}</td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="text-muted capitalize">{e.mode}</td>
                    <td className="text-muted">
                      {e.durationMs != null
                        ? `${(e.durationMs / 1000).toFixed(2)}s`
                        : "—"}
                    </td>
                    <td className="text-muted">
                      {slowest
                        ? `${slowest.node} (${slowest.executionTimeMs}ms)`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-8">
                    No executions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {executions[0] && (
        <section>
          <h2 className="text-lg font-medium mb-3">
            Step timings — most recent run
          </h2>
          <div className="card p-5">
            <NodeTimings nodes={executions[0].nodes} />
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="label">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function NodeTimings({
  nodes,
}: {
  nodes: { node: string; executionTimeMs: number; status: string; errorMessage?: string }[];
}) {
  const max = Math.max(1, ...nodes.map((n) => n.executionTimeMs));
  return (
    <div className="space-y-2">
      {nodes.map((n) => (
        <div key={n.node}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium">{n.node}</span>
            <span
              className={
                n.status === "error" ? "text-red-400" : "text-muted"
              }
            >
              {n.executionTimeMs}ms
            </span>
          </div>
          <div className="h-2 rounded bg-[#0b0e14] overflow-hidden">
            <div
              className={`h-full ${
                n.status === "error" ? "bg-red-500" : "bg-accent"
              }`}
              style={{ width: `${(n.executionTimeMs / max) * 100}%` }}
            />
          </div>
          {n.errorMessage && (
            <div className="text-xs text-red-400 mt-1">{n.errorMessage}</div>
          )}
        </div>
      ))}
    </div>
  );
}
