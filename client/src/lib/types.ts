export type AccountMode = "cloud_api" | "coexistence";

export type Connection = {
  businessPortfolioId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  accountMode: AccountMode;
  billableAccountId: string;
};

export type BusinessProfile = {
  name: string;
  type: string;
  branches: string;
  onlineStore: string;
};

export type ApiExchange = {
  id: string;
  at: string;
  page: string;
  operation: string;
  method: string;
  url: string;
  requestBody: unknown;
  status: number | null;
  ok: boolean;
  response: unknown;
  durationMs: number;
  fbtraceId: string | null;
  fbRequestId: string | null;
  errorMessageAr: string | null;
  summary: string;
  paymentRequired: boolean;
};

export type ApiResult<T> = {
  ok: boolean;
  data: T | null;
  exchange: ApiExchange;
};

export type AgentSettings = {
  agent_id?: string;
  ai_audience?: "EVERYONE" | "ALLOWLISTED_ONLY" | null;
  channel?: string;
  rollout?: { enabled?: boolean };
  handoff?: { enabled?: boolean; message?: string } | null;
  followup?: {
    enabled?: boolean;
    followup_interval_in_seconds?: number;
    message?: string;
  } | null;
};

export type BusinessInfo = {
  business_description: string;
  payment_method: string;
  return_policy: string;
  purchase_info: string;
  delivery_and_shipping: string;
  contact_info: {
    email: string;
    hours_of_operation: string;
    address: string;
  };
};

export type FaqDraft = {
  localId: string;
  remoteId?: string;
  question: string;
  answer: string;
};

export type SkillDraft = {
  localId: string;
  remoteId?: string;
  title: string;
  description: string;
  skill: string;
};

export type UiComponentType =
  | "cta_url"
  | "image"
  | "interactive_list"
  | "location"
  | "location_request"
  | "carousel_url"
  | "carousel_quick_reply"
  | "flow"
  | "interactive_reply_buttons";

export type UiSkillDraft = {
  localId: string;
  remoteId?: string;
  title: string;
  component_type: UiComponentType;
  status: "enabled" | "disabled";
  instruction: string;
  flow_id: string;
};

export type ToolParam = {
  name: string;
  type: "string" | "integer" | "number" | "boolean";
  required: boolean;
  description: string;
  in: "path" | "query";
};

export type ToolDraft = {
  localId: string;
  remoteId?: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: ToolParam[];
  bodyFields: string;
};

export type ConnectorAuth = "NONE" | "API_KEY" | "OAUTH2_CLIENT_CREDENTIALS";

export type RuntimeStatus = {
  eligible: boolean | null;
  agentId: string | null;
  rolloutEnabled: boolean | null;
  audience: string | null;
  uiSkillAccepted: boolean;
  documentedCost: number | null;
};
