import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import Root from "./Root";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ComingSoon from "./pages/ComingSoon";
import { RequireAuth } from "./components/RequireAuth";
import { RouteFallback } from "./components/RouteFallback";
import { homePathForUser } from "./lib/rbac";

/** HOTFIX: /admin is an entry alias — redirect to the role-based landing (no fixed admin URL). */
function AdminEntry() {
  return <Navigate to={homePathForUser()} replace />;
}

// ESP-03 — lazy route modules (same paths / same default exports; behavior unchanged).
// Marketing Home + Login stay eager for first paint.
const Services = lazy(() => import("./pages/Services"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const AuthOnboarding = lazy(() => import("./pages/AuthOnboarding"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AgentPortal = lazy(() => import("./pages/AgentPortal"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Settings = lazy(() => import("./pages/Settings"));
const RateCards = lazy(() => import("./pages/RateCards"));
const FlightMaster = lazy(() => import("./pages/FlightMaster"));
const FlightSchedule = lazy(() => import("./pages/FlightSchedule"));
const FlightOpsControl = lazy(() => import("./pages/FlightOpsControl"));
const GroundOps = lazy(() => import("./pages/GroundOps"));
const MeetAssist = lazy(() => import("./pages/MeetAssist"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const OCRCenter = lazy(() => import("./pages/OCRCenter"));
const SupplierPortal = lazy(() => import("./pages/SupplierPortal"));
const OpsControl = lazy(() => import("./pages/OpsControl"));
const FlightManagement = lazy(() => import("./pages/FlightManagement"));
const OpsDepartments = lazy(() => import("./pages/OpsDepartments"));
const Dashboards = lazy(() => import("./pages/Dashboards"));
const FleetERP = lazy(() => import("./pages/FleetERP"));
const FinanceERP = lazy(() => import("./pages/FinanceERP"));
const AutomationNotifications = lazy(() => import("./pages/AutomationNotifications"));
const WorkflowMap = lazy(() => import("./pages/WorkflowMap"));
const AgentOperations = lazy(() => import("./pages/AgentOperations"));
const AuditCenter = lazy(() => import("./pages/AuditCenter"));
const ApprovalDashboard = lazy(() => import("./pages/ApprovalDashboard"));
const SlaDashboard = lazy(() => import("./pages/SlaDashboard"));
const WaSenderConfig = lazy(() => import("./pages/WaSenderConfig"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const TemplateManager = lazy(() => import("./pages/TemplateManager"));
const NotificationInbox = lazy(() => import("./pages/NotificationInbox"));
const AgentGroupWorkflow = lazy(() => import("./pages/AgentGroupWorkflow"));

import { ImpersonationBanner } from "./components/ImpersonationBanner";

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

/** Private route: login required + optional path UX permission gate (S1-05). */
const priv = (el: ReactNode, path?: string) => (
  <RequireAuth path={path}>
    <>
      <ImpersonationBanner />
      <LazyPage>{el}</LazyPage>
    </>
  </RequireAuth>
);

// NARROW HONEST LAUNCH: reachable = public marketing + registration + portals.
// Staff screens that still render fabricated data may stay ComingSoon (S1-07).
// S2-04: FinanceERP live for FINANCIAL_REPORTS (authed → live APIs; no mock fallthrough).
// S2-05: Automation admin live for CONFIGURE_WORKFLOWS (existing queues/services).
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "services", element: <LazyPage><Services /></LazyPage> },
      { path: "about", element: <LazyPage><About /></LazyPage> },
      { path: "contact", element: <LazyPage><Contact /></LazyPage> },
    ],
  },
  // Public
  { path: "/login", Component: Login },
  { path: "/auth-onboarding", element: <LazyPage><AuthOnboarding /></LazyPage> },
  { path: "/reset-password", element: <LazyPage><ResetPassword /></LazyPage> },

  // Portals (tenancy via company.type — UX)
  { path: "/agent-portal", element: priv(<AgentPortal />, "/agent-portal") },
  { path: "/supplier-portal", element: priv(<SupplierPortal />, "/supplier-portal") },

  // Staff modules (permissions from session — UX)
  { path: "/ops-control", element: priv(<OpsControl />, "/ops-control") },
  { path: "/flight-management", element: priv(<FlightManagement />, "/flight-management") },
  { path: "/agent-operations", element: priv(<AgentOperations />, "/agent-operations") },
  { path: "/audit-center", element: priv(<AuditCenter />, "/audit-center") },
  { path: "/approvals", element: priv(<ApprovalDashboard />, "/approvals") },
  { path: "/sla-dashboard", element: priv(<SlaDashboard />, "/sla-dashboard") },
  { path: "/wasender-config", element: priv(<WaSenderConfig />, "/wasender-config") },
  { path: "/notification-center", element: priv(<NotificationCenter />, "/notification-center") },
  { path: "/template-manager", element: priv(<TemplateManager />, "/template-manager") },
  { path: "/inbox", element: priv(<NotificationInbox />, "/inbox") },
  { path: "/my-workflow", element: priv(<AgentGroupWorkflow />, "/my-workflow") },
  { path: "/ops-departments", element: priv(<OpsDepartments />, "/ops-departments") },
  { path: "/finance-erp", element: priv(<FinanceERP />, "/finance-erp") },
  { path: "/fleet-erp", element: priv(<FleetERP />, "/fleet-erp") },
  { path: "/ocr-center", element: priv(<OCRCenter />, "/ocr-center") },
  { path: "/automation", element: priv(<AutomationNotifications />, "/automation") },
  { path: "/dashboards", element: priv(<Dashboards />, "/dashboards") },
  { path: "/super-admin", element: priv(<SuperAdmin />, "/super-admin") },
  { path: "/settings", element: priv(<Settings />, "/settings") },
  { path: "/admin", element: <AdminEntry /> },
  { path: "/rate-cards", element: priv(<RateCards />, "/rate-cards") },
  { path: "/flight-master", element: priv(<FlightMaster />, "/flight-master") },
  { path: "/flight-schedule", element: priv(<FlightSchedule />, "/flight-schedule") },
  { path: "/flight-ops-control", element: priv(<FlightOpsControl />, "/flight-ops-control") },
  { path: "/ground-ops", element: priv(<GroundOps />, "/ground-ops") },
  { path: "/meet-assist", element: priv(<MeetAssist />, "/meet-assist") },
  { path: "/command-center", element: priv(<CommandCenter />, "/command-center") },
  { path: "/workflow-map", element: priv(<WorkflowMap />, "/workflow-map") },
  { path: "/mobile-apps", Component: ComingSoon },
  { path: "/tablet", Component: ComingSoon },
  { path: "/design-system", Component: ComingSoon },
  { path: "/i18n-system", Component: ComingSoon },
]);
