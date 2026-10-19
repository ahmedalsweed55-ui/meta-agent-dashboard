import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { Field } from "@/components/field";
import { PageIntro } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  asList,
  createSkill,
  deleteSkill,
  isSkillTitle,
  listSkills,
  updateSkill,
} from "@/lib/api";
import { buildSkills } from "@/lib/presets";
import type { ApiExchange, SkillDraft } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

export function SkillsPage() {
  const { connection, profile, status, run, busy } = useDashboard();
  const [skills, setSkills] = useState<SkillDraft[]>(() => buildSkills(profile));
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function show(result: { exchange: ApiExchange }) {
    setExchange(result.exchange);
  }

  async function saveOne(skill: SkillDraft) {
    if (!isSkillTitle(skill.title) || skill.description.length > 1024 || skill.skill.length > 20000) {
      setFormError("العنوان حروف إنجليزية صغيرة وأرقام وشرطات، بحد 64. الوصف 1024 والنص 20000.");
      return;
    }
    setFormError(null);
    const body = { title: skill.title, description: skill.description, skill: skill.skill };
    const result = skill.remoteId
      ? await run(updateSkill(connection, skill.remoteId, body))
      : await run(createSkill(connection, body, status.agentId ?? undefined));
    show(result);
    if (result.ok && result.data && typeof result.data.id === "string") {
      setSkills((current) =>
        current.map((item) =>
          item.localId === skill.localId ? { ...item, remoteId: String(result.data?.id) } : item,
        ),
      );
    }
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="التعليمات والمهارات" />
      <Alert>
        <AlertDescription>
          هنا تكتب قواعد سلوك الـAgent وأسلوب الرد. لا تضع أسعاراً أو مواعيد أو مخزوناً متغيراً هنا؛ استخدم الأدوات الحية أو الـConnectors لذلك.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setSkills(buildSkills(profile))}>
          تحميل المهارات الجاهزة
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(listSkills(connection, status.agentId ?? undefined)).then((result) => {
              show(result);
              if (!result.ok) return;
              setSkills(
                asList(result.data).map((item) => ({
                  localId: crypto.randomUUID(),
                  remoteId: String(item.id ?? ""),
                  title: String(item.title ?? ""),
                  description: String(item.description ?? ""),
                  skill: String(item.skill ?? ""),
                })),
              );
            })
          }
        >
          عرض من Meta
        </Button>
        <Button disabled={busy} onClick={() => void (async () => {
          for (const skill of skills) await saveOne(skill);
        })()}>
          رفع الكل إلى Meta
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setSkills((current) => [
              ...current,
              { localId: crypto.randomUUID(), title: "", description: "", skill: "" },
            ])
          }
        >
          إضافة Skill
        </Button>
      </div>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {skills.map((skill) => (
        <Card key={skill.localId}>
          <CardContent className="grid gap-2 pt-4">
            <Field label="title">
              <Input
                value={skill.title}
                onChange={(event) => update(skill.localId, { title: event.target.value })}
              />
            </Field>
            <Field label="description">
              <Textarea
                value={skill.description}
                onChange={(event) => update(skill.localId, { description: event.target.value })}
              />
            </Field>
            <Field label="skill">
              <Textarea
                value={skill.skill}
                onChange={(event) => update(skill.localId, { skill: event.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void saveOne(skill)}>
                حفظ ورفع
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (skill.remoteId) {
                      const result = await run(deleteSkill(connection, skill.remoteId));
                      show(result);
                      if (!result.ok) return;
                    }
                    setSkills((current) => current.filter((item) => item.localId !== skill.localId));
                  })()
                }
              >
                حذف Skill
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <ApiResponsePanel exchange={exchange} />
    </div>
  );

  function update(localId: string, patch: Partial<SkillDraft>) {
    setSkills((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  }
}
