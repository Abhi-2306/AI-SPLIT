"use client";

import { create } from "zustand";

export type FriendDto = {
  friendshipId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  since: string;
};

export type FriendRequestDto = {
  id: string;
  fromUserId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

type FriendState = {
  friends: FriendDto[];
  requests: FriendRequestDto[];
  loading: boolean;

  loadFriends: () => Promise<void>;
  loadRequests: () => Promise<void>;
  sendRequest: (email: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "API error");
  return json.data as T;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  requests: [],
  loading: false,

  loadFriends: async () => {
    set({ loading: true });
    try {
      const friends = await apiFetch<FriendDto[]>("/api/friends");
      set({ friends });
    } finally {
      set({ loading: false });
    }
  },

  loadRequests: async () => {
    const requests = await apiFetch<FriendRequestDto[]>("/api/friends/requests");
    set({ requests });
  },

  sendRequest: async (email) => {
    await apiFetch("/api/friends", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  acceptRequest: async (requestId) => {
    await apiFetch(`/api/friends/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "accept" }),
    });
    // Refresh both
    const [friends, requests] = await Promise.all([
      apiFetch<FriendDto[]>("/api/friends"),
      apiFetch<FriendRequestDto[]>("/api/friends/requests"),
    ]);
    set({ friends, requests });
  },

  rejectRequest: async (requestId) => {
    await apiFetch(`/api/friends/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "reject" }),
    });
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) }));
  },
}));
