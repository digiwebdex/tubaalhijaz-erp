/**
 * UI-08 — Executive Dashboard + Reports / Management views.
 * Reuses GET /dashboards/{ceo,ops,visa,finance} only — no new aggregations.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  RefreshCw, TrendingUp, ClipboardList,
  FileCheck, CalendarDays, DollarSign, Activity, ChevronRight, Eye, Download,
} from "lucide-react";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { useDash } from "../lib/useDash";
import { canAccessPath } from "../lib/rbac";
import { isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { downloadCsv } from "../lib/exportCsv";

// ─── Types (mirror Dashboards.tsx — read-only API shapes) ────────────────────

interface CeoDashData {
  kpis: {
    ytdRevenue: number; netProfit: number; netMargin: number;
    activeGroups: number; pax: number; airlines: number;
    arOutstanding: number; overdueInvoices: number; activeAgents: number;
  };
  revenueTrend: { month: string; total: number }[];
  topAgents: { name: string; total: number }[];
}

interface OpsDashData {
  kpis: {
    groupsActive: number; arrivalsToday: number; departuresToday: number;
    completedToday: number; delayedDispatch: number; pendingTasks: number;
  };
  hourly: { hour: number; arr: number; dep: number }[];
  departments: [string, number][];
}

interface FinDashData {
  kpis: {
    cashPosition: number; accountsReceivable: number; accountsPayable: number;
    netProfit: number; netMargin: number; totalRevenue: number;
  };
  arAging: { bucket: string; amount: number }[];
  cashTrend: { month: string; total: number }[];
  arEntities: { entity: string; cur: number; d30: number; d60: number; d90: number; total: number }[];
}

interface VisaDashData {
  pipeline: Record<string, number>;
  mofa: {
    issuedTotal: number; issuedWithMofa: number;
    completePercent: number; pendingPercent: number; note: string;
  };
  backlog: {
    notIssued: number; biometricNotIssued: number; rejectedOpen: number;
    arrivingSoon: { days: number; mutamersNotIssued: number; groups: number };
  };
  longStay: {
    total: number; tracking: number; approaching: number; due: number;
    escalated: number; resolved: number; redCards: number;
    hostComplete: number; hostCompletePercent: number;
  };
  gates: {
    activeGroups: number; ready: number;
    waitingVisa: number; waitingPackage: number; waitingPayment: number; waitingBill: number;
  };
}

const VISA_PIPELINE_ORDER = [
  "NEW", "MOFA", "EMBASSY", "BIOMETRIC", "SUBMITTED", "PROCESSING",
  "ISSUED", "REJECTED", "PASSPORT_RETURNED", "COMPLETED",
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;

function fmtSAR(n: number, cur = "SAR"): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${cur} ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${cur} ${(n / 1e3).toFixed(1)}K`;
  return `${cur} ${n.toLocaleString()}`;
}

function goIfAllowed(navigate: ReturnType<typeof useNavigate>, path: string) {
  const base = path.split("?")[0];
  if (canAccessPath(base)) navigate(path);
}

// ─── Shared UI atoms (cards / progress — not heavy charts) ───────────────────

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#0B1E3F]">{title}</h3>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = "#0B1E3F",
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const Comp = interactive ? "button" : "div";
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={`text-left rounded-xl px-3 py-3 w-full transition-colors ${interactive ? "hover:opacity-90" : ""}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(11,30,63,0.11)",
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div className="text-lg font-bold tabular-nums text-[#0B1E3F]" style={{ fontFamily: "var(--font-mono)", color: tone }}>
        {value}
      </div>
      <div className="text-[11px] font-semibold mt-0.5 text-[#0B1E3F]">{label}</div>
      {hint && <div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{hint}</div>}
      {interactive && (
        <div className="flex items-center gap-0.5 mt-1.5 text-[10px] font-semibold" style={{ color: tone }}>
          <span>→</span>
        </div>
      )}
    </Comp>
  );
}

function ProgressRow({
  label,
  value,
  max,
  color,
  fmt,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  fmt?: (v: number) => string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1 gap-2">
        <span className="text-[11px] truncate" style={{ color: "rgba(11,30,63,0.76)" }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color, fontFamily: "var(--font-mono)" }}>
          {fmt ? fmt(value) : value.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: "#EEF1F6" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── 1. Executive Dashboard (CEO view) ───────────────────────────────────────

export function ExecutiveDashboard({ onOpenReports }: { onOpenReports?: () => void }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const ceo = useDash<CeoDashData>("/dashboards/ceo");
  const ops = useDash<OpsDashData>("/dashboards/ops");
  const visa = useDash<VisaDashData>("/dashboards/visa");
  const fin = useDash<FinDashData>("/dashboards/finance");

  const loading = ceo.loading || ops.loading || visa.loading || fin.loading;
  const error = ceo.error || ops.error || visa.error || fin.error;
  const refetch = () => {
    ceo.refetch();
    ops.refetch();
    visa.refetch();
    fin.refetch();
  };

  const go = (path: string) => goIfAllowed(navigate, path);
  const ck = ceo.data?.kpis;
  const ok = ops.data?.kpis;
  const v = visa.data;
  const fk = fin.data?.kpis;
  const signedOut = !isLoggedIn();

  const revMax = useMemo(() => {
    const t = ceo.data?.revenueTrend ?? [];
    return t.length ? Math.max(...t.map((r) => r.total), 1) : 1;
  }, [ceo.data]);

  const agentMax = useMemo(() => {
    const a = ceo.data?.topAgents ?? [];
    return a.length ? Math.max(...a.map((x) => x.total), 1) : 1;
  }, [ceo.data]);

  const pipeMax = useMemo(() => {
    if (!v) return 1;
    return Math.max(1, ...VISA_PIPELINE_ORDER.map((s) => v.pipeline[s] ?? 0));
  }, [v]);

  if (error && !loading) {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "নির্বাহী ড্যাশবোর্ড" : "Executive Dashboard"}
        subtitle={lang === "bn" ? "সিইও ভিউ · বিদ্যমান ড্যাশবোর্ড এপিআই" : "CEO view · existing dashboard APIs"}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refetch}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
      >
        {loading && <LoadingSkeleton tone="light" rows={8} />}
        {!loading && signedOut && (
          <EmptyState
            tone="light"
            title={lang === "bn" ? "লাইভ কেপিআই দেখতে সাইন ইন করুন" : "Sign in for live KPIs"}
            hint={lang === "bn" ? "নির্বাহী সংখ্যা /dashboards/* থেকে আসে।" : "Executive figures come from /dashboards/*."}
          />
        )}

        {!loading && !signedOut && (
          <>
            {/* Executive Summary */}
            <Section
              title={lang === "bn" ? "নির্বাহী সারাংশ" : "Executive Summary"}
              subtitle={lang === "bn" ? "সিজন ১৪৪৬হি" : "Season 1446H"}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile
                  label={lang === "bn" ? "YTD রাজস্ব" : "YTD Revenue"}
                  value={ck ? fmtSAR(ck.ytdRevenue) : "—"}
                  hint={lang === "bn" ? "রাজস্ব স্ন্যাপশট" : "Revenue snapshot"}
                  tone="#06B6D4"
                  onClick={() => go("/finance-erp")}
                />
                <KpiTile
                  label={lang === "bn" ? "নেট লাভ" : "Net Profit"}
                  value={ck ? fmtSAR(ck.netProfit) : "—"}
                  hint={ck ? `${ck.netMargin.toFixed(1)}%` : undefined}
                  tone="#16A34A"
                  onClick={() => go("/finance-erp")}
                />
                <KpiTile
                  label={lang === "bn" ? "সক্রিয় গ্রুপ" : "Active Groups"}
                  value={ck ? String(ck.activeGroups) : "—"}
                  hint={ck ? `${ck.pax} pax · ${ck.activeAgents} agents` : undefined}
                  tone="#F59E0B"
                  onClick={() => go("/ops-control?tab=groups")}
                />
                <KpiTile
                  label={lang === "bn" ? "AR বকেয়া" : "AR Outstanding"}
                  value={ck ? fmtSAR(ck.arOutstanding) : "—"}
                  hint={ck ? `${ck.overdueInvoices} overdue` : undefined}
                  tone="#B45309"
                  onClick={() => go("/finance-erp")}
                />
              </div>
            </Section>

            {/* Today's Operations + Pending Work */}
            <Section
              title={lang === "bn" ? "আজকের অপারেশন" : "Today's Operations"}
              action={
                <ErpButton size="sm" variant="ghost" icon={<ChevronRight size={14} />} onClick={() => go("/ops-control")}>
                  {lang === "bn" ? "অপস" : "Ops"}
                </ErpButton>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <KpiTile label={lang === "bn" ? "সক্রিয় গ্রুপ" : "Groups"} value={ok ? String(ok.groupsActive) : "—"} onClick={() => go("/ops-control?tab=groups")} />
                <KpiTile label={lang === "bn" ? "আগমন" : "Arrivals"} value={ok ? String(ok.arrivalsToday) : "—"} onClick={() => go("/ops-control?tab=arrivals")} />
                <KpiTile label={lang === "bn" ? "প্রস্থান" : "Departures"} value={ok ? String(ok.departuresToday) : "—"} onClick={() => go("/ops-control?tab=departures")} />
                <KpiTile label={lang === "bn" ? "সম্পন্ন" : "Completed"} value={ok ? String(ok.completedToday) : "—"} tone="#16A34A" onClick={() => go("/ops-control")} />
                <KpiTile
                  label={lang === "bn" ? "পেন্ডিং কাজ" : "Pending Work"}
                  value={ok ? String(ok.pendingTasks) : "—"}
                  tone="#B45309"
                  onClick={() => go("/ops-departments")}
                />
                <KpiTile
                  label={lang === "bn" ? "ডিলে ডিসপ্যাচ" : "Delayed Dispatch"}
                  value={ok ? String(ok.delayedDispatch) : "—"}
                  tone="#DC2626"
                  onClick={() => go("/ops-control?tab=dispatch")}
                />
              </div>
            </Section>

            {/* Operations KPIs — dept depths as progress bars */}
            <Section title={lang === "bn" ? "অপারেশন কেপিআই" : "Operations KPIs"}>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                {(ops.data?.departments?.length ?? 0) === 0 ? (
                  <EmptyState tone="light" title={lang === "bn" ? "কোনো কিউ নেই" : "No queued work"} />
                ) : (
                  (() => {
                    const depts = ops.data!.departments;
                    const max = Math.max(...depts.map((d) => d[1]), 1);
                    return depts.map(([n, val]) => (
                      <ProgressRow key={n} label={n} value={val} max={max} color="#DC4E2A" fmt={(x) => `${x}`} />
                    ));
                  })()
                )}
              </div>
            </Section>

            {/* Visa KPIs */}
            <Section
              title={lang === "bn" ? "ভিসা কেপিআই" : "Visa KPIs"}
              action={
                <ErpButton size="sm" variant="ghost" icon={<FileCheck size={14} />} onClick={() => go("/ops-departments")}>
                  {lang === "bn" ? "ভিসা ডেস্ক" : "Visa Desk"}
                </ErpButton>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <KpiTile label={lang === "bn" ? "ইস্যু হয়নি" : "Not Issued"} value={v ? String(v.backlog.notIssued) : "—"} tone="#0D9488" onClick={() => go("/ops-departments")} />
                <KpiTile label={lang === "bn" ? "বায়োমেট্রিক" : "Biometric"} value={v ? String(v.backlog.biometricNotIssued) : "—"} tone="#B45309" onClick={() => go("/ops-departments")} />
                <KpiTile label="MOFA %" value={v ? `${v.mofa.completePercent}%` : "—"} hint={v ? `${v.mofa.issuedWithMofa}/${v.mofa.issuedTotal}` : undefined} onClick={() => go("/ops-departments")} />
                <KpiTile label={lang === "bn" ? "প্রত্যাখ্যাত" : "Rejected"} value={v ? String(v.backlog.rejectedOpen) : "—"} tone="#DC2626" onClick={() => go("/ops-departments")} />
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                {!v ? (
                  <EmptyState tone="light" title={lang === "bn" ? "ভিসা ডেটা নেই" : "No visa data"} />
                ) : (
                  VISA_PIPELINE_ORDER.filter((s) => (v.pipeline[s] ?? 0) > 0 || ["NEW", "MOFA", "EMBASSY", "ISSUED"].includes(s))
                    .slice(0, 8)
                    .map((s) => (
                      <ProgressRow
                        key={s}
                        label={s.replace(/_/g, " ")}
                        value={v.pipeline[s] ?? 0}
                        max={pipeMax}
                        color={s === "REJECTED" ? "#DC2626" : "#0D9488"}
                      />
                    ))
                )}
              </div>
            </Section>

            {/* Long Stay KPIs */}
            <Section
              title={lang === "bn" ? "লং স্টে কেপিআই" : "Long Stay KPIs"}
              action={
                <ErpButton size="sm" variant="ghost" icon={<CalendarDays size={14} />} onClick={() => go("/ops-control?tab=longstay")}>
                  {lang === "bn" ? "লং স্টে" : "Long Stay"}
                </ErpButton>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <KpiTile label={lang === "bn" ? "মোট" : "Total"} value={v ? String(v.longStay.total) : "—"} onClick={() => go("/ops-control?tab=longstay")} />
                <KpiTile label={lang === "bn" ? "হোস্ট সম্পূর্ণ" : "Host Complete"} value={v ? `${v.longStay.hostCompletePercent}%` : "—"} hint={v ? `${v.longStay.hostComplete}/${v.longStay.total}` : undefined} onClick={() => go("/ops-control?tab=longstay")} />
                <KpiTile label="Day-85" value={v ? String(v.longStay.due) : "—"} tone="#DC2626" onClick={() => go("/ops-control?tab=longstay")} />
                <KpiTile label="Day-90" value={v ? String(v.longStay.escalated) : "—"} tone="#991B1B" onClick={() => go("/ops-control?tab=longstay")} />
                <KpiTile label={lang === "bn" ? "রেড কার্ড" : "Red Cards"} value={v ? String(v.longStay.redCards) : "—"} tone="#EF4444" onClick={() => go("/ops-control?tab=longstay")} />
                <KpiTile label={lang === "bn" ? "সমাধান" : "Resolved"} value={v ? String(v.longStay.resolved) : "—"} tone="#16A34A" onClick={() => go("/ops-control?tab=longstay")} />
              </div>
            </Section>

            {/* Finance Snapshot */}
            <Section
              title={lang === "bn" ? "ফাইন্যান্স স্ন্যাপশট" : "Finance Snapshot"}
              action={
                <ErpButton size="sm" variant="ghost" icon={<DollarSign size={14} />} onClick={() => go("/finance-erp")}>
                  {lang === "bn" ? "হিসাব" : "Finance"}
                </ErpButton>
              }
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <KpiTile label={lang === "bn" ? "নগদ" : "Cash"} value={fk ? fmtSAR(fk.cashPosition) : "—"} onClick={() => go("/finance-erp")} />
                <KpiTile label="AR" value={fk ? fmtSAR(fk.accountsReceivable) : "—"} tone="#B45309" onClick={() => go("/finance-erp")} />
                <KpiTile label="AP" value={fk ? fmtSAR(fk.accountsPayable) : "—"} onClick={() => go("/finance-erp")} />
                <KpiTile label={lang === "bn" ? "মোট রাজস্ব" : "Revenue"} value={fk ? fmtSAR(fk.totalRevenue) : "—"} tone="#06B6D4" onClick={() => go("/finance-erp")} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-[11px] font-bold mb-2 text-[#0B1E3F]">
                    {lang === "bn" ? "রাজস্ব ট্রেন্ড" : "Revenue trend"}
                  </div>
                  {(ceo.data?.revenueTrend?.length ?? 0) === 0 ? (
                    <EmptyState tone="light" title={lang === "bn" ? "রাজস্ব নেই" : "No revenue yet"} />
                  ) : (
                    ceo.data!.revenueTrend.map((r) => (
                      <ProgressRow
                        key={r.month}
                        label={monthLabel(r.month)}
                        value={r.total}
                        max={revMax}
                        color="#06B6D4"
                        fmt={(n) => fmtSAR(n)}
                      />
                    ))
                  )}
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-[11px] font-bold mb-2 text-[#0B1E3F]">AR Aging</div>
                  {(fin.data?.arAging?.length ?? 0) === 0 ? (
                    <EmptyState tone="light" title={lang === "bn" ? "AR নেই" : "No AR data"} />
                  ) : (
                    (() => {
                      const aging = fin.data!.arAging;
                      const max = Math.max(...aging.map((a) => a.amount), 1);
                      return aging.map((a) => (
                        <ProgressRow key={a.bucket} label={a.bucket} value={a.amount} max={max} color="#B45309" fmt={(n) => fmtSAR(n)} />
                      ));
                    })()
                  )}
                </div>
              </div>
            </Section>

            {/* Alerts + Top Agents + Reports teaser */}
            <Section title={lang === "bn" ? "অ্যালার্ট ও টপ এজেন্ট" : "Alerts & Top Agents"}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-[11px] font-bold text-[#0B1E3F] mb-2">{lang === "bn" ? "অ্যালার্ট" : "Alerts"}</div>
                  {[
                    {
                      show: (ok?.delayedDispatch ?? 0) > 0,
                      label: lang === "bn" ? `ডিলে ডিসপ্যাচ · ${ok?.delayedDispatch}` : `Delayed dispatch · ${ok?.delayedDispatch}`,
                      path: "/ops-control?tab=dispatch",
                      kind: "warning" as ErpStatusKind,
                    },
                    {
                      show: (v?.longStay.redCards ?? 0) > 0,
                      label: lang === "bn" ? `লং স্টে রেড কার্ড · ${v?.longStay.redCards}` : `Long Stay red cards · ${v?.longStay.redCards}`,
                      path: "/ops-control?tab=longstay",
                      kind: "rejected" as ErpStatusKind,
                    },
                    {
                      show: (v?.longStay.due ?? 0) > 0,
                      label: `Day-85 · ${v?.longStay.due}`,
                      path: "/ops-control?tab=longstay",
                      kind: "rejected" as ErpStatusKind,
                    },
                    {
                      show: (v?.backlog.rejectedOpen ?? 0) > 0,
                      label: lang === "bn" ? `ভিসা প্রত্যাখ্যাত · ${v?.backlog.rejectedOpen}` : `Visa rejected · ${v?.backlog.rejectedOpen}`,
                      path: "/ops-departments",
                      kind: "rejected" as ErpStatusKind,
                    },
                    {
                      show: (ck?.overdueInvoices ?? 0) > 0,
                      label: lang === "bn" ? `ওভারডিউ ইনভয়েস · ${ck?.overdueInvoices}` : `Overdue invoices · ${ck?.overdueInvoices}`,
                      path: "/finance-erp",
                      kind: "warning" as ErpStatusKind,
                    },
                  ]
                    .filter((a) => a.show)
                    .map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => go(a.path)}
                        className="w-full flex items-center justify-between gap-2 py-2 text-left"
                        style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}
                      >
                        <ErpStatusChip status={a.kind} label={a.label} lang={lang} />
                        <ChevronRight size={14} style={{ color: "rgba(11,30,63,0.35)" }} />
                      </button>
                    ))}
                  {[ok?.delayedDispatch, v?.longStay.redCards, v?.longStay.due, v?.backlog.rejectedOpen, ck?.overdueInvoices]
                    .every((n) => !n) && (
                    <EmptyState
                      tone="light"
                      title={lang === "bn" ? "কোনো অ্যালার্ট নেই" : "No alerts"}
                      hint={lang === "bn" ? "বিদ্যমান কেপিআই থেকে।" : "From existing KPIs."}
                    />
                  )}
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-[11px] font-bold text-[#0B1E3F] mb-2">
                    {lang === "bn" ? "টপ এজেন্ট (YTD)" : "Top Agents (YTD)"}
                  </div>
                  {(ceo.data?.topAgents?.length ?? 0) === 0 ? (
                    <EmptyState tone="light" title={lang === "bn" ? "এজেন্ট রাজস্ব নেই" : "No agent revenue yet"} />
                  ) : (
                    ceo.data!.topAgents.map((a) => (
                      <ProgressRow
                        key={a.name}
                        label={a.name}
                        value={a.total}
                        max={agentMax}
                        color="#06B6D4"
                        fmt={(n) => fmtSAR(n)}
                      />
                    ))
                  )}
                  <div className="mt-2">
                    <ErpButton size="sm" variant="outline" onClick={() => go("/agent-portal")}>
                      {lang === "bn" ? "এজেন্ট পোর্টাল" : "Agent Portal"}
                    </ErpButton>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title={lang === "bn" ? "রিপোর্ট" : "Reports"}
              subtitle={lang === "bn" ? "বিস্তারিত টেবিল — রিপোর্ট ট্যাব" : "Detailed tables — Reports tab"}
            >
              <div className="flex flex-wrap gap-2">
                {onOpenReports && (
                  <ErpButton variant="primary" icon={<ClipboardList size={14} />} onClick={onOpenReports}>
                    {lang === "bn" ? "রিপোর্ট খুলুন" : "Open Reports"}
                  </ErpButton>
                )}
                <ErpButton variant="outline" icon={<Activity size={14} />} onClick={() => go("/ops-control")}>
                  {lang === "bn" ? "অপস কন্ট্রোল" : "Ops Control"}
                </ErpButton>
              </div>
            </Section>
          </>
        )}
      </ErpPageTemplate>
    </div>
  );
}

// ─── 2. Reports / Management view ────────────────────────────────────────────

type ReportKind = "agents" | "visa" | "longstay" | "finance" | "ops";

interface ReportRow {
  id: string;
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  kind?: ErpStatusKind;
}

export function ReportsManagementView({ onOpenExecutive }: { onOpenExecutive?: () => void }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ReportKind>("agents");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<ReportRow | null>(null);
  const PAGE = 15;

  const ceo = useDash<CeoDashData>("/dashboards/ceo");
  const ops = useDash<OpsDashData>("/dashboards/ops");
  const visa = useDash<VisaDashData>("/dashboards/visa");
  const fin = useDash<FinDashData>("/dashboards/finance");

  const loading = ceo.loading || ops.loading || visa.loading || fin.loading;
  const error = ceo.error && visa.error && fin.error && ops.error;
  const refetch = () => {
    ceo.refetch();
    ops.refetch();
    visa.refetch();
    fin.refetch();
  };

  const rows: ReportRow[] = useMemo(() => {
    if (kind === "agents") {
      return (ceo.data?.topAgents ?? []).map((a, i) => ({
        id: `a-${i}`,
        col1: a.name,
        col2: fmtSAR(a.total),
        col3: lang === "bn" ? "এজেন্ট" : "Agent",
        col4: "YTD",
        kind: "info" as ErpStatusKind,
      }));
    }
    if (kind === "visa") {
      const p = visa.data?.pipeline ?? {};
      return VISA_PIPELINE_ORDER.map((s) => ({
        id: s,
        col1: s.replace(/_/g, " "),
        col2: String(p[s] ?? 0),
        col3: lang === "bn" ? "পাইপলাইন" : "Pipeline",
        col4: s === "REJECTED" ? "!" : "",
        kind: (s === "REJECTED" ? "rejected" : s === "ISSUED" || s === "COMPLETED" ? "approved" : "pending") as ErpStatusKind,
      }));
    }
    if (kind === "longstay") {
      const ls = visa.data?.longStay;
      if (!ls) return [];
      return [
        { id: "t", col1: lang === "bn" ? "মোট" : "Total", col2: String(ls.total), col3: "LS", col4: "", kind: "info" as ErpStatusKind },
        { id: "h", col1: lang === "bn" ? "হোস্ট সম্পূর্ণ" : "Host complete", col2: `${ls.hostComplete} (${ls.hostCompletePercent}%)`, col3: "LS", col4: "", kind: "approved" as ErpStatusKind },
        { id: "d", col1: "Day-85 Due", col2: String(ls.due), col3: "LS", col4: "", kind: "rejected" as ErpStatusKind },
        { id: "e", col1: "Day-90 Escalated", col2: String(ls.escalated), col3: "LS", col4: "", kind: "rejected" as ErpStatusKind },
        { id: "r", col1: lang === "bn" ? "রেড কার্ড" : "Red cards", col2: String(ls.redCards), col3: "LS", col4: "", kind: "rejected" as ErpStatusKind },
        { id: "ok", col1: lang === "bn" ? "সমাধান" : "Resolved", col2: String(ls.resolved), col3: "LS", col4: "", kind: "completed" as ErpStatusKind },
      ];
    }
    if (kind === "finance") {
      return (fin.data?.arAging ?? []).map((a, i) => ({
        id: `f-${i}`,
        col1: a.bucket,
        col2: fmtSAR(a.amount),
        col3: "AR",
        col4: lang === "bn" ? "এজিং" : "Aging",
        kind: "warning" as ErpStatusKind,
      }));
    }
    // ops
    return (ops.data?.departments ?? []).map(([n, val], i) => ({
      id: `o-${i}`,
      col1: n,
      col2: String(val),
      col3: lang === "bn" ? "ডিপার্টমেন্ট" : "Department",
      col4: lang === "bn" ? "কিউ" : "Queue",
      kind: "warning" as ErpStatusKind,
    }));
  }, [kind, ceo.data, visa.data, fin.data, ops.data, lang]);

  const filtered = rows.filter((r) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return r.col1.toLowerCase().includes(qq) || r.col2.toLowerCase().includes(qq) || r.col3.toLowerCase().includes(qq);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<ReportRow>[] = [
    { id: "c1", header: lang === "bn" ? "নাম / আইটেম" : "Name / Item", cell: (r) => <span className="text-xs font-semibold">{r.col1}</span> },
    { id: "c2", header: lang === "bn" ? "মান" : "Value", cell: (r) => <span className="text-xs font-mono font-bold tabular-nums">{r.col2}</span> },
    { id: "c3", header: lang === "bn" ? "ধরন" : "Type", cell: (r) => <span className="text-[11px]" style={{ color: "rgba(11,30,63,0.55)" }}>{r.col3}</span> },
    {
      id: "st",
      header: lang === "bn" ? "স্ট্যাটাস" : "Status",
      cell: (r) => r.kind ? <ErpStatusChip status={r.kind} lang={lang} /> : <span>—</span>,
    },
  ];

  const kinds: { id: ReportKind; bn: string; en: string }[] = [
    { id: "agents", bn: "টপ এজেন্ট", en: "Top Agents" },
    { id: "visa", bn: "ভিসা পাইপলাইন", en: "Visa Pipeline" },
    { id: "longstay", bn: "লং স্টে", en: "Long Stay" },
    { id: "finance", bn: "AR এজিং", en: "AR Aging" },
    { id: "ops", bn: "অপস কিউ", en: "Ops Queues" },
  ];

  const drillPath =
    kind === "agents" ? "/agent-portal"
      : kind === "visa" ? "/ops-departments"
        : kind === "longstay" ? "/ops-control?tab=longstay"
          : kind === "finance" ? "/finance-erp"
            : "/ops-control";

  if (error && !loading) {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "রিপোর্ট" : "Reports"}
        subtitle={lang === "bn" ? "সহজ · পাঠযোগ্য · বিদ্যমান এগ্রিগেশন" : "Simple · readable · existing aggregations"}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <ErpButton
              variant="outline"
              icon={<Download size={14} />}
              disabled={!filtered.length}
              onClick={() => {
                downloadCsv(
                  `report-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Name", "Value", "Type", "Note"],
                  filtered.map((r) => [r.col1, r.col2, r.col3, r.col4]),
                );
                erpToast.success(lang === "bn" ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded", lang);
              }}
            >
              {lang === "bn" ? "এক্সপোর্ট CSV" : "Export CSV"}
            </ErpButton>
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refetch}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
            {onOpenExecutive && (
              <ErpButton variant="outline" icon={<TrendingUp size={14} />} onClick={onOpenExecutive}>
                {lang === "bn" ? "নির্বাহী" : "Executive"}
              </ErpButton>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <ErpButton
                  key={k.id}
                  size="sm"
                  variant={kind === k.id ? "primary" : "outline"}
                  onClick={() => { setKind(k.id); setPage(1); }}
                >
                  {lang === "bn" ? k.bn : k.en}
                </ErpButton>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1 min-w-0">
                <ErpSearchBar
                  lang={lang}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  onClear={() => { setQ(""); setPage(1); }}
                  placeholder={lang === "bn" ? "নাম বা মান দিয়ে খুঁজুন..." : "Search name or value…"}
                />
              </div>
              <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={kind !== "agents" ? 1 : 0}>
                <p className="text-xs" style={{ color: "rgba(11,30,63,0.55)" }}>
                  {lang === "bn"
                    ? "রিপোর্ট ধরন উপরের কুইক ফিল্টার দিয়ে বাছুন। নতুন SQL নেই।"
                    : "Pick report type via quick filters. No new SQL."}
                </p>
                <div className="mt-2">
                  <ErpButton size="sm" variant="secondary" onClick={() => goIfAllowed(navigate, drillPath)}>
                    {lang === "bn" ? "মডিউলে যান" : "Open module"}
                  </ErpButton>
                </div>
              </ErpFilterPanel>
            </div>
          </div>
        }
        footer={
          <ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />
        }
      >
        <ErpDataTable
          columns={columns}
          rows={loading ? [] : pageRows}
          rowKey={(r) => r.id}
          loading={loading}
          lang={lang}
          onRowClick={(r) => setSel(r)}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No report rows"}
          emptyHint={lang === "bn" ? "ড্যাশবোর্ড এপিআই থেকে ডেটা আসলে এখানে দেখা যাবে।" : "Rows appear when dashboard APIs return data."}
          emptyAction={
            <ErpButton variant="primary" icon={<RefreshCw size={14} />} onClick={refetch}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
          }
          rowActions={(r) => (
            <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(e) => { e.stopPropagation(); setSel(r); }}>
              {lang === "bn" ? "দেখুন" : "View"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.col1 ?? (lang === "bn" ? "রিপোর্ট" : "Report")}
        subtitle={sel ? `${sel.col3} · ${sel.col2}` : undefined}
        lang={lang}
        footer={
          <ErpButton variant="primary" onClick={() => { setSel(null); goIfAllowed(navigate, drillPath); }}>
            {lang === "bn" ? "মডিউলে যান" : "Open module"}
          </ErpButton>
        }
      >
        {sel && (
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "আইটেম" : "Item", sel.col1],
              [lang === "bn" ? "মান" : "Value", sel.col2],
              [lang === "bn" ? "ধরন" : "Type", sel.col3],
              [lang === "bn" ? "নোট" : "Note", sel.col4 || "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-2" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                <dd className="font-semibold text-[#0B1E3F]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </ErpDrawer>
    </div>
  );
}
