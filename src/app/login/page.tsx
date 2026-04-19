import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/guard";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/gallery");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-4xl border border-white/70 bg-panel/85 p-8 shadow-soft backdrop-blur sm:p-10">
          <div className="max-w-xl space-y-6">
            <span className="inline-flex rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Private gallery
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                画像をためて、整理して、静かに見返せる自分専用ギャラリー。
              </h1>
              <p className="max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
                フォルダー整理、未分類管理、お気に入り導線を中心にした、複数端末前提の画像倉庫です。
                v1 基盤ではログインとギャラリー導線を安定させます。
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                <p className="font-semibold text-ink">整理</p>
                <p className="mt-2">フォルダー / 未分類 / お気に入りで自然に分類</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                <p className="font-semibold text-ink">保存</p>
                <p className="mt-2">ドラッグ、選択、貼り付けの 3 導線でアップロード</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                <p className="font-semibold text-ink">閲覧</p>
                <p className="mt-2">一覧から先の詳細導線を拡張しやすい構成</p>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-4xl border border-slate-200 bg-white/90 p-8 shadow-soft backdrop-blur sm:p-10">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}

