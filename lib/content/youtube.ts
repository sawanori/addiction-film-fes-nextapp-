/**
 * YouTube の URL から動画IDを取り出す。
 *
 * 管理画面の「YouTube の動画ID」欄は、利用者が**動画URLをそのまま貼れる**ようにしたい。
 * 一方で埋め込みに必要なのはIDだけなので、保存時にIDへ揃える。
 *
 * `lib/admin/ops.ts` の「文字列を trim・正規化しない」原則
 * （`docs/implementation-plan.md` §8.4）に対する**明示的な例外**で、
 * manifest で `format: "youtube-id"` を付けた欄にだけ効く。他の欄の文字列は一切加工しない。
 * 前後の空白を落とすのも同じ例外に含む。この欄は散文ではなく機械的な形式で、
 * 貼り付け運用では前後に空白が混ざるのが日常的なため
 * （`docs/plans/trailer-admin/implementation-plan.md` §16-4 に判断の経緯がある）。
 *
 * 変換できない入力は**そのまま返す**。捨てるかどうかを決めるのはここではなく、
 * 呼び出し側の検証（`isYouTubeId` を使う 422 判定）の責務にする。
 * ここで空文字にすると、利用者が何を入れたか分からなくなる。
 */

/** YouTube の動画IDの形（11文字の英数字・ハイフン・アンダースコア）。 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** `/embed/ID`・`/shorts/ID`・`/live/ID`・`/v/ID` のように、パスの直後にIDが来る形。 */
const PATH_PREFIXES = ["embed", "shorts", "live", "v"];

const HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
];

/** 保存してよい値か。空文字（＝予告編なし）は呼び出し側で別途許す。 */
export function isYouTubeId(value: string): boolean {
  return VIDEO_ID.test(value);
}

export function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return input;
  if (VIDEO_ID.test(trimmed)) return trimmed;

  // `youtu.be/xxx` のようにスキームを省いた貼り方も受ける。
  // ただし補うのは**既知のホスト名で始まる場合だけ**にする。何にでも `https://` を足すと、
  // ただの書き損じが「URLとして解釈できるが変換できない文字列」に化けて紛らわしい。
  const looksLikeHost = HOSTS.some(
    (host) => trimmed === host || trimmed.startsWith(`${host}/`)
  );
  const hasScheme = /^https?:\/\//i.test(trimmed);
  if (!hasScheme && !looksLikeHost) return input;

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return input;
  }
  if (!HOSTS.includes(url.hostname)) return input;

  const segments = url.pathname.split("/").filter(Boolean);

  // youtu.be/ID
  if (url.hostname === "youtu.be") {
    const id = segments[0];
    return id && VIDEO_ID.test(id) ? id : input;
  }

  // youtube.com/watch?v=ID
  const v = url.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return v;

  // youtube.com/embed/ID ほか
  if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0])) {
    const id = segments[1];
    if (VIDEO_ID.test(id)) return id;
  }

  return input;
}
