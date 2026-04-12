import { getKeyStatus, getValueStatus, setKey, setValue, isHosted, KEY_DEFS, VALUE_DEFS, type KeyId, type ValueId } from "@agent/_lib/config/keys";

export async function GET() {
  const hosted = isHosted();
  const keys = getKeyStatus();
  const values = getValueStatus();
  return Response.json({ keys, values, hosted, writable: !hosted });
}

export async function POST(req: Request) {
  const { keys, values } = (await req.json()) as {
    keys?: Record<string, string>;
    values?: Record<string, string>;
  };

  if ((!keys || typeof keys !== "object") && (!values || typeof values !== "object")) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const hosted = isHosted();

  for (const [id, value] of Object.entries(keys ?? {})) {
    if (id in KEY_DEFS) {
      setKey(id as KeyId, value);
    }
  }

  for (const [id, value] of Object.entries(values ?? {})) {
    if (id in VALUE_DEFS) {
      setValue(id as ValueId, value);
    }
  }

  return Response.json({
    success: true,
    keys: getKeyStatus(),
    values: getValueStatus(),
    note: hosted
      ? "Keys stored in memory for this session only. For persistence, set environment variables in your hosting provider."
      : "Keys saved to .env.local",
  });
}
