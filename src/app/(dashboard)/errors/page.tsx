import { requireUser } from "@/lib/session";
import { workflowsForUser } from "@/lib/access";
import { errors as errorsStore } from "@/lib/store";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const user = await requireUser();
  const allowed = workflowsForUser(user).map((r) => r.n8nWorkflowId);
  const rows = errorsStore.recentForWorkflows(allowed, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Error alerts</h1>
        <p className="text-muted">
          Posted here by n8n's Error Workflow. Configure once in n8n →
          point it at this dashboard's webhook.
        </p>
      </div>
      <div className="card overflow-hidden">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Workflow</th>
              <th>Node</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-muted whitespace-nowrap">
                  {new Date(r.receivedAt).toLocaleString()}
                </td>
                <td>
                  <Link
                    href={`/workflows/${r.n8nWorkflowId}`}
                    className="hover:underline"
                  >
                    {r.workflowName || r.n8nWorkflowId}
                  </Link>
                </td>
                <td className="text-muted">{r.nodeName || "—"}</td>
                <td className="text-red-400">{r.message || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-8">
                  No errors recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-5 text-sm">
        <div className="label mb-2">Wiring up n8n's Error Workflow</div>
        <p className="text-muted mb-2">
          In n8n, create a workflow with an <code>Error Trigger</code> node, then add
          an <code>HTTP Request</code> node:
        </p>
        <pre className="bg-[#0b0e14] border border-border rounded-md p-3 overflow-x-auto text-xs">
{`POST  https://<this-dashboard>/api/errors
Body  {
  "workflowId":   "{{$json.workflow.id}}",
  "workflowName": "{{$json.workflow.name}}",
  "executionId":  "{{$json.execution.id}}",
  "nodeName":     "{{$json.execution.lastNodeExecuted}}",
  "message":      "{{$json.execution.error.message}}"
}`}
        </pre>
        <p className="text-muted mt-2">
          Then set this workflow as the "Error workflow" on each client workflow
          (Settings → Error Workflow).
        </p>
      </div>
    </div>
  );
}
