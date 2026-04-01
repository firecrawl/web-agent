import { detectACPAgents } from "@agent/_lib/agents/acp";

export async function GET() {
  const agents = detectACPAgents();
  return Response.json(agents);
}
