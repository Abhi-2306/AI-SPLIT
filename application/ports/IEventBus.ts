export type DomainEventType =
  | "bill.created"
  | "bill.updated"
  | "item.added"
  | "item.updated"
  | "item.deleted"
  | "participant.added"
  | "participant.removed"
  | "assignment.added"
  | "assignment.removed";

export type DomainEvent = {
  readonly type: DomainEventType;
  readonly billId: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: Date;
};

/**
 * Event bus interface for publishing domain events.
 * Iter 1: NoOpEventBus (does nothing).
 * Iter 3: WebSocketEventBus broadcasts to connected clients.
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
}
