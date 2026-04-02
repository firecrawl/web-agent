import {
  getConversation,
  getMessages,
  deleteConversation,
  addMessage,
} from "@agent/_lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const messages = getMessages(id);
  return Response.json({
    ...conversation,
    config: JSON.parse(conversation.config),
    messages: messages.map((m) => ({
      ...m,
      parts: JSON.parse(m.parts),
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { messageId, role, content, parts } = await req.json();
  addMessage(messageId, id, role, content, parts);
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteConversation(id);
  return Response.json({ ok: true });
}
