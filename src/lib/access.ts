import { mappings, WorkflowMapping } from "./store";
import { SessionUser } from "./session";

export async function workflowsForUser(
  user: SessionUser
): Promise<WorkflowMapping[]> {
  if (user.role === "admin") return mappings.all();
  if (!user.clientId) return [];
  return mappings.forClient(user.clientId);
}

export async function userCanAccessWorkflow(
  user: SessionUser,
  workflowId: string
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!user.clientId) return false;
  return mappings.exists(user.clientId, workflowId);
}
