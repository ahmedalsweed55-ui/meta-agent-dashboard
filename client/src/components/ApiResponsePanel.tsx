import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiExchange } from "@/lib/types";

export function ApiResponsePanel({
  exchange,
}: {
  exchange: ApiExchange | null;
}) {
  if (!exchange) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>استجابة Meta</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          لم يُرسل طلب بعد من هذه الصفحة. النجاح لا يُعرض إلا بعد استجابة فعلية.
        </CardContent>
      </Card>
    );
  }

  const trace = exchange.fbtraceId || exchange.fbRequestId;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>استجابة Meta</CardTitle>
        <Badge variant={exchange.ok ? "default" : "destructive"}>
          {exchange.ok ? "نجاح" : "فشل"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <Row label="Method" value={exchange.method} />
        <Row label="URL" value={exchange.url} mono />
        <Block label="Request body" value={exchange.requestBody} />
        <Row label="HTTP status" value={exchange.status === null ? "—" : String(exchange.status)} />
        <Block label="Response JSON" value={exchange.response} />
        <Row label="وقت العملية" value={formatWhen(exchange.at, exchange.durationMs)} />
        <Row label="fbtrace_id / X-FB-Request-ID" value={trace ?? "غير موجود في الاستجابة"} mono />
        {exchange.errorMessageAr ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
            {exchange.errorMessageAr}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "break-all font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function Block({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <pre className="max-h-64 overflow-auto rounded-lg bg-background/70 p-3 text-xs leading-6">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatWhen(at: string, durationMs: number) {
  const time = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Riyadh",
  }).format(new Date(at));
  return `${time} · ${durationMs} ms`;
}
