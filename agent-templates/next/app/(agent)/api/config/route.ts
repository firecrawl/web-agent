import {
  getKeyStatus,
  getValueStatus,
  setKey,
  setValue,
  isHosted,
  isSafeEnvValue,
  requireConfigReadAuth,
  requireConfigWriteAuth,
  KEY_DEFS,
  VALUE_DEFS,
  type KeyId,
  type ValueId,
} from "@agent/_lib/config/keys";

export async function GET(req: Request) {
  const denied = requireConfigReadAuth(req);
  if (denied) return denied;

  const hosted = isHosted();
  const keys = getKeyStatus();
  const values = getValueStatus();
  return Response.json({ keys, values, hosted, writable: !hosted });
}

export async function POST(req: Request) {
  const denied = requireConfigWriteAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body is not valid JSON" }, { status: 400 });
  }
  const { keys, values } = (body ?? {}) as {
    keys?: Record<string, string>;
    values?: Record<string, string>;
  };

  if ((!keys || typeof keys !== "object") && (!values || typeof values !== "object")) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Reject payloads whose values would break out of their .env.local line
  // or trip dotenv's quote/comment/variable-expansion parsing (see
  // isSafeEnvValue for the full denylist). Empty string means "delete
  // this key" and is legal.
  for (const value of Object.values(keys ?? {})) {
    if (value !== "" && !isSafeEnvValue(value)) {
      return Response.json({ error: "Invalid characters in key value" }, { status: 400 });
    }
  }
  for (const value of Object.values(values ?? {})) {
    if (value !== "" && !isSafeEnvValue(value)) {
      return Response.json({ error: "Invalid characters in value" }, { status: 400 });
    }
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
