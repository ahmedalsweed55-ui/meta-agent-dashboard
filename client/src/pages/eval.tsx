import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { PageIntro } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asList, getEvalDetails, getEvalJob, listEvalCases, runEval } from "@/lib/api";
import { buildEvalTemplates } from "@/lib/presets";
import type { ApiExchange } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

export function EvalPage() {
  const { connection, profile, run, busy } = useDashboard();
  const templates = buildEvalTemplates(profile);
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [exchange, setExchange] = useState<ApiExchange | null>(null);

  return (
    <div className="grid gap-5">
      <PageIntro title="التقييم والأداء">
        واجهة التقييم الرسمية هنا تدعم جلب الحالات وتشغيلها. لا يوجد زر إنشاء لأن المسار الموثق هو GET للحالات، والإنشاء يتم من واتساب مانيجر ثم التحميل.
      </PageIntro>
      <Alert>
        <AlertDescription>
          القوالب العربية بالأسفل مرجع محلي فقط، ولا تُرفع تلقائيًا.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run(listEvalCases(connection)).then((result) => {
              setExchange(result.exchange);
              if (!result.ok) return;
              setCases(asList(result.data?.eval_cases ?? result.data));
            })
          }
        >
          جلب الحالات من Meta
        </Button>
        <Button
          variant="secondary"
          disabled={busy || picked.length === 0}
          onClick={() =>
            void run(runEval(connection, picked)).then(async (result) => {
              setExchange(result.exchange);
              if (!result.ok || !result.data?.job_id) return;
              const status = await run(getEvalJob(connection, result.data.job_id));
              setExchange(status.exchange);
              if (status.ok && status.data) setJob(status.data);
            })
          }
        >
          تشغيل الحالات المحددة
        </Button>
        <Button
          variant="outline"
          disabled={busy || !job || typeof job.job_id !== "string" && !lastJobId(exchange)}
          onClick={() => {
            const id = typeof job?.job_id === "string" ? job.job_id : lastJobId(exchange);
            if (!id) return;
            void run(getEvalJob(connection, id)).then((result) => {
              setExchange(result.exchange);
              if (result.ok && result.data) setJob(result.data);
            });
          }}
        >
          تحديث حالة التشغيل
        </Button>
      </div>
      <div className="grid gap-2">
        {cases.map((item) => {
          const id = String(item.id ?? "");
          return (
            <label key={id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(id)}
                onChange={(event) =>
                  setPicked((current) =>
                    event.target.checked ? [...current, id] : current.filter((value) => value !== id),
                  )
                }
              />
              <span>
                <span className="font-medium">{String(item.scenario ?? id)}</span>
                {Array.isArray(item.success_criteria) ? (
                  <span className="mt-1 block text-muted-foreground">
                    {item.success_criteria.map(String).join(" · ")}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {job ? (
        <Card>
          <CardHeader>
            <CardTitle>نتيجة التشغيل</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>الحالة: {String(job.status ?? "—")}</p>
            <ResultBlock value={job.result} />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const ids = collectEvalIds(job);
                if (!ids) return;
                void run(getEvalDetails(connection, ids)).then((result) => setExchange(result.exchange));
              }}
            >
              جلب تفاصيل التقييم إن وُجدت معرّفات
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {templates.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>{item.scenario}</p>
              <ul className="list-disc pe-4 text-muted-foreground">
                {item.success.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <ApiResponsePanel exchange={exchange} />
    </div>
  );
}

function ResultBlock({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <p>لا توجد نتيجة مكتملة بعد.</p>;
  const result = value as Record<string, unknown>;
  return (
    <div className="grid gap-1">
      <p>متوسط المحادثة: {String(result.avg_conversation_score ?? "—")}</p>
      <p>متوسط الدور: {String(result.avg_turn_score ?? "—")}</p>
      <p>{String(result.summary ?? "")}</p>
    </div>
  );
}

function collectEvalIds(job: Record<string, unknown>): string | null {
  const result = job.result;
  if (!result || typeof result !== "object") return null;
  const raw = (result as { eval_ids_by_score?: unknown }).eval_ids_by_score;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ids = Object.values(parsed).flatMap((value) => (Array.isArray(value) ? value.map(String) : []));
    return ids.length ? ids.join(",") : null;
  } catch {
    return null;
  }
}

function lastJobId(exchange: ApiExchange | null): string | null {
  const response = exchange?.response;
  if (!response || typeof response !== "object") return null;
  const id = (response as { job_id?: unknown }).job_id;
  return typeof id === "string" ? id : null;
}
