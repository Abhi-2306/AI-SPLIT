"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      // If Supabase requires email confirmation, session is null after sign-up
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        // Email confirmation is enabled in the Supabase project
        setAwaitingConfirmation(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Check your email
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            A confirmation link was sent to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <p className="text-xs text-slate-400 mb-4">
            To skip email confirmation for development, go to your Supabase dashboard →
            Authentication → Settings → uncheck &quot;Enable email confirmations&quot;.
          </p>
          <Link href="/login" className="text-blue-600 hover:underline text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-slate-500 mt-1">Create your account</p>
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1">
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
