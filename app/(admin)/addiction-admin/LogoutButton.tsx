"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/addiction-admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-aff-admin": "1" },
        body: "{}",
      });
    } finally {
      // Cookie が消えているので、再取得すればログイン画面へリダイレクトされる
      router.replace("/addiction-admin/login");
      router.refresh();
    }
  }

  return (
    <button className="adm__button adm__button--ghost" type="button" onClick={handleLogout} disabled={busy}>
      ログアウト
    </button>
  );
}
