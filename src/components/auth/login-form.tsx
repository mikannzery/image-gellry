"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClientSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClientSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "ログインに失敗しました。");
      return;
    }

    router.push("/gallery");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">Login</p>
        <div>
          <h2 className="text-3xl font-semibold text-ink">ログイン</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            アカウントは Supabase Dashboard で作成したものを利用します。
          </p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">メールアドレス</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            type="email"
            autoComplete="email"
            placeholder="[email protected]"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">パスワード</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            type="password"
            autoComplete="current-password"
            placeholder="8文字以上"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}

