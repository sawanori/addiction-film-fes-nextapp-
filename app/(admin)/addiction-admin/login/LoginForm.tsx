"use client";

import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/addiction-admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aff-admin": "1",
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = next;
        return;
      }

      if (res.status === 401) {
        setError("パスワードが違います");
      } else if (res.status === 429) {
        const data: unknown = await res.json().catch(() => null);
        const retryAfter =
          data !== null &&
          typeof data === "object" &&
          typeof (data as Record<string, unknown>).retryAfter === "number"
            ? (data as { retryAfter: number }).retryAfter
            : 0;
        const minutes = Math.ceil(retryAfter / 60);
        setError(`しばらく待ってください（残り${minutes}分）`);
      } else {
        setError("エラーが発生しました。しばらくしてから再度お試しください。");
      }
    } catch {
      setError("エラーが発生しました。しばらくしてから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm__login">
      <div className="adm__login-card">
        <h1 className="adm__login-title">コンテンツ管理</h1>
        <p className="adm__login-sub">アディクション国際映画祭のサイトを編集します。</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="adm__error">{error}</p>}
          <label className="adm__row">
            <span className="adm__label">パスワード</span>
            <input
              className="adm__field"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </label>
          <button className="adm__button" type="submit" disabled={submitting}>
            {submitting ? "確認中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
