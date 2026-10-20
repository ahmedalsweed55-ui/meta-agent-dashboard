# Meta Business Agent Dashboard

لوحة عربية (RTL) داكنة لإدارة Meta Business Agent على واتساب. الواجهة ثابتة: بيانات الربط تُحفظ في المتصفح للتجربة فقط، وطبقة Meta معزولة في `client/src/lib/api.ts`.

النشاط الجاهز: **السويد للسباكة**، تجزئة سباكة وأدوات صحية وكهرباء ومواد بناء وحلول مياه، بفروع في حائل وبريدة (فرع العليا) ومتجر على سلة. الأسعار والساعات والعناوين والسياسات عناصر نائبة بين `{{ }}` وليست حقائق.

## التشغيل

```bash
pnpm install --dir client
pnpm run dev
```

الفحص والبناء:

```bash
pnpm run check
pnpm run build
```

ثم افتح `http://127.0.0.1:5173`. المسارات تستخدم hash حتى يعمل الموقع على استضافة ثابتة.

## النشر

أضف ملف GitHub Actions في `.github/workflows/pages.yml`. بعد دمج الفرع إلى `main`:

1. من إعدادات المستودع: Pages → Source: GitHub Actions.
2. ادفع إلى `main` أو شغّل workflow‏ `Deploy GitHub Pages`.
3. الرابط المتوقع: `https://ahmedalsweed55-ui.github.io/meta-agent-dashboard/`

لا تضع Access Token في المستودع. أدخله داخل الواجهة فقط في نسخة التجربة، واستخدم Backend في الإنتاج.

## الوثائق

مسارات الوكيل تُستدعى على `https://api.facebook.com/{phone-number-id}/...` مع `Authorization: Bearer` و`X-API-Version: 2.0.0`. رؤوس الاستخدام (`insights/usage`) تستخدم الإصدار `3.0.0` ومعرّف حساب الفوترة من Billing Hub.
