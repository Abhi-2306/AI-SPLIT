"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { useUiStore } from "@/presentation/store/uiStore";
import { ROUTES } from "@/lib/constants/routes";

type Group = {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
};

type Member = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
};

type Friend = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  friendshipId: string;
};

function Avatar({ name, url, size = 8 }: { name: string; url: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`;
  if (url) return <img src={url} alt="" className={`${cls} object-cover`} />;
  return (
    <div className={`${cls} bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-xs`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function GroupCard({ group, onDeleted }: { group: Group; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const { addToast } = useUiStore();

  function loadMembers() {
    fetch(`/api/groups/${group.id}/members`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setMembers(j.data); })
      .catch(() => null);
  }

  useEffect(() => {
    if (expanded && !membersLoaded) {
      setMembersLoaded(true);
      loadMembers();
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAddMember() {
    fetch("/api/friends")
      .then((r) => r.json())
      .then((j) => { if (j.success) setFriends(j.data); })
      .catch(() => null);
    setShowAddMember(true);
  }

  async function handleAddMember(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to add member");
      addToast("Member added!", "success");
      loadMembers();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add member", "error");
    } finally {
      setAdding(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/groups/${group.id}/members?userId=${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to remove member", "error");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to delete group");
      onDeleted();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete group", "error");
      setDeleting(false);
    }
  }

  const nonMembers = friends.filter((f) => !members.some((m) => m.userId === f.userId));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{group.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
            {!group.isOwner && " · Member"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? "Hide" : "Members"}
          </button>
          {group.isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={m.displayName} url={m.avatarUrl} size={7} />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {m.displayName} {m.isMe && <span className="text-xs text-slate-400">(you)</span>}
                  </span>
                </div>
                {group.isOwner && !m.isMe && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {group.isOwner && (
            <div className="mt-3">
              {showAddMember ? (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Add a friend</p>
                  {nonMembers.length === 0 ? (
                    <p className="text-xs text-slate-400">All friends are already in this group.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {nonMembers.map((f) => (
                        <div key={f.userId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar name={f.displayName} url={f.avatarUrl} size={6} />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{f.displayName}</span>
                          </div>
                          <button
                            onClick={() => handleAddMember(f.userId)}
                            disabled={adding === f.userId}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
                          >
                            {adding === f.userId ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowAddMember(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 mt-2"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={openAddMember}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add member
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const { addToast } = useUiStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  function loadGroups() {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((j) => { if (j.success) setGroups(j.data); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadGroups(); }, []);

  function openModal() {
    setGroupName("");
    setSelectedFriends(new Set());
    fetch("/api/friends")
      .then((r) => r.json())
      .then((j) => { if (j.success) setFriends(j.data); })
      .catch(() => null);
    setShowModal(true);
  }

  function toggleFriend(userId: string) {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), memberIds: Array.from(selectedFriends) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to create group");
      addToast("Group created!", "success");
      setShowModal(false);
      loadGroups();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create group", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Groups</h1>
        <div className="flex items-center gap-2">
          <Button onClick={openModal}>+ New Group</Button>
          <Button variant="ghost" onClick={() => router.push(ROUTES.home)}>← Home</Button>
        </div>
      </div>

      {/* Groups list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-4">👥</p>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No groups yet</p>
          <p className="text-sm mt-1 mb-6">Create a group to quickly split with the same people</p>
          <Button onClick={openModal}>Create a Group</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onDeleted={() => setGroups((prev) => prev.filter((x) => x.id !== g.id))}
            />
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">New Group</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Group name
              </label>
              <Input
                placeholder="e.g. Roommates, Road Trip"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            {friends.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Add friends <span className="text-slate-400 font-normal">(optional)</span>
                </p>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {friends.map((f) => (
                    <label key={f.userId} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFriends.has(f.userId)}
                        onChange={() => toggleFriend(f.userId)}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <Avatar name={f.displayName} url={f.avatarUrl} size={7} />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{f.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={creating}
                disabled={!groupName.trim()}
                onClick={handleCreate}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
