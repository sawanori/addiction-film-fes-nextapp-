"use client";

/**
 * 文中に装飾やリンクを含む文章の編集。
 *
 * 保存できるのは許可タグ5種（改行 / 太字 strong・em・b / span / リンク）だけで、
 * `lib/admin/ops.ts` の `isValidInline` が保存時にも同じ制約を検証する。
 * 素人が迷わないよう、(1) 完成形のプレビューを上に出す、(2) 各行に「文章」「改行」「太字」
 * 「リンク」と日本語で書く、(3) 追加ボタンを日本語にする、の3点を守っている。
 * 入れ子（太字の中の太字など）は現行データに無いので、装飾の中身は文字列1つとして扱う。
 */

type InlineNode =
  | string
  | { t: "br" }
  | { t: "strong" | "em" | "b"; c: InlineNode[] }
  | { t: "span"; cls?: string; c: InlineNode[] }
  | { t: "link"; href: string; cls?: string; c: InlineNode[] };

function nodeText(node: InlineNode): string {
  if (typeof node === "string") return node;
  if (node.t === "br") return "";
  // manifest 側で inline と判定されていても、想定外の形が来たら落とさない
  return Array.isArray(node.c) ? node.c.map(nodeText).join("") : "";
}

function label(node: InlineNode): string {
  if (typeof node === "string") return "文章";
  switch (node.t) {
    case "br":
      return "改行";
    case "strong":
    case "b":
      return "太字";
    case "em":
      return "強調";
    case "span":
      return "装飾";
    case "link":
      return "リンク";
    default:
      return "文章";
  }
}

export default function InlineEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: InlineNode[]) => void;
}) {
  const nodes: InlineNode[] = Array.isArray(value) ? (value as InlineNode[]) : [];

  const replace = (index: number, node: InlineNode) => {
    const next = nodes.slice();
    next[index] = node;
    onChange(next);
  };

  const setText = (index: number, text: string) => {
    const node = nodes[index];
    if (typeof node === "string") return replace(index, text);
    if (node.t === "br") return;
    replace(index, { ...node, c: [text] } as InlineNode);
  };

  const add = (node: InlineNode) => onChange([...nodes, node]);
  const remove = (index: number) => onChange(nodes.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= nodes.length) return;
    const next = nodes.slice();
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="adm__inline">
      <p className="adm__inline-preview">
        {nodes.length === 0 ? (
          <span className="adm__hint">まだ何も入っていません。下のボタンで追加してください。</span>
        ) : (
          nodes.map((node, i) => {
            if (typeof node !== "string" && node.t === "br") return <br key={i} />;
            const text = nodeText(node);
            if (typeof node !== "string" && (node.t === "strong" || node.t === "b" || node.t === "em")) {
              return <em key={i}>{text}</em>;
            }
            return <span key={i}>{text}</span>;
          })
        )}
      </p>

      {nodes.map((node, i) => (
        <div className="adm__inline-row" key={i}>
          <span className={typeof node !== "string" && node.t === "br" ? "adm__tag adm__tag--br" : "adm__tag"}>
            {label(node)}
          </span>
          {typeof node !== "string" && node.t === "br" ? (
            <span className="adm__inline-br">ここで行が変わります</span>
          ) : (
            <input
              className="adm__field"
              type="text"
              value={nodeText(node)}
              onChange={(e) => setText(i, e.target.value)}
            />
          )}
          {typeof node !== "string" && node.t === "link" ? (
            <input
              className="adm__field"
              type="text"
              value={node.href}
              onChange={(e) => replace(i, { ...node, href: e.target.value })}
              placeholder="リンク先（例: /tickets）"
              aria-label="リンク先"
            />
          ) : null}
          <button type="button" className="adm__mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ移動">
            ↑
          </button>
          <button type="button" className="adm__mini" onClick={() => move(i, 1)} disabled={i === nodes.length - 1} aria-label="下へ移動">
            ↓
          </button>
          <button type="button" className="adm__mini adm__mini--danger" onClick={() => remove(i)} aria-label="削除">
            ×
          </button>
        </div>
      ))}

      <div className="adm__inline-add">
        <button type="button" className="adm__mini" onClick={() => add("")}>
          ＋ 文章
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "br" })}>
          ＋ 改行
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "strong", c: [""] })}>
          ＋ 太字
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "link", href: "", c: [""] })}>
          ＋ リンク
        </button>
      </div>
    </div>
  );
}
