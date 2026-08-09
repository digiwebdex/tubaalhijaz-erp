import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { toast } from "sonner";
import { api, ApiError, isLoggedIn } from "../lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, TrendingUp, TrendingDown, BookOpen,
  ArrowDownLeft, ArrowUpRight, CreditCard, Globe,
  FileText, FileCheck, List, BarChart3, Layers,
  Download, Printer, Plus, Check, Send,
  CheckCircle, ArrowUp, ArrowDown,
  Building, Wallet, RefreshCw, Eye,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState, SampleDataBanner } from "../components/States";
import {
  ERP, CAT, erpAlpha, ErpThemeProvider, ErpStatCard, ErpBadge,
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpTextarea, ErpStatusChip, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { downloadCsv } from "../lib/exportCsv";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIN  = CAT.green; // Finance module accent (categorical, themed)
const GOLD = ERP.accent;
const BARCODE_FIN = [3,1,2,1,1,3,2,1,1,2,3,1,2,1,1,3,1,2,3,1,1,2,1,3,2,1,1,2,1,3,1,2,1,3];

type FinScreen = "dashboard"|"income"|"expenses"|"ledger"|"ar"|"ap"|"cash"|"forex"|"invoices"|"mofaBill"|"receipts"|"statements"|"pl"|"bs";

const FIN_NAV: NavItem[] = [
  { id:"dashboard",  label:"Finance Dashboard",  icon: LayoutDashboard as IconFC, badge:3 },
  { id:"income",     label:"Income",              icon: TrendingUp      as IconFC },
  { id:"expenses",   label:"Expenses",            icon: TrendingDown    as IconFC },
  { id:"ledger",     label:"Ledgers",             icon: BookOpen        as IconFC },
  { id:"ar",         label:"Receivables (AR)",    icon: ArrowDownLeft   as IconFC, badge:5 },
  { id:"ap",         label:"Payables (AP)",       icon: ArrowUpRight    as IconFC },
  { id:"cash",       label:"Cash & Bank",         icon: CreditCard      as IconFC },
  { id:"forex",      label:"Multi-Currency",      icon: Globe           as IconFC },
  { id:"invoices",   label:"Invoices",            icon: FileText        as IconFC },
  { id:"mofaBill",   label:"MOFA Bill Sheet",     icon: FileCheck       as IconFC },
  { id:"receipts",   label:"Receipts",            icon: FileCheck       as IconFC },
  { id:"statements", label:"Statements",          icon: List            as IconFC },
  { id:"pl",         label:"Profit & Loss",       icon: BarChart3       as IconFC },
  { id:"bs",         label:"Balance Sheet",       icon: Layers          as IconFC },
];

// ─── Mock data ────────────────────────────────────────────────────────────────

const CASH_FLOW   = [
  { month:"Jan", cash:1200000 }, { month:"Feb", cash:1450000 }, { month:"Mar", cash:1820000 },
  { month:"Apr", cash:1680000 }, { month:"May", cash:2100000 }, { month:"Jun", cash:2750000 },
  { month:"Jul", cash:3200000 },
];
const PL_CHART    = [
  { month:"Jan", revenue:820,  cogs:590,  opex:220 }, { month:"Feb", revenue:960,  cogs:680,  opex:240 },
  { month:"Mar", revenue:1100, cogs:780,  opex:255 }, { month:"Apr", revenue:880,  cogs:610,  opex:230 },
  { month:"May", revenue:750,  cogs:520,  opex:210 }, { month:"Jun", revenue:1240, cogs:860,  opex:260 },
  { month:"Jul", revenue:1450, cogs:980,  opex:265 },
];

const INCOME = [
  { id:"INC-0091", date:"15 Jul", ref:"INV-1446-0091", entity:"Rashidi Travel Co.",  cat:"Visa Services",    amt:94000,  group:"GRP-2891", status:"RECEIVED" },
  { id:"INC-0088", date:"09 Jul", ref:"INV-1446-0088", entity:"Al-Noor Pilgrim Svc", cat:"Hotel Services",   amt:112000, group:"GRP-2744", status:"RECEIVED" },
  { id:"INC-0085", date:"08 Jul", ref:"INV-1446-0085", entity:"Zamzam Pilgrim Svc",  cat:"Transport Svcs",   amt:36000,  group:"GRP-3102", status:"RECEIVED" },
  { id:"INC-0082", date:"07 Jul", ref:"INV-1446-0082", entity:"Makkah Tours Co.",    cat:"Full Package",     amt:187000, group:"GRP-2612", status:"PENDING"  },
  { id:"INC-0079", date:"06 Jul", ref:"INV-1446-0079", entity:"Crown Hajj Tours",    cat:"Visa Services",    amt:76000,  group:"GRP-2990", status:"OVERDUE"  },
  { id:"INC-0071", date:"02 Jul", ref:"INV-1446-0071", entity:"Rashidi Travel Co.",  cat:"Hotel Services",   amt:168000, group:"GRP-2401", status:"RECEIVED" },
  { id:"INC-0063", date:"25 Jun", ref:"INV-1446-0063", entity:"Al-Noor Pilgrim Svc", cat:"Catering Svcs",    amt:58800,  group:"GRP-2203", status:"RECEIVED" },
  { id:"INC-0059", date:"20 Jun", ref:"INV-1446-0059", entity:"Baraka Travel",       cat:"Transport Svcs",   amt:14400,  group:"GRP-3201", status:"RECEIVED" },
];

const EXPENSES = [
  { id:"EXP-0091", date:"14 Jul", ref:"PO-1446-0091", entity:"Jabal Omar Hyatt",   cat:"Hotel Costs",     amt:124000, group:"GRP-2891", status:"PAID"    },
  { id:"EXP-0087", date:"12 Jul", ref:"PO-1446-0087", entity:"Al-Barakah Cat.",    cat:"Catering Costs",  amt:98280,  group:"GRP-2891", status:"PAID"    },
  { id:"EXP-0082", date:"11 Jul", ref:"PO-1446-0082", entity:"Al-Naqil Trans.",    cat:"Transport Costs", amt:18000,  group:"GRP-2891", status:"PAID"    },
  { id:"EXP-0079", date:"08 Jul", ref:"PO-1446-0079", entity:"Makkah Towers",      cat:"Hotel Costs",     amt:89600,  group:"GRP-2744", status:"PENDING" },
  { id:"EXP-0071", date:"01 Jul", ref:"SAL-JUL-2025", entity:"Staff Payroll",      cat:"Salaries",        amt:82500,  group:"—",        status:"PAID"    },
  { id:"EXP-0065", date:"01 Jul", ref:"PO-1446-0065", entity:"Marriott Makkah",    cat:"Hotel Costs",     amt:168000, group:"GRP-2401", status:"PAID"    },
  { id:"EXP-0059", date:"27 Jun", ref:"PO-1446-0059", entity:"Zamzam Food Svc",    cat:"Catering Costs",  amt:58800,  group:"GRP-2203", status:"PAID"    },
  { id:"EXP-0052", date:"01 Jun", ref:"RENT-JUN-2025",entity:"Office Rent",         cat:"Overhead",        amt:20000,  group:"—",        status:"PAID"    },
];

const AGENT_LED = [
  { date:"01 Jun", desc:"Opening Balance",              ref:"OB-2025",     dr:0,      cr:0,      bal:180000 },
  { date:"15 Jun", desc:"Top-up received",              ref:"PAY-0189",    dr:0,      cr:250000, bal:430000 },
  { date:"24 Jun", desc:"GRP-2203 hotel deduction",     ref:"SVC-2203",    dr:78400,  cr:0,      bal:351600 },
  { date:"02 Jul", desc:"GRP-2401 visa & transport",    ref:"SVC-2401",    dr:128000, cr:0,      bal:223600 },
  { date:"05 Jul", desc:"Top-up received",              ref:"PAY-0211",    dr:0,      cr:180000, bal:403600 },
  { date:"09 Jul", desc:"GRP-2891 full package deduct", ref:"SVC-2891",    dr:254000, cr:0,      bal:149600 },
  { date:"10 Jul", desc:"Visa refund — GRP-2891",       ref:"REF-0041",    dr:0,      cr:4000,   bal:153600 },
  { date:"15 Jul", desc:"Invoice INV-0091 issued",      ref:"INV-0091",    dr:94000,  cr:0,      bal:59600  },
];

const SUPPLIER_LED = [
  { date:"01 Jan", desc:"Opening Balance",               ref:"OB-2025",     dr:0,      cr:0,      bal:0      },
  { date:"15 Mar", desc:"Contract — Season 1446H",       ref:"CTR-0001",    dr:0,      cr:520000, bal:520000 },
  { date:"01 May", desc:"Advance payment (50%)",         ref:"ADV-HTL-001", dr:260000, cr:0,      bal:260000 },
  { date:"24 Jun", desc:"GRP-2203 settlement",           ref:"STL-0063",    dr:78400,  cr:0,      bal:181600 },
  { date:"02 Jul", desc:"GRP-2401 settlement",           ref:"STL-0071",    dr:168000, cr:0,      bal:13600  },
  { date:"10 Jul", desc:"Invoice received — GRP-2891",   ref:"INV-0091",    dr:0,      cr:124000, bal:137600 },
  { date:"12 Jul", desc:"Advance disbursement",          ref:"ADV-HTL-002", dr:62000,  cr:0,      bal:75600  },
  { date:"16 Jul", desc:"Balance outstanding",           ref:"STMT-0001",   dr:0,      cr:0,      bal:75600  },
];

const GL_DATA = [
  { date:"15 Jul", acct:"2001 — AR Agents",       ref:"INV-0091",     dr:94000,  cr:0,      desc:"Invoice — Rashidi Travel" },
  { date:"15 Jul", acct:"3001 — Revenue Visa",    ref:"INV-0091",     dr:0,      cr:94000,  desc:"Revenue recognition" },
  { date:"14 Jul", acct:"4001 — Hotel Costs",     ref:"PO-0091",      dr:124000, cr:0,      desc:"Jabal Omar Hyatt — GRP-2891" },
  { date:"14 Jul", acct:"2101 — AP Hotels",       ref:"PO-0091",      dr:0,      cr:124000, desc:"Hotel payable" },
  { date:"12 Jul", acct:"1001 — Cash Al Rajhi",   ref:"PAY-0211",     dr:180000, cr:0,      desc:"Top-up — Al-Noor Pilgrim" },
  { date:"12 Jul", acct:"2001 — AR Agents",       ref:"PAY-0211",     dr:0,      cr:180000, desc:"AR offset" },
  { date:"10 Jul", acct:"2101 — AP Hotels",       ref:"ADV-HTL-002",  dr:62000,  cr:0,      desc:"Advance — Jabal Omar" },
  { date:"10 Jul", acct:"1001 — Cash Al Rajhi",   ref:"ADV-HTL-002",  dr:0,      cr:62000,  desc:"Cash outflow" },
  { date:"01 Jul", acct:"4003 — Staff Salaries",  ref:"SAL-JUL-2025", dr:82500,  cr:0,      desc:"Monthly payroll" },
  { date:"01 Jul", acct:"1001 — Cash Al Rajhi",   ref:"SAL-JUL-2025", dr:0,      cr:82500,  desc:"Payroll disbursement" },
];

const AR_ENTITIES = [
  { entity:"Rashidi Travel Co.",    cur:350000, d30:180000, d60:120000, d90:80000  },
  { entity:"Al-Noor Pilgrim Svc",  cur:200000, d30:140000, d60:80000,  d90:60000  },
  { entity:"Zamzam Pilgrim Svc",   cur:180000, d30:150000, d60:100000, d90:50000  },
  { entity:"Crown Hajj Tours",     cur:80000,  d30:90000,  d60:90000,  d90:25000  },
  { entity:"Makkah Tours Co.",     cur:40000,  d30:60000,  d60:60000,  d90:5000   },
];
const AP_ENTITIES = [
  { entity:"Jabal Omar Hyatt",     cur:124000, d30:75000,  d60:30000,  d90:0      },
  { entity:"Al-Barakah Catering",  cur:98000,  d30:62000,  d60:20000,  d90:0      },
  { entity:"Al-Naqil Transport",   cur:72000,  d30:48000,  d60:40000,  d90:40000  },
  { entity:"Movenpick Makkah",     cur:86000,  d30:95000,  d60:60000,  d90:40000  },
];

const BANKS = [
  { name:"Al Rajhi Bank",    iban:"SA29 0000 0001 XXXX XXXX 1234", balance:1850000, acct:"Current Account" },
  { name:"Alinma Bank",      iban:"SA41 0550 0000 XXXX XXXX 5678", balance:980000,  acct:"Savings Account" },
  { name:"SNB — Operations", iban:"SA00 1000 0000 XXXX XXXX 9012", balance:370000,  acct:"Operations Account" },
];
const BANK_TXN = [
  { date:"15 Jul", desc:"Receipt from Rashidi Travel",       ref:"SARIE-0711",  type:"cr", amount:250000 },
  { date:"14 Jul", desc:"Advance to Jabal Omar Hyatt",       ref:"TRF-HTL-002", type:"dr", amount:62000  },
  { date:"12 Jul", desc:"Receipt from Al-Noor Pilgrim",      ref:"SARIE-0712",  type:"cr", amount:180000 },
  { date:"01 Jul", desc:"Staff payroll disbursement",        ref:"SAL-JUL",     type:"dr", amount:82500  },
  { date:"28 Jun", desc:"Receipt from Zamzam Pilgrim",       ref:"CHQ-44219",   type:"cr", amount:95000  },
  { date:"25 Jun", desc:"GRP-2203 hotel settlement",         ref:"TRF-STL-063", type:"dr", amount:78400  },
];

const FX_RATES = [
  { code:"SAR", name:"Saudi Riyal",      sar:1.0000, change:0,      exposure:"SAR 3,200,000" },
  { code:"USD", name:"US Dollar",        sar:3.7500, change:+0.001, exposure:"USD 485,000"   },
  { code:"BDT", name:"Bangladeshi Taka", sar:0.0330, change:-0.0002,exposure:"BDT 12,400,000"},
  { code:"EUR", name:"Euro",             sar:4.0650, change:+0.015, exposure:"EUR 82,000"    },
  { code:"GBP", name:"British Pound",    sar:4.7100, change:+0.022, exposure:"GBP 41,000"    },
  { code:"TRY", name:"Turkish Lira",     sar:0.1162, change:-0.003, exposure:"TRY 950,000"   },
];

const INVOICES_LIST = [
  {
    id:"INV-1446-0091", date:"15 Jul 2025", to:"Rashidi Travel Co.", toAddr:"Riyadh, KSA · License SAR-2024-1891", group:"GRP-1446-2891",
    items:[
      { desc:"Visa Services — Umrah 2025 (47 pax)",         qty:47, unit:2000,   total:94000  },
      { desc:"Hotel: Jabal Omar Hyatt — 14 nights",          qty:1,  unit:168000, total:168000 },
      { desc:"Ground Transport — 2× Bus (Arrival + Depart)", qty:2,  unit:9000,   total:18000  },
      { desc:"Meet & Assist — King Abdulaziz Int'l Airport", qty:1,  unit:1500,   total:1500   },
    ], subtotal:281500, vat:42225, total:323725, status:"OUTSTANDING",
  },
  {
    id:"INV-1446-0087", date:"08 Jul 2025", to:"Al-Noor Pilgrim Svc", toAddr:"Jeddah, KSA · License SAR-2024-2231", group:"GRP-1446-2744",
    items:[
      { desc:"Visa Services — Umrah 2025 (32 pax)", qty:32, unit:2000,   total:64000  },
      { desc:"Hotel: Makkah Towers — 14 nights",    qty:1,  unit:112000, total:112000 },
    ], subtotal:176000, vat:26400, total:202400, status:"PAID",
  },
  {
    id:"INV-1446-0082", date:"02 Jul 2025", to:"Zamzam Pilgrim Svc", toAddr:"Makkah, KSA · License SAR-2024-3312", group:"GRP-1446-3102",
    items:[
      { desc:"Full Package — Season 1446H (52 pax)", qty:52, unit:7500, total:390000 },
    ], subtotal:390000, vat:58500, total:448500, status:"PAID",
  },
];

const RECEIPTS_LIST = [
  { id:"REC-1446-0241", date:"12 Jul 2025", from:"Rashidi Travel Co.",  fromAddr:"Riyadh, KSA", amount:250000, method:"Bank Transfer (SARIE)", bankRef:"SARIE-20250712-4491", applies:"INV-1446-0087 + partial INV-1446-0091", status:"CONFIRMED" },
  { id:"REC-1446-0229", date:"05 Jul 2025", from:"Al-Noor Pilgrim Svc", fromAddr:"Jeddah, KSA", amount:180000, method:"Bank Transfer (SARIE)", bankRef:"SARIE-20250705-3321", applies:"INV-1446-0082 (partial)",               status:"CONFIRMED" },
  { id:"REC-1446-0218", date:"28 Jun 2025", from:"Zamzam Pilgrim Svc",  fromAddr:"Makkah, KSA", amount:95000,  method:"Cheque",                 bankRef:"CHQ-44219",           applies:"INV-1446-0079",                          status:"CONFIRMED" },
];

// ─── API response types ───────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

interface DashData { cashPosition:number; accountsReceivable:number; accountsPayable:number; ytdNetProfit:number; netMargin:number; totalRevenue:number; arAging:{cur:number;d30:number;d60:number;d90:number;total:number}; balanced:boolean; }
interface FinEntry { id:string; date:string; ref:string; entity:string; cat:string; amt:number; group:string; status:string; }
interface LedEntity { companyId:string; name:string; code:string; }
interface LedgerEntry { id:string; date:string; description:string; ref:string; debit:number; credit:number; balance:number; }
interface LedgerView { entity:{companyId:string;name:string}; openingBalance:number; totalDebits:number; totalCredits:number; closingBalance:number; entries:LedgerEntry[]; }
interface GLRow { id:string; date:string; description:string; ref:string; account:{code:string;name:string}; debit:number; credit:number; }
interface ARAPData { entities:{entity:string;cur:number;d30:number;d60:number;d90:number;total:number}[]; totals:{cur:number;d30:number;d60:number;d90:number;total:number}; }
interface CashData { accounts:{name:string;code:string;balance:number}[]; total:number; transactions:{date:string;desc:string;ref:string;type:"cr"|"dr";amount:number}[]; }
interface ForexRate { currency:string; rateToSar:number; asOf:string; }
interface ApiInvoice { id:string; code:string; tenant:string; toAddr:string; group:string; issueDate:string; dueDate:string; subtotal:number; vatRate:number; vatAmount:number; total:number; status:string; fileId:string|null; items:{desc:string;qty:number;unit:number;total:number}[]; }
interface ApiReceipt { id:string; code:string; from:string; fromAddr:string; date:string; amount:number; method:string; bankRef:string; applies:string; status:string; }
interface PLLine { code:string; name:string; amount:number; }
interface PLData { revenue:PLLine[]; cogs:PLLine[]; opex:PLLine[]; totalRevenue:number; totalCogs:number; grossProfit:number; grossMargin:number; totalOpex:number; ebitda:number; netProfit:number; netMargin:number; }
interface BSLine { code:string; name:string; amount:number; }
interface BSData { assets:BSLine[]; liabilities:BSLine[]; equity:BSLine[]; totalAssets:number; totalLiabilities:number; totalEquity:number; liabilitiesPlusEquity:number; balanced:boolean; }

// ─── Shared helpers ───────────────────────────────────────────────────────────

const IS: CSSProperties = { backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}`, color:ERP.navy };

// ─── Live-data state machine ──────────────────────────────────────────────────
// Logged OUT → demo mode: screens keep rendering their mock data (unchanged).
// Logged IN  → loading / error / empty / data. A failed request must NEVER fall
// through to the mock constants — a controller would read demo money as real.
function useLive<T>(path: string) {
  const demo = !isLoggedIn();
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError]     = useState(false);
  const [nonce, setNonce]     = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) { setData(null); setLoading(false); setError(false); return; }
    let cancelled = false;
    setLoading(true); setError(false); setData(null);
    const t = setTimeout(() => {
      api.get<T>(path)
        .then(v  => { if (!cancelled) { setData(v); setError(false); } })
        .catch(() => { if (!cancelled) { setData(null); setError(true); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce]);

  return { data, loading, error, demo, refetch: () => setNonce(n => n + 1) };
}

/** Loading / error gate rendered inside a screen's own padding wrapper. */
function Gate({ loading, error, onRetry, rows = 6 }: { loading:boolean; error:boolean; onRetry:()=>void; rows?:number }) {
  if (loading) return <LoadingSkeleton tone="light" rows={rows} />;
  if (error)   return <ErrorState tone="light" onRetry={onRetry} />;
  return null;
}

/** Full-width loading / error / empty cell that keeps a table's column layout. */
function TableState({ cols, loading, error, onRetry, title, hint }: {
  cols:number; loading:boolean; error:boolean; onRetry:()=>void; title:string; hint?:string;
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-2">
        {loading ? <LoadingSkeleton tone="light" rows={4} />
          : error ? <ErrorState tone="light" onRetry={onRetry} />
          : <EmptyState tone="light" title={title} hint={hint} />}
      </td>
    </tr>
  );
}

function finStatusKind(s: string): ErpStatusKind {
  const u = s.toUpperCase();
  if (u === "RECEIVED" || u === "PAID" || u === "CONFIRMED" || u === "CURRENT" || u === "CREDIT") return "approved";
  if (u === "OVERDUE" || u === "DEBIT") return "rejected";
  if (u === "PENDING" || u === "OUTSTANDING") return "warning";
  if (u === "CANCELLED") return "cancelled";
  if (u === "DRAFT") return "pending";
  return "info";
}

function fmtMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `SAR ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `SAR ${(n / 1e3).toFixed(1)}K`;
  return `SAR ${n.toLocaleString()}`;
}

function TH({ cols }: { cols:string[] }) {
  return (
    <thead>
      <tr style={{ backgroundColor:ERP.surfaceSoft, borderBottom:`1px solid ${ERP.border}` }}>
        {cols.map(c => (
          <th key={c} className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color:ERP.muted }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function Amt({ v, type }: { v:number; type?:"cr"|"dr" }) {
  const c = type==="cr"?ERP.success:type==="dr"?ERP.destructive:ERP.navy;
  const p = type==="cr"?"+":(type==="dr"?"−":"");
  return <span className="font-mono font-bold text-xs whitespace-nowrap tabular-nums" style={{ color:c, fontFamily:"var(--font-mono)" }}>{p}SAR {v.toLocaleString()}</span>;
}

// Delegates to the shared ErpButton (outline), tinted to an optional accent.
function ActionBtn({ label, color, icon:Icon, onClick, disabled }: { label:string; color?:string; icon?:typeof Download; onClick?:()=>void; disabled?:boolean }) {
  return (
    <ErpButton variant="outline" size="sm" icon={Icon ? <Icon size={11} /> : undefined} onClick={onClick} disabled={disabled}
      style={color ? { backgroundColor: erpAlpha(color, 9), color, border: `1px solid ${erpAlpha(color, 19)}` } : undefined}>
      {label}
    </ErpButton>
  );
}

// ─── FinDoc — shared print-preview layout ─────────────────────────────────────

function FinDoc({ type, docNo, date, children, noBarcode }: { type:string; docNo:string; date:string; children:ReactNode; noBarcode?:boolean }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-xl" style={{ fontFamily:"var(--font-sans)" }}>
      <div className="h-2" style={{ background:`linear-gradient(90deg,${GOLD},${ERP.goldHov},${GOLD})` }} />
      <div className="bg-white px-8 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-2xl font-black text-gray-900">TUBA AL HIJAZ</div>
            <div className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color:ERP.muted }}>Enterprise Ground Handling · Financial Services</div>
            <div className="text-[9px] mt-0.5" style={{ color:ERP.muted }}>Makkah Al-Mukarramah, Kingdom of Saudi Arabia · VAT Reg: 310-XXX-XXXX</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black tracking-widest uppercase" style={{ color:FIN }}>{type}</div>
            <div className="text-xl font-black text-gray-900 mt-1" style={{ fontFamily:"var(--font-mono)" }}>{docNo}</div>
            <div className="text-[10px]" style={{ color:ERP.muted }}>Date: {date}</div>
          </div>
        </div>
        {children}
        {!noBarcode && (
          <>
            <div className="flex justify-center gap-px mt-5 pt-4 border-t border-gray-100">
              {BARCODE_FIN.map((w, i) => <div key={i} style={{ width:w, height:28, backgroundColor:ERP.surfaceSoft, opacity:i%5===0?0.4:1, borderRadius:1 }} />)}
            </div>
            <div className="text-center text-[9px] mt-1.5" style={{ color:ERP.muted, fontFamily:"var(--font-mono)" }}>{docNo} · TUBA-FIN-1446H</div>
          </>
        )}
      </div>
      <div className="h-1.5" style={{ background:`linear-gradient(90deg,${GOLD},${ERP.goldHov},${GOLD})` }} />
    </div>
  );
}

// Table for FinDoc (white background)
function DocTable({ cols, rows }: { cols:string[]; rows:ReactNode[][] }) {
  return (
    <table className="w-full mb-4 text-xs">
      <thead>
        <tr style={{ backgroundColor:ERP.surfaceSoft, borderBottom:`1px solid ${ERP.border}` }}>
          {cols.map((c, i) => <th key={c} className={`py-2 px-3 font-black text-[9px] uppercase tracking-wider text-left${i>0?" text-right":""}`} style={{ color:ERP.muted }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ backgroundColor:ri%2===0?"white":ERP.surfaceSoft, borderBottom:`1px solid ${ERP.surfaceSoft}` }}>
            {row.map((cell, ci) => <td key={ci} className={`py-2.5 px-3${ci>0?" text-right":""}`} style={{ color:ERP.muted }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Statement line for P&L / Balance Sheet
// `pending` opt-in renders this document's existing "—" placeholder (same token and
// light-grey tone as the light statement table above) in the amount slot, for a line
// whose figure the backend does not carry. Left off, an amount-less row still
// renders label-only — that is the section-heading form ("Current Assets" etc.).
function SLine({ label, amount, indent=0, bold=false, sub=false, sep=false, color, pending=false }: { label:string; amount?:number; indent?:number; bold?:boolean; sub?:boolean; sep?:boolean; color?:string; pending?:boolean }) {
  const amtCls = `text-xs font-mono shrink-0 whitespace-nowrap tabular-nums ml-3${bold?" font-black":" font-semibold"}`;
  return (
    <div className={`flex justify-between items-center py-1.5${sep?" border-t mt-1 pt-2":""}${sub?" opacity-60":""}`} style={sep?{borderColor:ERP.border}:{}}>
      <span className={`text-xs min-w-0 truncate${bold?" font-black":" font-medium"}`} title={label} style={{ paddingLeft:`${indent*14}px`, color:color??(bold?ERP.navy:ERP.muted) }}>{label}</span>
      {amount !== undefined ? (
        <span className={amtCls} style={{ color:color??(bold?ERP.navy:ERP.muted), fontFamily:"var(--font-mono)" }}>
          SAR {amount.toLocaleString()}
        </span>
      ) : pending ? (
        <span className={amtCls} style={{ color:ERP.border, fontFamily:"var(--font-mono)" }}>—</span>
      ) : null}
    </div>
  );
}

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────

const AR_TOTAL = AR_ENTITIES.reduce((s,e)=>s+e.cur+e.d30+e.d60+e.d90,0);
const AP_TOTAL = AP_ENTITIES.reduce((s,e)=>s+e.cur+e.d30+e.d60+e.d90,0);

const DASH_FALLBACK: DashData = {
  cashPosition:3200000, accountsReceivable:2140000, accountsPayable:890000, ytdNetProfit:1630000,
  netMargin:19.3, totalRevenue:8450000,
  arAging:{ cur:850000, d30:620000, d60:450000, d90:220000, total:AR_TOTAL },
  balanced:true,
};

function DashboardScreen({ onGo }: { onGo: (s: FinScreen) => void }) {
  const { lang } = useLang();
  const { data: live, loading, error, demo, refetch } = useLive<DashData>("/finance/dashboard");
  const recent = useLive<FinEntry[]>("/finance/entries?kind=income");
  const recentRows = (demo
    ? INCOME
    : (recent.data ?? []).map(e => ({ ...e, date: fmtDate(e.date) }))
  ).slice(0, 8);
  const d = demo ? DASH_FALLBACK : live;
  const arTotal = d ? (d.arAging.total || (d.arAging.cur + d.arAging.d30 + d.arAging.d60 + d.arAging.d90)) : 0;

  /** Existing DashData fields only — no invented “today” collection/payment KPIs. */
  const summary = d ? [
    { id: "cash", labelBn: "নগদ অবস্থান", labelEn: "Cash Position", value: fmtMoney(d.cashPosition), tone: FIN, go: "cash" as FinScreen },
    { id: "rev", labelBn: "রাজস্ব (YTD)", labelEn: "Revenue (YTD)", value: fmtMoney(d.totalRevenue), tone: ERP.info, go: "income" as FinScreen },
    { id: "ar", labelBn: "প্রাপ্য (AR)", labelEn: "Accounts Receivable", value: fmtMoney(d.accountsReceivable), tone: ERP.warning, go: "ar" as FinScreen },
    { id: "ap", labelBn: "প্রদেয় (AP)", labelEn: "Accounts Payable", value: fmtMoney(d.accountsPayable), tone: ERP.destructive, go: "ap" as FinScreen },
    { id: "due", labelBn: "বকেয়া (৯০+)", labelEn: "Outstanding Due (90+)", value: fmtMoney(d.arAging.d90), tone: ERP.destructive, go: "ar" as FinScreen },
    { id: "profit", labelBn: "নেট লাভ (YTD)", labelEn: "YTD Net Profit", value: fmtMoney(d.ytdNetProfit), tone: ERP.success, go: "pl" as FinScreen },
  ] : [];

  const recentCols: ErpColumn<FinEntry>[] = [
    { id: "id", header: "ID", cell: (e) => <span className="text-[11px] font-mono font-bold" style={{ color: FIN }}>{e.id}</span> },
    { id: "ent", header: lang === "bn" ? "পক্ষ" : "Entity", cell: (e) => <span className="text-xs font-semibold truncate max-w-[140px] block">{e.entity}</span> },
    { id: "amt", header: lang === "bn" ? "পরিমাণ" : "Amount", cell: (e) => <Amt v={e.amt} type="cr" /> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (e) => <ErpStatusChip status={finStatusKind(e.status)} label={e.status} lang={lang} /> },
  ];

  if (!d) {
  return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <Gate loading={loading} error={error} onRetry={refetch} rows={6} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ফাইন্যান্স" : "Finance"}
        subtitle={lang === "bn" ? "সারাংশ · বিদ্যমান কেপিআই" : "Summary · existing KPIs"}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refetch}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {summary.map((s) => (
                <ErpStatCard
                  key={s.id}
                  value={s.value}
                  accent={s.tone}
                  label={lang === "bn" ? s.labelBn : s.labelEn}
                  onClick={() => onGo(s.go)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpButton size="sm" variant="primary" icon={<FileCheck size={14} />} onClick={() => onGo("receipts")}>
                {lang === "bn" ? "নতুন রসিদ" : "New Receipt"}
              </ErpButton>
              <ErpButton size="sm" variant="secondary" icon={<TrendingDown size={14} />} onClick={() => onGo("expenses")}>
                {lang === "bn" ? "নতুন পেমেন্ট" : "New Payment"}
              </ErpButton>
              <ErpButton size="sm" variant="outline" icon={<FileText size={14} />} onClick={() => onGo("invoices")}>
                {lang === "bn" ? "নতুন ইনভয়েস" : "New Invoice"}
              </ErpButton>
              <ErpButton size="sm" variant="outline" icon={<BookOpen size={14} />} onClick={() => onGo("income")}>
                {lang === "bn" ? "ভাউচার" : "Voucher"}
              </ErpButton>
          </div>
            <p className="text-[10px]" style={{ color: ERP.muted }}>
              {lang === "bn"
                ? "আজকের কালেকশন/পেমেন্ট API-তে নেই — YTD রাজস্ব ও বিদ্যমান কেপিআই দেখানো হয়েছে।"
                : "Today’s collection/payment are not on the API — showing YTD revenue and existing KPIs."}
            </p>
        </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
            <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-3">{lang === "bn" ? "AR এজিং" : "AR Aging"}</div>
            {([["0–30", ERP.success, d.arAging.cur], ["31–60", ERP.warning, d.arAging.d30], ["61–90", CAT.orange, d.arAging.d60], ["90+", ERP.destructive, d.arAging.d90]] as const).map(([l, c, v]) => {
              const pct = arTotal > 0 ? Math.round((v / arTotal) * 100) : 0;
            return (
                <div key={l} className="mb-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span style={{ color: ERP.muted }}>{l}</span>
                    <span className="font-mono font-bold" style={{ color: c }}>{fmtMoney(v)}</span>
                </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: ERP.surfaceSoft }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
                  </div>
              </div>
            );
          })}
        </div>
          <div>
            <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-2">{lang === "bn" ? "সাম্প্রতিক লেনদেন" : "Recent Transactions"}</div>
            <ErpDataTable
              columns={recentCols}
              rows={recent.loading && !demo ? [] : recentRows}
              rowKey={(e) => e.id}
              loading={recent.loading && !demo}
              lang={lang}
              onRowClick={() => onGo("income")}
              emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No recent transactions"}
              emptyHint={lang === "bn" ? "ইনকাম এন্ট্রি এখানে দেখা যাবে।" : "Posted income entries appear here."}
              emptyAction={
                <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => onGo("income")}>
                  {lang === "bn" ? "এন্ট্রি যোগ" : "Add entry"}
                </ErpButton>
              }
            />
                </div>
              </div>
        {!demo && (
          <SampleDataBanner tone="light" detail={lang === "bn" ? "মাসিক ক্যাশ চার্ট লাইভ নয়।" : "Monthly cash chart is not connected to live data."} />
        )}
      </ErpPageTemplate>
    </div>
  );
}

// ─── 2/3. Income / Expenses (shared template) ────────────────────────────────

function IncExpScreen({ type }: { type:"income"|"expenses" }) {
  const { lang } = useLang();
  const mock = type === "income" ? INCOME : EXPENSES;
  const color = type === "income" ? FIN : ERP.destructive;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sel, setSel] = useState<FinEntry | null>(null);
  const [page, setPage] = useState(1);
  const PAGE = 20;

  const kind = type === "income" ? "income" : "expense";
  const { data: live, loading, error, demo, refetch: refresh } = useLive<FinEntry[]>(`/finance/entries?kind=${kind}`);

  const data = demo ? mock : (live ?? []).map(e => ({ ...e, date: fmtDate(e.date) }));
  const filtered = data.filter(e => {
    const matchQ = !q || [e.entity, e.cat, e.id, e.group, e.ref].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || e.status === statusFilter;
    return matchQ && matchS;
  });
  const total = data.reduce((s, e) => s + e.amt, 0);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const [fRef, setFRef] = useState("");
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fEntity, setFEntity] = useState("");
  const [fCat, setFCat] = useState(type === "income" ? "Visa Services" : "Hotel Costs");
  const [fGroup, setFGroup] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPage(1); }, [q, statusFilter, type]);

  const save = async () => {
    if (!isLoggedIn()) {
      erpToast.success(lang === "bn" ? "এন্ট্রি সংরক্ষিত (ডেমো)" : "Journal entry saved (demo)", lang);
      setShowForm(false);
      return;
    }
    const amount = parseFloat(fAmount.replace(/,/g, ""));
    if (!fEntity.trim() || !amount) {
      erpToast.error(lang === "bn" ? "পক্ষ ও পরিমাণ প্রয়োজন" : "Entity and amount are required.", lang);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ id: string; status: string }>("/finance/entries", {
        kind: type === "income" ? "INCOME" : "EXPENSE",
        partyName: fEntity.trim(),
        category: fCat,
        amount,
        ref: fRef.trim() || undefined,
        groupId: fGroup.trim() || undefined,
        date: fDate || undefined,
        notes: fNotes.trim() || undefined,
      });
      erpToast.success(lang === "bn" ? `এন্ট্রি ${res.id} সংরক্ষিত` : `Entry ${res.id} saved`, lang);
      setFRef(""); setFEntity(""); setFGroup(""); setFAmount(""); setFNotes("");
      setShowForm(false);
      refresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "সংরক্ষণ ব্যর্থ" : "Failed to save entry"), lang);
    } finally {
      setSaving(false);
    }
  };

  const columns: ErpColumn<FinEntry>[] = [
    { id: "id", header: "ID", cell: (e) => <span className="text-[11px] font-mono font-bold" style={{ color }}>{e.id}</span> },
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (e) => <span className="text-[11px] font-mono">{e.date}</span> },
    { id: "ent", header: lang === "bn" ? "পক্ষ" : "Entity", cell: (e) => <span className="text-xs font-semibold truncate max-w-[140px] block" title={e.entity}>{e.entity}</span> },
    { id: "cat", header: lang === "bn" ? "ক্যাটাগরি" : "Category", cell: (e) => <span className="text-[11px]">{e.cat}</span> },
    { id: "amt", header: lang === "bn" ? "পরিমাণ" : "Amount", cell: (e) => <Amt v={e.amt} type={type === "income" ? "cr" : "dr"} /> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (e) => <ErpStatusChip status={finStatusKind(e.status)} label={e.status} lang={lang} /> },
  ];

  if (error && !demo) {
  return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={refresh} />
          </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={type === "income" ? (lang === "bn" ? "ইনকাম / ভাউচার" : "Income / Voucher") : (lang === "bn" ? "খরচ / পেমেন্ট" : "Expenses / Payment")}
        subtitle={`${fmtMoney(total)} · ${data.length} ${lang === "bn" ? "এন্ট্রি" : "entries"}`}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            {lang === "bn" ? "নতুন এন্ট্রি" : "Add Entry"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1 min-w-0">
              <ErpSearchBar
                lang={lang}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onClear={() => setQ("")}
                placeholder={lang === "bn" ? "পক্ষ, গ্রুপ বা রেফারেন্স লিখুন..." : "Search entity, group, or reference…"}
              />
            </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusFilter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {["all", "RECEIVED", "PAID", "PENDING", "OVERDUE"].map((st) => (
                  <ErpButton key={st} size="sm" variant={statusFilter === st ? "primary" : "outline"} onClick={() => setStatusFilter(st)}>
                    {st === "all" ? (lang === "bn" ? "সব" : "All") : st}
                  </ErpButton>
                ))}
          </div>
            </ErpFilterPanel>
        </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={loading && !demo ? [] : pageRows}
          rowKey={(e) => e.id}
          loading={loading && !demo}
          lang={lang}
          onRowClick={(e) => setSel(e)}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : `No ${type} entries`}
          emptyHint={lang === "bn" ? "নতুন এন্ট্রি যোগ করুন।" : `Posted ${type} entries appear here.`}
          emptyAction={
            <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>
              {lang === "bn" ? "নতুন তৈরি করুন" : "Create new"}
            </ErpButton>
          }
          rowActions={(e) => (
            <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(ev) => { ev.stopPropagation(); setSel(e); }}>
              {lang === "bn" ? "দেখুন" : "View"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>

      <ErpDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title={type === "income" ? (lang === "bn" ? "নতুন ইনকাম ভাউচার" : "New Income Voucher") : (lang === "bn" ? "নতুন পেমেন্ট" : "New Payment Entry")}
        lang={lang}
        footer={
          <ErpDrawerFooterActions
            lang={lang}
            onCancel={() => setShowForm(false)}
            onSave={() => void save()}
            saving={saving}
            saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save Entry"}
          />
        }
      >
        <ErpForm columns={2}>
          <ErpField label={lang === "bn" ? "রেফারেন্স" : "Reference"}>
            <ErpInput value={fRef} onChange={(e) => setFRef(e.target.value)} placeholder="INC- / EXP-" />
          </ErpField>
          <ErpField label={lang === "bn" ? "তারিখ" : "Date"}>
            <ErpInput type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </ErpField>
          <ErpFormRow span={2}>
            <ErpField label={lang === "bn" ? "পক্ষ" : "Entity"} required>
              <ErpInput value={fEntity} onChange={(e) => setFEntity(e.target.value)} />
            </ErpField>
          </ErpFormRow>
          <ErpField label={lang === "bn" ? "ক্যাটাগরি" : "Category"}>
            <ErpSelect value={fCat} onChange={(e) => setFCat(e.target.value)}>
              {(type === "income"
                ? ["Visa Services", "Hotel Services", "Transport Svcs", "Catering Svcs", "Full Package"]
                : ["Hotel Costs", "Transport Costs", "Catering Costs", "Salaries", "Overhead"]
              ).map((o) => <option key={o}>{o}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "গ্রুপ" : "Group"}>
            <ErpInput value={fGroup} onChange={(e) => setFGroup(e.target.value)} placeholder="GRP-…" />
          </ErpField>
          <ErpField label={lang === "bn" ? "পরিমাণ (SAR)" : "Amount (SAR)"} required>
            <ErpInput type="number" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
          </ErpField>
          <ErpFormRow span={2}>
            <ErpField label={lang === "bn" ? "নোট" : "Notes"}>
              <ErpTextarea rows={2} value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
            </ErpField>
          </ErpFormRow>
        </ErpForm>
      </ErpDrawer>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.id ?? ""}
        subtitle={sel?.entity}
        lang={lang}
        footer={<ErpButton variant="secondary" onClick={() => setSel(null)}>{lang === "bn" ? "বন্ধ" : "Close"}</ErpButton>}
      >
        {sel && (
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "তারিখ" : "Date", sel.date],
              [lang === "bn" ? "ক্যাটাগরি" : "Category", sel.cat],
              [lang === "bn" ? "গ্রুপ" : "Group", sel.group],
              [lang === "bn" ? "রেফ" : "Ref", sel.ref],
              [lang === "bn" ? "পরিমাণ" : "Amount", fmtMoney(sel.amt)],
              [lang === "bn" ? "স্ট্যাটাস" : "Status", sel.status],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                <dt style={{ color: ERP.muted }}>{k}</dt>
                <dd className="font-semibold text-[color:var(--erp-text-strong)]">{v}</dd>
                </div>
              ))}
          </dl>
        )}
      </ErpDrawer>
    </div>
  );
}

// ─── 4. Ledger (Agent / Supplier / GL) ───────────────────────────────────────

type LedTab = "agent"|"supplier"|"gl";

function LedgerScreen() {
  const [tab, setTab] = useState<LedTab>("agent");
  const [entity, setEntity] = useState("Rashidi Travel Co."); // fallback (mock) selection

  const agentList    = ["Rashidi Travel Co.","Al-Noor Pilgrim Svc","Zamzam Pilgrim Svc","Crown Hajj Tours","Makkah Tours Co."];
  const supplierList = ["Jabal Omar Hyatt","Al-Barakah Catering","Al-Naqil Transport","Movenpick Makkah"];
  const data  = tab === "agent" ? AGENT_LED : tab === "supplier" ? SUPPLIER_LED : null;
  const isGL  = tab === "gl";

  const demo = !isLoggedIn();
  const [entAgent, setEntAgent]       = useState<LedEntity[] | null>(null);
  const [entSupplier, setEntSupplier] = useState<LedEntity[] | null>(null);
  const [selId, setSelId]             = useState("");            // live companyId
  const [ledger, setLedger]           = useState<LedgerView | null>(null);
  const [gl, setGl]                   = useState<GLRow[] | null>(null);
  const [baseLoad, setBaseLoad]       = useState(!demo);   // entity lists + general ledger
  const [baseErr,  setBaseErr]        = useState(false);
  const [ledLoad,  setLedLoad]        = useState(!demo);   // per-entity ledger
  const [ledErr,   setLedErr]         = useState(false);
  const [reload,   setReload]         = useState(0);
  const retry = () => setReload(n => n + 1);

  useEffect(() => {
    if (!isLoggedIn()) { setBaseLoad(false); return; }
    let cancelled = false;
    setBaseLoad(true); setBaseErr(false);
    const t = setTimeout(() => {
      Promise.all([
        api.get<LedEntity[]>("/finance/ledger/entities?type=agent"),
        api.get<LedEntity[]>("/finance/ledger/entities?type=supplier"),
        api.get<GLRow[]>("/finance/ledger?type=gl"),
      ])
        .then(([a, s, g]) => { if (!cancelled) { setEntAgent(a); setEntSupplier(s); setGl(g); setBaseErr(false); } })
        .catch(() => { if (!cancelled) { setEntAgent(null); setEntSupplier(null); setGl(null); setBaseErr(true); } })
        .finally(() => { if (!cancelled) setBaseLoad(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const liveEnts = demo ? null : (tab === "agent" ? entAgent : tab === "supplier" ? entSupplier : null);
  const effId    = selId || liveEnts?.[0]?.companyId || "";

  useEffect(() => {
    if (isGL || demo) { setLedLoad(false); return; }
    if (baseLoad) return;                                             // wait for the entity list
    if (!liveEnts || liveEnts.length === 0) { setLedger(null); setLedLoad(false); return; }
    const id = selId || liveEnts[0].companyId;
    let cancelled = false;
    setLedLoad(true); setLedErr(false); setLedger(null);
    const t = setTimeout(() => {
      api.get<LedgerView>(`/finance/ledger?type=${tab}&companyId=${encodeURIComponent(id)}`)
        .then(v => { if (!cancelled) { setLedger(v); setLedErr(false); } })
        .catch(() => { if (!cancelled) { setLedger(null); setLedErr(true); } })
        .finally(() => { if (!cancelled) setLedLoad(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selId, entAgent, entSupplier, baseLoad, reload]);

  const changeTab = (t: LedTab) => { setTab(t); setSelId(""); setLedger(null); };

  const entityName = demo ? entity : (liveEnts?.find(x => x.companyId === effId)?.name ?? "—");
  const rows = demo
    ? (data ?? [])
    : (ledger ? ledger.entries.map(e => ({ date: fmtDate(e.date), desc: e.description, ref: e.ref, dr: e.debit, cr: e.credit, bal: e.balance })) : []);
  const closing = demo ? (data?.[data.length-1]?.bal ?? 0) : (ledger?.closingBalance ?? 0);
  const glRows = demo
    ? GL_DATA
    : (gl ?? []).map(e => ({ date: fmtDate(e.date), acct: `${e.account.code} — ${e.account.name}`, ref: e.ref, desc: e.description, dr: e.debit, cr: e.credit }));

  const glReady  = demo || (!baseLoad && !baseErr);
  const ledReady = demo || (!baseLoad && !baseErr && !ledLoad && !ledErr);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-3 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}`, backgroundColor:ERP.surface }}>
        {(["agent","supplier","gl"] as LedTab[]).map(t=>(
          <button key={t} onClick={()=>changeTab(t)} className="px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize"
            style={{ backgroundColor:tab===t?erpAlpha(FIN, 9):"transparent", color:tab===t?FIN:ERP.muted, border:`1px solid ${tab===t?erpAlpha(FIN, 19):"transparent"}` }}>
            {t==="gl"?"General Ledger":t==="agent"?"Agent Ledger":"Supplier Ledger"}
          </button>
        ))}
        {!isGL && (
          <div className="ml-4">
            <ErpSelect value={liveEnts ? effId : entity} onChange={e=> liveEnts ? setSelId(e.target.value) : setEntity(e.target.value)}>
              {liveEnts
                ? liveEnts.map(x=><option key={x.companyId} value={x.companyId}>{x.name}</option>)
                : (tab==="agent"?agentList:supplierList).map(e=><option key={e} value={e}>{e}</option>)}
            </ErpSelect>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <ActionBtn
            label="Export CSV"
            icon={Download}
            onClick={() => {
              if (isGL) {
                downloadCsv(
                  `gl-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Date", "Account", "Ref", "Description", "Debit", "Credit"],
                  glRows.map((r) => [r.date, r.acct, r.ref, r.desc, r.dr, r.cr]),
                );
              } else {
                downloadCsv(
                  `ledger-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Date", "Description", "Ref", "Debit", "Credit", "Balance"],
                  rows.map((r) => [r.date, r.desc, r.ref, r.dr, r.cr, r.bal]),
                );
              }
              erpToast.success("CSV downloaded");
            }}
          />
          <ActionBtn label="Print" icon={Printer} onClick={() => window.print()} />
        </div>
      </div>

      {/* Opening balance / header */}
      {!isGL && (
        <div className="flex items-center gap-6 px-6 py-3 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}`, backgroundColor:ERP.surface }}>
          <div className="min-w-0"><div className="text-[9px] uppercase tracking-widest" style={{ color:ERP.muted }}>Entity</div><div className="text-xs font-bold text-[color:var(--erp-text-strong)] truncate" title={entityName}>{entityName}</div></div>
          <div className="shrink-0"><div className="text-[9px] uppercase tracking-widest" style={{ color:ERP.muted }}>Period</div><div className="text-xs font-bold text-[color:var(--erp-text-strong)] whitespace-nowrap">Jun – Jul 2025</div></div>
          <div className="shrink-0"><div className="text-[9px] uppercase tracking-widest" style={{ color:ERP.muted }}>Closing Balance</div>
            <div className="text-xs font-bold whitespace-nowrap tabular-nums" style={{ color:FIN, fontFamily:"var(--font-mono)" }}>
              {ledReady ? `SAR ${closing.toLocaleString()}` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:`${ERP.mutedSoft} transparent` }}>
        {isGL ? (
          (baseErr && !demo) ? <div className="p-4"><ErrorState onRetry={retry} /></div> : (
          <ErpDataTable
            rows={glReady ? glRows : []}
            rowKey={(e) => `${e.date}-${e.ref}-${e.acct}-${e.dr}-${e.cr}`}
            loading={baseLoad && !demo}
            emptyTitle="No journal entries"
            emptyHint="Posted general-ledger lines appear here."
            columns={[
              { id:"date", header:"Date", cell:(e)=><span className="whitespace-nowrap" style={{ fontSize:ERP.text.size[10], color:ERP.muted, fontFamily:ERP.font.data }}>{e.date}</span> },
              { id:"acct", header:"Account", cell:(e)=><div className="truncate max-w-[16rem] text-[color:var(--erp-text-strong)]" style={{ fontSize:ERP.text.size[12] }} title={e.acct}>{e.acct}</div> },
              { id:"ref", header:"Reference", cell:(e)=><span className="whitespace-nowrap" style={{ fontSize:ERP.text.size[9], color:FIN, fontFamily:ERP.font.data }}>{e.ref}</span> },
              { id:"desc", header:"Description", cell:(e)=><div className="truncate max-w-[20rem]" style={{ fontSize:ERP.text.size[10], color:ERP.muted }} title={e.desc}>{e.desc}</div> },
              { id:"dr", header:"Debit", align:"right", cell:(e)=> e.dr>0?<Amt v={e.dr} type="dr" />:<span style={{ color:ERP.mutedSoft }}>—</span> },
              { id:"cr", header:"Credit", align:"right", cell:(e)=> e.cr>0?<Amt v={e.cr} type="cr" />:<span style={{ color:ERP.mutedSoft }}>—</span> },
            ]}
          />)
        ) : (
          ((baseErr || ledErr) && !demo) ? <div className="p-4"><ErrorState onRetry={retry} /></div> : (
          <ErpDataTable
            rows={ledReady ? rows : []}
            rowKey={(e) => `${e.date}-${e.ref}-${e.dr}-${e.cr}-${e.bal}`}
            loading={(baseLoad || ledLoad) && !demo}
            emptyTitle={!demo && liveEnts && liveEnts.length === 0 ? "No ledger accounts" : "No ledger entries"}
            emptyHint={!demo && liveEnts && liveEnts.length === 0 ? "Agents and suppliers appear here once onboarded." : "Postings against this entity appear here."}
            columns={[
              { id:"date", header:"Date", cell:(e)=><span className="whitespace-nowrap" style={{ fontSize:ERP.text.size[10], color:ERP.muted, fontFamily:ERP.font.data }}>{e.date}</span> },
              { id:"desc", header:"Description", cell:(e)=><div className="truncate max-w-[22rem] text-[color:var(--erp-text-strong)]" style={{ fontSize:ERP.text.size[12] }} title={e.desc}>{e.desc}</div> },
              { id:"ref", header:"Reference", cell:(e)=><span className="whitespace-nowrap" style={{ fontSize:ERP.text.size[9], color:FIN, fontFamily:ERP.font.data }}>{e.ref}</span> },
              { id:"dr", header:"Debit", align:"right", cell:(e)=> e.dr>0?<Amt v={e.dr} type="dr" />:<span style={{ color:ERP.mutedSoft }}>—</span> },
              { id:"cr", header:"Credit", align:"right", cell:(e)=> e.cr>0?<Amt v={e.cr} type="cr" />:<span style={{ color:ERP.mutedSoft }}>—</span> },
              { id:"bal", header:"Balance", align:"right", cell:(e)=><span style={{ fontSize:ERP.text.size[12], fontWeight:ERP.text.weight.bold, color:ERP.navy, fontFamily:ERP.font.data }}>SAR {e.bal.toLocaleString()}</span> },
            ]}
          />)
        )}
      </div>
    </div>
  );
}

// ─── 5/6. AR / AP (shared template) ──────────────────────────────────────────

type ArApEntity = { entity: string; cur: number; d30: number; d60: number; d90: number; total?: number };

function ARAPScreen({ type }: { type: "ar" | "ap" }) {
  const { lang } = useLang();
  const color = type === "ar" ? ERP.warning : ERP.destructive;
  const { data: live, loading, error, demo, refetch } = useLive<ARAPData>(`/finance/${type}`);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<"all" | "cur" | "d30" | "d60" | "d90">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<ArApEntity | null>(null);
  const PAGE = 20;

  const entities: ArApEntity[] = demo ? (type === "ar" ? AR_ENTITIES : AP_ENTITIES) : (live?.entities ?? []);
  const totals = demo ? null : (live?.totals ?? null);
  const sum = (k: "cur" | "d30" | "d60" | "d90") =>
    totals ? totals[k] : entities.reduce((s, e) => s + (e[k] as number), 0);
  const total = totals ? totals.total : entities.reduce((s, e) => s + e.cur + e.d30 + e.d60 + e.d90, 0);
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const buckets: [string, string, "cur" | "d30" | "d60" | "d90"][] = [
    [lang === "bn" ? "০–৩০ দিন" : "0–30 days", ERP.success, "cur"],
    [lang === "bn" ? "৩১–৬০" : "31–60 days", ERP.warning, "d30"],
    [lang === "bn" ? "৬১–৯০" : "61–90 days", CAT.orange, "d60"],
    [lang === "bn" ? "৯০+" : "90+ days", ERP.destructive, "d90"],
  ];

  const filtered = entities.filter((e) => {
    const matchQ = !q || e.entity.toLowerCase().includes(q.toLowerCase());
    const matchB = bucket === "all" || (e[bucket] as number) > 0;
    return matchQ && matchB;
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<ArApEntity>[] = [
    {
      id: "ent",
      header: type === "ar" ? (lang === "bn" ? "এজেন্ট" : "Agent") : (lang === "bn" ? "সাপ্লায়ার" : "Supplier"),
      cell: (e) => <span className="text-xs font-semibold truncate max-w-[160px] block" title={e.entity}>{e.entity}</span>,
    },
    { id: "cur", header: "0–30", cell: (e) => <Amt v={e.cur} /> },
    { id: "d30", header: "31–60", cell: (e) => <Amt v={e.d30} /> },
    { id: "d60", header: "61–90", cell: (e) => <Amt v={e.d60} /> },
    { id: "d90", header: "90+", cell: (e) => (e.d90 > 0 ? <Amt v={e.d90} type="dr" /> : <span style={{ color: ERP.mutedSoft }}>—</span>) },
    {
      id: "tot",
      header: lang === "bn" ? "মোট" : "Total",
      cell: (e) => (
        <span className="font-mono font-bold text-xs" style={{ color, fontFamily: "var(--font-mono)" }}>
          SAR {(e.cur + e.d30 + e.d60 + e.d90).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={type === "ar"
          ? (lang === "bn" ? "প্রাপ্য (AR)" : "Accounts Receivable")
          : (lang === "bn" ? "প্রদেয় (AP)" : "Accounts Payable")}
        subtitle={`${lang === "bn" ? "মোট" : "Total"}: ${fmtMoney(total)}`}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refetch}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {buckets.map(([l, c, k]) => {
                const v = sum(k);
                return (
                  <ErpStatCard
                    key={k}
                    value={`${pctOf(v)}%`}
                    accent={c}
                    label={`${l} · ${fmtMoney(v)}`}
                    onClick={() => { setBucket(k); setPage(1); }}
                  />
                );
              })}
        </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1">
                <ErpSearchBar
                  lang={lang}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  onClear={() => setQ("")}
                  placeholder={lang === "bn" ? "পক্ষ খুঁজুন…" : "Search party…"}
                />
        </div>
              <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={bucket === "all" ? 0 : 1}>
                <div className="flex flex-wrap gap-2">
                  <ErpButton size="sm" variant={bucket === "all" ? "primary" : "outline"} onClick={() => { setBucket("all"); setPage(1); }}>
                    {lang === "bn" ? "সব" : "All"}
                  </ErpButton>
                  {buckets.map(([l, , k]) => (
                    <ErpButton key={k} size="sm" variant={bucket === k ? "primary" : "outline"} onClick={() => { setBucket(k); setPage(1); }}>
                      {l}
                    </ErpButton>
                  ))}
      </div>
              </ErpFilterPanel>
            </div>
          </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error && !demo ? (
          <ErrorState tone="light" lang={lang} onRetry={refetch} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading && !demo ? [] : pageRows}
            rowKey={(e) => e.entity}
            loading={loading && !demo}
            lang={lang}
            onRowClick={(e) => setSel(e)}
            emptyTitle={type === "ar"
              ? (lang === "bn" ? "কোনো প্রাপ্য নেই" : "No outstanding receivables")
              : (lang === "bn" ? "কোনো প্রদেয় নেই" : "No outstanding payables")}
            emptyHint={type === "ar"
              ? (lang === "bn" ? "অপরিশোধিত এজেন্ট ইনভয়েস এখানে এজিং হবে।" : "Unpaid agent invoices will be aged here.")
              : (lang === "bn" ? "অনিষ্পন্ন সাপ্লায়ার ব্যালেন্স এখানে এজিং হবে।" : "Unsettled supplier balances will be aged here.")}
          />
        )}
      </ErpPageTemplate>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.entity ?? (type === "ar" ? "AR" : "AP")}
        lang={lang}
        footer={<ErpButton variant="secondary" onClick={() => setSel(null)}>{lang === "bn" ? "বন্ধ" : "Close"}</ErpButton>}
      >
        {sel && (
          <dl className="space-y-2 text-sm">
            {buckets.map(([l, c, k]) => (
              <div key={k} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                <dt style={{ color: ERP.muted }}>{l}</dt>
                <dd className="font-mono font-bold" style={{ color: c }}>SAR {(sel[k] as number).toLocaleString()}</dd>
      </div>
            ))}
            <div className="flex justify-between gap-3 pt-2 font-bold">
              <dt>{lang === "bn" ? "মোট" : "Total"}</dt>
              <dd className="font-mono" style={{ color }}>SAR {(sel.cur + sel.d30 + sel.d60 + sel.d90).toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </ErpDrawer>
    </div>
  );
}

// ─── 7. Cash & Bank ───────────────────────────────────────────────────────────

type BankTxn = { date: string; desc: string; ref: string; type: string; amount: number };

function CashBankScreen() {
  const { lang } = useLang();
  const { data: live, loading, error, demo, refetch } = useLive<CashData>("/finance/cash");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<BankTxn | null>(null);
  const PAGE = 20;

  // API supplies name+code+balance only — never fabricate IBAN on live rows.
  const banks = demo
    ? BANKS
    : (live?.accounts ?? []).map((a) => ({ name: a.name, balance: a.balance, acct: a.code, iban: "—" }));
  const txns: BankTxn[] = demo
    ? BANK_TXN
    : (live?.transactions ?? []).map((t) => ({ ...t, date: fmtDate(t.date) }));
  const bankTotal = demo ? BANKS.reduce((s, b) => s + b.balance, 0) : (live?.total ?? 0);

  const filtered = txns.filter((t) => {
    const matchQ = !q || [t.desc, t.ref, t.date].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchT = typeFilter === "all" || t.type === typeFilter;
    return matchQ && matchT;
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<BankTxn>[] = [
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (t) => <span className="text-[11px] font-mono">{t.date}</span> },
    { id: "desc", header: lang === "bn" ? "বিবরণ" : "Description", cell: (t) => <span className="text-xs truncate max-w-[180px] block" title={t.desc}>{t.desc}</span> },
    { id: "ref", header: lang === "bn" ? "রেফ" : "Ref", cell: (t) => <span className="text-[10px] font-mono" style={{ color: FIN }}>{t.ref}</span> },
    {
      id: "type",
      header: lang === "bn" ? "ধরন" : "Type",
      cell: (t) => (
        <ErpStatusChip
          status={t.type === "cr" ? "approved" : "rejected"}
          label={t.type === "cr" ? "CREDIT" : "DEBIT"}
          lang={lang}
        />
      ),
    },
    { id: "amt", header: lang === "bn" ? "পরিমাণ" : "Amount", cell: (t) => <Amt v={t.amount} type={t.type as "cr" | "dr"} /> },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "নগদ ও ব্যাংক" : "Cash & Bank"}
        subtitle={`${lang === "bn" ? "মোট অবস্থান" : "Total position"}: ${fmtMoney(bankTotal)}`}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refetch}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            {banks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {banks.map((b) => (
                  <div key={b.name} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Building size={14} style={{ color: FIN }} />
                      <ErpStatusChip status="approved" label="ACTIVE" lang={lang} />
      </div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: FIN, fontFamily: "var(--font-mono)" }}>{fmtMoney(b.balance)}</div>
                    <div className="text-[11px] font-semibold text-[color:var(--erp-text-strong)] truncate" title={b.name}>{b.name}</div>
                    <div className="text-[10px] truncate" style={{ color: ERP.muted }}>{b.acct}</div>
            </div>
                ))}
          </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1">
                <ErpSearchBar
                  lang={lang}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  onClear={() => setQ("")}
                  placeholder={lang === "bn" ? "লেনদেন বা রেফ…" : "Transaction or ref…"}
                />
              </div>
              <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={typeFilter === "all" ? 0 : 1}>
                <div className="flex flex-wrap gap-2">
                  {(["all", "cr", "dr"] as const).map((st) => (
                    <ErpButton key={st} size="sm" variant={typeFilter === st ? "primary" : "outline"} onClick={() => { setTypeFilter(st); setPage(1); }}>
                      {st === "all" ? (lang === "bn" ? "সব" : "All") : st === "cr" ? "CREDIT" : "DEBIT"}
                    </ErpButton>
        ))}
      </div>
              </ErpFilterPanel>
            </div>
          </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error && !demo ? (
          <ErrorState tone="light" lang={lang} onRetry={refetch} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading && !demo ? [] : pageRows}
            rowKey={(t) => `${t.ref}-${t.date}-${t.amount}-${t.desc}`}
            loading={loading && !demo}
            lang={lang}
            onRowClick={(t) => setSel(t)}
            emptyTitle={lang === "bn" ? "কোনো লেনদেন নেই" : "No bank transactions"}
            emptyHint={lang === "bn" ? "নিষ্পন্ন রসিদ ও বিতরণ এখানে দেখা যাবে।" : "Settled receipts and disbursements appear here."}
          />
        )}
      </ErpPageTemplate>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.ref ?? (lang === "bn" ? "লেনদেন" : "Transaction")}
        lang={lang}
        footer={<ErpButton variant="secondary" onClick={() => setSel(null)}>{lang === "bn" ? "বন্ধ" : "Close"}</ErpButton>}
      >
        {sel && (
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "তারিখ" : "Date", sel.date],
              [lang === "bn" ? "বিবরণ" : "Description", sel.desc],
              [lang === "bn" ? "রেফ" : "Reference", sel.ref],
              [lang === "bn" ? "ধরন" : "Type", sel.type === "cr" ? "CREDIT" : "DEBIT"],
              [lang === "bn" ? "পরিমাণ" : "Amount", `SAR ${sel.amount.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                <dt style={{ color: ERP.muted }}>{k}</dt>
                <dd className="font-semibold text-[color:var(--erp-text-strong)] text-right">{v}</dd>
        </div>
            ))}
          </dl>
        )}
      </ErpDrawer>
    </div>
  );
}

// ─── 8. Multi-Currency ────────────────────────────────────────────────────────

function ForexScreen() {
  const [fromCur, setFromCur] = useState("USD");
  const [toCur,   setToCur]   = useState("SAR");
  const [amount,  setAmount]  = useState("10000");

  const { data: live, loading, error, demo, refetch } = useLive<ForexRate[]>("/finance/currencies");

  const rates = demo
    ? FX_RATES
    : (live ?? []).map(r => {
        const m = FX_RATES.find(f => f.code === r.currency);
        return { code:r.currency, name:m?.name ?? r.currency, sar:r.rateToSar, change:m?.change ?? 0, exposure:m?.exposure ?? "—" };
      });
  const ready = demo || (!loading && !error);

  const fromRate = rates.find(r=>r.code===fromCur)?.sar ?? 1;
  const toRate   = rates.find(r=>r.code===toCur)?.sar ?? 1;
  const converted = (parseFloat(amount.replace(/,/g,"")||"0") * fromRate / toRate).toLocaleString("en-US", { maximumFractionDigits:2 });

  return (
    <div className="p-7 grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <div><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Multi-Currency</h2><p className="text-xs mt-0.5" style={{ color:ERP.muted }}>Live rates · SAR, BDT, USD exposures · Season 1446H</p></div>
        <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${ERP.border}` }}>
          {(error && !demo) ? <div className="p-4"><ErrorState onRetry={refetch} /></div> : (
          <ErpDataTable
            flush
            rows={ready ? rates : []}
            rowKey={(r) => r.code}
            loading={loading && !demo}
            emptyTitle="No currency rates"
            emptyHint="Configured currencies and their SAR rates appear here."
            columns={[
              { id:"cur", header:"Currency", cell:(r)=><div className="truncate max-w-[14rem] font-semibold text-[color:var(--erp-text-strong)]" style={{ fontSize:ERP.text.size[12] }} title={r.name}>{r.name}</div> },
              { id:"code", header:"Code", cell:(r)=><ErpBadge color={FIN} size="sm">{r.code}</ErpBadge> },
              { id:"rate", header:"Rate (to SAR)", cell:(r)=><span className="whitespace-nowrap text-[color:var(--erp-text-strong)]" style={{ fontSize:ERP.text.size[12], fontWeight:ERP.text.weight.bold, fontFamily:ERP.font.data }}>SAR {r.sar.toFixed(4)}</span> },
              { id:"change", header:"Change", cell:(r)=> r.change !== 0 ? <span className="flex items-center gap-1" style={{ fontSize:ERP.text.size[10], fontWeight:ERP.text.weight.bold, color:r.change>0?ERP.success:ERP.destructive }}>{r.change>0?<ArrowUp size={9}/>:<ArrowDown size={9}/>}{Math.abs(r.change).toFixed(4)}</span> : <span style={{ color:ERP.mutedSoft }}>—</span> },
              { id:"exp", header:"Exposure", cell:(r)=><span className="whitespace-nowrap" style={{ fontSize:ERP.text.size[10], color:ERP.muted }}>{r.exposure}</span> },
              { id:"act", header:"Action", cell:()=><ErpButton variant="outline" size="sm" style={{ backgroundColor:erpAlpha(FIN, 7), color:FIN, border:`1px solid ${erpAlpha(FIN, 19)}` }}>Convert</ErpButton> },
            ]}
          />)}
        </div>
      </div>

      {/* Converter */}
      <div className="space-y-4">
        <div className="rounded-xl p-5" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}` }}>
          <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-4">Currency Converter</div>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color:ERP.muted }}>From</label>
              <div className="flex gap-2">
                <ErpSelect value={fromCur} onChange={e=>setFromCur(e.target.value)}>
                  {rates.map(r=><option key={r.code}>{r.code}</option>)}
                </ErpSelect>
                <ErpInput type="text" value={amount} onChange={e=>setAmount(e.target.value)} className="flex-1" style={{ textAlign:"right", fontFamily:ERP.font.data }} />
              </div>
            </div>
            <div className="flex justify-center py-1">
              <ErpButton variant="ghost" size="sm" onClick={()=>{ setFromCur(toCur); setToCur(fromCur); }} style={{ backgroundColor:erpAlpha(FIN, 13), color:ERP.navy }}>⇅</ErpButton>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color:ERP.muted }}>To</label>
              <div className="flex gap-2">
                <ErpSelect value={toCur} onChange={e=>setToCur(e.target.value)}>
                  {rates.map(r=><option key={r.code}>{r.code}</option>)}
                </ErpSelect>
                <div className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono text-right font-bold" style={{ backgroundColor:`${erpAlpha(FIN, 6)}`, border:`1px solid ${erpAlpha(FIN, 19)}`, color:FIN, fontFamily:"var(--font-mono)" }}>
                  {converted}
                </div>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
              <div className="text-[10px]" style={{ color:ERP.muted }}>1 {fromCur} = {(fromRate/toRate).toFixed(4)} {toCur}</div>
              <div className="text-[9px] mt-0.5" style={{ color:ERP.mutedSoft }}>Rate as of 16 Jul 2025</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor:`${erpAlpha(FIN, 3)}`, border:`1px solid ${erpAlpha(FIN, 13)}` }}>
          <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:FIN }}>BDT Exposure Note</div>
          <div className="text-[10px]" style={{ color:ERP.muted }}>BDT 12.4M in agent balances is the largest foreign-currency exposure. Exchange risk is partially hedged via advance booking contracts.</div>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Invoices ──────────────────────────────────────────────────────────────

type InvRow = {
  id: string; realId: string | null; fileId: string | null; date: string; to: string; toAddr: string;
  group: string; items: { desc: string; qty: number; unit: number; total: number }[];
  subtotal: number; vat: number; total: number; status: string;
};

function InvoicesScreen() {
  const { lang } = useLang();
  const { data: live, loading, error, demo, refetch: refresh } = useLive<ApiInvoice[]>("/finance/invoices");
  const [busy, setBusy] = useState<"pdf" | "pay" | "create" | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<InvRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [agents, setAgents] = useState<LedEntity[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [itemDesc, setItemDesc] = useState("Umrah package services");
  const [itemQty, setItemQty] = useState("1");
  const [itemUnit, setItemUnit] = useState("");
  const [notes, setNotes] = useState("");
  const PAGE = 20;

  useEffect(() => {
    if (!showCreate || !isLoggedIn()) return;
    api.get<LedEntity[]>("/finance/ledger/entities?type=agent")
      .then((rows) => {
        setAgents(rows);
        if (!tenantId && rows[0]) setTenantId(rows[0].companyId);
      })
      .catch(() => setAgents([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate]);

  const createInvoice = async () => {
    if (demo || !isLoggedIn()) {
      erpToast.error(lang === "bn" ? "সাইন ইন করুন" : "Sign in as finance staff", lang);
      return;
    }
    const qty = Math.max(1, Number(itemQty) || 1);
    const unit = Number(itemUnit);
    if (!tenantId.trim()) {
      erpToast.error(lang === "bn" ? "এজেন্ট নির্বাচন করুন" : "Select an agent tenant", lang);
      return;
    }
    if (!itemDesc.trim() || Number.isNaN(unit) || unit < 0) {
      erpToast.error(lang === "bn" ? "বর্ণনা ও ইউনিট মূল্য আবশ্যক" : "Description and unit price required", lang);
      return;
    }
    setBusy("create");
    try {
      await api.post("/finance/invoices", {
        tenantId: tenantId.trim(),
        notes: notes.trim() || undefined,
        items: [{ desc: itemDesc.trim(), qty, unit }],
      });
      erpToast.success(lang === "bn" ? "ইনভয়েস তৈরি হয়েছে" : "Invoice created", lang);
      setShowCreate(false);
      setItemUnit("");
      setNotes("");
      refresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "তৈরি ব্যর্থ" : "Create failed"), lang);
    } finally {
      setBusy(null);
    }
  };

  const invoices: InvRow[] = demo
    ? INVOICES_LIST.map(v => ({ ...v, realId: null, fileId: null, vat: v.vat }))
    : (live ?? []).map(v => ({
      id: v.code, realId: v.id, fileId: v.fileId, date: fmtDate(v.issueDate), to: v.tenant,
      toAddr: v.toAddr, group: v.group, items: v.items, subtotal: v.subtotal, vat: v.vatAmount,
      total: v.total, status: v.status,
    }));

  const filtered = invoices.filter((i) => {
    const matchQ = !q || [i.id, i.to, i.group].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || i.status === statusFilter;
    return matchQ && matchS;
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const downloadPdf = async () => {
    if (!sel?.fileId) { erpToast.error(lang === "bn" ? "PDF নেই" : "No PDF available for this invoice.", lang); return; }
    setBusy("pdf");
    try {
      const url = await api.fileBlobUrl(sel.fileId);
      window.open(url, "_blank");
    } catch {
      erpToast.error(lang === "bn" ? "PDF ডাউনলোড ব্যর্থ" : "Could not download PDF.", lang);
    } finally {
      setBusy(null);
    }
  };
  const markPaid = async () => {
    if (!isLoggedIn() || !sel?.realId) {
      erpToast.error(lang === "bn" ? "ফাইন্যান্স স্টাফ হিসেবে সাইন ইন করুন" : "Sign in as finance staff to update invoices.", lang);
      return;
    }
    setBusy("pay");
    try {
      await api.patch(`/finance/invoices/${sel.realId}/pay`, {});
      erpToast.success(lang === "bn" ? `${sel.id} পেইড` : `Invoice ${sel.id} marked paid`, lang);
      setSel(null);
      refresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "পেইড করা যায়নি" : "Could not mark invoice paid."), lang);
    } finally {
      setBusy(null);
    }
  };

  const columns: ErpColumn<InvRow>[] = [
    { id: "id", header: "ID", cell: (i) => <span className="text-[11px] font-mono font-bold" style={{ color: FIN }}>{i.id}</span> },
    { id: "to", header: lang === "bn" ? "পক্ষ" : "Bill To", cell: (i) => <span className="text-xs font-semibold truncate max-w-[140px] block">{i.to}</span> },
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (i) => <span className="text-[11px]">{i.date}</span> },
    { id: "tot", header: lang === "bn" ? "মোট" : "Total", cell: (i) => <span className="text-xs font-mono font-bold">{fmtMoney(i.total)}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (i) => <ErpStatusChip status={finStatusKind(i.status)} label={i.status} lang={lang} /> },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ইনভয়েস" : "Invoices"}
        subtitle={lang === "bn" ? "এজেন্ট ইনভয়েস · বিদ্যমান API" : "Agent invoices · existing API"}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <ErpButton
              variant="outline"
              icon={<Download size={14} />}
              disabled={!filtered.length}
              onClick={() => {
                downloadCsv(
                  `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Code", "Bill To", "Date", "Group", "Total", "Status"],
                  filtered.map((i) => [i.id, i.to, i.date, i.group, i.total, i.status]),
                );
                erpToast.success(lang === "bn" ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded", lang);
              }}
            >
              {lang === "bn" ? "এক্সপোর্ট CSV" : "Export CSV"}
            </ErpButton>
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refresh}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
            <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreate(true)} disabled={demo}>
              {lang === "bn" ? "নতুন ইনভয়েস" : "New Invoice"}
            </ErpButton>
        </div>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
                placeholder={lang === "bn" ? "ইনভয়েস, পক্ষ বা গ্রুপ…" : "Invoice, party, or group…"} />
              </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusFilter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {["all", "OUTSTANDING", "PAID", "OVERDUE", "DRAFT"].map((st) => (
                  <ErpButton key={st} size="sm" variant={statusFilter === st ? "primary" : "outline"} onClick={() => { setStatusFilter(st); setPage(1); }}>
                    {st === "all" ? (lang === "bn" ? "সব" : "All") : st}
                  </ErpButton>
                ))}
        </div>
            </ErpFilterPanel>
      </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error && !demo ? (
          <ErrorState tone="light" lang={lang} onRetry={refresh} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading && !demo ? [] : pageRows}
            rowKey={(i) => i.id}
            loading={loading && !demo}
            lang={lang}
            onRowClick={(i) => setSel(i)}
            emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No invoices yet"}
            emptyHint={lang === "bn" ? "ইস্যুকৃত ইনভয়েস এখানে দেখা যাবে।" : "Issued agent invoices appear here."}
            rowActions={(i) => (
              <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(e) => { e.stopPropagation(); setSel(i); }}>
                {lang === "bn" ? "খুলুন" : "Open"}
              </ErpButton>
            )}
          />
        )}
      </ErpPageTemplate>

      <ErpDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={lang === "bn" ? "নতুন ইনভয়েস" : "New Invoice"}
        lang={lang}
        footer={
          <ErpDrawerFooterActions
            lang={lang}
            onCancel={() => setShowCreate(false)}
            onSave={createInvoice}
            saving={busy === "create"}
            saveLabel={lang === "bn" ? "তৈরি করুন" : "Create"}
          />
        }
      >
        <ErpForm columns={2}>
          <ErpFormRow span={2}>
            <ErpField label={lang === "bn" ? "এজেন্ট" : "Agent tenant"} required>
              <ErpSelect value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">—</option>
                {agents.map((a) => (
                  <option key={a.companyId} value={a.companyId}>{a.name} ({a.code})</option>
                ))}
              </ErpSelect>
            </ErpField>
          </ErpFormRow>
          <ErpFormRow span={2}>
            <ErpField label={lang === "bn" ? "লাইন বর্ণনা" : "Line description"} required>
              <ErpInput value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </ErpField>
          </ErpFormRow>
          <ErpField label={lang === "bn" ? "পরিমাণ" : "Qty"} required>
            <ErpInput type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
          </ErpField>
          <ErpField label={lang === "bn" ? "ইউনিট (SAR)" : "Unit (SAR)"} required>
            <ErpInput type="number" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} />
          </ErpField>
          <ErpFormRow span={2}>
            <ErpField label={lang === "bn" ? "নোট" : "Notes"}>
              <ErpTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </ErpField>
          </ErpFormRow>
        </ErpForm>
      </ErpDrawer>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.id ?? (lang === "bn" ? "ইনভয়েস" : "Invoice")}
        subtitle={sel?.to}
        lang={lang}
        maxWidth={720}
        footer={
          <div className="flex flex-wrap gap-2 justify-end w-full">
            <ErpButton variant="secondary" onClick={() => setSel(null)}>{lang === "bn" ? "বন্ধ" : "Close"}</ErpButton>
            <ErpButton variant="outline" icon={<Download size={14} />} disabled={busy !== null} onClick={() => void downloadPdf()}>
              PDF
            </ErpButton>
            <ErpButton variant="primary" icon={<CheckCircle size={14} />} disabled={busy !== null} onClick={() => void markPaid()}>
              {lang === "bn" ? "পেইড চিহ্নিত" : "Mark Paid"}
            </ErpButton>
            </div>
        }
      >
        {sel && (
          <div className="space-y-3">
            <FinDoc type="INVOICE" docNo={sel.id} date={sel.date}>
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                <div>
                  <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Bill To</div>
                  <div className="text-sm font-black">{sel.to}</div>
                  <div className="text-[10px] text-gray-500">{sel.toAddr}</div>
                  <div className="text-[10px] text-gray-500">Group: {sel.group}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Bill From</div>
                  <div className="text-sm font-black">TUBA AL HIJAZ</div>
            </div>
          </div>
          <DocTable
                cols={["Description", "Qty", "Unit", "Total"]}
                rows={sel.items.map((it) => [
              <span key="d">{it.desc}</span>,
                  <span key="q" style={{ fontFamily: "var(--font-mono)" }}>{it.qty}</span>,
                  <span key="u" style={{ fontFamily: "var(--font-mono)" }}>SAR {it.unit.toLocaleString()}</span>,
                  <span key="t" style={{ fontFamily: "var(--font-mono)", fontWeight: ERP.text.weight.bold }}>SAR {it.total.toLocaleString()}</span>,
            ])}
          />
              <div className="flex justify-end mt-2">
                <div className="w-56 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{fmtMoney(sel.subtotal)}</span></div>
                  <div className="flex justify-between"><span>VAT</span><span className="font-mono">{fmtMoney(sel.vat)}</span></div>
                  <div className="flex justify-between font-bold" style={{ color: FIN }}><span>Total</span><span className="font-mono">{fmtMoney(sel.total)}</span></div>
                </div>
          </div>
        </FinDoc>
            <ErpStatusChip status={finStatusKind(sel.status)} label={sel.status} lang={lang} />
        </div>
        )}
      </ErpDrawer>
    </div>
  );
}

// ─── 10. Receipts ─────────────────────────────────────────────────────────────

type RecRow = {
  id: string; date: string; from: string; fromAddr: string; amount: number;
  method: string; bankRef: string; applies: string; status: string;
};

function ReceiptsScreen() {
  const { lang } = useLang();
  const { data: live, loading, error, demo, refetch: refresh } = useLive<ApiReceipt[]>("/finance/receipts");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<RecRow | null>(null);
  const PAGE = 20;

  const receipts: RecRow[] = demo
    ? RECEIPTS_LIST
    : (live ?? []).map(r => ({
      id: r.code, date: fmtDate(r.date), from: r.from, fromAddr: r.fromAddr,
      amount: r.amount, method: r.method, bankRef: r.bankRef, applies: r.applies, status: r.status,
    }));

  const filtered = receipts.filter((r) => {
    const matchQ = !q || [r.id, r.from, r.applies, r.bankRef].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || r.status === statusFilter;
    return matchQ && matchS;
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<RecRow>[] = [
    { id: "id", header: "ID", cell: (r) => <span className="text-[11px] font-mono font-bold" style={{ color: FIN }}>{r.id}</span> },
    { id: "from", header: lang === "bn" ? "প্রাপ্ত" : "From", cell: (r) => <span className="text-xs font-semibold truncate max-w-[140px] block">{r.from}</span> },
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (r) => <span className="text-[11px]">{r.date}</span> },
    { id: "amt", header: lang === "bn" ? "পরিমাণ" : "Amount", cell: (r) => <span className="text-xs font-mono font-bold" style={{ color: ERP.success }}>{fmtMoney(r.amount)}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={finStatusKind(r.status)} label={r.status} lang={lang} /> },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "রসিদ" : "Receipts"}
        subtitle={lang === "bn" ? "নিশ্চিত পেমেন্ট · বিদ্যমান API" : "Confirmed payments · existing API"}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refresh}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
                placeholder={lang === "bn" ? "রসিদ, পক্ষ বা ব্যাংক রেফ…" : "Receipt, party, or bank ref…"} />
              </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusFilter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {["all", "CONFIRMED", "PENDING"].map((st) => (
                  <ErpButton key={st} size="sm" variant={statusFilter === st ? "primary" : "outline"} onClick={() => { setStatusFilter(st); setPage(1); }}>
                    {st === "all" ? (lang === "bn" ? "সব" : "All") : st}
                  </ErpButton>
                ))}
        </div>
            </ErpFilterPanel>
      </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error && !demo ? (
          <ErrorState tone="light" lang={lang} onRetry={refresh} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading && !demo ? [] : pageRows}
            rowKey={(r) => r.id}
            loading={loading && !demo}
            lang={lang}
            onRowClick={(r) => setSel(r)}
            emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No receipts yet"}
            emptyHint={lang === "bn" ? "নিশ্চিত এজেন্ট পেমেন্ট এখানে দেখা যাবে।" : "Confirmed agent payments appear here."}
            rowActions={(r) => (
              <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(e) => { e.stopPropagation(); setSel(r); }}>
                {lang === "bn" ? "খুলুন" : "Open"}
              </ErpButton>
            )}
          />
        )}
      </ErpPageTemplate>

      <ErpDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.id ?? (lang === "bn" ? "রসিদ" : "Receipt")}
        subtitle={sel?.from}
        lang={lang}
        footer={<ErpButton variant="secondary" onClick={() => setSel(null)}>{lang === "bn" ? "বন্ধ" : "Close"}</ErpButton>}
      >
        {sel && (
          <FinDoc type="PAYMENT RECEIPT" docNo={sel.id} date={sel.date}>
            <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: `${erpAlpha(FIN, 3)}`, border: `1px solid ${erpAlpha(FIN, 15)}` }}>
              <div className="text-[9px] text-gray-400 mb-1">{lang === "bn" ? "প্রাপ্ত পরিমাণ" : "Amount Received"}</div>
              <div className="text-2xl font-black" style={{ color: FIN, fontFamily: "var(--font-mono)" }}>{fmtMoney(sel.amount)}</div>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                [lang === "bn" ? "পদ্ধতি" : "Method", sel.method],
                [lang === "bn" ? "ব্যাংক রেফ" : "Bank Ref", sel.bankRef],
                [lang === "bn" ? "প্রয়োগ" : "Applies To", sel.applies],
                [lang === "bn" ? "ঠিকানা" : "Address", sel.fromAddr],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>{k}</dt>
                  <dd className="font-semibold text-[color:var(--erp-text-strong)] text-right">{v}</dd>
            </div>
          ))}
            </dl>
            <div className="mt-3"><ErpStatusChip status={finStatusKind(sel.status)} label={sel.status} lang={lang} /></div>
        </FinDoc>
        )}
      </ErpDrawer>
    </div>
  );
}

// ─── 11. Statements ───────────────────────────────────────────────────────────

function StatementsScreen() {
  const [entity, setEntity] = useState("Rashidi Travel Co."); // fallback (mock) selection
  const [period, setPeriod] = useState("Jun – Jul 2025");

  const demo = !isLoggedIn();
  const [entAgent, setEntAgent]       = useState<LedEntity[] | null>(null);
  const [entSupplier, setEntSupplier] = useState<LedEntity[] | null>(null);
  const [selId, setSelId]             = useState("");
  const [stmt, setStmt]               = useState<LedgerView | null>(null);
  const [entLoad, setEntLoad]         = useState(!demo);
  const [entErr,  setEntErr]          = useState(false);
  const [stmtLoad, setStmtLoad]       = useState(!demo);
  const [stmtErr,  setStmtErr]        = useState(false);
  const [reload,   setReload]         = useState(0);
  const retry = () => setReload(n => n + 1);

  useEffect(() => {
    if (!isLoggedIn()) { setEntLoad(false); return; }
    let cancelled = false;
    setEntLoad(true); setEntErr(false);
    const t = setTimeout(() => {
      Promise.all([
        api.get<LedEntity[]>("/finance/ledger/entities?type=agent"),
        api.get<LedEntity[]>("/finance/ledger/entities?type=supplier"),
      ])
        .then(([a, s]) => { if (!cancelled) { setEntAgent(a); setEntSupplier(s); setEntErr(false); } })
        .catch(() => { if (!cancelled) { setEntAgent(null); setEntSupplier(null); setEntErr(true); } })
        .finally(() => { if (!cancelled) setEntLoad(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const liveOpts: { companyId:string; name:string; type:"agent"|"supplier" }[] | null =
    demo ? null
      : (entAgent || entSupplier)
        ? [ ...(entAgent??[]).map(e => ({ companyId:e.companyId, name:e.name, type:"agent" as const })),
            ...(entSupplier??[]).map(e => ({ companyId:e.companyId, name:e.name, type:"supplier" as const })) ]
        : null;
  const effOpt = liveOpts ? (liveOpts.find(o => o.companyId === selId) ?? liveOpts[0]) : null;

  const loadStmt = () => {
    if (demo || !liveOpts || liveOpts.length === 0) { toast.success("Statement generated"); return; }
    const o = liveOpts.find(x => x.companyId === selId) ?? liveOpts[0];
    setStmtLoad(true); setStmtErr(false);
    api.get<LedgerView>(`/finance/statements?type=${o.type}&companyId=${encodeURIComponent(o.companyId)}`)
      .then(v => { setStmt(v); setStmtErr(false); toast.success("Statement generated"); })
      .catch(() => { setStmt(null); setStmtErr(true); toast.error("Could not generate statement"); })
      .finally(() => setStmtLoad(false));
  };
  useEffect(() => {
    if (demo) { setStmtLoad(false); return; }
    if (entLoad) return;                                             // wait for the entity list
    if (!liveOpts || liveOpts.length === 0) { setStmt(null); setStmtLoad(false); return; }
    const o = liveOpts.find(x => x.companyId === selId) ?? liveOpts[0];
    let cancelled = false;
    setStmtLoad(true); setStmtErr(false); setStmt(null);
    const t = setTimeout(() => {
      api.get<LedgerView>(`/finance/statements?type=${o.type}&companyId=${encodeURIComponent(o.companyId)}`)
        .then(v => { if (!cancelled) { setStmt(v); setStmtErr(false); } })
        .catch(() => { if (!cancelled) { setStmt(null); setStmtErr(true); } })
        .finally(() => { if (!cancelled) setStmtLoad(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, entAgent, entSupplier, entLoad, reload]);

  const mockEntries = entity === "Rashidi Travel Co." ? AGENT_LED : SUPPLIER_LED;
  const entityName  = demo ? entity : (effOpt?.name ?? "—");
  const loading = !demo && (entLoad || stmtLoad);
  const error   = !demo && (entErr  || stmtErr);
  const ready   = demo || (!loading && !error);
  const entries = demo
    ? mockEntries
    : (stmt?.entries.map(e => ({ date:fmtDate(e.date), desc:e.description, ref:e.ref, dr:e.debit, cr:e.credit, bal:e.balance })) ?? []);
  const opening = demo ? mockEntries[0].bal                                        : (stmt?.openingBalance ?? 0);
  const credits = demo ? mockEntries.filter(e=>e.cr>0).reduce((s,e)=>s+e.cr,0)     : (stmt?.totalCredits   ?? 0);
  const debits  = demo ? mockEntries.filter(e=>e.dr>0).reduce((s,e)=>s+e.dr,0)     : (stmt?.totalDebits    ?? 0);
  const closing = demo ? mockEntries[mockEntries.length-1].bal                     : (stmt?.closingBalance ?? 0);

  return (
    <div className="grid grid-cols-5 gap-0 h-full overflow-hidden">
      <div className="col-span-2 p-5 space-y-4 overflow-y-auto" style={{ borderRight:`1px solid ${ERP.border}` }}>
        <div className="text-xs font-bold text-[color:var(--erp-text-strong)]">Generate Statement</div>
        {[
          { l:"Entity", el:<ErpSelect value={liveOpts ? (effOpt?.companyId ?? "") : entity} onChange={e=> liveOpts ? setSelId(e.target.value) : setEntity(e.target.value)}>{liveOpts ? liveOpts.map(o=><option key={o.companyId} value={o.companyId}>{o.name}</option>) : ["Rashidi Travel Co.","Al-Noor Pilgrim Svc","Zamzam Pilgrim Svc","Jabal Omar Hyatt","Al-Barakah Catering"].map(e=><option key={e} value={e}>{e}</option>)}</ErpSelect> },
          { l:"Period",  el:<ErpSelect value={period} onChange={e=>setPeriod(e.target.value)}>{["Jun – Jul 2025","May – Jun 2025","Q2 2025","Full Season 1446H"].map(p=><option key={p}>{p}</option>)}</ErpSelect> },
          { l:"Format",  el:<ErpSelect ><option>Full Statement</option><option>Summary</option><option>Outstanding Only</option></ErpSelect> },
        ].map(({l,el})=>(
          <div key={l}><label className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color:ERP.muted }}>{l}</label>{el}</div>
        ))}
        <ErpButton variant="primary" onClick={()=>loadStmt()} loading={loading} style={{ width:"100%", backgroundColor:FIN, color:ERP.primaryFg }}>Generate Statement</ErpButton>
        <div className="mt-4 space-y-2">
          {[["Opening Balance",opening],["Total Credits",credits],["Total Debits",debits],["Closing Balance",closing]].map(([l,v])=>(
            <div key={l as string} className="flex justify-between gap-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}` }}>
              <span className="text-[10px] min-w-0 truncate" style={{ color:ERP.muted }}>{l}</span>
              <span className="text-[10px] font-bold font-mono text-[color:var(--erp-text-strong)] shrink-0 whitespace-nowrap tabular-nums" style={{ fontFamily:"var(--font-mono)" }}>{ready ? `SAR ${(v as number).toLocaleString()}` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-3 overflow-y-auto p-6">
        <FinDoc type="ACCOUNT STATEMENT" docNo={`STMT-${entityName.substring(0,4).toUpperCase()}-JUL25`} date="16 Jul 2025">
          <div className="mb-4 pb-4" style={{ borderBottom:`1px solid ${ERP.border}` }}>
            <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">Statement For</div>
            <div className="text-sm font-black text-gray-900">{entityName}</div>
            <div className="text-[10px] text-gray-500">Period: {period}</div>
          </div>
          <table className="w-full text-xs mb-4">
            <thead><tr style={{ backgroundColor:ERP.surfaceSoft, borderBottom:`1px solid ${ERP.border}` }}>
              {["Date","Description","Reference","Debit","Credit","Balance"].map(c=><th key={c} className="py-2 px-3 text-[9px] font-black uppercase tracking-wider text-left text-gray-400">{c}</th>)}
            </tr></thead>
            <tbody>
              {ready && entries.map((e,i)=>(
                <tr key={i} style={{ backgroundColor:i%2===0?"white":ERP.surfaceSoft, borderBottom:`1px solid ${ERP.surfaceSoft}` }}>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap" style={{ fontFamily:"var(--font-mono)" }}>{e.date}</td>
                  <td className="py-2 px-3 text-gray-700"><div className="truncate max-w-[16rem]" title={e.desc}>{e.desc}</div></td>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap" style={{ fontFamily:"var(--font-mono)" }}>{e.ref}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums" style={{ color:e.dr>0?ERP.destructive:ERP.border, fontFamily:"var(--font-mono)" }}>{e.dr>0?`SAR ${e.dr.toLocaleString()}`:"—"}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums" style={{ color:e.cr>0?FIN:ERP.border,    fontFamily:"var(--font-mono)" }}>{e.cr>0?`SAR ${e.cr.toLocaleString()}`:"—"}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums" style={{ fontFamily:"var(--font-mono)" }}>SAR {e.bal.toLocaleString()}</td>
                </tr>
              ))}
              {(!ready || entries.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-3 py-2">
                    {/* light tone — this table sits on the white statement document */}
                    {loading ? <LoadingSkeleton tone="light" rows={4} />
                      : error ? <ErrorState tone="light" onRetry={retry} />
                      : <EmptyState tone="light" title="No statement lines" hint="Postings for the selected entity and period appear here." />}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </FinDoc>
        <div className="flex gap-2 mt-4">
          <ActionBtn label="Download PDF" color={FIN} icon={Download} />
          <ActionBtn label="Print" icon={Printer} />
          <ActionBtn label="Email to Agent" color={ERP.info} icon={Send} />
        </div>
      </div>
    </div>
  );
}

// ─── 12. Profit & Loss ────────────────────────────────────────────────────────

const PL_FALLBACK: PLData = {
  revenue: [
    { code:"", name:"Visa Services",      amount:2840000 },
    { code:"", name:"Hotel Services",     amount:3210000 },
    { code:"", name:"Transport Services", amount:1420000 },
    { code:"", name:"Catering Services",  amount:680000  },
    { code:"", name:"Other Services",     amount:300000  },
  ],
  cogs: [
    { code:"", name:"Hotel Costs",          amount:2650000 },
    { code:"", name:"Transport Costs",      amount:890000  },
    { code:"", name:"Catering Costs",       amount:420000  },
    { code:"", name:"Visa Processing Fees", amount:180000  },
  ],
  opex: [
    { code:"", name:"Staff Salaries", amount:960000 },
    { code:"", name:"Office Rent",    amount:240000 },
    { code:"", name:"Marketing",      amount:180000 },
    { code:"", name:"IT & Systems",   amount:120000 },
    { code:"", name:"Other Admin",    amount:180000 },
  ],
  totalRevenue:8450000, totalCogs:4140000, grossProfit:4310000, grossMargin:51.0,
  totalOpex:1680000, ebitda:2630000, netProfit:1630000, netMargin:19.3,
};

function PLScreen() {
  const { data: live, loading, error, demo, refetch } = useLive<PLData>("/finance/pl");
  const d = demo ? PL_FALLBACK : live;

  const TTip = ({ active, payload, label }: any) => active && payload?.length ? (
    <div className="px-3 py-2 rounded-lg text-[10px]" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
      <div className="font-bold text-[color:var(--erp-text-strong)] mb-1">{label} 2025 (SAR K)</div>
      {payload.map((p: any) => <div key={p.dataKey} style={{ color:p.color }}>{p.name}: {p.value}K</div>)}
    </div>
  ) : null;

  // Never render the demo P&L to a signed-in controller on load / failure.
  if (!d) return <div className="p-7"><Gate loading={loading} error={error} onRetry={refetch} rows={7} /></div>;

  return (
    <div className="p-7 space-y-5">
      {/* Chart + KPIs */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-xl p-5" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div><div className="text-xs font-bold text-[color:var(--erp-text-strong)]">P&L Overview — Jan–Jul 2025</div><div className="text-[10px]" style={{ color:ERP.muted }}>Revenue · COGS · OpEx (SAR thousands)</div></div>
          </div>
          {!demo && <SampleDataBanner tone="light" className="mb-3" detail="This monthly trend is not yet connected to live data — the statement below is live." />}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={PL_CHART} margin={{ top:4, right:4, bottom:0, left:0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={ERP.mutedSoft} />
              <XAxis dataKey="month" tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}K`} />
              <Tooltip content={<TTip />} />
              <Bar dataKey="revenue" name="Revenue"  fill={FIN}      radius={[3,3,0,0]} />
              <Bar dataKey="cogs"    name="COGS"     fill={ERP.destructive}  radius={[3,3,0,0]} />
              <Bar dataKey="opex"    name="OpEx"     fill={CAT.orange}  radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {[
            { l:"Total Revenue",  v:`SAR ${d.totalRevenue.toLocaleString()}`, c:FIN        },
            { l:"Gross Profit",   v:`SAR ${d.grossProfit.toLocaleString()}`,  c:ERP.success  },
            { l:"Gross Margin",   v:`${d.grossMargin.toFixed(1)}%`,           c:ERP.info  },
            { l:"Net Profit",     v:`SAR ${d.netProfit.toLocaleString()}`,    c:FIN        },
            { l:"Net Margin",     v:`${d.netMargin.toFixed(1)}%`,             c:ERP.accent  },
          ].map(k=>(
            <div key={k.l} className="flex justify-between items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}` }}>
              <span className="text-[10px] min-w-0 truncate" style={{ color:ERP.muted }}>{k.l}</span>
              <span className="text-xs font-black font-mono shrink-0 whitespace-nowrap tabular-nums" style={{ color:k.c, fontFamily:"var(--font-mono)" }}>{k.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* P&L Statement */}
      <FinDoc type="PROFIT & LOSS STATEMENT" docNo="PL-1446H-JUL25" date="16 Jul 2025" noBarcode>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:FIN }}>Revenue</div>
            {d.revenue.map((r,i)=><SLine key={i} label={r.name} amount={r.amount} indent={1} />)}
            <SLine label="Total Revenue"         amount={d.totalRevenue} bold sep />

            <div className="mt-4 mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color:ERP.destructive }}>Cost of Services</div>
            {d.cogs.map((r,i)=><SLine key={i} label={r.name} amount={r.amount} indent={1} />)}
            <SLine label="Total Cost of Services" amount={d.totalCogs} bold sep color={ERP.destructive} />
            <SLine label="GROSS PROFIT"          amount={d.grossProfit} bold sep color={FIN} />
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:CAT.orange }}>Operating Expenses</div>
            {d.opex.map((r,i)=><SLine key={i} label={r.name} amount={r.amount} indent={1} />)}
            <SLine label="Total Operating Expenses" amount={d.totalOpex} bold sep color={CAT.orange} />
            <SLine label="EBITDA"                 amount={d.ebitda} bold sep color={FIN} />

            {/* Below EBITDA: PLData carries no depreciation / interest / zakat, so
                signed in these were invented statutory figures sitting on top of live
                revenue and profit. Keep every line in the designed statement order —
                dropping Zakat would be its own bug — and blank the amounts to "—". */}
            <div className="mt-3">
              <SLine label="Less: Depreciation"   amount={demo ? 80000   : undefined} pending={!demo} sub indent={1} />
              <SLine label="EBIT"                  amount={demo ? 2550000 : undefined} pending={!demo} bold sep />
              <SLine label="Less: Interest"        amount={demo ? 45000   : undefined} pending={!demo} sub indent={1} />
              <SLine label="Earnings Before Tax"   amount={demo ? 2505000 : undefined} pending={!demo} bold sep />
              <SLine label="Less: Zakat (2.5%)"    amount={demo ? 875000  : undefined} pending={!demo} sub indent={1} />
            </div>
            <div className="mt-3 px-4 py-3 rounded-xl" style={{ backgroundColor:`${erpAlpha(FIN, 6)}`, border:`1px solid ${erpAlpha(FIN, 19)}` }}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black" style={{ color:FIN }}>NET PROFIT</span>
                <span className="text-xl font-black" style={{ color:FIN, fontFamily:"var(--font-mono)" }}>SAR {d.netProfit.toLocaleString()}</span>
              </div>
              <div className="text-[9px] mt-0.5" style={{ color:"erpAlpha(ERP.success, 70)" }}>Net Margin: {d.netMargin.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </FinDoc>
      <div className="flex gap-2">
        <ActionBtn label="Download PDF" color={FIN} icon={Download} onClick={() => window.print()} />
        <ActionBtn label="Print" icon={Printer} onClick={() => window.print()} />
        <ActionBtn
          label="Export Excel"
          icon={Download}
          onClick={() => {
            if (!d) return;
            downloadCsv(
              `pl-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Section", "Line", "Amount"],
              [
                ...d.revenue.map((r) => ["Revenue", r.name, r.amount]),
                ["Revenue", "Total Revenue", d.totalRevenue],
                ...d.cogs.map((r) => ["COGS", r.name, r.amount]),
                ["COGS", "Total COGS", d.totalCogs],
                ["Summary", "Gross Profit", d.grossProfit],
                ...d.opex.map((r) => ["Opex", r.name, r.amount]),
                ["Opex", "Total Opex", d.totalOpex],
                ["Summary", "EBITDA", d.ebitda],
                ["Summary", "Net Profit", d.netProfit],
              ],
            );
            erpToast.success("P&L CSV downloaded");
          }}
        />
      </div>
    </div>
  );
}

// ─── 13. Balance Sheet ────────────────────────────────────────────────────────

function BSScreen() {
  const { data: live, loading, error, demo, refetch } = useLive<BSData>("/finance/bs");
  const totalAssets = live ? live.totalAssets : 6060000;
  const balanced    = live ? live.balanced : true;

  // Signed in but no data yet / request failed → designed state, not the demo sheet.
  if (!demo && !live) return <div className="p-7"><Gate loading={loading} error={error} onRetry={refetch} rows={7} /></div>;

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Balance Sheet</h2><p className="text-xs mt-0.5" style={{ color:ERP.muted }}>As at 16 July 2025 · Season 1446H</p></div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor:`${erpAlpha(FIN, 7)}`, border:`1px solid ${erpAlpha(FIN, 15)}` }}>
          <Check size={13} style={{ color:FIN }} />
          <span className="text-xs font-bold" style={{ color:FIN }}>{balanced ? "Balanced" : "Unbalanced"} — SAR {totalAssets.toLocaleString()}</span>
        </div>
      </div>

      <FinDoc type="BALANCE SHEET" docNo="BS-1446H-JUL25" date="16 Jul 2025" noBarcode>
        {live ? (
        <>
        <div className="grid grid-cols-2 gap-10">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:FIN }}>Assets</div>
            {live.assets.map((a,i)=><SLine key={i} label={a.name} amount={a.amount} indent={1} />)}
            <div className="mt-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor:`${erpAlpha(FIN, 3)}`, border:`1px solid ${erpAlpha(FIN, 13)}` }}>
              <SLine label="TOTAL ASSETS" amount={live.totalAssets} bold color={FIN} />
            </div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:ERP.destructive }}>Liabilities</div>
            {live.liabilities.map((l,i)=><SLine key={i} label={l.name} amount={l.amount} indent={1} />)}
            <SLine label="Total Liabilities" amount={live.totalLiabilities} bold sep color={ERP.destructive} />
            <div className="mt-3 text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:ERP.info }}>Equity</div>
            {live.equity.map((eq,i)=><SLine key={i} label={eq.name} amount={eq.amount} indent={1} />)}
            <SLine label="Total Equity" amount={live.totalEquity} bold sep color={ERP.info} />
            <div className="mt-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor:erpAlpha(ERP.destructive, 3), border:`1px solid ${erpAlpha(ERP.destructive, 15)}` }}>
              <SLine label="TOTAL LIABILITIES & EQUITY" amount={live.liabilitiesPlusEquity} bold color={ERP.destructive} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-gray-100">
          <CheckCircle size={14} style={{ color:FIN }} />
          <span className="text-xs font-bold text-gray-500">Assets (SAR {live.totalAssets.toLocaleString()}) = Liabilities + Equity (SAR {live.liabilitiesPlusEquity.toLocaleString()}) {live.balanced?"✓":"✗"}</span>
        </div>
        </>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-10">
          {/* Assets */}
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:FIN }}>Assets</div>
            <SLine label="Current Assets" bold />
            <SLine label="Cash & Bank — Al Rajhi"      amount={1850000} indent={2} sub />
            <SLine label="Cash & Bank — Alinma"        amount={980000}  indent={2} sub />
            <SLine label="Cash & Bank — SNB"           amount={370000}  indent={2} sub />
            <SLine label="Accounts Receivable (Agents)"amount={2140000} indent={2} sub />
            <SLine label="Prepaid Expenses"            amount={120000}  indent={2} sub />
            <SLine label="Total Current Assets"        amount={5460000} bold sep />
            <div className="mt-3">
              <SLine label="Non-Current Assets" bold />
              <SLine label="Equipment & Fixtures"      amount={180000}  indent={2} sub />
              <SLine label="Vehicles & Fleet"          amount={420000}  indent={2} sub />
              <SLine label="Total Non-Current Assets"  amount={600000}  bold sep />
            </div>
            <div className="mt-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor:`${erpAlpha(FIN, 3)}`, border:`1px solid ${erpAlpha(FIN, 13)}` }}>
              <SLine label="TOTAL ASSETS" amount={6060000} bold color={FIN} />
            </div>
          </div>

          {/* Liabilities + Equity */}
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:ERP.destructive }}>Liabilities</div>
            <SLine label="Current Liabilities" bold />
            <SLine label="Accounts Payable (Suppliers)"  amount={890000}  indent={2} sub />
            <SLine label="Agent Advance Payments"        amount={1240000} indent={2} sub />
            <SLine label="VAT Payable"                   amount={126750}  indent={2} sub />
            <SLine label="Total Current Liabilities"     amount={2256750} bold sep color={ERP.destructive} />
            <div className="mt-3">
              <SLine label="Long-term Liabilities" bold />
              <SLine label="Bank Loan — Al Rajhi"        amount={500000}  indent={2} sub />
              <SLine label="Total Long-term Liabilities" amount={500000}  bold sep color={ERP.destructive} />
            </div>
            <div className="mt-3 text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:ERP.info }}>Equity</div>
            <SLine label="Share Capital"                 amount={1000000} indent={1} />
            <SLine label="Retained Earnings"             amount={673250}  indent={1} />
            <SLine label="Current Period Profit"         amount={1630000} indent={1} />
            <SLine label="Total Equity"                  amount={3303250} bold sep color={ERP.info} />
            <div className="mt-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor:erpAlpha(ERP.destructive, 3), border:`1px solid ${erpAlpha(ERP.destructive, 15)}` }}>
              <SLine label="TOTAL LIABILITIES & EQUITY" amount={6060000} bold color={ERP.destructive} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-gray-100">
          <CheckCircle size={14} style={{ color:FIN }} />
          <span className="text-xs font-bold text-gray-500">Assets (SAR 6,060,000) = Liabilities + Equity (SAR 6,060,000) ✓</span>
        </div>
        </>
        )}
      </FinDoc>
      <div className="flex gap-2 mt-4">
        <ActionBtn label="Download PDF" color={FIN} icon={Download} onClick={() => window.print()} />
        <ActionBtn label="Print" icon={Printer} onClick={() => window.print()} />
        <ActionBtn
          label="Export Excel"
          icon={Download}
          onClick={() => {
            if (live) {
              downloadCsv(
                `bs-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Section", "Line", "Amount"],
                [
                  ...live.assets.map((a) => ["Assets", a.name, a.amount]),
                  ["Assets", "Total Assets", live.totalAssets],
                  ...live.liabilities.map((l) => ["Liabilities", l.name, l.amount]),
                  ["Liabilities", "Total Liabilities", live.totalLiabilities],
                  ...live.equity.map((eq) => ["Equity", eq.name, eq.amount]),
                  ["Equity", "Total Equity", live.totalEquity],
                ],
              );
            } else {
              downloadCsv(`bs-demo.csv`, ["Section", "Line", "Amount"], [["Assets", "Total Assets", totalAssets]]);
            }
            erpToast.success("Balance sheet CSV downloaded");
          }}
        />
      </div>
    </div>
  );
}

// ─── T002-06 MOFA Processing Bill Sheet (Qty×Rate) ────────────────────────────
// Separate from Passenger MOFA Number. Flag ENABLE_MOFA_PROCESSING_BILL.

interface MofaBillStatus { enabled: boolean; flag: string; note: string }
interface MofaBillRow {
  id: string; code: string; kind: string; tenant: string; group: string | null;
  total: number; status: string; approvalSign: string | null; crDate: string | null;
  items: { desc: string; qty: number; unit: number; total: number }[];
}

function MofaBillScreen() {
  const status = useLive<MofaBillStatus>("/finance/mofa-processing-bills/status");
  const bills = useLive<MofaBillRow[]>("/finance/mofa-processing-bills");
  const [tenantId, setTenantId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  if (status.demo) {
    return (
      <div className="p-6">
        <SampleDataBanner />
        <EmptyState tone="light" title="MOFA Bill Sheet" hint="Log in as Finance staff. Mutamer MOFA Number stays on Visa Desk — this is Qty×Rate only." />
      </div>
    );
  }
  const gate = <Gate loading={status.loading || bills.loading} error={status.error || bills.error} onRetry={() => { status.refetch(); bills.refetch(); }} />;
  if (gate) return <div className="p-6">{gate}</div>;

  if (!status.data?.enabled) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm font-bold text-[color:var(--erp-text-strong)]">MOFA Processing Bill Sheet</div>
        <p className="text-[11px]" style={{ color: ERP.muted }}>
          Disabled until Finance enables <code>ENABLE_MOFA_PROCESSING_BILL</code>.
          Mutamer <strong>MOFA Number</strong> on Visa Desk is unaffected and must stay separate.
        </p>
        <EmptyState tone="light" title="Bill Sheet off" hint={status.data?.note} />
      </div>
    );
  }

  const rows = bills.data ?? [];

  const create = async () => {
    const q = Number(qty);
    const r = Number(rate);
    if (!tenantId.trim() || !groupId.trim()) { toast.error("tenantId and groupId required"); return; }
    if (!q || q < 1 || Number.isNaN(r) || r < 0) { toast.error("qty ≥ 1 and rate required"); return; }
    setBusy(true);
    try {
      const inv = await api.post<MofaBillRow>("/finance/mofa-processing-bills", {
        tenantId: tenantId.trim(), groupId: groupId.trim(), qty: q, rate: r,
      });
      toast.success(`MOFA bill ${inv.code} created`);
      bills.refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const sign = async (id: string) => {
    const approvalSign = window.prompt("Finance Approval Sign:")?.trim();
    if (!approvalSign) return;
    try {
      await api.patch(`/finance/mofa-processing-bills/${id}/sign`, { approvalSign });
      toast.success("Bill signed");
      bills.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-sm font-bold text-[color:var(--erp-text-strong)]">MOFA Processing Bill Sheet</div>
        <p className="text-[10px] mt-1" style={{ color: ERP.muted }}>
          Qty × Rate account bill. Not hotel/transport cash. Not mutamer MOFA Number.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 rounded-xl" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
        <ErpInput value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Agent tenantId" />
        <ErpInput value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="Group id" />
        <ErpInput value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
        <ErpInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate SAR" />
        <ErpButton variant="primary" size="sm" disabled={busy} onClick={create} style={{ backgroundColor: FIN, color: ERP.primaryFg }}>{busy ? "…" : "Create bill"}</ErpButton>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ERP.border}` }}>
        <ErpDataTable
          flush
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No MOFA bills yet"
          emptyHint="Create a Qty×Rate bill above."
          columns={[
            { id:"code", header:"Code", cell:(r)=><span className="font-bold text-[color:var(--erp-text-strong)]" style={{ fontSize:ERP.text.size[10], fontFamily:ERP.font.data }}>{r.code}</span> },
            { id:"group", header:"Group", cell:(r)=><span style={{ fontSize:ERP.text.size[10], color:ERP.navy }}>{r.group ?? "—"}</span> },
            { id:"tenant", header:"Tenant", cell:(r)=><span style={{ fontSize:ERP.text.size[10], color:ERP.navy }}>{r.tenant}</span> },
            { id:"total", header:"Total", align:"right", cell:(r)=><span style={{ fontSize:ERP.text.size[10], color:ERP.navy, fontFamily:ERP.font.data }}>SAR {r.total.toLocaleString()}</span> },
            { id:"sign", header:"Sign", cell:(r)=><span style={{ fontSize:ERP.text.size[10], color:ERP.muted }}>{r.approvalSign ?? "—"}</span> },
            { id:"crdate", header:"CR Date", cell:(r)=><span style={{ fontSize:ERP.text.size[10], color:ERP.muted }}>{r.crDate ? new Date(r.crDate).toLocaleDateString() : "—"}</span> },
            { id:"act", header:"", align:"right", cell:(r)=> !r.approvalSign ? <ErpButton variant="ghost" size="sm" onClick={() => sign(r.id)} style={{ color: FIN }}>Sign</ErpButton> : null },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Main FinanceERP ──────────────────────────────────────────────────────────

const LABELS: Record<FinScreen, string> = {
  dashboard: "ফাইন্যান্স", income: "ইনকাম", expenses: "খরচ",
  ledger: "লেজার", ar: "প্রাপ্য (AR)", ap: "প্রদেয় (AP)",
  cash: "নগদ ও ব্যাংক", forex: "মাল্টি-কারেন্সি", invoices: "ইনভয়েস",
  mofaBill: "MOFA বিল",
  receipts: "রসিদ", statements: "স্টেটমেন্ট", pl: "লাভ-ক্ষতি", bs: "ব্যালেন্স শিট",
};

export default function FinanceERP() {
  const { lang } = useLang();
  const [screen, setScreen] = useState<FinScreen>("dashboard");

  const body =
    screen === "dashboard" ? <DashboardScreen onGo={setScreen} />
      : screen === "income" ? <IncExpScreen type="income" />
        : screen === "expenses" ? <IncExpScreen type="expenses" />
          : screen === "ledger" ? <LedgerScreen />
            : screen === "ar" ? <ARAPScreen type="ar" />
              : screen === "ap" ? <ARAPScreen type="ap" />
                : screen === "cash" ? <CashBankScreen />
                  : screen === "forex" ? <ForexScreen />
                    : screen === "invoices" ? <InvoicesScreen />
                      : screen === "mofaBill" ? <MofaBillScreen />
                        : screen === "receipts" ? <ReceiptsScreen />
                          : screen === "statements" ? <StatementsScreen />
                            : screen === "pl" ? <PLScreen />
                              : screen === "bs" ? <BSScreen />
                                : null;

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="finance"
      moduleName={lang === "bn" ? "ফাইন্যান্স ERP" : "Finance ERP"}
      moduleColor={FIN}
      moduleIcon={Wallet as IconFC}
      navItems={FIN_NAV}
      activeItem={screen}
      onItemClick={(id) => setScreen(id as FinScreen)}
      breadcrumb={[lang === "bn" ? "ফাইন্যান্স" : "Finance", LABELS[screen]]}
      notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${ERP.mutedSoft} transparent` }}>
          {body}
        </div>
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
