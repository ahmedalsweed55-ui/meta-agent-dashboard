const SECRET_KEY =
  /^(authorization|access_token|accesstoken|token|api_key|apikey|client_secret|client_key|password|secret|verify_token|app_secret)$/i;

export function redact(value: unknown): unknown {
  return walk(value);
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => walk(item));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key) || key === "value") {
      output[key] = "••••";
      continue;
    }
    output[key] = walk(nested);
  }
  return output;
}

export function clip(value: unknown, limit = 20_000): unknown {
  try {
    const text = JSON.stringify(value);
    if (text.length <= limit) return value;
    return { truncated: true, preview: text.slice(0, limit) };
  } catch {
    return { unserializable: true };
  }
}
