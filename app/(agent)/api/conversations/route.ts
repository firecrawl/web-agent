import {
  listConversations,
  createConversation,
} from "@agent/_lib/db";

export async function GET() {
  const conversations = listConversations();
  return Response.json(conversations);
}

export async function POST(req: Request) {
  const { id, title, config } = await req.json();
  createConversation(id, title, config ?? {});
  return Response.json({ id, title });
}
