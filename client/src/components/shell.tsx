import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDashboard } from "@/state/dashboard";
import { cn } from "@/lib/utils";

const NAV = [
  ["/", "الإعداد والربط"],
  ["/knowledge", "قاعدة المعرفة"],
  ["/skills", "التعليمات والمهارات"],
  ["/ui-skills", "UI Skills"],
  ["/connectors", "Connectors"],
  ["/test", "الاختبار"],
  ["/eval", "التقييم والأداء"],
  ["/logs", "التكلفة والسجلات"],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col border-e bg-sidebar lg:flex">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu />
          </Button>
          <div>
            <p className="text-sm font-semibold">Meta Business Agent</p>
            <p className="text-xs text-muted-foreground">لوحة واتساب</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>القائمة</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { connection, status, exchanges } = useDashboard();
  const linked = Boolean(connection.phoneNumberId && connection.accessToken);
  const connectionLabel = !linked
    ? "غير مربوط"
    : status.eligible === false
      ? "غير مؤهل"
      : status.rolloutEnabled
        ? "الوكيل مفعّل"
        : status.agentId
          ? "تم التجهيز"
          : "محفوظ محليًا";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-5">
        <p className="text-xs text-primary">WhatsApp · Meta</p>
        <h1 className="mt-1 text-lg font-semibold">Meta Business Agent</h1>
        <p className="text-xs text-muted-foreground">لوحة إدارة الوكيل</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(([href, label]) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="grid gap-2 border-t p-4 text-xs">
        <p>
          حالة الاتصال: <span className="font-semibold text-primary">{connectionLabel}</span>
        </p>
        <p>تقدير الطلبات المسجّلة: {exchanges.length}</p>
        <p>
          {status.documentedCost === null
            ? "لا توجد تكلفة موثّقة من Meta بعد"
            : `تكلفة موثّقة من Meta: ${status.documentedCost}`}
        </p>
      </div>
    </div>
  );
}

export function PageIntro({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
