import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { Field } from "@/components/field";
import { PageIntro } from "@/components/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  asList,
  createConnector,
  createTool,
  deleteConnector,
  deleteTool,
  isCamelCaseName,
  isPublicHttps,
  listConnectors,
  listTools,
  refreshMcpTools,
  upsertApiKey,
  upsertOAuth,
} from "@/lib/api";
import { probeMcp } from "@/lib/mcp";
import { buildToolTemplates, toolBody } from "@/lib/presets";
import type { ApiExchange, ConnectorAuth, ToolDraft } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

const DIAGNOSIS = [
  "الاسم غير صالح",
  "لم يتم Agent Onboarding",
  "Base URL ليس public HTTPS",
  "MCP server لا يدعم protocol الصحيح",
  "schema Tool غير صالح",
  "credentials أو permissions غير مكتملة",
  "Connector workspace لم يتم provisioned",
];

export function ConnectorsPage() {
  const { connection, run, busy, pushExchange } = useDashboard();
  const [name, setName] = useState("storeOperationsApi");
  const [description, setDescription] = useState(
    "يربط الوكيل بعمليات المتجر: الطلبات والمنتجات والمواعيد. عدّل المسارات لتطابق نظامك.",
  );
  const [baseUrl, setBaseUrl] = useState("https://example.com");
  const [authType, setAuthType] = useState<ConnectorAuth>("NONE");
  const [apiKeyLocation, setApiKeyLocation] = useState<"headers" | "query_params" | "body_params">("headers");
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [oauth, setOauth] = useState({
    client_id: "",
    client_secret: "",
    token_url: "",
    scopes: "",
  });
  const [mcpUrl, setMcpUrl] = useState("https://example.com/mcp");
  const [tools, setTools] = useState<ToolDraft[]>(() => buildToolTemplates());
  const [connectors, setConnectors] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState("");
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidRequest, setInvalidRequest] = useState(false);

  function show(result: { exchange: ApiExchange }) {
    setExchange(result.exchange);
    const blob = JSON.stringify(result.exchange.response ?? {});
    setInvalidRequest(/invalid connector request/i.test(blob));
  }

  async function createHttp() {
    const nameError = isCamelCaseName(name) ? null : "اسم الموصل camelCase فقط، مثل storeOperationsApi، من غير مسافات أو شرطات.";
    const urlError = isPublicHttps(baseUrl);
    if (nameError || urlError) {
      setFormError(nameError ?? urlError);
      return;
    }
    setFormError(null);
    const created = await run(
      createConnector(connection, {
        name,
        description,
        base_url: baseUrl.trim(),
        auth_type: authType,
        connector_protocol: "HTTP",
      }),
    );
    show(created);
    if (!created.ok || !created.data || typeof created.data.id !== "string") return;
    const id = created.data.id;
    if (authType === "API_KEY") {
      const secret = await run(
        upsertApiKey(connection, id, {
          api_key_config: {
            [apiKeyLocation]: [
              {
                field_name: apiKeyName,
                prefix: apiKeyPrefix,
                value: apiKeyValue,
              },
            ],
          },
        }),
      );
      show(secret);
      setApiKeyValue("");
    }
    if (authType === "OAUTH2_CLIENT_CREDENTIALS") {
      const secret = await run(
        upsertOAuth(connection, id, {
          oauth_config: {
            client_id: oauth.client_id,
            client_secret: oauth.client_secret,
            token_url: oauth.token_url,
            scopes_to_request: oauth.scopes.split(",").map((item) => item.trim()).filter(Boolean),
          },
        }),
      );
      show(secret);
      setOauth((current) => ({ ...current, client_secret: "" }));
    }
    setSelected(id);
  }

  async function createMcp() {
    const urlError = isPublicHttps(mcpUrl);
    if (!isCamelCaseName("storeMcp") || urlError) {
      setFormError(urlError ?? "رابط MCP غير صالح.");
      return;
    }
    setFormError(null);
    const created = await run(
      createConnector(connection, {
        name: "storeMcp",
        description: "خادم MCP عام لعمليات المتجر. الأدوات تُزامَن من الخادم ولا تُخترع محليًا.",
        base_url: mcpUrl.trim(),
        auth_type: "NONE",
        connector_protocol: "MCP",
      }),
    );
    show(created);
    if (created.ok && created.data && typeof created.data.id === "string") {
      setSelected(created.data.id);
    }
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="Connectors">
        الموصل ليس Webhook. Meta تستدعي واجهة العميل عند الحاجة. المفتاح لا يُحفظ في الواجهة بعد الإرسال.
      </PageIntro>
      <Card>
        <CardHeader>
          <CardTitle>HTTP Connector</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="الاسم" hint="camelCase فقط.">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="الوصف">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Base URL">
            <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </Field>
          <Field label="المصادقة" hint="المدعوم حاليًا: NONE و API_KEY و OAUTH2_CLIENT_CREDENTIALS.">
            <Select value={authType} onValueChange={(value) => setAuthType(value as ConnectorAuth)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">NONE</SelectItem>
                <SelectItem value="API_KEY">API_KEY</SelectItem>
                <SelectItem value="OAUTH2_CLIENT_CREDENTIALS">OAUTH2_CLIENT_CREDENTIALS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {authType === "API_KEY" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="مكان المفتاح">
                <Select
                  value={apiKeyLocation}
                  onValueChange={(value) =>
                    setApiKeyLocation(value as typeof apiKeyLocation)
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="headers">headers</SelectItem>
                    <SelectItem value="query_params">query_params</SelectItem>
                    <SelectItem value="body_params">body_params</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="اسم الحقل">
                <Input value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} />
              </Field>
              <Field label="البادئة">
                <Input value={apiKeyPrefix} onChange={(event) => setApiKeyPrefix(event.target.value)} />
              </Field>
              <Field label="القيمة" hint="تُرسل مرة واحدة ولا تُحفظ.">
                <Input type="password" value={apiKeyValue} onChange={(event) => setApiKeyValue(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {authType === "OAUTH2_CLIENT_CREDENTIALS" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="client_id">
                <Input value={oauth.client_id} onChange={(event) => setOauth({ ...oauth, client_id: event.target.value })} />
              </Field>
              <Field label="client_secret" hint="لا يُحفظ محليًا.">
                <Input type="password" value={oauth.client_secret} onChange={(event) => setOauth({ ...oauth, client_secret: event.target.value })} />
              </Field>
              <Field label="token_url">
                <Input value={oauth.token_url} onChange={(event) => setOauth({ ...oauth, token_url: event.target.value })} />
              </Field>
              <Field label="scopes مفصولة بفاصلة">
                <Input value={oauth.scopes} onChange={(event) => setOauth({ ...oauth, scopes: event.target.value })} />
              </Field>
            </div>
          ) : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button disabled={busy} onClick={() => void createHttp()}>إنشاء HTTP Connector</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>أدوات HTTP قابلة للتعديل</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tools.map((tool) => (
            <div key={tool.localId} className="grid gap-2 rounded-lg border p-3">
              <Input value={tool.name} onChange={(event) => patchTool(tool.localId, { name: event.target.value })} />
              <Textarea value={tool.description} onChange={(event) => patchTool(tool.localId, { description: event.target.value })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={tool.method} onChange={(event) => patchTool(tool.localId, { method: event.target.value as ToolDraft["method"] })} />
                <Input value={tool.path} onChange={(event) => patchTool(tool.localId, { path: event.target.value })} />
              </div>
              <Field label="حقول الجسم مفصولة بفاصلة">
                <Input value={tool.bodyFields} onChange={(event) => patchTool(tool.localId, { bodyFields: event.target.value })} />
              </Field>
              <Button
                size="sm"
                disabled={busy || !selected}
                onClick={() =>
                  void run(createTool(connection, selected, toolBody(tool))).then(show)
                }
              >
                رفع الأداة إلى الموصل المحدد
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => setTools(buildToolTemplates())}>إعادة النماذج</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>MCP Connector</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="MCP endpoint">
            <Input value={mcpUrl} onChange={(event) => setMcpUrl(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void probeMcp(mcpUrl.trim()).then((result) => {
                  pushExchange(result);
                  setExchange(result);
                })
              }
            >
              فحص بروتوكول MCP
            </Button>
            <Button disabled={busy} onClick={() => void createMcp()}>إنشاء MCP Connector</Button>
            <Button
              variant="secondary"
              disabled={busy || !selected}
              onClick={() => void run(refreshMcpTools(connection, selected)).then(show)}
            >
              Refresh / Sync MCP Tools
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(listConnectors(connection)).then((result) => {
              show(result);
              if (result.ok) setConnectors(asList(result.data));
            })
          }
        >
          عرض الموصلات
        </Button>
        <Button
          variant="outline"
          disabled={busy || !selected}
          onClick={() => void run(listTools(connection, selected)).then(show)}
        >
          عرض أدوات الموصل المحدد
        </Button>
        <Button
          variant="destructive"
          disabled={busy || !selected}
          onClick={() =>
            void run(deleteConnector(connection, selected)).then((result) => {
              show(result);
              if (result.ok) {
                setConnectors((current) => current.filter((item) => item.id !== selected));
                setSelected("");
              }
            })
          }
        >
          حذف الموصل المحدد
        </Button>
      </div>
      <div className="grid gap-3">
        {connectors.map((item) => {
          const sync = (item.mcp_tool_sync ?? null) as Record<string, unknown> | null;
          const connectionStatus = (item.connection_status ?? {}) as Record<string, unknown>;
          const id = String(item.id ?? "");
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`rounded-lg border p-3 text-start ${selected === id ? "border-primary" : ""}`}
            >
              <p className="font-medium">{String(item.name)} · {String(item.connector_protocol ?? "HTTP")}</p>
              <p className="text-xs text-muted-foreground">{String(item.base_url ?? "")}</p>
              <p className="text-sm">الاتصال: {String(connectionStatus.status ?? "—")}</p>
              {connectionStatus.error_message ? (
                <p className="text-sm text-destructive">{String(connectionStatus.error_message)}</p>
              ) : null}
              {sync ? (
                <p className="text-sm">
                  مزامنة MCP: {String(sync.status ?? "—")} · الأدوات: {String(sync.tool_count ?? "—")} · آخر محاولة: {String(sync.last_attempted_at ?? "—")}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(listTools(connection, selected)).then(async (result) => {
              show(result);
              if (!result.ok) return;
              const remote = asList(result.data);
              for (const tool of remote) {
                if (typeof tool.id === "string") {
                  const removed = await run(deleteTool(connection, selected, tool.id));
                  show(removed);
                }
              }
            })
          }
        >
          حذف كل أدوات الموصل المحدد
        </Button>
      ) : null}
      {invalidRequest ? (
        <Alert variant="destructive">
          <AlertTitle>Invalid connector request</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pe-4">
              {DIAGNOSIS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <ApiResponsePanel exchange={exchange} />
    </div>
  );

  function patchTool(localId: string, patch: Partial<ToolDraft>) {
    setTools((current) => current.map((tool) => (tool.localId === localId ? { ...tool, ...patch } : tool)));
  }
}
