export async function GET() {
  return Response.json([]);
}

export async function POST() {
  return Response.json({ error: "Conversation history is not available" }, { status: 501 });
}
