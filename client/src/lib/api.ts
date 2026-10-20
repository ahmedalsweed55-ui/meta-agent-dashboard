import { clip, redact } from "@/lib/redact";
import type { ApiExchange, ApiResult, Connection } from "@/lib/types";

/**
 * Meta Business Agent calls.
 *
 * Host: https://api.facebook.com/{phone_number_id}/...
 * Headers on Business Agent calls: Authorization Bearer, Content-Type JSON,
 * X-API-Version 2.0.0 (usage insights uses 3.0.0 as published on that endpoint).
 *
 * Paths and bodies follow the current Business Agent contract:
 * agent_eligibility, agent_onboarding?channel=whatsapp, agent_config/settings,
 * agent_config/business_info, faq, websites, files, skills, agent-ui-skills,
 * agent_connectors, agent_test, agent-eval, agent_thread_control.
 * Phone Number ID is the entity for those routes. Usage insights use the
 * billable account id from Billing Hub, not the phone number id.
 */

export const META_API_HOST = "https://api.facebook.com";
export const MBA_API_VERSION = "2.0.0";
export const USAGE_API_VERSION = "3.0.0";

export const META_DOCS = {
  overview:
    "https://developers.facebook.com/documentation/meta-business-agent/overview",
  eligibility:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/onboard/agent-eligibility",
  onboarding:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/onboard/agent-onboarding",
  settings:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/onboard/agent-settings",
  businessInfo:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/agent-knowledge-business-info",
  faqs: "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/agent-knowledge-faqs",
  files:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/agent-knowledge-files",
  websites:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/agent-knowledge-websites",
  skills:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/agent-skills",
  uiSkills:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/ui-skills",
  connectors:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/connectors",
  tools:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/configure/connector-tools",
  test: "https://developers.facebook.com/documentation/meta-business-agent/reference/operate/agent-test",
  eval: "https://developers.facebook.com/documentation/meta-business-agent/reference/operate/agent-eval",
  thread:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/operate/thread-control-cloud-api",
  usage:
    "https://developers.facebook.com/documentation/meta-business-agent/reference/insights/business-agent-usage-insights",
} as const;

export const WHATSAPP_MANAGER_URL = (businessId: string, wabaId: string) =>
  `https://business.facebook.com/latest/whatsapp_manager/business_ai?business_id=${encodeURIComponent(businessId)}&asset_id=${encodeURIComponent(wabaId)}`;

export const BILLING_HUB_URL =
  "https://business.facebook.com/latest/billing_hub/credit_lines/";

export const PAYMENT_MESSAGE_AR =
  "يجب ربط وسيلة دفع أو Credit Line بحساب Meta Business Agent قبل التفعيل للجميع.";

export const INELIGIBLE_MESSAGE_AR =
  "هذا الرقم غير مؤهل حالياً لـ Meta Business Agent. توثيق النشاط أو فئة النشاط وحدهما لا يضمنان الإتاحة.";

const FILE_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.xlsx";
export const KNOWLEDGE_FILE_ACCEPT = FILE_ACCEPT;
export const KNOWLEDGE_FILE_MAX_BYTES = 100_000_000;

type CallInput = {
  connection: Connection;
  page: string;
  operation: string;
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  formData?: FormData;
  apiVersion?: string;
  entity?: "phone" | "billable";
};

export async function metaRequest<T>(input: CallInput): Promise<ApiResult<T>> {
  const started = performance.now();
  const missing = missingCredentials(input);
  if (missing) {
    return finish<T>(input, started, missing, null, null, false, null);
  }

  const url = buildUrl(input);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${input.connection.accessToken}`);
  headers.set("Accept", "application/json");
  headers.set("X-API-Version", input.apiVersion ?? MBA_API_VERSION);
  let body: BodyInit | undefined;
  if (input.formData) {
    body = input.formData;
  } else if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(input.body);
  }

  try {
    const response = await fetch(url, {
      method: input.method,
      headers,
      body,
    });
    const text = await response.text();
    const parsed = parseJson(text);
    const fbRequestId = response.headers.get("x-fb-request-id");
    const fbtraceId =
      response.headers.get("x-fb-trace-id") ?? readTrace(parsed);
    const ok = response.ok;
    return finish<T>(
      input,
      started,
      url,
      response.status,
      parsed,
      ok,
      fbtraceId,
      fbRequestId,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "network";
    return finish<T>(
      input,
      started,
      url,
      null,
      { networkError: message },
      false,
      null,
    );
  }
}

function missingCredentials(input: CallInput): string | null {
  if (input.entity === "billable") {
    if (!input.connection.billableAccountId.trim()) {
      return "missing-billable";
    }
  } else if (!input.connection.phoneNumberId.trim()) {
    return "missing-phone";
  }
  if (!input.connection.accessToken.trim()) return "missing-token";
  return null;
}

function buildUrl(input: CallInput): string {
  if (input.path === "missing-phone" || input.path === "missing-token" || input.path === "missing-billable") {
    return input.path;
  }
  const entityId =
    input.entity === "billable"
      ? input.connection.billableAccountId.trim()
      : input.connection.phoneNumberId.trim();
  const url = new URL(
    `${META_API_HOST}/${encodeURIComponent(entityId)}${input.path}`,
  );
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function finish<T>(
  input: CallInput,
  started: number,
  urlOrCode: string,
  status: number | null,
  response: unknown,
  ok: boolean,
  fbtraceId: string | null,
  fbRequestId: string | null = null,
): ApiResult<T> {
  const localError = localErrorMessage(urlOrCode);
  const url = localError ? "(لم يُرسل الطلب)" : urlOrCode;
  const safeResponse = clip(redact(response));
  const errorMessageAr = ok
    ? null
    : localError ?? arabicError(status, response);
  const paymentRequired = !ok && isPaymentError(response, errorMessageAr);
  const exchange: ApiExchange = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    page: input.page,
    operation: input.operation,
    method: input.method,
    url,
    requestBody: clip(redact(requestPreview(input))),
    status,
    ok,
    response: safeResponse,
    durationMs: Math.round(performance.now() - started),
    fbtraceId,
    fbRequestId,
    errorMessageAr: paymentRequired ? PAYMENT_MESSAGE_AR : errorMessageAr,
    summary: summarize(ok, status, response, errorMessageAr),
    paymentRequired,
  };
  return {
    ok,
    data: ok ? (response as T) : null,
    exchange,
  };
}

function requestPreview(input: CallInput): unknown {
  if (input.formData) {
    const fileName = input.formData.get("file_name");
    return {
      file_name: typeof fileName === "string" ? fileName : "",
      file: "[binary omitted]",
    };
  }
  return input.body ?? null;
}

function localErrorMessage(code: string): string | null {
  if (code === "missing-phone") return "أدخل Phone Number ID قبل إرسال الطلب.";
  if (code === "missing-token") return "أدخل System User Access Token قبل إرسال الطلب.";
  if (code === "missing-billable") {
    return "أدخل معرّف حساب الفوترة من Billing Hub. لا يُستخدم Phone Number ID مكانه.";
  }
  return null;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 4000) };
  }
}

function readTrace(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.fbtrace_id === "string") return record.fbtrace_id;
  const error = record.error;
  if (error && typeof error === "object") {
    const nested = (error as Record<string, unknown>).fbtrace_id;
    if (typeof nested === "string") return nested;
  }
  return null;
}

function arabicError(status: number | null, response: unknown): string {
  const detail = readDetail(response);
  if (status === null) {
    return "تعذر الاتصال بـ Meta. المتصفح قد يمنع الطلب بسبب CORS، والاستخدام الإنتاجي يحتاج Backend وسيطًا آمنًا.";
  }
  if (detail && /terms of service|terms must be accepted/i.test(detail)) {
    return "يجب قبول شروط Meta Business AI من واتساب مانيجر قبل استخدام هذه الواجهة.";
  }
  if (status === 401) return detail ? `غير مصرح: ${detail}` : "الرمز غير مقبول أو لا يملك الصلاحية.";
  if (status === 403) return detail ? `مرفوض: ${detail}` : "رفضت Meta الطلب. تحقق من الأهلية وقبول الشروط.";
  if (status === 404) return detail ? `غير موجود: ${detail}` : "المسار أو المعرّف غير موجود عند Meta.";
  if (status === 429) return "تجاوزت حد الطلبات لدى Meta. أعد المحاولة لاحقًا.";
  if (detail) return detail;
  return `أعادت Meta الحالة ${status} من دون رسالة أوضح.`;
}

function readDetail(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    const user = nested.error_user_msg ?? nested.message;
    if (typeof user === "string") return user;
  }
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.title === "string" && typeof record.detail !== "string") {
    return record.title;
  }
  if (typeof record.message === "string") return record.message;
  return "";
}

export function isPaymentError(response: unknown, message: string | null): boolean {
  const blob = `${message ?? ""} ${readDetail(response)}`.toLowerCase();
  return /payment method|payment_method|credit line|credit_line|billing|must add a payment|وسيلة دفع/.test(
    blob,
  );
}

function summarize(
  ok: boolean,
  status: number | null,
  response: unknown,
  errorMessageAr: string | null,
): string {
  if (!ok) return (errorMessageAr ?? "فشل الطلب").slice(0, 180);
  if (Array.isArray(response)) return `نجاح ${status ?? 200}: ${response.length} عنصر`;
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (typeof record.is_eligible === "boolean") {
      return record.is_eligible ? "الرقم مؤهل" : "الرقم غير مؤهل";
    }
    if (typeof record.agent_id === "string") return `agent_id: ${record.agent_id}`;
    if (record.rollout && typeof record.rollout === "object") {
      const enabled = (record.rollout as { enabled?: boolean }).enabled;
      return `rollout.enabled=${String(enabled)}`;
    }
  }
  return `نجاح ${status ?? 200}`;
}

function phoneCall<T>(
  connection: Connection,
  page: string,
  operation: string,
  method: string,
  path: string,
  extra: Partial<CallInput> = {},
) {
  return metaRequest<T>({
    connection,
    page,
    operation,
    method,
    path,
    ...extra,
  });
}

export const checkEligibility = (connection: Connection) =>
  phoneCall<{ is_eligible?: boolean }>(
    connection,
    "الإعداد والربط",
    "Eligibility Check",
    "GET",
    "/agent_eligibility",
  );

export const startOnboarding = (connection: Connection) =>
  phoneCall<{ agent_id?: string }>(
    connection,
    "الإعداد والربط",
    "Agent Onboarding",
    "POST",
    "/agent_onboarding",
    { query: { channel: "whatsapp" } },
  );

export const getSettings = (connection: Connection, agentId?: string) =>
  phoneCall<unknown>(
    connection,
    "الإعداد والربط",
    "Get Settings",
    "GET",
    "/agent_config/settings",
    { query: { agent_id: agentId } },
  );

export const replaceSettings = (
  connection: Connection,
  body: Record<string, unknown>,
  agentId?: string,
) =>
  phoneCall<unknown>(
    connection,
    "الإعداد والربط",
    "Update Settings",
    "PUT",
    "/agent_config/settings",
    { body, query: { agent_id: agentId } },
  );

export const getBusinessInfo = (connection: Connection) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Get Business Info",
    "GET",
    "/agent_config/business_info",
  );

export const putBusinessInfo = (
  connection: Connection,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Save Business Info",
    "PUT",
    "/agent_config/business_info",
    { body },
  );

export const listFaqs = (connection: Connection) =>
  phoneCall<unknown>(connection, "قاعدة المعرفة", "List FAQs", "GET", "/agent_config/faq");

export const createFaq = (
  connection: Connection,
  body: { question: string; answer: string },
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Create FAQ",
    "POST",
    "/agent_config/faq",
    { body },
  );

export const updateFaq = (
  connection: Connection,
  faqId: string,
  body: { question: string; answer: string },
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Update FAQ",
    "PUT",
    `/agent_config/faq/${encodeURIComponent(faqId)}`,
    { body },
  );

export const deleteFaq = (connection: Connection, faqId: string) =>
  phoneCall<unknown>(
    connection,
    "قاعدة المعرفة",
    "Delete FAQ",
    "DELETE",
    `/agent_config/faq/${encodeURIComponent(faqId)}`,
  );

export const listWebsites = (connection: Connection) =>
  phoneCall<unknown>(
    connection,
    "قاعدة المعرفة",
    "List Websites",
    "GET",
    "/agent_config/websites",
  );

export const addWebsite = (connection: Connection, url: string) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Add Website",
    "POST",
    "/agent_config/websites",
    { body: { url } },
  );

export const deleteWebsite = (connection: Connection, websiteId: string) =>
  phoneCall<unknown>(
    connection,
    "قاعدة المعرفة",
    "Delete Website",
    "DELETE",
    `/agent_config/websites/${encodeURIComponent(websiteId)}`,
  );

export const listFiles = (connection: Connection) =>
  phoneCall<unknown>(
    connection,
    "قاعدة المعرفة",
    "List Files",
    "GET",
    "/agent_config/files",
  );

export function uploadKnowledgeFile(connection: Connection, file: File) {
  const form = new FormData();
  form.set("file_name", file.name);
  form.set("file", file);
  return phoneCall<Record<string, unknown>>(
    connection,
    "قاعدة المعرفة",
    "Upload File",
    "POST",
    "/agent_config/files",
    { formData: form },
  );
}

export const deleteFile = (connection: Connection, fileId: string) =>
  phoneCall<unknown>(
    connection,
    "قاعدة المعرفة",
    "Delete File",
    "DELETE",
    `/agent_config/files/${encodeURIComponent(fileId)}`,
  );

export const listSkills = (connection: Connection, agentId?: string) =>
  phoneCall<unknown>(
    connection,
    "التعليمات والمهارات",
    "List Skills",
    "GET",
    "/agent_config/skills",
    { query: { agent_id: agentId } },
  );

export const createSkill = (
  connection: Connection,
  body: { title: string; description: string; skill: string },
  agentId?: string,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "التعليمات والمهارات",
    "Create Skill",
    "POST",
    "/agent_config/skills",
    { body, query: { agent_id: agentId } },
  );

export const updateSkill = (
  connection: Connection,
  skillId: string,
  body: { title: string; description: string; skill: string },
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "التعليمات والمهارات",
    "Update Skill",
    "PUT",
    `/agent_config/skills/${encodeURIComponent(skillId)}`,
    { body },
  );

export const deleteSkill = (connection: Connection, skillId: string) =>
  phoneCall<unknown>(
    connection,
    "التعليمات والمهارات",
    "Delete Skill",
    "DELETE",
    `/agent_config/skills/${encodeURIComponent(skillId)}`,
  );

export const listUiSkills = (connection: Connection) =>
  phoneCall<unknown>(
    connection,
    "UI Skills",
    "List UI Skills",
    "GET",
    "/agent-ui-skills",
  );

export const createUiSkill = (connection: Connection, body: Record<string, unknown>) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "UI Skills",
    "Create UI Skill",
    "POST",
    "/agent-ui-skills",
    { body },
  );

export const updateUiSkill = (
  connection: Connection,
  instructionId: string,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "UI Skills",
    "Update UI Skill",
    "PUT",
    `/agent-ui-skills/${encodeURIComponent(instructionId)}`,
    { body },
  );

export const deleteUiSkill = (connection: Connection, instructionId: string) =>
  phoneCall<unknown>(
    connection,
    "UI Skills",
    "Delete UI Skill",
    "DELETE",
    `/agent-ui-skills/${encodeURIComponent(instructionId)}`,
  );

export const listConnectors = (connection: Connection) =>
  phoneCall<unknown>(
    connection,
    "Connectors",
    "List Connectors",
    "GET",
    "/agent_connectors",
  );

export const createConnector = (
  connection: Connection,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Create Connector",
    "POST",
    "/agent_connectors",
    { body },
  );

export const deleteConnector = (connection: Connection, connectorId: string) =>
  phoneCall<unknown>(
    connection,
    "Connectors",
    "Delete Connector",
    "DELETE",
    `/agent_connectors/${encodeURIComponent(connectorId)}`,
  );

export const refreshMcpTools = (connection: Connection, connectorId: string) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Refresh MCP Tools",
    "POST",
    `/agent_connectors/${encodeURIComponent(connectorId)}/refreshMCPTools`,
  );

export const upsertApiKey = (
  connection: Connection,
  connectorId: string,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Upsert API Key",
    "POST",
    `/agent_connectors/${encodeURIComponent(connectorId)}/upsertApiKey`,
    { body },
  );

export const upsertOAuth = (
  connection: Connection,
  connectorId: string,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Upsert OAuth",
    "POST",
    `/agent_connectors/${encodeURIComponent(connectorId)}/upsertOAuth`,
    { body },
  );

export const listTools = (connection: Connection, connectorId: string) =>
  phoneCall<unknown>(
    connection,
    "Connectors",
    "List Tools",
    "GET",
    `/agent_connectors/${encodeURIComponent(connectorId)}/tools`,
  );

export const createTool = (
  connection: Connection,
  connectorId: string,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Create Tool",
    "POST",
    `/agent_connectors/${encodeURIComponent(connectorId)}/tools`,
    { body },
  );

export const updateTool = (
  connection: Connection,
  connectorId: string,
  toolId: string,
  body: Record<string, unknown>,
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "Connectors",
    "Update Tool",
    "PUT",
    `/agent_connectors/${encodeURIComponent(connectorId)}/tools/${encodeURIComponent(toolId)}`,
    { body },
  );

export const deleteTool = (
  connection: Connection,
  connectorId: string,
  toolId: string,
) =>
  phoneCall<unknown>(
    connection,
    "Connectors",
    "Delete Tool",
    "DELETE",
    `/agent_connectors/${encodeURIComponent(connectorId)}/tools/${encodeURIComponent(toolId)}`,
  );

export const runAgentTest = (
  connection: Connection,
  body: { user_msg: string; conversation_id?: string },
) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "الاختبار",
    "Agent Test",
    "POST",
    "/agent_test",
    { body },
  );

export const listEvalCases = (connection: Connection) =>
  phoneCall<{ eval_cases?: unknown[] }>(
    connection,
    "التقييم والأداء",
    "List Eval Cases",
    "GET",
    "/agent-eval/cases",
  );

export const runEval = (connection: Connection, evalCaseIds: string[]) =>
  phoneCall<{ job_id?: string; status?: string }>(
    connection,
    "التقييم والأداء",
    "Run Eval",
    "POST",
    "/agent-eval/run",
    { query: { eval_case_ids: evalCaseIds.join(",") }, body: {} },
  );

export const getEvalJob = (connection: Connection, jobId: string) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "التقييم والأداء",
    "Get Eval Job",
    "GET",
    "/agent-eval/run",
    { query: { job_id: jobId } },
  );

export const getEvalDetails = (connection: Connection, evalIds: string) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "التقييم والأداء",
    "Get Eval Details",
    "GET",
    "/agent-eval/details",
    { query: { eval_ids: evalIds } },
  );

export const getUsageInsights = (
  connection: Connection,
  query: { start: string; end: string; granularity: string },
) =>
  metaRequest<{ usage?: Array<Record<string, unknown>> }>({
    connection,
    page: "التكلفة والسجلات",
    operation: "Usage Insights",
    method: "GET",
    path: "/insights/usage",
    query,
    apiVersion: USAGE_API_VERSION,
    entity: "billable",
  });

export const releaseThread = (connection: Connection, to: string) =>
  phoneCall<Record<string, unknown>>(
    connection,
    "الإعداد والربط",
    "Release Thread Control",
    "POST",
    "/agent_thread_control",
    {
      body: {
        messaging_product: "whatsapp",
        action: "release",
        to,
      },
    },
  );

export function asList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object") as Record<
      string,
      unknown
    >[];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return asList(record.data);
    if (Array.isArray(record.eval_cases)) return asList(record.eval_cases);
  }
  return [];
}

export function readSettingsList(value: unknown): Record<string, unknown>[] {
  return asList(value);
}

export function rolloutEnabled(value: unknown): boolean | null {
  const list = asList(value);
  const item = list[0] ?? (value && typeof value === "object" ? value : null);
  if (!item || typeof item !== "object") return null;
  const rollout = (item as Record<string, unknown>).rollout;
  if (!rollout || typeof rollout !== "object") return null;
  const enabled = (rollout as { enabled?: unknown }).enabled;
  return typeof enabled === "boolean" ? enabled : null;
}

export function readAgentId(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const direct = (value as { agent_id?: unknown }).agent_id;
    if (typeof direct === "string" && direct) return direct;
  }
  for (const item of asList(value)) {
    if (typeof item.agent_id === "string" && item.agent_id) return item.agent_id;
  }
  return null;
}

export function needsAgentId(exchange: ApiExchange): boolean {
  const text = `${exchange.errorMessageAr ?? ""} ${JSON.stringify(exchange.response ?? {})}`;
  return /agent_id/i.test(text) && /required|missing|يجب|invalid/i.test(text);
}

export function isPublicHttps(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "الرابط غير صالح.";
  }
  if (url.protocol !== "https:") return "Base URL يجب أن يكون HTTPS عامًا.";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return "لا يُسمح بـ localhost.";
  }
  if (isPrivateIp(host)) return "لا يُسمح بعناوين IP الخاصة.";
  return null;
}

function isPrivateIp(host: string): boolean {
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return false;
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function isCamelCaseName(name: string): boolean {
  return /^[a-z][A-Za-z0-9]*$/.test(name);
}

export function isSkillTitle(title: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(title) && title.length <= 64;
}

export function knowledgeFileError(file: File): string | null {
  const allowed = new Set([
    "pdf",
    "doc",
    "docx",
    "png",
    "jpg",
    "jpeg",
    "csv",
    "xlsx",
  ]);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.has(extension)) {
    return "نوع الملف غير مدعوم. المقبول: PDF, DOC, DOCX, PNG, JPG, JPEG, CSV, XLSX.";
  }
  if (file.size > KNOWLEDGE_FILE_MAX_BYTES) {
    return "يتجاوز الملف الحد الموثق: 100 ميجابايت.";
  }
  return null;
}
