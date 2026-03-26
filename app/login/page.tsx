"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirmation(true);
        } else {
          setError(authError.message);
        }
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: "signup", email });
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {needsConfirmation && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 text-sm">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                Email not confirmed
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs mb-2">
                Check your inbox for a confirmation link, or resend it below.
              </p>
              {resendSent ? (
                <p className="text-green-600 dark:text-green-400 text-xs font-medium">
                  Confirmation email resent!
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  {resendLoading ? "Sending…" : "Resend confirmation email"}
                </button>
              )}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1">
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
