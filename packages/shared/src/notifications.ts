// ─── TUBA AL HIJAZ · Notification message templates (bilingual) ──────────────
// Canonical DEFAULT templates per event, in Bengali (default) + English, using
// the shared i18n Lang type. Bodies support {{variable}} placeholders filled at
// send time. The DB `MessageTemplate` table is seeded from these and may override
// them (edited in the Notification Center); the delivery layer prefers the DB row
// and falls back to this catalog.

import type { Lang } from "./i18n";

export interface NotifTemplate {
  subject: string; // used by email; ignored by WhatsApp/in-app
  body: string; // supports {{var}}
}
export type NotifVariant = Record<Lang, NotifTemplate>;

/** eventKey → per-language template. Keys match NotificationEvent.key. */
export const NOTIF_TEMPLATES: Record<string, NotifVariant> = {
  AGENT_REGISTRATION_SUBMITTED: {
    en: { subject: "Application received — {{code}}", body: "Assalamu Alaikum {{name}}, your registration {{code}} has been received and is under review. We'll notify you once verified." },
    bn: { subject: "আবেদন গৃহীত — {{code}}", body: "আসসালামু আলাইকুম {{name}}, আপনার নিবন্ধন {{code}} গৃহীত হয়েছে এবং যাচাইয়ের অধীনে আছে। যাচাই সম্পন্ন হলে জানানো হবে।" },
  },
  AGENT_APPROVED: {
    en: { subject: "Registration approved — {{code}}", body: "Welcome to TUBA AL HIJAZ, {{name}}! Your account {{code}} is verified and portal access is now active." },
    bn: { subject: "নিবন্ধন অনুমোদিত — {{code}}", body: "তুবা আল হিজাজে স্বাগতম, {{name}}! আপনার অ্যাকাউন্ট {{code}} যাচাই সম্পন্ন এবং পোর্টাল অ্যাক্সেস এখন সক্রিয়।" },
  },
  AGENT_REJECTED: {
    en: { subject: "Application not approved — {{code}}", body: "Your application {{code}} was not approved. Reason: {{reason}}. You may correct the issues and resubmit." },
    bn: { subject: "আবেদন অনুমোদিত হয়নি — {{code}}", body: "আপনার আবেদন {{code}} অনুমোদিত হয়নি। কারণ: {{reason}}। সমস্যা সংশোধন করে পুনরায় জমা দিতে পারেন।" },
  },
  VISA_APPROVED: {
    en: { subject: "Visa issued — {{code}}", body: "Visa issued for mutamer {{code}} (group {{groupCode}}). Visa No: {{visaNumber}}. Passport: {{passportNo}}." },
    bn: { subject: "ভিসা ইস্যু — {{code}}", body: "মুতামির {{code}} (গ্রুপ {{groupCode}})-এর ভিসা ইস্যু হয়েছে। ভিসা নং: {{visaNumber}}। পাসপোর্ট: {{passportNo}}।" },
  },
  VISA_REJECTED: {
    en: { subject: "Visa rejected — {{code}}", body: "Visa rejected for mutamer {{code}} (group {{groupCode}}). Reason: {{reason}}. Our Visa Desk will follow up." },
    bn: { subject: "ভিসা প্রত্যাখ্যাত — {{code}}", body: "মুতামির {{code}} (গ্রুপ {{groupCode}})-এর ভিসা প্রত্যাখ্যাত। কারণ: {{reason}}। ভিসা ডেস্ক ফলো-আপ করবে।" },
  },
  PASSPORT_RETURNED: {
    en: { subject: "Passport returned — {{code}}", body: "Passport returned to custody for mutamer {{code}} (group {{groupCode}}). Passport: {{passportNo}}." },
    bn: { subject: "পাসপোর্ট ফেরত — {{code}}", body: "মুতামির {{code}} (গ্রুপ {{groupCode}})-এর পাসপোর্ট কাস্টডিতে ফেরত। পাসপোর্ট: {{passportNo}}।" },
  },
  LONGSTAY_DAY85: {
    en: { subject: "Day-85 compliance — {{code}}", body: "Long Stay {{code}} (group {{groupCode}}) is on day {{dayCount}} of the ~90-day stay. Host: {{hostName}}. Exit or renewal must be actioned before day 90." },
    bn: { subject: "ডে-৮৫ কমপ্লায়েন্স — {{code}}", body: "লং স্টে {{code}} (গ্রুপ {{groupCode}}) ~৯০ দিনের মধ্যে {{dayCount}} দিনে পৌঁছেছে। হোস্ট: {{hostName}}। ৯০ দিনের আগে এক্সিট বা রিনিউয়াল সম্পন্ন করতে হবে।" },
  },
  SERVICE_UPDATE: {
    en: { subject: "{{service}} update — {{code}}", body: "Your {{service}} booking {{code}} is now {{status}}." },
    bn: { subject: "{{service}} আপডেট — {{code}}", body: "আপনার {{service}} বুকিং {{code}} এখন {{status}}।" },
  },
  HOTEL_BOOKING_CONFIRMED: {
    en: { subject: "Hotel confirmed — {{code}}", body: "Hotel booking {{code}} is confirmed. Voucher will follow shortly." },
    bn: { subject: "হোটেল নিশ্চিত — {{code}}", body: "হোটেল বুকিং {{code}} নিশ্চিত হয়েছে। শীঘ্রই ভাউচার পাঠানো হবে।" },
  },
  PAYMENT_RECEIVED: {
    en: { subject: "Payment received — SAR {{amount}}", body: "We have received your payment of SAR {{amount}} ({{ref}}). Thank you." },
    bn: { subject: "পেমেন্ট গৃহীত — SAR {{amount}}", body: "আমরা আপনার SAR {{amount}} ({{ref}}) পেমেন্ট গ্রহণ করেছি। ধন্যবাদ।" },
  },
  INVOICE_GENERATED: {
    en: { subject: "Invoice {{invoiceNo}} ready", body: "Invoice {{invoiceNo}} for SAR {{total}} has been generated and is attached." },
    bn: { subject: "চালান {{invoiceNo}} প্রস্তুত", body: "SAR {{total}}-এর চালান {{invoiceNo}} তৈরি হয়েছে এবং সংযুক্ত করা হলো।" },
  },
  VOUCHER_READY: {
    en: { subject: "Voucher {{code}} ready", body: "Your voucher {{code}} is ready to download. It is attached to this message." },
    bn: { subject: "ভাউচার {{code}} প্রস্তুত", body: "আপনার ভাউচার {{code}} ডাউনলোডের জন্য প্রস্তুত। এই বার্তায় সংযুক্ত করা হলো।" },
  },
  GROUP_CREATED: {
    en: { subject: "Group {{code}} created", body: "Group {{code}} ({{name}}) is open. Visa type: {{visaType}}. Created by {{createdBy}}." },
    bn: { subject: "গ্রুপ {{code}} তৈরি", body: "গ্রুপ {{code}} ({{name}}) খোলা হয়েছে। ভিসা: {{visaType}}। তৈরি করেছেন {{createdBy}}।" },
  },
  GROUP_GATES_CHANGED: {
    en: { subject: "Readiness updated — {{code}}", body: "Group {{code}} gates changed by {{changedBy}}. Visa={{gateVisa}} Package={{gatePackage}} Payment={{gatePayment}} Bill={{gateBill}}." },
    bn: { subject: "প্রস্তুতি আপডেট — {{code}}", body: "গ্রুপ {{code}}-এর গেট {{changedBy}} পরিবর্তন করেছেন। Visa={{gateVisa}} Package={{gatePackage}} Payment={{gatePayment}} Bill={{gateBill}}।" },
  },
  GROUP_IMPORT_COMPLETED: {
    en: { subject: "Mutamer import — {{code}}", body: "{{count}} mutamer(s) imported into group {{code}} by {{importedBy}}. File: {{fileName}}." },
    bn: { subject: "মুতামির আমদানি — {{code}}", body: "গ্রুপ {{code}}-এ {{count}} জন মুতামির আমদানি করেছেন {{importedBy}}। ফাইল: {{fileName}}।" },
  },
  GROUP_OCR_COMMITTED: {
    en: { subject: "Group list OCR — {{code}}", body: "Nusuk group-list OCR committed for {{code}} ({{nusukGroupNumber}}). Mode: {{mode}}. By {{approvedBy}}." },
    bn: { subject: "গ্রুপ তালিকা OCR — {{code}}", body: "নুসুক গ্রুপ তালিকা OCR গ্রুপ {{code}} ({{nusukGroupNumber}})-এ প্রতিশ্রুত। মোড: {{mode}}। অনুমোদন: {{approvedBy}}." },
  },
  GROUP_COMPLETED: {
    en: { subject: "Group {{code}} completed", body: "Group {{code}} has completed its journey. Jazakum Allahu Khairan for trusting TUBA AL HIJAZ." },
    bn: { subject: "গ্রুপ {{code}} সম্পন্ন", body: "গ্রুপ {{code}} তাদের যাত্রা সম্পন্ন করেছে। তুবা আল হিজাজে আস্থা রাখার জন্য জাযাকুমুল্লাহু খাইরান।" },
  },
  DAILY_SUMMARY: {
    en: { subject: "Daily summary — {{date}}", body: "Today: {{groups}} active groups, {{arrivals}} arrivals, {{departures}} departures, SAR {{revenue}} invoiced." },
    bn: { subject: "দৈনিক সারসংক্ষেপ — {{date}}", body: "আজ: {{groups}}টি সক্রিয় গ্রুপ, {{arrivals}}টি আগমন, {{departures}}টি প্রস্থান, SAR {{revenue}} চালান।" },
  },
  EMERGENCY_ALERT: {
    en: { subject: "EMERGENCY: {{title}}", body: "URGENT — {{title}}. {{body}} Immediate attention required." },
    bn: { subject: "জরুরি: {{title}}", body: "জরুরি — {{title}}। {{body}} অবিলম্বে মনোযোগ প্রয়োজন।" },
  },
  DEFAULT: {
    en: { subject: "{{title}}", body: "{{body}}" },
    bn: { subject: "{{title}}", body: "{{body}}" },
  },
};

/** Fill {{var}} placeholders; missing vars collapse to an empty string. */
export function interpolate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Render a template from this catalog. `override` (a DB MessageTemplate row) wins
 * when present. Returns interpolated { subject, body }.
 */
export function renderTemplate(
  eventKey: string | null | undefined,
  lang: Lang,
  vars: Record<string, unknown>,
  override?: { subject?: string | null; body: string },
): NotifTemplate {
  if (override) {
    return { subject: interpolate(override.subject ?? "", vars), body: interpolate(override.body, vars) };
  }
  const variant = (eventKey && NOTIF_TEMPLATES[eventKey]) || NOTIF_TEMPLATES.DEFAULT;
  const tpl = variant[lang] ?? variant.en;
  return { subject: interpolate(tpl.subject, vars), body: interpolate(tpl.body, vars) };
}
