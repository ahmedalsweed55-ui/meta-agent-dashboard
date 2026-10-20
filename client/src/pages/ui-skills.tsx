import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { Field } from "@/components/field";
import { PageIntro } from "@/components/shell";
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
  createUiSkill,
  deleteUiSkill,
  listUiSkills,
  updateUiSkill,
} from "@/lib/api";
import { buildUiSkills } from "@/lib/presets";
import type { ApiExchange, UiComponentType, UiSkillDraft } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

const TYPES: Array<[UiComponentType, string]> = [
  ["cta_url", "CTA URL Button"],
  ["image", "Image"],
  ["interactive_list", "Interactive List"],
  ["location", "Location"],
  ["location_request", "Location Request"],
  ["carousel_url", "Media Carousel (روابط)"],
  ["carousel_quick_reply", "Media Carousel (ردود سريعة)"],
  ["flow", "WhatsApp Flow"],
  ["interactive_reply_buttons", "Reply Buttons"],
];

export function UiSkillsPage() {
  const { connection, profile, run, busy, setStatus } = useDashboard();
  const [items, setItems] = useState<UiSkillDraft[]>(() => buildUiSkills(profile));
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function bodyFor(item: UiSkillDraft, creating: boolean) {
    if (item.component_type === "flow") {
      if (!/^\d+$/.test(item.flow_id)) {
        return { error: "واتساب فلو يحتاج flow_id رقميًا منشورًا. لا يُرسل النموذج من غيره." };
      }
    }
    if (creating) {
      const body: Record<string, unknown> = {
        title: item.title,
        component_type: item.component_type,
        status: item.status,
        instruction: item.instruction,
      };
      if (item.component_type === "flow") body.flow_id = Number(item.flow_id);
      return { body };
    }
    return {
      body: {
        title: item.title,
        status: item.status,
        instruction: item.instruction,
      },
    };
  }

  async function save(item: UiSkillDraft) {
    const prepared = bodyFor(item, !item.remoteId);
    if ("error" in prepared) {
      setFormError(prepared.error ?? "تعذر تجهيز الطلب.");
      return;
    }
    setFormError(null);
    const result = item.remoteId
      ? await run(updateUiSkill(connection, item.remoteId, prepared.body))
      : await run(createUiSkill(connection, prepared.body));
    setExchange(result.exchange);
    if (!result.ok || !result.data) return;
    setStatus({ uiSkillAccepted: true });
    if (typeof result.data.id === "string") {
      setItems((current) =>
        current.map((row) =>
          row.localId === item.localId ? { ...row, remoteId: String(result.data?.id) } : row,
        ),
      );
    }
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="UI Skills">
        الأنواع المعروضة هي الأنواع الموجودة في عقد الواجهة الحالي. الردود التقليدية
        interactive_reply_buttons ظاهرة لأن العقد يوثقها، والتعديل بعد الإنشاء لا يغيّر النوع ولا flow_id.
      </PageIntro>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setItems(buildUiSkills(profile))}>
          تحميل النماذج الجاهزة
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(listUiSkills(connection)).then((result) => {
              setExchange(result.exchange);
              if (!result.ok) return;
              setItems(
                asList(result.data).map((row) => ({
                  localId: crypto.randomUUID(),
                  remoteId: String(row.id ?? ""),
                  title: String(row.title ?? ""),
                  component_type: String(row.component_type ?? "cta_url") as UiComponentType,
                  status: row.status === "disabled" ? "disabled" : "enabled",
                  instruction: String(row.instruction ?? ""),
                  flow_id: row.flow_id === undefined ? "" : String(row.flow_id),
                })),
              );
            })
          }
        >
          عرض من Meta
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setItems((current) => [
              ...current,
              {
                localId: crypto.randomUUID(),
                title: "",
                component_type: "cta_url",
                status: "enabled",
                instruction: "",
                flow_id: "",
              },
            ])
          }
        >
          إضافة UI Skill
        </Button>
      </div>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {items.map((item) => (
        <Card key={item.localId}>
          <CardHeader>
            <CardTitle>{item.title || "مهارة واجهة"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="العنوان">
              <Input
                value={item.title}
                onChange={(event) => patch(item.localId, { title: event.target.value })}
              />
            </Field>
            <Field label="النوع" hint={item.remoteId ? "النوع لا يتغير بعد الإنشاء." : undefined}>
              <Select
                value={item.component_type}
                disabled={Boolean(item.remoteId)}
                onValueChange={(value) =>
                  patch(item.localId, { component_type: value as UiComponentType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {item.component_type === "flow" ? (
              <Field label="flow_id" hint="مطلوب فقط لهذا النوع، ويُحذف من باقي الأنواع.">
                <Input
                  value={item.flow_id}
                  disabled={Boolean(item.remoteId)}
                  onChange={(event) => patch(item.localId, { flow_id: event.target.value })}
                />
              </Field>
            ) : null}
            <Field label="الحالة">
              <Select
                value={item.status}
                onValueChange={(value) =>
                  patch(item.localId, { status: value === "disabled" ? "disabled" : "enabled" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">enabled</SelectItem>
                  <SelectItem value="disabled">disabled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="متى يستخدمها الوكيل">
              <Textarea
                value={item.instruction}
                onChange={(event) => patch(item.localId, { instruction: event.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void save(item)}>
                حفظ ورفع
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (item.remoteId) {
                      const result = await run(deleteUiSkill(connection, item.remoteId));
                      setExchange(result.exchange);
                      if (!result.ok) return;
                    }
                    setItems((current) => current.filter((row) => row.localId !== item.localId));
                  })()
                }
              >
                حذف
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <ApiResponsePanel exchange={exchange} />
    </div>
  );

  function patch(localId: string, partial: Partial<UiSkillDraft>) {
    setItems((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...partial } : row)),
    );
  }
}
