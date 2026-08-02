// T001-08 — unit-style catalog checks (runs under jest-e2e config)

import { ALL_EVENT_KEYS, EV, isEventKey } from "../src/automation/events";
import { isIntakeDomainEvent, INTAKE_DOMAIN_EVENTS } from "../src/automation/intake-notification.pack";
import { NOTIF_TEMPLATES } from "@tuba/shared";

describe("T001-08 intake notification pack (unit)", () => {
  it("registers group.ocr.committed as a domain event", () => {
    expect(EV.OCR_GROUP_COMMITTED).toBe("group.ocr.committed");
    expect(isEventKey("group.ocr.committed")).toBe(true);
    expect(ALL_EVENT_KEYS).toContain("group.ocr.committed");
    expect(ALL_EVENT_KEYS).toContain("group.gates.changed");
    expect(ALL_EVENT_KEYS).toContain("group.import.completed");
  });

  it("marks intake domain events for Agent+Admin notify policy", () => {
    for (const k of INTAKE_DOMAIN_EVENTS) {
      expect(isIntakeDomainEvent(k)).toBe(true);
    }
    expect(isIntakeDomainEvent("booking.confirmed")).toBe(false);
  });

  it("ships shared bilingual templates for intake NotificationEvent keys", () => {
    for (const key of [
      "GROUP_CREATED",
      "GROUP_GATES_CHANGED",
      "GROUP_IMPORT_COMPLETED",
      "GROUP_OCR_COMMITTED",
    ]) {
      expect(NOTIF_TEMPLATES[key]?.en?.body).toBeTruthy();
      expect(NOTIF_TEMPLATES[key]?.bn?.body).toBeTruthy();
    }
  });
});
