import { getKeyStatus, setKey, isHosted, KEY_DEFS, type KeyId } from "@agent/_lib/config/keys";

export async function GET() {
  const hosted = isHosted();
  const keys = getKeyStatus();
  return Response.json({ keys, hosted, writable: !hosted });
}

export async function POST(req: Request) {
  const { keys } = (await req.json()) as { keys: Record<string, string> };

  if (!keys || typeof keys !== "object") {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const hosted = isHosted();

  for (const [id, value] of Object.entries(keys)) {
    if (!(id in KEY_DEFS)) continue;
    setKey(id as KeyId, value);
  }

  return Response.json({
    success: true,
    keys: getKeyStatus(),
    note: hosted
      ? "Keys stored in memory for this session only. For persistence, set environment variables in your hosting provider."
      : "Keys saved to .env.local",
  });
}
