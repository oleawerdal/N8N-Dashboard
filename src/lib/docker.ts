// Docker host wrapper. Real ops are performed via dockerode when
// DOCKER_MODE=real; in mock mode every call updates only the in-memory
// store and pretends container actions succeeded. This lets the same
// dashboard run on Vercel (mock, demo) and on the Docker host
// (real, production) without code changes.
//
// To wire up real Docker:
//   1. npm install dockerode @types/dockerode
//   2. Set DOCKER_MODE=real in env
//   3. Mount the Docker socket into the dashboard container:
//        volumes:
//          - /var/run/docker.sock:/var/run/docker.sock
//   4. Implement the LIVE branches in this file using `new Docker()`.
//
// Security: docker.sock = root on host. Lock the admin UI behind strong
// auth + IP allowlist + MFA before flipping this to real mode in prod.

import { Instance, instances } from "./store";

const MODE = (process.env.DOCKER_MODE || "mock").toLowerCase();
export const DOCKER_LIVE = MODE === "real";

type ProvisionInput = {
  clientId: number;
  subdomain: string;
  image: string;
  envVars: Record<string, string>;
};

export type LogLine = {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
};

export async function provisionInstance(input: ProvisionInput): Promise<Instance> {
  // Create the bookkeeping record first; we transition status as we go.
  const inst = await instances.create(input);

  if (!DOCKER_LIVE) {
    // Mock: simulate provisioning succeeded after a short delay.
    // In a real prototype we'd want to flip status to "running" via
    // a setTimeout, but Vercel functions can't keep timers between
    // requests. Instead, flip immediately so the UI shows running.
    await instances.patch(inst.id, { status: "running" });
    return (await instances.findById(inst.id))!;
  }

  // --- LIVE path (sketch — fill in with dockerode):
  // const docker = new Docker(); // talks to /var/run/docker.sock
  // try {
  //   await docker.pull(input.image);
  //   const container = await docker.createContainer({
  //     name: `n8n_${input.subdomain}`,
  //     Image: input.image,
  //     Env: Object.entries(input.envVars).map(([k, v]) => `${k}=${v}`),
  //     HostConfig: {
  //       PortBindings: { "5678/tcp": [{ HostPort: String(inst.port) }] },
  //       RestartPolicy: { Name: "unless-stopped" },
  //       Binds: [`n8n_${input.subdomain}_data:/home/node/.n8n`],
  //     },
  //     Labels: {
  //       "n8n.dashboard.clientId": String(input.clientId),
  //       "caddy": `${input.subdomain}.n8n.example.com`,
  //       "caddy.reverse_proxy": `{{upstreams ${inst.port}}}`,
  //     },
  //   });
  //   await container.start();
  //   instances.patch(inst.id, { status: "running" });
  // } catch (e) {
  //   instances.patch(inst.id, { status: "error", lastError: String(e) });
  // }
  // return instances.findById(inst.id)!;
  throw new Error("DOCKER_MODE=real not yet implemented");
}

export async function updateImage(
  instanceId: number,
  newImage: string
): Promise<Instance> {
  const inst = await instances.findById(instanceId);
  if (!inst) throw new Error("instance not found");

  if (!DOCKER_LIVE) {
    await instances.patch(instanceId, { status: "updating" });
    await instances.patch(instanceId, { image: newImage, status: "running" });
    return (await instances.findById(instanceId))!;
  }

  // LIVE: docker.pull(newImage) -> stop -> remove -> recreate with same
  // volumes/env -> start. dockerode also exposes container.commit() for
  // rollback if needed.
  throw new Error("DOCKER_MODE=real not yet implemented");
}

export async function updateEnv(
  instanceId: number,
  envVars: Record<string, string>
): Promise<Instance> {
  const inst = await instances.findById(instanceId);
  if (!inst) throw new Error("instance not found");

  if (!DOCKER_LIVE) {
    await instances.patch(instanceId, { envVars, status: "running" });
    return (await instances.findById(instanceId))!;
  }
  // LIVE: env changes require container recreate (Docker can't mutate
  // env on a running container). Same recreate path as updateImage.
  throw new Error("DOCKER_MODE=real not yet implemented");
}

export async function restart(instanceId: number): Promise<Instance> {
  const inst = await instances.findById(instanceId);
  if (!inst) throw new Error("instance not found");

  if (!DOCKER_LIVE) {
    await instances.patch(instanceId, { status: "running" });
    return (await instances.findById(instanceId))!;
  }
  // LIVE: const c = docker.getContainer(inst.containerName); await c.restart();
  throw new Error("DOCKER_MODE=real not yet implemented");
}

export async function destroy(instanceId: number): Promise<void> {
  const inst = await instances.findById(instanceId);
  if (!inst) throw new Error("instance not found");

  if (!DOCKER_LIVE) {
    await instances.remove(instanceId);
    return;
  }
  // LIVE: stop + remove container, optionally drop the named volume.
  // Recommend keeping the volume by default and offering a separate
  // "purge data" action so deletions are recoverable.
  throw new Error("DOCKER_MODE=real not yet implemented");
}

export async function tailLogs(
  instanceId: number,
  lines = 100
): Promise<LogLine[]> {
  const inst = await instances.findById(instanceId);
  if (!inst) throw new Error("instance not found");

  if (!DOCKER_LIVE) {
    return fakeLogs(inst, lines);
  }
  // LIVE: container.logs({stdout:true, stderr:true, tail:lines, timestamps:true})
  // returns a multiplexed stream that must be demuxed via docker-modem.
  throw new Error("DOCKER_MODE=real not yet implemented");
}

function fakeLogs(inst: Instance, count: number): LogLine[] {
  const start = Date.now() - count * 12_000;
  const samples = [
    ["stdout", "n8n ready on port 5678"],
    ["stdout", "Loaded credentials from encryption key"],
    ["stdout", "Initialized SQLite database at /home/node/.n8n/database.sqlite"],
    ["stdout", "Workflow 'Daily Shopify → QuickBooks Sync' executed successfully"],
    ["stdout", "Workflow 'Lead Enrichment (HubSpot)' executed successfully"],
    ["stderr", "Warning: webhook URL not set, using HOST"],
    ["stdout", "Permissions OK"],
    ["stdout", "Executing scheduled workflow 'Weekly KPI Email'"],
  ] as const;
  return Array.from({ length: count }, (_, i) => {
    const [stream, message] = samples[i % samples.length];
    return {
      timestamp: new Date(start + i * 12_000).toISOString(),
      stream,
      message: `[${inst.containerName}] ${message}`,
    };
  });
}
