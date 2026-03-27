"use client";

import { useState, useEffect } from "react";
import type { ParticipantDto } from "@/application/dtos/index";
import { ParticipantChip } from "./ParticipantChip";
import { Input } from "@/presentation/components/ui/Input";
import { Button } from "@/presentation/components/ui/Button";
import { useBillStore } from "@/presentation/store/billStore";
import { useFriendStore, type FriendDto } from "@/presentation/store/friendStore";
import { useUiStore } from "@/presentation/store/uiStore";

type ParticipantListProps = {
  participants: ParticipantDto[];
  billId: string;
};

export function ParticipantList({ participants, billId }: ParticipantListProps) {
  const { addParticipant, removeParticipant } = useBillStore();
  const { friends, loadFriends } = useFriendStore();
  const { addToast } = useUiStore();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; displayName: string } | null>(null);

  useEffect(() => {
    loadFriends();
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => { if (j.success) setCurrentUser({ id: j.data.id, displayName: j.data.displayName }); })
      .catch(() => null);
  }, [loadFriends]);

  // Friends not already in the bill
  const linkedUserIds = new Set(participants.map((p) => p.userId).filter(Boolean));
  const availableFriends = friends.filter((f) => !linkedUserIds.has(f.userId));
  const selfNotInBill = currentUser && !linkedUserIds.has(currentUser.id);

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

  async function handleAddFriend(friend: FriendDto) {
    setShowFriendPicker(false);
    try {
      await addParticipant(billId, friend.displayName, friend.userId);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to add friend", "error");
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
      <div className="flex gap-2">
        <form onSubmit={handleAdd} className="flex gap-2 flex-1">
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

        {selfNotInBill && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => addParticipant(billId, currentUser!.displayName, currentUser!.id).catch(() => addToast("Failed to add yourself", "error"))}
          >
            + Add me
          </Button>
        )}

        {availableFriends.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFriendPicker((v) => !v)}
            >
              Friends
            </Button>
            {showFriendPicker && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[180px] py-1">
                {availableFriends.map((f) => (
                  <button
                    key={f.userId}
                    onClick={() => handleAddFriend(f)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-semibold">
                        {f.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {f.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
