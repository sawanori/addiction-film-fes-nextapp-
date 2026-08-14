/**
 * manifest（管理画面のフォーム定義）の導出ロジック。
 *
 * **このファイルは何も import しない。** `@/` エイリアスや JSON import を含めると
 * `scripts/verify-coverage.mjs`（Node が TypeScript を直接読む）から使えなくなるため。
 * アプリ側の入口は `lib/content/manifest.ts`。
 *
 * 手書きのフィールド一覧を持たず、実データの形から機械的に導出する。手書きにすると
 * 「型にはあるがフォームに出ていない項目」が生まれ、編集網羅性
 * （`docs/implementation-plan.md` §5）が成り立たなくなるため。
 *
 * パス表記:
 * - 正規化パス（manifest）… 配列の添字を伏せる。例 `price.rows[].type`
 * - 具体パス（PATCH の ops）… 添字を含む。例 `price.rows.3.type`（計画 §9.2）
 */

export type Field =
  | { type: "text" | "textarea" | "image" | "boolean" | "inline"; path: string; label: string }
  | { type: "group"; path: string; label: string; fields: Field[] }
  | { type: "array"; path: string; label: string; item: Field; template: unknown };

export type DocumentManifest = {
  key: string;
  label: string;
  fields: Field[];
};

/** フィールド名の表示名。ここに無いキーはキー名をそのまま出す。 */
const FIELD_LABELS: Record<string, string> = {
  meta: "ページ情報（title / description）",
  title: "タイトル",
  description: "説明",
  head: "見出し",
  eyebrow: "小見出し（英字）",
  jp: "日本語見出し",
  lead: "リード文",
  h: "見出し",
  p: "本文",
  note: "注記",
  boxes: "ボックス",
  rows: "行",
  columns: "列見出し",
  items: "項目",
  label: "ラベル",
  href: "リンク先",
  src: "画像パス",
  alt: "代替テキスト",
  lazy: "遅延読み込み",
  delay: "アニメーション遅延",
  cta: "行動喚起",
  footer: "フッター",
  header: "ヘッダー",
  sections: "セクション",
  q: "質問",
  a: "回答",
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** `[{t:"br"}, "…"]` のように装飾ノードを含む配列か。 */
function hasMarkupNode(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (node) => typeof node === "object" && node !== null && "t" in (node as Record<string, unknown>)
    )
  );
}

/**
 * 全ドキュメントを走査して「その正規化パスの配列は inline である」ものを集める。
 * 1件だけ見ると、たまたま装飾を含まない `["ただの文字列"]` を素の配列と誤判定するため、
 * 同じパスが他のドキュメント・他の要素で装飾を持つかどうかで決める。
 */
function collectInlinePaths(allDocuments: Record<string, unknown>): Set<string> {
  const inlinePaths = new Set<string>();

  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      if (hasMarkupNode(value)) {
        inlinePaths.add(path);
        return;
      }
      value.forEach((item) => walk(item, `${path}[]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };

  for (const doc of Object.values(allDocuments)) {
    walk(doc, "");
  }
  return inlinePaths;
}

/**
 * 同じ正規化パスに現れる値をすべて畳み込んで、代表値（形の和）を作る。
 *
 * 配列の1件目だけを見て形を決めると、**後続の要素にしか無いキーが manifest から落ちる**
 * （実測: `boxes[].delay` や `articles[].variant` など58件が漏れた）。
 * `privacy.sections[].blocks[]` のように要素ごとに形が違う配列もあるため、
 * 全要素のキーの和をとる。
 */
function unify(values: unknown[]): unknown {
  const present = values.filter((v) => v !== undefined);
  if (present.length === 0) return "";

  if (present.some((v) => Array.isArray(v))) {
    const inner = present.filter(Array.isArray).flat();
    return inner.length > 0 ? [unify(inner)] : [];
  }

  if (present.some((v) => typeof v === "object" && v !== null)) {
    const objects = present.filter(
      (v): v is Record<string, unknown> => typeof v === "object" && v !== null
    );
    const keys = new Set<string>();
    objects.forEach((o) => Object.keys(o).forEach((k) => keys.add(k)));
    const merged: Record<string, unknown> = {};
    for (const k of keys) {
      merged[k] = unify(objects.map((o) => o[k]));
    }
    return merged;
  }

  // スカラーは型判定に使うだけなので、いちばん情報量の多いものを代表にする
  const strings = present.filter((v): v is string => typeof v === "string");
  if (strings.length > 0) {
    return strings.reduce((a, b) => (b.length > a.length ? b : a));
  }
  return present[0];
}

function stringFieldType(key: string, value: string): "text" | "textarea" | "image" {
  if (key === "src" || value.startsWith("/assets/")) return "image";
  if (value.includes("\n") || value.length >= 60) return "textarea";
  return "text";
}

/** 配列の「追加」用の雛形（文字列は空、真偽値は false）。 */
function blankTemplate(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return 0;
  if (Array.isArray(value)) return [];
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, blankTemplate(v)])
    );
  }
  return null;
}

/**
 * 導出器を作る。`allDocuments` は inline 判定のために全ドキュメントを渡す
 * （アプリ側は同梱JSON、検証スクリプトは `content/*.json` を渡す）。
 */
export function createManifestBuilder(allDocuments: Record<string, unknown>) {
  const inlinePaths = collectInlinePaths(allDocuments);

  const inferField = (value: unknown, path: string, key: string): Field => {
    const label = labelFor(key);

    if (Array.isArray(value)) {
      if (inlinePaths.has(path) || hasMarkupNode(value)) {
        return { type: "inline", path, label };
      }
      // 1件目ではなく全要素の形の和をとる（unify のコメント参照）
      const sample = unify(value);
      return {
        type: "array",
        path,
        label,
        item: inferField(sample, `${path}[]`, key),
        template: blankTemplate(sample),
      };
    }

    if (typeof value === "object" && value !== null) {
      return {
        type: "group",
        path,
        label,
        fields: Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          inferField(v, path ? `${path}.${k}` : k, k)
        ),
      };
    }

    if (typeof value === "boolean") return { type: "boolean", path, label };
    if (typeof value === "string") return { type: stringFieldType(key, value), path, label };

    // 数値・null は現行データに存在しない。将来出てきたらテキストとして扱う。
    return { type: "text", path, label };
  };

  const buildManifest = (key: string, label: string, doc: unknown): DocumentManifest => ({
    key,
    label,
    fields: Object.entries(doc as Record<string, unknown>).map(([k, v]) => inferField(v, k, k)),
  });

  return { buildManifest, inlinePaths };
}

/**
 * manifest が受け持つ正規化パスの一覧。
 * `inline` は配下をまとめて1フィールドが受け持つので終端として扱う。
 */
export function manifestPaths(fields: Field[]): { leaves: string[]; inlines: string[] } {
  const leaves: string[] = [];
  const inlines: string[] = [];

  const walk = (field: Field): void => {
    switch (field.type) {
      case "group":
        field.fields.forEach(walk);
        return;
      case "array":
        walk(field.item);
        return;
      case "inline":
        inlines.push(field.path);
        return;
      default:
        leaves.push(field.path);
    }
  };

  fields.forEach(walk);
  return { leaves, inlines };
}
