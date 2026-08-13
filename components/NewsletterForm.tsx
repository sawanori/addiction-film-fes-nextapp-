"use client";

/**
 * ニュースレター登録フォーム。
 * 変換元は onsubmit="return false" で送信を無効化している（配信機能は未実装の仮置き）。
 */
export default function NewsletterForm() {
  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <input type="email" placeholder="E-mail" aria-label="メールアドレス" />
      <button type="submit">Subscribe →</button>
    </form>
  );
}
