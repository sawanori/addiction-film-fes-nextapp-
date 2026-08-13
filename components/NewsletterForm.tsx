"use client";

/**
 * ニュースレター登録フォーム。
 * 変換元は onsubmit="return false" で送信を無効化している（配信機能は未実装の仮置き）。
 * 文言は props で受け取る（content/index.json の newsletter.form）。
 */
export default function NewsletterForm({
  placeholder,
  ariaLabel,
  button,
}: {
  placeholder: string;
  ariaLabel: string;
  button: string;
}) {
  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <input type="email" placeholder={placeholder} aria-label={ariaLabel} />
      <button type="submit">{button}</button>
    </form>
  );
}
