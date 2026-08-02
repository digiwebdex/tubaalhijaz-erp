/**
 * UI-10 website + agent portal smoke — run:
 *   pnpm run test:website
 * (from apps/web)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PKG_LABEL } from "./group-foundation";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const routes = read("routes.tsx");
assert.ok(routes.includes('path: "services"'));
assert.ok(routes.includes('path: "about"'));
assert.ok(routes.includes('path: "contact"'));
assert.ok(routes.includes('path: "/agent-portal"'));
assert.ok(routes.includes("Component: Home"));

const home = read("pages/Home.tsx");
assert.ok(home.includes("Service Lines") || home.includes("সেবা বিভাগ"));
assert.ok(home.includes("Why Choose Us") || home.includes("আমাদের কেন বেছে নেবেন"));
assert.ok(home.includes('to={`/services#${mod.id}`}'));
assert.ok(!home.includes("api.get") && !home.includes("api.post"));

const services = read("pages/Services.tsx");
assert.ok(services.includes('id={svc.id}'));
assert.ok(services.includes("Visa Processing") || services.includes("ভিসা প্রক্রিয়াকরণ"));

const contact = read("pages/Contact.tsx");
assert.ok(contact.includes("handleSubmit"));
assert.ok(contact.includes("setSubmitted(true)"));
assert.ok(!contact.includes("api.post"));
assert.ok(contact.includes("outlineColor: GOLD") || contact.includes("outlineColor:GOLD"));

const agent = read("pages/AgentPortal.tsx");
assert.ok(agent.includes("ErpPageTemplate"));
assert.ok(agent.includes('"/groups"'));
assert.ok(agent.includes('"/services/visa"'));
assert.ok(agent.includes('"/agent-finance/wallet"'));
assert.ok(agent.includes("DashboardScreen"));

assert.deepEqual(Object.keys(PKG_LABEL).sort(), ["ECONOMY", "PREMIUM", "STANDARD"]);

const groups = read("pages/AgentPortalGroups.tsx");
assert.ok(groups.includes("Economy"));
assert.ok(groups.includes("role=\"radio\""));

console.log("website.selftest: OK");
