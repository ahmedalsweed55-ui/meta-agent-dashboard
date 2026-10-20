import { useMemo, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BILLING_HUB_URL, getUsageInsights } from "@/lib/api";
import { useDashboard } from "@/state/dashboard";

export function LogsPage() {
  const { connection, setConnection, exchanges, clearLog, run, busy, setStatus } = useDashboard();
  const [page, setPage] = useState("all");
  const [operation, setOperation] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);

  const pages = unique(exchanges.map((item) => item.page));
  const operations = unique(exchanges.map((item) => item.operation));
  const filtered = useMemo(
    () =>
      exchanges.filter((item) => {
        if (page !== "all" && item.page !== page) return false;
        if (operation !== "all" && item.operation !== operation) return false;
        if (outcome === "ok" && !item.ok) return false;
        if (outcome === "fail" && item.ok) return false;
        return true;
      }),
    [exchanges, page, operation, outcome],
  );

  function exportJson() {
    download("meta-agent-log.json", JSON.stringify(filtered, null, 2), "application/json");
  }

  function exportCsv() {
    const header = [
      "time",
      "page",
      "operation",
      "endpoint",
      "method",
      "status",
      "duration",
      "summary",
      "fbtrace_id",
    ];
    const rows = filtered.map((item) =>
      [
        item.at,
        item.page,
        item.operation,
        item.url,
        item.method,
        item.status ?? "",
        item.durationMs,
        item.summary,
        item.fbtraceId ?? item.fbRequestId ?? "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    download("meta-agent-log.csv", [header.join(","), ...rows].join("\n"), "text/csv");
  }

  async function loadUsage() {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await run(
      getUsageInsights(connection, {
        start: String(Math.floor(start.getTime() / 1000)),
        end: String(Math.floor(end.getTime() / 1000)),
        granularity: "DAY",
      }),
    );
    if (!result.ok || !result.data?.usage) {
      setNotice(result.exchange.errorMessageAr);
      setStatus({ documentedCost: null });
      return;
    }
    const costs = result.data.usage
      .map((row) => row.cost)
      .filter((value): value is number => typeof value === "number");
    if (!costs.length) {
      setStatus({ documentedCost: null });
      setNotice("رجعت Meta بيانات استخدام من غير حقل cost. لن يُعرض سعر مخترع.");
      return;
    }
    const total = costs.reduce((sum, value) => sum + value, 0);
    setStatus({ documentedCost: total });
    setNotice(`مجموع cost كما رجع من Meta لآخر 30 يومًا: ${total}. العملة هي عملة حساب الفوترة ولم تُخترع هنا.`);
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="التكلفة والسجلات">
        السجل محلي داخل المتصفح. التكلفة تُعرض فقط إذا أعادت Meta رقمًا.
      </PageIntro>
      <Alert>
        <AlertDescription>
          تسعير Meta Business Agent يتطلب Billing Hub وطريقة دفع أو Credit Line حسب نوع الحساب.
          معرّف حساب الفوترة مختلف عن Phone Number ID ويُنسخ من Billing Hub.
        </AlertDescription>
      </Alert>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">معرّف حساب الفوترة</span>
            <Input
              value={connection.billableAccountId}
              onChange={(event) =>
                setConnection({ ...connection, billableAccountId: event.target.value })
              }
            />
          </div>
          <Button disabled={busy} onClick={() => void loadUsage()}>
            جلب الاستخدام لآخر 30 يومًا
          </Button>
          <Button variant="outline" asChild>
            <a href={BILLING_HUB_URL} target="_blank" rel="noreferrer">
              Billing Hub
            </a>
          </Button>
        </CardContent>
      </Card>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Filter label="النتيجة" value={outcome} onChange={setOutcome} options={[["all", "الكل"], ["ok", "نجاح"], ["fail", "فشل"]]} />
        <Filter label="الصفحة" value={page} onChange={setPage} options={[["all", "الكل"], ...pages.map((item) => [item, item] as [string, string])]} />
        <Filter label="العملية" value={operation} onChange={setOperation} options={[["all", "الكل"], ...operations.map((item) => [item, item] as [string, string])]} />
        <Button variant="outline" onClick={exportCsv}>تصدير CSV</Button>
        <Button variant="outline" onClick={exportJson}>تصدير JSON</Button>
        <Button variant="destructive" onClick={clearLog}>مسح السجل</Button>
      </div>
      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوقت</TableHead>
              <TableHead>الصفحة</TableHead>
              <TableHead>العملية</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>الملخص</TableHead>
              <TableHead>fbtrace_id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.at}</TableCell>
                <TableCell>{item.page}</TableCell>
                <TableCell>{item.operation}</TableCell>
                <TableCell className="max-w-56 truncate font-mono text-xs">{item.url}</TableCell>
                <TableCell>{item.method}</TableCell>
                <TableCell>{item.status ?? "—"}</TableCell>
                <TableCell>{item.durationMs}</TableCell>
                <TableCell>{item.summary}</TableCell>
                <TableCell className="font-mono text-xs">{item.fbtraceId ?? item.fbRequestId ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
