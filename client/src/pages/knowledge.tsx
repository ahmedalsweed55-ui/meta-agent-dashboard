import { useState } from "react";
import { ApiResponsePanel } from "@/components/ApiResponsePanel";
import { Field } from "@/components/field";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  KNOWLEDGE_FILE_ACCEPT,
  addWebsite,
  asList,
  createFaq,
  deleteFaq,
  deleteFile,
  deleteWebsite,
  getBusinessInfo,
  knowledgeFileError,
  listFaqs,
  listFiles,
  listWebsites,
  putBusinessInfo,
  updateFaq,
  uploadKnowledgeFile,
} from "@/lib/api";
import {
  PRESET_WEBSITES,
  buildBusinessInfo,
  buildFaqs,
} from "@/lib/presets";
import type { ApiExchange, BusinessInfo, FaqDraft } from "@/lib/types";
import { useDashboard } from "@/state/dashboard";

export function KnowledgePage() {
  const { connection, profile, setProfile, run, busy } = useDashboard();
  const [info, setInfo] = useState<BusinessInfo>(() => buildBusinessInfo(profile));
  const [faqs, setFaqs] = useState<FaqDraft[]>(() => buildFaqs(profile));
  const [sites, setSites] = useState<Array<{ localId: string; remoteId?: string; url: string }>>(
    () => PRESET_WEBSITES.map((url) => ({ localId: crypto.randomUUID(), url })),
  );
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [exchange, setExchange] = useState<ApiExchange | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function show(result: { exchange: ApiExchange }) {
    setExchange(result.exchange);
  }

  async function loadInfo() {
    const result = await run(getBusinessInfo(connection));
    show(result);
    if (!result.ok || !result.data) return;
    const data = result.data;
    const contact = (data.contact_info ?? {}) as Record<string, unknown>;
    setInfo({
      business_description: String(data.business_description ?? ""),
      payment_method: String(data.payment_method ?? ""),
      return_policy: String(data.return_policy ?? ""),
      purchase_info: String(data.purchase_info ?? ""),
      delivery_and_shipping: String(data.delivery_and_shipping ?? ""),
      contact_info: {
        email: String(contact.email ?? ""),
        hours_of_operation: String(contact.hours_of_operation ?? ""),
        address: String(contact.address ?? ""),
      },
    });
  }

  async function saveInfo() {
    const result = await run(
      putBusinessInfo(connection, {
        business_description: info.business_description,
        payment_method: info.payment_method,
        return_policy: info.return_policy,
        purchase_info: info.purchase_info,
        delivery_and_shipping: info.delivery_and_shipping,
        contact_info: info.contact_info,
      }),
    );
    show(result);
  }

  async function uploadFaqs() {
    for (const faq of faqs) {
      const body = { question: faq.question, answer: faq.answer };
      const result = faq.remoteId
        ? await run(updateFaq(connection, faq.remoteId, body))
        : await run(createFaq(connection, body));
      show(result);
      if (result.ok && result.data && typeof result.data.id === "string") {
        setFaqs((current) =>
          current.map((item) =>
            item.localId === faq.localId ? { ...item, remoteId: String(result.data?.id) } : item,
          ),
        );
      }
    }
  }

  async function uploadSites() {
    for (const site of sites) {
      if (site.remoteId || site.url.startsWith("{{")) continue;
      const result = await run(addWebsite(connection, site.url));
      show(result);
      if (result.ok && result.data && typeof result.data.id === "string") {
        setSites((current) =>
          current.map((item) =>
            item.localId === site.localId ? { ...item, remoteId: String(result.data?.id) } : item,
          ),
        );
      }
    }
  }

  return (
    <div className="grid gap-5">
      <PageIntro title="قاعدة المعرفة">
        المحتوى الجاهز مبني على اسم النشاط ونوعه. الحقول بين {"{{ }}"} عناصر تنتظر منك، وليست حقائق.
      </PageIntro>
      <Card>
        <CardHeader>
          <CardTitle>هوية المحتوى الجاهز</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم النشاط">
            <Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          </Field>
          <Field label="نوع النشاط">
            <Input value={profile.type} onChange={(event) => setProfile({ ...profile, type: event.target.value })} />
          </Field>
          <Field label="الفروع">
            <Input
              value={profile.branches}
              onChange={(event) => setProfile({ ...profile, branches: event.target.value })}
            />
          </Field>
          <Field label="المتجر">
            <Input
              value={profile.onlineStore}
              onChange={(event) => setProfile({ ...profile, onlineStore: event.target.value })}
            />
          </Field>
        </CardContent>
      </Card>
      <Tabs defaultValue="info">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="info">معلومات العمل</TabsTrigger>
          <TabsTrigger value="faq">FAQs</TabsTrigger>
          <TabsTrigger value="sites">Websites</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setInfo(buildBusinessInfo(profile))}>
              تحميل نموذج جاهز
            </Button>
            <Button disabled={busy} onClick={() => void saveInfo()}>
              رفع إلى Meta
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void loadInfo()}>
              عرض البيانات الحالية من Meta
            </Button>
          </div>
          <InfoForm info={info} onChange={setInfo} />
        </TabsContent>
        <TabsContent value="faq" className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setFaqs(buildFaqs(profile))}>
              تحميل أسئلة جاهزة
            </Button>
            <Button disabled={busy} onClick={() => void uploadFaqs()}>
              رفع الكل إلى Meta
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(listFaqs(connection)).then((result) => {
                  show(result);
                  if (!result.ok) return;
                  setFaqs(
                    asList(result.data).map((item) => ({
                      localId: crypto.randomUUID(),
                      remoteId: String(item.id ?? ""),
                      question: String(item.question ?? ""),
                      answer: String(item.answer ?? ""),
                    })),
                  );
                })
              }
            >
              عرض الموجود في Meta
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setFaqs((current) => [
                  ...current,
                  { localId: crypto.randomUUID(), question: "", answer: "" },
                ])
              }
            >
              إضافة سؤال
            </Button>
          </div>
          {faqs.map((faq) => (
            <Card key={faq.localId}>
              <CardContent className="grid gap-2 pt-4">
                <Input
                  value={faq.question}
                  onChange={(event) =>
                    setFaqs((current) =>
                      current.map((item) =>
                        item.localId === faq.localId ? { ...item, question: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Textarea
                  value={faq.answer}
                  onChange={(event) =>
                    setFaqs((current) =>
                      current.map((item) =>
                        item.localId === faq.localId ? { ...item, answer: event.target.value } : item,
                      ),
                    )
                  }
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void (faq.remoteId
                        ? run(updateFaq(connection, faq.remoteId, { question: faq.question, answer: faq.answer }))
                        : run(createFaq(connection, { question: faq.question, answer: faq.answer }))
                      ).then((result) => {
                        show(result);
                        if (result.ok && result.data && typeof result.data.id === "string") {
                          setFaqs((current) =>
                            current.map((item) =>
                              item.localId === faq.localId
                                ? { ...item, remoteId: String(result.data?.id) }
                                : item,
                            ),
                          );
                        }
                      })
                    }
                  >
                    حفظ
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        if (faq.remoteId) {
                          const result = await run(deleteFaq(connection, faq.remoteId));
                          show(result);
                          if (!result.ok) return;
                        }
                        setFaqs((current) => current.filter((item) => item.localId !== faq.localId));
                      })()
                    }
                  >
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="sites" className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setSites((current) => [
                  ...current,
                  ...PRESET_WEBSITES.map((url) => ({ localId: crypto.randomUUID(), url })),
                ])
              }
            >
              إضافة روابط جاهزة
            </Button>
            <Button disabled={busy} onClick={() => void uploadSites()}>
              رفع الروابط المكتملة
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(listWebsites(connection)).then((result) => {
                  show(result);
                  if (!result.ok) return;
                  setSites(
                    asList(result.data).map((item) => ({
                      localId: crypto.randomUUID(),
                      remoteId: String(item.id ?? ""),
                      url: String(item.url ?? ""),
                    })),
                  );
                })
              }
            >
              عرض المواقع الحالية
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            الروابط التي ما زالت {"{{عنصرًا نائبًا}}"} لا تُرسل. لا يُقال إن الموقع رُفع إلا إذا نجح الطلب.
          </p>
          {sites.map((site) => (
            <div key={site.localId} className="flex flex-wrap gap-2">
              <Input
                className="min-w-64 flex-1"
                value={site.url}
                onChange={(event) =>
                  setSites((current) =>
                    current.map((item) =>
                      item.localId === site.localId ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
              />
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (site.remoteId) {
                      const result = await run(deleteWebsite(connection, site.remoteId));
                      show(result);
                      if (!result.ok) return;
                    }
                    setSites((current) => current.filter((item) => item.localId !== site.localId));
                  })()
                }
              >
                حذف
              </Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="files" className="grid gap-3">
          <Field label="رفع ملف معرفة" hint="PDF, DOC, DOCX, PNG, JPG, JPEG, CSV, XLSX حتى 100MB.">
            <Input
              type="file"
              accept={KNOWLEDGE_FILE_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const error = knowledgeFileError(file);
                if (error) {
                  setFileError(error);
                  return;
                }
                setFileError(null);
                void run(uploadKnowledgeFile(connection, file)).then((result) => {
                  show(result);
                  if (!result.ok) setFileError(result.exchange.errorMessageAr);
                });
              }}
            />
          </Field>
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(listFiles(connection)).then((result) => {
                show(result);
                if (result.ok) setFiles(asList(result.data));
              })
            }
          >
            عرض الملفات الحالية
          </Button>
          {files.map((file) => (
            <div key={String(file.id)} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <span>{String(file.file_name ?? file.id)}</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(deleteFile(connection, String(file.id))).then((result) => {
                    show(result);
                    if (result.ok) setFiles((current) => current.filter((item) => item.id !== file.id));
                  })
                }
              >
                حذف
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
      <ApiResponsePanel exchange={exchange} />
    </div>
  );
}

function InfoForm({
  info,
  onChange,
}: {
  info: BusinessInfo;
  onChange: (next: BusinessInfo) => void;
}) {
  const text = (
    key: keyof Omit<BusinessInfo, "contact_info">,
    label: string,
  ) => (
    <Field label={label}>
      <Textarea
        value={info[key]}
        onChange={(event) => onChange({ ...info, [key]: event.target.value })}
      />
    </Field>
  );
  return (
    <div className="grid gap-3">
      {text("business_description", "business_description")}
      {text("payment_method", "payment_method")}
      {text("return_policy", "return_policy")}
      {text("purchase_info", "purchase_info")}
      {text("delivery_and_shipping", "delivery_and_shipping")}
      <Field label="contact_info.email">
        <Input
          value={info.contact_info.email}
          onChange={(event) =>
            onChange({ ...info, contact_info: { ...info.contact_info, email: event.target.value } })
          }
        />
      </Field>
      <Field label="contact_info.hours_of_operation">
        <Textarea
          value={info.contact_info.hours_of_operation}
          onChange={(event) =>
            onChange({
              ...info,
              contact_info: { ...info.contact_info, hours_of_operation: event.target.value },
            })
          }
        />
      </Field>
      <Field label="contact_info.address">
        <Textarea
          value={info.contact_info.address}
          onChange={(event) =>
            onChange({ ...info, contact_info: { ...info.contact_info, address: event.target.value } })
          }
        />
      </Field>
    </div>
  );
}
