import type { ApiExchange } from "@/lib/types";
import { isPublicHttps } from "@/lib/api";

const PROTOCOL = "2026-07-28";

export async function probeMcp(endpoint: string): Promise<ApiExchange> {
  const started = performance.now();
  const invalid = isPublicHttps(endpoint);
  if (invalid) {
    return exchange(endpoint, started, null, { error: invalid }, false, invalid);
  }
  const modern = await postJson(endpoint, discoverBody(), {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": PROTOCOL,
    "Mcp-Method": "server/discover",
  });
  if (modern.ok) {
    return exchange(
      endpoint,
      started,
      modern.status,
      modern.body,
      true,
      null,
      "MCP modern server/discover",
    );
  }
  const modernError = isModernMcpError(modern.body);
  if (modern.status === 400 && modernError) {
    return exchange(
      endpoint,
      started,
      modern.status,
      modern.body,
      false,
      "الخادم ردّ بخطأ بروتوكول حديث. راجع الإصدارات التي يدعمها.",
      "MCP modern server/discover",
    );
  }
  const legacy = await postJson(
    endpoint,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "meta-business-agent-dashboard", version: "1.0.0" },
      },
    },
    {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
  );
  return exchange(
    endpoint,
    started,
    legacy.status,
    { modern: modern.body, legacyInitialize: legacy.body },
    legacy.ok,
    legacy.ok
      ? null
      : "لم ينجح فحص Streamable HTTP. الخادم قد لا يدعم البروتوكول الحالي أو فحص المتصفح منعه بسبب CORS.",
    "MCP probe",
  );
}

function discoverBody() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": PROTOCOL,
        "io.modelcontextprotocol/clientInfo": {
          name: "meta-business-agent-dashboard",
          version: "1.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

async function postJson(
  endpoint: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number | null; body: unknown }> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      parsed = { raw: text.slice(0, 2000) };
    }
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: { networkError: error instanceof Error ? error.message : "network" },
    };
  }
}

function isModernMcpError(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const error = (body as { error?: { code?: unknown } }).error;
  return Boolean(error && typeof error.code === "number");
}

function exchange(
  endpoint: string,
  started: number,
  status: number | null,
  response: unknown,
  ok: boolean,
  errorMessageAr: string | null,
  operation = "MCP probe",
): ApiExchange {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    page: "Connectors",
    operation,
    method: "POST",
    url: endpoint,
    requestBody: { note: "فحص بروتوكول MCP من غير أسرار" },
    status,
    ok,
    response,
    durationMs: Math.round(performance.now() - started),
    fbtraceId: null,
    fbRequestId: null,
    errorMessageAr,
    summary: ok ? "استجاب خادم MCP" : (errorMessageAr ?? "فشل فحص MCP"),
    paymentRequired: false,
  };
}
