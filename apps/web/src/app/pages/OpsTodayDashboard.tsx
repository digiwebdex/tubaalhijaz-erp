/**
 * UI-03 — Operations Today dashboard.
 * Answers: "আজ আমাকে কী কাজ করতে হবে?"
 * Reuses existing /dashboards/* and /notifications — no new APIs.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Plus, Users, UserRound, FileCheck, CalendarDays, Wallet,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw,
  Building2, Stamp, Plane, ShieldAlert,
} from "lucide-react";
import { fontFor, toLocalNum } from "@tuba/shared";
import { useLang } from "../lib/LangContext";
import { useDash } from "../lib/useDash";
import { isLoggedIn } from "../lib/api";
import {
  canAccessPath,
  hasAnyPermission,
  hasPermission,
  isAgentCompany,
  isSupplierCompany,
  P,
  sessionUser,
} from "../lib/rbac";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";

// ─── API shapes (same as Dashboards.tsx — read-only reuse) ───────────────────

interface VisaDashData {
  pipeline: Record<string, number>;
  mofa: {
    issuedTotal: number;
    issuedWithMofa: number;
    completePercent: number;
    pendingPercent: number;
    note: string;
  };
  backlog: {
    notIssued: number;
    biometricNotIssued: number;
    rejectedOpen: number;
    arrivingSoon: { days: number; mutamersNotIssued: number; groups: number };
  };
  longStay: {
    total: number;
    tracking: number;
    approaching: number;
    due: number;
    escalated: number;
    resolved: number;
    redCards: number;
    hostComplete: number;
    hostCompletePercent: number;
  };
  gates: {
    activeGroups: number;
    ready: number;
    waitingVisa: number;
    waitingPackage: number;
    waitingPayment: number;
    waitingBill: number;
  };
}

interface FinDashData {
  kpis: {
    cashPosition: number;
    accountsReceivable: number;
    accountsPayable: number;
    netProfit: number;
    netMargin: number;
    totalRevenue: number;
  };
  arAging: { bucket: string; amount: number }[];
}

interface AgentDashData {
  kpis: {
    walletBalance: number;
    currency: string;
    activeGroups: number;
    seasonGroups: number;
    outstandingAmount: number;
    outstandingCount: number;
  };
  groups: { code: string; paxCount: number; status: string; opsStatus: string }[];
  invoices: { code: string; total: number; status: string }[];
  visa?: {
    pipeline: Record<string, number>;
    notIssued: number;
    mofaCompletePercent: number;
  };
}

interface SupplierDashData {
  kpis: {
    pendingBookings: number;
    invoicesOutstanding: number;
    seasonRevenue: number;
    upcomingServices: number;
  };
}

interface NotifLog {
  id: string;
  title: string;
  body: string;
  priority: string;
  createdAt: string;
  status: string;
}

type Persona = "agent" | "supplier" | "finance" | "visa" | "ceo";

/**
 * Persona from existing permissions / company type — no new RBAC keys.
 * CEO ≈ finance + platform admin/ops tools; Finance ≈ FINANCIAL_REPORTS without OCR/workflow;
 * Visa/Ops ≈ VIEW_DASHBOARD staff without the finance-only profile.
 */
function resolvePersona(): Persona {
  const u = sessionUser();
  if (!u) return "visa";
  if (isAgentCompany(u)) return "agent";
  if (isSupplierCompany(u)) return "supplier";
  const fin = hasPermission(P.FINANCIAL_REPORTS, u);
  const opsTools = hasAnyPermission(
    [P.CONFIGURE_WORKFLOWS, P.REVIEW_OCR_QUEUE, P.MANAGE_USERS, P.MANAGE_SYSTEM_SETTINGS, P.APPROVE_COMPANIES],
    u,
  );
  if (fin && opsTools) return "ceo";
  if (fin) return "finance";
  return "visa";
}

function fmtSAR(n: number, cur = "SAR"): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${cur} ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${cur} ${(n / 1e3).toFixed(1)}K`;
  return `${cur} ${n.toLocaleString()}`;
}

function timeAgo(iso: string, lang: "bn" | "en"): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return lang === "bn" ? `${s} সেকেন্ড` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return lang === "bn" ? `${m} মিনিট` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "bn" ? `${h} ঘণ্টা` : `${h}h`;
  const d = Math.floor(h / 24);
  return lang === "bn" ? `${d} দিন` : `${d}d`;
}

function num(lang: "bn" | "en", n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return toLocalNum(n, lang);
}

// ─── UI atoms ────────────────────────────────────────────────────────────────

function WorkCard({
  tone,
  label,
  value,
  hint,
  onClick,
  lang,
}: {
  tone: string;
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
  lang: "bn" | "en";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl p-5 min-h-[120px] transition-all active:scale-[0.99] w-full"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(11,30,63,0.10)",
        borderLeft: `4px solid ${tone}`,
        fontFamily: fontFor(lang),
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${tone}55`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(11,30,63,0.10)"; e.currentTarget.style.borderLeftColor = tone; }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tone }} />
        <span className="text-sm font-semibold" style={{ color: NAVY }}>{label}</span>
      </div>
      <div className="text-3xl font-bold tracking-tight" style={{ color: NAVY, fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      {hint && (
        <div className="text-xs mt-2" style={{ color: "rgba(11,30,63,0.55)" }}>{hint}</div>
      )}
    </button>
  );
}

function ActionChip({
  label,
  icon: Icon,
  onClick,
  lang,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  lang: "bn" | "en";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold min-h-[44px] transition-all active:scale-[0.98]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(11,30,63,0.12)",
        color: NAVY,
        fontFamily: fontFor(lang),
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}88`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(11,30,63,0.12)"; }}
    >
      <Icon size={16} style={{ color: GOLD }} />
      {label}
    </button>
  );
}

function SectionTitle({ bn, en, lang }: { bn: string; en: string; lang: "bn" | "en" }) {
  return (
    <h2 className="text-sm font-bold mb-3" style={{ color: NAVY, fontFamily: fontFor(lang) }}>
      {lang === "bn" ? bn : en}
    </h2>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function OpsTodayDashboard() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const persona = useMemo(() => resolvePersona(), []);
  const [showMore, setShowMore] = useState(false);

  const needVisa = persona === "visa" || persona === "ceo";
  const needFin = persona === "finance" || persona === "ceo";
  const needAgent = persona === "agent";
  const needSupplier = persona === "supplier";

  const visa = useDash<VisaDashData>(needVisa ? "/dashboards/visa" : "");
  const fin = useDash<FinDashData>(needFin ? "/dashboards/finance" : "");
  const agent = useDash<AgentDashData>(needAgent ? "/dashboards/agent" : "");
  const supplier = useDash<SupplierDashData>(needSupplier ? "/dashboards/supplier" : "");
  const activity = useDash<NotifLog[]>(isLoggedIn() ? "/notifications?limit=10" : "");

  const loading =
    (needVisa && visa.loading) ||
    (needFin && fin.loading) ||
    (needAgent && agent.loading) ||
    (needSupplier && supplier.loading);

  const error =
    (needVisa && visa.error) ||
    (needFin && fin.error) ||
    (needAgent && agent.error) ||
    (needSupplier && supplier.error);

  const refetchAll = () => {
    if (needVisa) visa.refetch();
    if (needFin) fin.refetch();
    if (needAgent) agent.refetch();
    if (needSupplier) supplier.refetch();
    activity.refetch();
  };

  const go = (path: string) => {
    if (canAccessPath(path.split("?")[0])) navigate(path);
  };

  // ── Quick actions (existing routes only) ──
  const actions = useMemo(() => {
    const list: { id: string; label: string; icon: typeof Plus; path: string }[] = [];
    if (persona === "agent") {
      if (canAccessPath("/agent-portal")) {
        list.push(
          { id: "g", label: lang === "bn" ? "+ নতুন গ্রুপ" : "+ New Group", icon: Users, path: "/agent-portal" },
          { id: "p", label: lang === "bn" ? "+ নতুন যাত্রী" : "+ New Passenger", icon: UserRound, path: "/agent-portal" },
          { id: "v", label: lang === "bn" ? "ভিসা স্ট্যাটাস" : "Visa Status", icon: FileCheck, path: "/agent-portal" },
          { id: "pay", label: lang === "bn" ? "পেমেন্ট" : "Payments", icon: Wallet, path: "/agent-portal" },
        );
      }
      return list;
    }
    if (persona === "supplier") {
      if (canAccessPath("/supplier-portal")) {
        list.push(
          { id: "b", label: lang === "bn" ? "বুকিং" : "Bookings", icon: Building2, path: "/supplier-portal" },
          { id: "i", label: lang === "bn" ? "চালান" : "Invoices", icon: Wallet, path: "/supplier-portal" },
        );
      }
      return list;
    }
    if (canAccessPath("/ops-control")) {
      list.push(
        { id: "g", label: lang === "bn" ? "+ নতুন গ্রুপ" : "+ New Group", icon: Users, path: "/ops-control?tab=groups" },
        { id: "p", label: lang === "bn" ? "+ নতুন যাত্রী" : "+ New Passenger", icon: UserRound, path: "/ops-control?tab=groups" },
      );
    }
    if (canAccessPath("/ops-departments")) {
      list.push({ id: "v", label: lang === "bn" ? "ভিসা ডেস্ক" : "Visa Desk", icon: FileCheck, path: "/ops-departments" });
    }
    if (canAccessPath("/ops-control")) {
      list.push({ id: "ls", label: lang === "bn" ? "লং স্টে" : "Long Stay", icon: CalendarDays, path: "/ops-control?tab=longstay" });
    }
    if (canAccessPath("/finance-erp") && (persona === "finance" || persona === "ceo")) {
      list.push({ id: "f", label: lang === "bn" ? "হিসাব" : "Finance", icon: Wallet, path: "/finance-erp" });
    }
    return list;
  }, [lang, persona]);

  // ── Today's work cards (max 6 visible) ──
  const workCards = useMemo(() => {
    const v = visa.data;
    const f = fin.data;
    const a = agent.data;
    const s = supplier.data;
    const cards: {
      id: string;
      tone: string;
      label: string;
      value: string;
      hint?: string;
      path: string;
    }[] = [];

    if (persona === "agent" && a) {
      const pax = a.groups.reduce((sum, g) => sum + (g.paxCount || 0), 0);
      cards.push(
        {
          id: "ag-g",
          tone: "#2563EB",
          label: lang === "bn" ? "আমার গ্রুপ" : "My Groups",
          value: num(lang, a.kpis.activeGroups),
          hint: lang === "bn" ? `মৌসুম ${num(lang, a.kpis.seasonGroups)}` : `Season ${a.kpis.seasonGroups}`,
          path: "/agent-portal",
        },
        {
          id: "ag-p",
          tone: "#0D9488",
          label: lang === "bn" ? "আমার যাত্রী" : "My Passengers",
          value: num(lang, pax),
          path: "/agent-portal",
        },
        {
          id: "ag-v",
          tone: "#D97706",
          label: lang === "bn" ? "ভিসা স্ট্যাটাস" : "Visa Status",
          value: num(lang, a.visa?.notIssued ?? null),
          hint: lang === "bn" ? "এখনও ইস্যু হয়নি" : "Not issued",
          path: "/agent-portal",
        },
        {
          id: "ag-pay",
          tone: "#DC2626",
          label: lang === "bn" ? "পেমেন্ট বকেয়া" : "My Payments",
          value: a.kpis ? fmtSAR(a.kpis.outstandingAmount, a.kpis.currency) : "—",
          hint: a.kpis ? `${num(lang, a.kpis.outstandingCount)} ${lang === "bn" ? "চালান" : "invoices"}` : undefined,
          path: "/agent-portal",
        },
      );
      return cards;
    }

    if (persona === "supplier" && s) {
      cards.push(
        {
          id: "su-b",
          tone: "#D97706",
          label: lang === "bn" ? "অপেক্ষমাণ বুকিং" : "Pending Bookings",
          value: num(lang, s.kpis.pendingBookings),
          path: "/supplier-portal",
        },
        {
          id: "su-i",
          tone: "#DC2626",
          label: lang === "bn" ? "বকেয়া চালান" : "Outstanding Invoices",
          value: fmtSAR(s.kpis.invoicesOutstanding),
          path: "/supplier-portal",
        },
        {
          id: "su-u",
          tone: "#2563EB",
          label: lang === "bn" ? "আসন্ন সেবা" : "Upcoming Services",
          value: num(lang, s.kpis.upcomingServices),
          path: "/supplier-portal",
        },
      );
      return cards;
    }

    // Ops / CEO: visa work first (operations priority). Finance-only: collection widgets.
    if ((persona === "visa" || persona === "ceo") && v) {
      const embassy = v.pipeline.EMBASSY ?? 0;
      const passport = v.pipeline.PASSPORT_RETURNED ?? 0;
      const mofaPending = Math.max(0, v.mofa.issuedTotal - v.mofa.issuedWithMofa);
      const visaPending = v.backlog.notIssued;
      cards.push(
        {
          id: "visa-p",
          tone: "#DC2626",
          label: lang === "bn" ? "ভিসা পেন্ডিং" : "Visa Pending",
          value: num(lang, visaPending),
          path: "/ops-departments",
        },
        {
          id: "emb",
          tone: "#EA580C",
          label: lang === "bn" ? "এম্বাসি পেন্ডিং" : "Embassy Pending",
          value: num(lang, embassy),
          path: "/ops-departments",
        },
        {
          id: "pass",
          tone: "#D97706",
          label: lang === "bn" ? "পাসপোর্ট রিটার্ন" : "Passport Return",
          value: num(lang, passport),
          path: "/ops-departments",
        },
        {
          id: "mofa",
          tone: "#16A34A",
          label: lang === "bn" ? "মোফা পেন্ডিং" : "MOFA Pending",
          value: num(lang, mofaPending),
          hint: `${num(lang, v.mofa.completePercent)}% ${lang === "bn" ? "সম্পূর্ণ" : "complete"}`,
          path: "/ops-departments",
        },
        {
          id: "ls",
          tone: "#2563EB",
          label: lang === "bn" ? "লং স্টে" : "Long Stay",
          value: num(lang, v.longStay.tracking || v.longStay.total),
          path: "/ops-control?tab=longstay",
        },
        {
          id: "d85",
          tone: "#DC2626",
          label: lang === "bn" ? "ডে-৮৫" : "Day-85",
          value: num(lang, v.longStay.due),
          hint: lang === "bn"
            ? `রেড কার্ড ${num(lang, v.longStay.redCards)}`
            : `Red cards ${v.longStay.redCards}`,
          path: "/ops-control?tab=longstay",
        },
      );
    }

    if ((persona === "finance" || persona === "ceo") && f) {
      const due90 = f.arAging.find((b) => /90/.test(b.bucket))?.amount
        ?? f.arAging[f.arAging.length - 1]?.amount
        ?? 0;
      const finCards = [
        {
          id: "fi-c",
          tone: "#16A34A",
          label: lang === "bn" ? "কালেকশন (AR)" : "Collection (AR)",
          value: fmtSAR(f.kpis.accountsReceivable),
          path: "/finance-erp",
          hint: undefined as string | undefined,
        },
        {
          id: "fi-e",
          tone: "#EA580C",
          label: lang === "bn" ? "খরচ (AP)" : "Expense (AP)",
          value: fmtSAR(f.kpis.accountsPayable),
          path: "/finance-erp",
          hint: undefined as string | undefined,
        },
        {
          id: "fi-d",
          tone: "#DC2626",
          label: lang === "bn" ? "বকেয়া" : "Due",
          value: fmtSAR(due90),
          hint: lang === "bn" ? "এজিং বাকেট" : "Aging bucket",
          path: "/finance-erp",
        },
      ];
      // CEO already has 6 ops cards — finance stays available via Finance tab / remaining slots
      if (persona === "finance") cards.push(...finCards);
      else if (cards.length < 6) cards.push(...finCards.slice(0, 6 - cards.length));
    }

    // Loading / empty placeholders so layout holds
    if (cards.length === 0 && !loading) {
      if (needVisa || needFin || needAgent) {
        cards.push({
          id: "empty",
          tone: "#6B7280",
          label: lang === "bn" ? "কোনো কাজের তথ্য নেই" : "No work items yet",
          value: "—",
          path: persona === "agent" ? "/agent-portal" : "/ops-control",
        });
      }
    }

    return cards.slice(0, 6);
  }, [persona, visa.data, fin.data, agent.data, supplier.data, lang, loading, needVisa, needFin, needAgent]);

  if (loading && !visa.data && !fin.data && !agent.data && !supplier.data) {
    return (
      <div className="p-6 md:p-8">
        <LoadingSkeleton tone="light" rows={8} />
      </div>
    );
  }

  if (error && !visa.data && !fin.data && !agent.data && !supplier.data) {
    return (
      <div className="p-6 md:p-8">
        <ErrorState tone="light" onRetry={refetchAll} />
      </div>
    );
  }

  const v = visa.data;

  return (
    <div
      className="p-6 md:p-8 h-full overflow-y-auto space-y-8"
      style={{ scrollbarWidth: "thin", fontFamily: fontFor(lang) }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: NAVY }}>
            {lang === "bn" ? "আজকের কাজ" : "Today's Work"}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "rgba(11,30,63,0.58)" }}>
            {lang === "bn"
              ? "আজ আমাকে কী কাজ করতে হবে?"
              : "What do I need to do today?"}
          </p>
        </div>
        <button
          type="button"
          onClick={refetchAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold min-h-[40px]"
          style={{ border: "1px solid rgba(11,30,63,0.12)", color: NAVY, backgroundColor: "#FFFFFF" }}
        >
          <RefreshCw size={14} />
          {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
        </button>
      </div>

      {/* Section 1 — Quick Actions */}
      {actions.length > 0 && (
        <section>
          <SectionTitle bn="দ্রুত কাজ" en="Quick Actions" lang={lang} />
          <div className="flex flex-wrap gap-3">
            {actions.map((a) => (
              <ActionChip key={a.id} label={a.label} icon={a.icon} lang={lang} onClick={() => go(a.path)} />
            ))}
          </div>
        </section>
      )}

      {/* Section 2 — Today's Work (max 6) */}
      <section>
        <SectionTitle bn="আজকের কাজের তালিকা" en="Today's Work" lang={lang} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {workCards.map((c) => (
            <WorkCard
              key={c.id}
              tone={c.tone}
              label={c.label}
              value={c.value}
              hint={c.hint}
              lang={lang}
              onClick={() => go(c.path)}
            />
          ))}
        </div>
      </section>

      {/* আরও দেখুন — readiness, activity, alerts */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((x) => !x)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px]"
          style={{
            backgroundColor: showMore ? `${GOLD}18` : "#FFFFFF",
            border: `1px solid ${showMore ? `${GOLD}55` : "rgba(11,30,63,0.12)"}`,
            color: NAVY,
            fontFamily: fontFor(lang),
          }}
        >
          {lang === "bn" ? "আরও দেখুন" : "View more"}
          {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showMore && (
        <div className="space-y-8">
          {/* Section 3 — Group Readiness */}
          {(persona === "visa" || persona === "ceo") && (
            <section>
              <SectionTitle bn="গ্রুপ প্রস্তুতি" en="Group Readiness" lang={lang} />
              {!v ? (
                <EmptyState
                  tone="light"
                  title={lang === "bn" ? "প্রস্তুতির তথ্য নেই" : "No readiness data"}
                  hint={lang === "bn" ? "সক্রিয় গ্রুপের গেট রোলআপ এখানে আসবে।" : "Gate rollups appear for active groups."}
                />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: lang === "bn" ? "ভিসা রেডি" : "Visa Ready",
                      wait: v.gates.waitingVisa,
                      tone: "#0D9488",
                      icon: FileCheck,
                    },
                    {
                      label: lang === "bn" ? "প্যাকেজ রেডি" : "Package Ready",
                      wait: v.gates.waitingPackage,
                      tone: "#2563EB",
                      icon: Stamp,
                    },
                    {
                      label: lang === "bn" ? "পেমেন্ট রেডি" : "Payment Ready",
                      wait: v.gates.waitingPayment,
                      tone: "#D97706",
                      icon: Wallet,
                    },
                    {
                      label: lang === "bn" ? "বিল রেডি" : "Bill Ready",
                      wait: v.gates.waitingBill,
                      tone: "#9333EA",
                      icon: Building2,
                    },
                  ].map((g) => {
                    const readyish = Math.max(0, v.gates.activeGroups - g.wait);
                    return (
                      <button
                        key={g.label}
                        type="button"
                        onClick={() => go("/ops-control?tab=groups")}
                        className="rounded-2xl p-5 text-left"
                        style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.10)" }}
                      >
                        <g.icon size={18} style={{ color: g.tone }} className="mb-3" />
                        <div className="text-xs font-semibold mb-2" style={{ color: "rgba(11,30,63,0.65)" }}>{g.label}</div>
                        <div className="text-2xl font-bold" style={{ color: NAVY, fontFamily: "var(--font-mono)" }}>
                          {num(lang, readyish)}
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: "rgba(11,30,63,0.50)" }}>
                          {lang === "bn" ? `অপেক্ষা ${num(lang, g.wait)}` : `${g.wait} waiting`}
                          {" · "}
                          {lang === "bn" ? `রেডি ${num(lang, v.gates.ready)}` : `${v.gates.ready} all-ready`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Section 4 — Today's Activity */}
          <section>
            <SectionTitle bn="আজকের কার্যক্রম" en="Today's Activity" lang={lang} />
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.10)" }}>
              {activity.loading ? (
                <div className="p-4"><LoadingSkeleton tone="light" rows={4} /></div>
              ) : activity.error || !activity.data?.length ? (
                <div className="p-4">
                  <EmptyState
                    tone="light"
                    title={lang === "bn" ? "কোনো কার্যক্রম নেই" : "No recent activity"}
                    hint={lang === "bn" ? "বিজ্ঞপ্তি ফিড থেকে সাম্প্রতিক ঘটনা দেখানো হয়।" : "Recent items come from your notification feed."}
                  />
                </div>
              ) : (
                activity.data.map((n, i) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={{
                      borderBottom: i < activity.data!.length - 1 ? "1px solid rgba(11,30,63,0.06)" : undefined,
                      borderLeft: n.priority === "EMERGENCY" ? "3px solid #DC2626" : "3px solid transparent",
                    }}
                  >
                    {(n.priority === "EMERGENCY" || n.status === "FAILED") && (
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#DC2626" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: NAVY }}>{n.title}</div>
                      {n.body && (
                        <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(11,30,63,0.55)" }}>{n.body}</div>
                      )}
                    </div>
                    <span className="text-[11px] shrink-0" style={{ color: "rgba(11,30,63,0.45)", fontFamily: "var(--font-mono)" }}>
                      {timeAgo(n.createdAt, lang)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section 5 — Alerts */}
          {(persona === "visa" || persona === "ceo") && v && (
            <section>
              <SectionTitle bn="সতর্কতা" en="Alerts" lang={lang} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: "a85",
                    tone: "#DC2626",
                    icon: ShieldAlert,
                    label: lang === "bn" ? "লং স্টে ডে-৮৫" : "Long Stay Day-85",
                    value: v.longStay.due,
                    path: "/ops-control?tab=longstay",
                  },
                  {
                    id: "arej",
                    tone: "#DC2626",
                    icon: AlertTriangle,
                    label: lang === "bn" ? "রিজেক্টেড ভিসা" : "Rejected Visa",
                    value: v.backlog.rejectedOpen,
                    path: "/ops-departments",
                  },
                  {
                    id: "apass",
                    tone: "#D97706",
                    icon: Plane,
                    label: lang === "bn" ? "পাসপোর্ট রিটার্নড" : "Passport Returned",
                    value: v.pipeline.PASSPORT_RETURNED ?? 0,
                    path: "/ops-departments",
                  },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => go(a.path)}
                    className="rounded-2xl p-5 text-left flex items-start gap-3"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.10)" }}
                  >
                    <a.icon size={20} style={{ color: a.tone }} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.65)" }}>{a.label}</div>
                      <div className="text-2xl font-bold mt-1" style={{ color: a.tone, fontFamily: "var(--font-mono)" }}>
                        {num(lang, a.value)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* CEO — finance summary when ops cards filled the primary six */}
          {persona === "ceo" && fin.data && (
            <section>
              <SectionTitle bn="হিসাব সারাংশ" en="Finance Summary" lang={lang} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: lang === "bn" ? "কালেকশন (AR)" : "Collection (AR)",
                    value: fmtSAR(fin.data.kpis.accountsReceivable),
                    tone: "#16A34A",
                  },
                  {
                    label: lang === "bn" ? "খরচ (AP)" : "Expense (AP)",
                    value: fmtSAR(fin.data.kpis.accountsPayable),
                    tone: "#EA580C",
                  },
                  {
                    label: lang === "bn" ? "নগদ অবস্থান" : "Cash Position",
                    value: fmtSAR(fin.data.kpis.cashPosition),
                    tone: "#2563EB",
                  },
                ].map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => go("/finance-erp")}
                    className="rounded-2xl p-5 text-left"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.10)" }}
                  >
                    <div className="text-xs font-semibold mb-2" style={{ color: "rgba(11,30,63,0.65)" }}>{c.label}</div>
                    <div className="text-2xl font-bold" style={{ color: c.tone, fontFamily: "var(--font-mono)" }}>{c.value}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
