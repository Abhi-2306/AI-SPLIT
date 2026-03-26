"use client";

import { useState } from "react";
import type { ParticipantDto } from "@/application/dtos/index";
import { ParticipantChip } from "./ParticipantChip";
import { Input } from "@/presentation/components/ui/Input";
import { Button } from "@/presentation/components/ui/Button";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";

type ParticipantListProps = {
  participants: ParticipantDto[];
  billId: string;
};


export function ParticipantList({ participants, billId }: ParticipantListProps) {
  const { addParticipant, removeParticipant } = useBillStore();
  const { addToast } = useUiStore();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addParticipant(billId, name.trim());
      setName("");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to add participant", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(participantId: string, participantName: string) {
    try {
      await removeParticipant(billId, participantId);
      addToast(`Removed ${participantName}`, "info");
    } catch {
      addToast("Failed to remove participant", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="Enter participant name (e.g. Alice)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd(e)}
        />
        <Button type="submit" loading={loading} disabled={!name.trim()}>
          Add
        </Button>
      </form>

      {participants.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-3xl mb-2">👥</p>
          <p>No participants yet. Add names above.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {participants.map((p, idx) => (
            <ParticipantChip
              key={p.id}
              participant={p}
              index={idx}
              billId={billId}
              onRemove={() => handleRemove(p.id, p.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
