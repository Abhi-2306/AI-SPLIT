declare const _brand: unique symbol;

export type BillId = string & { readonly [_brand]: "BillId" };
export type BillItemId = string & { readonly [_brand]: "BillItemId" };
export type ParticipantId = string & { readonly [_brand]: "ParticipantId" };
export type AssignmentId = string & { readonly [_brand]: "AssignmentId" };

export function asBillId(id: string): BillId {
  return id as BillId;
}

export function asBillItemId(id: string): BillItemId {
  return id as BillItemId;
}

export function asParticipantId(id: string): ParticipantId {
  return id as ParticipantId;
}

export function asAssignmentId(id: string): AssignmentId {
  return id as AssignmentId;
}
