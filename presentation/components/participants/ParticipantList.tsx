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
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string; memberCount: number }[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [addingGroup, setAddingGroup] = useState<string | null>(null);

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

  function openGroupPicker() {
    if (!groupsLoaded) {
      fetch("/api/groups")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setGroups(j.data);
          setGroupsLoaded(true);
        })
        .catch(() => setGroupsLoaded(true));
    }
    setShowGroupPicker((v) => !v);
  }

  async function handleAddGroup(group: { id: string; name: string }) {
    setShowGroupPicker(false);
    setAddingGroup(group.id);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`);
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load group members");

      const members = json.data as { userId: string; displayName: string; avatarUrl: string | null; isMe: boolean }[];
      const toAdd = members.filter((m) => !linkedUserIds.has(m.userId));

      if (toAdd.length === 0) {
        addToast("All members are already in this bill", "info");
        return;
      }

      await Promise.all(toAdd.map((m) => addParticipant(billId, m.displayName, m.userId)));
      addToast(`Added ${toAdd.length} member${toAdd.length !== 1 ? "s" : ""} from ${group.name}`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add group members", "error");
    } finally {
      setAddingGroup(null);
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
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[180px] py-1">
                {availableFriends.map((f) => (
                  <button
                    key={f.userId}
                    onClick={() => handleAddFriend(f)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full object-cover" />
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

        <div className="relative">
          <Button
            type="button"
            variant="secondary"
            onClick={openGroupPicker}
            loading={addingGroup !== null}
          >
            Groups
          </Button>
          {showGroupPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[200px] py-1">
              {!groupsLoaded ? (
                <p className="px-3 py-2 text-sm text-slate-400">Loading...</p>
              ) : groups.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-400">No groups yet</p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleAddGroup(g)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-slate-400 ml-1">· {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
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
