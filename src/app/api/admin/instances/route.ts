import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { instances, clients } from "@/lib/store";
import { provisionInstance } from "@/lib/docker";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ instances: await instances.all() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      clientId?: number;
      subdomain?: string;
      image?: string;
      envVars?: Record<string, string>;
    };
    if (!body.clientId || !body.subdomain || !body.image) {
      return NextResponse.json(
        { error: "clientId, subdomain and image are required" },
        { status: 400 }
      );
    }
    const client = await clients.findById(body.clientId);
    if (!client) {
      return NextResponse.json({ error: "client not found" }, { status: 404 });
    }
    if (client.tenancyMode !== "dedicated") {
      return NextResponse.json(
        {
          error:
            "Client is in shared mode. Switch tenancy to 'dedicated' first.",
        },
        { status: 400 }
      );
    }
    if (await instances.forClient(body.clientId)) {
      return NextResponse.json(
        { error: "client already has an instance" },
        { status: 409 }
      );
    }
    const inst = await provisionInstance({
      clientId: body.clientId,
      subdomain: body.subdomain,
      image: body.image,
      envVars: body.envVars ?? {},
    });
    return NextResponse.json({ instance: inst });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "error";
  const status =
    msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}
