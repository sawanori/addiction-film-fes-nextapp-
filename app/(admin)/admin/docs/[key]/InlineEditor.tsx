"use client";

/**
 * inline（リッチテキスト）の編集。
 *
 * 許可タグは5種（br / strong / em / b / span / link）で、`lib/admin/ops.ts` の
 * `isValidInline` が保存時にも同じ制約を検証する。ここではノードを1行ずつ並べて編集する。
 * 入れ子（強調の中の強調など）は現行データに存在しないため、装飾ノードの中身は
 * 「文字列1つ」に正規化して扱う。
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
  return node.c.map(nodeText).join("");
}

function label(node: InlineNode): string {
  if (typeof node === "string") return "文字";
  switch (node.t) {
    case "br":
      return "改行";
    case "strong":
      return "強調 (strong)";
    case "em":
      return "強調 (em)";
    case "b":
      return "太字 (b)";
    case "span":
      return "span";
    case "link":
      return "リンク";
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
      {nodes.map((node, i) => (
        <div className="adm__inline-row" key={i}>
          <span className="adm__tag">{label(node)}</span>
          {typeof node !== "string" && node.t === "br" ? (
            <span className="adm__inline-br">（改行）</span>
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
              className="adm__field adm__field--href"
              type="text"
              value={node.href}
              onChange={(e) => replace(i, { ...node, href: e.target.value })}
              aria-label="リンク先"
            />
          ) : null}
          <button type="button" className="adm__mini" onClick={() => move(i, -1)} aria-label="上へ">
            ↑
          </button>
          <button type="button" className="adm__mini" onClick={() => move(i, 1)} aria-label="下へ">
            ↓
          </button>
          <button type="button" className="adm__mini adm__mini--danger" onClick={() => remove(i)} aria-label="削除">
            ×
          </button>
        </div>
      ))}
      <div className="adm__inline-add">
        <button type="button" className="adm__mini" onClick={() => add("")}>
          + 文字
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "br" })}>
          + 改行
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "strong", c: [""] })}>
          + 強調
        </button>
        <button type="button" className="adm__mini" onClick={() => add({ t: "link", href: "", c: [""] })}>
          + リンク
        </button>
      </div>
    </div>
  );
}
