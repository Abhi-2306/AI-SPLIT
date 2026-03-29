"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/presentation/components/ui/Button";
import { useUiStore } from "@/presentation/store/uiStore";
import { ROUTES } from "@/lib/constants/routes";
import { useCallback } from "react";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { addToast } = useUiStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setProfile(j.data);
          setName(j.data.displayName);
        }
      });
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile?.displayName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile((p) => p ? { ...p, displayName: trimmed } : p);
        addToast("Name updated!", "success");
      } else {
        addToast(json.error?.message ?? "Failed to save", "error");
        setName(profile?.displayName ?? "");
      }
    } catch {
      addToast("Failed to save", "error");
      setName(profile?.displayName ?? "");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Upload failed");
      setProfile((p) => p ? { ...p, avatarUrl: json.data.avatarUrl } : p);
      addToast("Profile photo updated!", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to upload photo", "error");
    } finally {
      setUploadingAvatar(false);
      // Reset so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [addToast]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.displayName
    ? profile.displayName.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={() => router.push(ROUTES.home)}>
          ← Home
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group w-20 h-20 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Change profile photo"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-2xl font-bold">
                {initials}
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <p className="text-xs text-slate-400">Tap photo to change</p>
        </div>

        {/* Display Name */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Display Name
          </label>
          {editing ? (
            <div className="flex gap-2 mt-1">
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") {
                    setName(profile?.displayName ?? "");
                    setEditing(false);
                  }
                }}
                onBlur={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg border border-blue-400 px-3 py-1.5 text-slate-800 dark:text-slate-100 dark:bg-slate-700 outline-none text-sm"
              />
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full text-left mt-1 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium text-sm group flex items-center gap-2 transition-colors"
            >
              {profile?.displayName ?? "…"}
              <span className="text-slate-400 opacity-0 group-hover:opacity-100 text-xs">edit</span>
            </button>
          )}
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Email
          </label>
          <p className="mt-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            {profile?.email ?? "…"}
          </p>
        </div>

        <Button variant="ghost" onClick={handleSignOut} className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
