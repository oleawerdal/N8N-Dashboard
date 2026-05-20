import Link from "next/link";
import { requireUser } from "@/lib/session";
import { workflowsForUser } from "@/lib/access";
import { listWorkflows, listExecutions } from "@/lib/n8n";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const user = await requireUser();
  const mappings = workflowsForUser(user);
  const ids = [...new Set(mappings.map((m) => m.n8nWorkflowId))];
  const workflows = await listWorkflows(ids);
  const overrides = new Map(
    mappings.map((m) => [m.n8nWorkflowId, m.displayName])
  );

  const enriched = await Promise.all(
    workflows.map(async (w) => {
      const execs = await listExecutions(w.id, 1);
      return { workflow: w, last: execs[0] };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-muted">
            {workflows.length} workflow{workflows.length === 1 ? "" : "s"} available to you
          </p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Last run</th>
              <th>Last duration</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ workflow, last }) => (
              <tr key={workflow.id} className="row-link">
                <td>
                  <Link
                    href={`/workflows/${workflow.id}`}
                    className="font-medium hover:underline"
                  >
                    {overrides.get(workflow.id) || workflow.name}
                  </Link>
                  <div className="text-xs text-muted">{workflow.id}</div>
                </td>
                <td>
                  <StatusBadge status={workflow.active ? "active" : "inactive"} />
                </td>
                <td className="text-muted">
                  {last ? new Date(last.startedAt).toLocaleString() : "—"}
                </td>
                <td className="text-muted">
                  {last?.durationMs != null
                    ? `${(last.durationMs / 1000).toFixed(2)}s`
                    : "—"}
                </td>
              </tr>
            ))}
            {enriched.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-8">
                  No workflows assigned to your account yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
