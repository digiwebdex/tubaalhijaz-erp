import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { Queue } from "bullmq";
import { AUTOMATION_QUEUE } from "./automation.constants";
import { AutomationService } from "./automation.service";
import { evaluateConditions, type JobData } from "./actions";
import { isEventKey, type DomainPayload } from "./events";

/**
 * The bridge from domain events → queued work. One wildcard listener catches
 * every emitted event; for each, it finds enabled rules bound to that event,
 * checks their conditions against the payload, and enqueues one BullMQ job per
 * action. The emitting service knows nothing about any of this.
 */
@Injectable()
export class AutomationDispatcher {
  private readonly log = new Logger("Automation");

  constructor(
    private readonly rules: AutomationService,
    @Inject(AUTOMATION_QUEUE) private readonly queue: Queue<JobData>,
  ) {}

  @OnEvent("**", { async: true })
  async onDomainEvent(payload: DomainPayload) {
    if (!payload || !isEventKey(payload.key)) return; // ignore non-domain / framework events
    const matches = await this.rules.rulesForEvent(payload.key);
    if (matches.length === 0) return;

    for (const { rule, actions } of matches) {
      if (!evaluateConditions(rule.conditions, payload)) continue; // conditions gate the rule
      for (const action of actions) {
        await this.queue.add(
          action.type,
          { ruleId: rule.id, ruleCode: rule.code, eventKey: payload.key, action, event: payload },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 500, removeOnFail: 1000 },
        );
      }
      this.log.debug(`${payload.key} → ${rule.code}: queued ${actions.length} action(s)`);
    }
  }
}
