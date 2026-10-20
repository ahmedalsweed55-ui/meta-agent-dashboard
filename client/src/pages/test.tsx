import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { runAgentTest } from "@/lib/api";
import { buildTestCases } from "@/lib/presets";
import type { ApiExchange } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

type Bubble = { id: string; role: "user" | "agent"; text: string; extra?: Record<string, unknown> };

export function TestPage() {
  const { connection, profile, status, run, busy } = useDashboard();
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const cases = buildTestCases(profile);

  async function send(text: string) {
    const content = text.trim();
    if (!content) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: content }]);
    setDraft("");
    const result = await run(
      runAgentTest(connection, {
        user_msg: content,
        conversation_id: conversationId,
      }),
    );
    setExchange(result.exchange);
    if (!result.ok || !result.data) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: result.exchange.errorMessageAr ?? "لم يرجع رد ناجح.",
        },
      ]);
      return;
    }
    const data = result.data;
    if (typeof data.conversation_id === "string") setConversationId(data.conversation_id);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "agent",
        text: String(data.agent_response ?? ""),
        extra: data,
      },
    ]);
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="الاختبار">
        المحادثة ترسل إلى Agent Test API. الواجهة الغنية تُعرض فقط إذا رجعت في الاستجابة
        {status.uiSkillAccepted ? "، أو إذا سبق قبول UI Skill من Meta." : "."}
      </PageIntro>
      <div className="flex flex-wrap gap-2">
        {cases.map((item) => (
          <Button key={item} variant="outline" size="sm" disabled={busy} onClick={() => void send(item)}>
            {item}
          </Button>
        ))}
      </div>
      <Card className="bg-[#0d1c14]">
        <CardContent className="grid max-h-[32rem] gap-3 overflow-auto py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">ابدأ بترحيب أو حالة جاهزة.</p>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ms-8 rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
                  : "me-8 rounded-2xl bg-card px-3 py-2"
              }
            >
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
              {message.extra ? <Rich extra={message.extra} allowRich={status.uiSkillAccepted} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
      <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="اكتب رسالة الاختبار" />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void send(draft)}>إرسال إلى Agent Test</Button>
        <Button
          variant="outline"
          onClick={() => {
            setConversationId(undefined);
            setMessages([]);
          }}
        >
          محادثة جديدة
        </Button>
      </div>
      <ApiResponsePanel exchange={exchange} />
    </div>
  );
}

function Rich({ extra, allowRich }: { extra: Record<string, unknown>; allowRich: boolean }) {
  const products = Array.isArray(extra.product_variant_ids) ? extra.product_variant_ids : [];
  const replies = Array.isArray(extra.quick_replies) ? extra.quick_replies : [];
  const known = new Set([
    "agent_response",
    "conversation_id",
    "message_id",
    "timestamp",
    "product_variant_ids",
    "quick_replies",
    "handoff_reason",
    "no_response_reason",
  ]);
  const extras = Object.keys(extra).filter((key) => !known.has(key));
  const hasRich = products.length > 0 || replies.length > 0 || extras.length > 0;
  if (!hasRich && !allowRich) return null;
  return (
    <div className="mt-2 grid gap-1 text-xs">
      {typeof extra.handoff_reason === "string" ? <p>تحويل: {extra.handoff_reason}</p> : null}
      {typeof extra.no_response_reason === "string" ? <p>بدون رد: {extra.no_response_reason}</p> : null}
      {products.length ? <p>منتجات: {products.map(String).join("، ")}</p> : null}
      {replies.length ? <p>ردود مقترحة: {replies.map(String).join("، ")}</p> : null}
      {extras.length ? <p>حقول إضافية في الاستجابة: {extras.join("، ")}</p> : null}
      {!hasRich && allowRich ? (
        <p>تم إعداد UI Skill بنجاح سابقًا، لكن هذه الاستجابة لم تتضمن مكوّنًا غنيًا.</p>
      ) : null}
    </div>
  );
}
