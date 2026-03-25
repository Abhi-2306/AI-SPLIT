import type { IEventBus, DomainEvent } from "../../application/ports/IEventBus";

/**
 * No-op event bus for Iteration 1.
 * Replace with WebSocketEventBus in Iteration 3 — no other code changes needed.
 */
export class NoOpEventBus implements IEventBus {
  async publish(_event: DomainEvent): Promise<void> {
    // Intentionally empty in Iter 1
  }
}
