import { mappings, WorkflowMapping } from "./store";
import { SessionUser } from "./session";

export function workflowsForUser(user: SessionUser): WorkflowMapping[] {
  if (user.role === "admin") return mappings.all();
  if (!user.clientId) return [];
  return mappings.forClient(user.clientId);
}

export function userCanAccessWorkflow(
  user: SessionUser,
  workflowId: string
): boolean {
  if (user.role === "admin") return true;
  if (!user.clientId) return false;
  return mappings.exists(user.clientId, workflowId);
}
