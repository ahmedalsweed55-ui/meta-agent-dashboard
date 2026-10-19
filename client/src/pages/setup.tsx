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
import {
  BILLING_HUB_URL,
  INELIGIBLE_MESSAGE_AR,
  PAYMENT_MESSAGE_AR,
  WHATSAPP_MANAGER_URL,
  checkEligibility,
  getSettings,
  needsAgentId,
  readAgentId,
  releaseThread,
  replaceSettings,
  rolloutEnabled,
  startOnboarding,
} from "@/lib/api";
import type { ApiExchange } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

const REASONS = [
  "البلد غير مدعوم",
  "WABA أو Business عليه تقييد",
  "فئة أعمال غير مدعومة",
  "متطلبات الثقة أو التحقق غير مكتملة",
  "يوجد AI Agent آخر على الرقم",
  "Meta لم تفعّل الإتاحة لهذا الحساب بعد",
];

export function SetupPage() {
  const { connection, setConnection, saveConnection, status, setStatus, run, busy } =
    useDashboard();
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payment, setPayment] = useState(false);
  const [ineligible, setIneligible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customer, setCustomer] = useState("");

  function patch(partial: Partial<typeof connection>) {
    setConnection({ ...connection, ...partial });
    setSaved(false);
  }

  async function onEligibility() {
    setPayment(false);
    setNotice(null);
    const result = await run(checkEligibility(connection));
    setExchange(result.exchange);
    if (!result.ok || typeof result.data?.is_eligible !== "boolean") {
      setIneligible(false);
      return;
    }
    const eligible = result.data.is_eligible;
    setStatus({ eligible });
    setIneligible(!eligible);
    if (!eligible) return;
    const onboard = await run(startOnboarding(connection));
    setExchange(onboard.exchange);
    if (!onboard.ok) return;
    const onboardAgent = readAgentId(onboard.data);
    const settings = await run(getSettings(connection));
    setExchange(settings.exchange);
    if (!settings.ok) return;
    setStatus({
      agentId: readAgentId(settings.data) ?? onboardAgent,
      rolloutEnabled: rolloutEnabled(settings.data),
    });
    setNotice("الأهلية نجحت، ثم اكتمل Onboarding وجلب الإعدادات من استجابات Meta.");
  }

  async function onGetSettings() {
    const result = await run(getSettings(connection));
    setExchange(result.exchange);
    if (!result.ok) return;
    setStatus({
      agentId: readAgentId(result.data) ?? status.agentId,
      rolloutEnabled: rolloutEnabled(result.data),
    });
  }

  async function onToggle(enabled: boolean) {
    setPayment(false);
    setNotice(null);
    const current = await run(getSettings(connection));
    setExchange(current.exchange);
    const agentId = current.ok ? readAgentId(current.data) : status.agentId;
    if (agentId) setStatus({ agentId });
    const body = enabled
      ? { rollout: { enabled: true }, ai_audience: "EVERYONE" }
      : { rollout: { enabled: false } };
    let put = await run(replaceSettings(connection, body));
    setExchange(put.exchange);
    if (!put.ok && agentId && needsAgentId(put.exchange)) {
      put = await run(replaceSettings(connection, body, agentId));
      setExchange(put.exchange);
      setNotice("أُعيد الطلب مع agent_id لأن رسالة Meta طلبته.");
    }
    if (!put.ok) {
      setPayment(put.exchange.paymentRequired);
      return;
    }
    const verify = await run(getSettings(connection));
    setExchange(verify.exchange);
    const live = verify.ok ? rolloutEnabled(verify.data) : null;
    setStatus({ rolloutEnabled: live, audience: enabled ? "EVERYONE" : status.audience });
    if (enabled && live !== true) {
      setNotice("رجعت استجابة، لكن التحقق اللاحق لم يؤكد rollout.enabled = true.");
      return;
    }
    setNotice(enabled ? "تم التحقق: rollout.enabled = true." : "تم إيقاف الوكيل حسب الاستجابة.");
  }

  async function onRelease() {
    const result = await run(releaseThread(connection, customer.trim()));
    setExchange(result.exchange);
  }

  const manager =
    connection.businessPortfolioId && connection.wabaId
      ? WHATSAPP_MANAGER_URL(connection.businessPortfolioId, connection.wabaId)
      : "";

  return (
    <div className="grid gap-5">
      <PageIntro title="الإعداد والربط">
        أدخل معرّفات Meta هنا. لا يُطلب التوكن في المحادثة، ولا يُطبع في السجلات.
      </PageIntro>
      <Alert>
        <AlertTitle>تنبيهات الأمان والإنتاج</AlertTitle>
        <AlertDescription className="grid gap-1">
          <span>لا تضع Access Token أو App Secret أو Verify Token داخل frontend في الإنتاج.</span>
          <span>استخدم Backend أو Serverless Functions، وخزّن الأسرار في Environment Variables.</span>
          <span>تحقق من Webhook Signature، واستخدم نظام صلاحيات للمستخدمين.</span>
          <span>سجّل العمليات من دون الأسرار أو بيانات المراجعين الحساسة، ولا تعرض استجابة كاملة تحتوي أسرارًا.</span>
          <span>هذه النسخة تحفظ الربط في localStorage للتجربة فقط. لا تستخدم localStorage للرموز في الإنتاج.</span>
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>بيانات الربط</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business Portfolio ID">
            <Input
              value={connection.businessPortfolioId}
              onChange={(event) => patch({ businessPortfolioId: event.target.value })}
            />
          </Field>
          <Field label="WhatsApp Business Account ID / WABA ID">
            <Input value={connection.wabaId} onChange={(event) => patch({ wabaId: event.target.value })} />
          </Field>
          <Field label="Phone Number ID" hint="يُستخدم كـ entity في مسارات الوكيل.">
            <Input
              value={connection.phoneNumberId}
              onChange={(event) => patch({ phoneNumberId: event.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="System User Access Token" hint="حقل مخفي. لا يُعرض في سجل الطلبات.">
            <Input
              type="password"
              autoComplete="off"
              value={connection.accessToken}
              onChange={(event) => patch({ accessToken: event.target.value })}
            />
          </Field>
          <Field
            label="App ID (اختياري)"
            hint="غير مطلوب لطلبات الوكيل الأساسية. مطلوب عمليًا عند إعداد Webhooks و subscribed_apps."
          >
            <Input value={connection.appId} onChange={(event) => patch({ appId: event.target.value })} />
          </Field>
          <Field
            label="نوع الربط"
            hint="Cloud API و Coexistence مدعومان هنا كوصف للحساب. Coexistence لا يعني أن الرقم مؤهل."
          >
            <Select
              value={connection.accountMode}
              onValueChange={(value) =>
                patch({ accountMode: value as typeof connection.accountMode })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cloud_api">WhatsApp Cloud API</SelectItem>
                <SelectItem value="coexistence">Coexistence</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              onClick={() => {
                saveConnection();
                setSaved(true);
              }}
            >
              حفظ بيانات الربط محليًا
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void onEligibility()}>
              Eligibility Check
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void startOnly()}>
              Agent Onboarding
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onGetSettings()}>
              Get Settings
            </Button>
            <Button disabled={busy} onClick={() => void onToggle(true)}>
              Enable Agent
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onToggle(false)}>
              Disable Agent
            </Button>
            <Button
              variant="outline"
              disabled={!manager}
              onClick={() => window.open(manager, "_blank", "noopener")}
            >
              فتح WhatsApp Manager
            </Button>
            <Button variant="outline" asChild>
              <a href={BILLING_HUB_URL} target="_blank" rel="noreferrer">
                فتح Billing Hub
              </a>
            </Button>
          </div>
          {saved ? <p className="text-sm text-primary">حُفظ الربط في هذا المتصفح فقط.</p> : null}
          {!manager ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              رابط واتساب مانيجر يُبنى من Business Portfolio ID و WABA ID:
              business_id و asset_id.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {ineligible ? (
        <Alert variant="destructive">
          <AlertTitle>{INELIGIBLE_MESSAGE_AR}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pe-4">
              {REASONS.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {payment ? (
        <Alert variant="destructive">
          <AlertTitle>{PAYMENT_MESSAGE_AR}</AlertTitle>
          <AlertDescription>
            <a className="underline" href={BILLING_HUB_URL} target="_blank" rel="noreferrer">
              فتح Billing Hub
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? <Alert><AlertDescription>{notice}</AlertDescription></Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks والسيطرة على المحادثة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            هذه النسخة static ولا تستقبل Webhooks. الاستقبال الإنتاجي يحتاج Backend عام وآمن مع Verify Token والتحقق من X-Hub-Signature-256.
          </p>
          <p>
            عند تفعيل الوكيل يصبح هو primary responder. التطبيق يمكنه استقبال نسخ في standby webhooks:
            standby.messages و standby.message_echoes و standby.statuses.
          </p>
          <p>
            إذا أرسل التطبيق رسالة فإنه يأخذ Thread Control، ويجب استدعاء release لإعادة السيطرة للوكيل. لا يمكن اعتراض رد الوكيل ومنعه قبل وصوله للعميل وهو primary responder.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="رقم العميل لإعادة السيطرة">
              <Input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="9665xxxxxxxx" />
            </Field>
            <Button variant="secondary" disabled={busy || !customer.trim()} onClick={() => void onRelease()}>
              Release Thread Control
            </Button>
          </div>
        </CardContent>
      </Card>
      <ApiResponsePanel exchange={exchange} />
    </div>
  );

  async function startOnly() {
    const result = await run(startOnboarding(connection));
    setExchange(result.exchange);
    if (result.ok) setStatus({ agentId: readAgentId(result.data) ?? status.agentId });
  }
}
