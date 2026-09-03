"use client";

import type { Field } from "@/lib/content/manifest-core";
import { extractYouTubeId } from "@/lib/content/youtube";
import InlineEditor from "./InlineEditor";

/**
 * manifest のフィールド定義1件を描画する。group / array は再帰する。
 *
 * 値の受け渡しは「具体パス（添字つき）と新しい値」で行い、状態は呼び出し元（DocumentEditor）が持つ。
 * 素人が説明書なしで使えることを優先し、次の3点を守る:
 * - 項目名は日本語（manifest 側で付けている）。補足がある項目は小さく説明を出す
 * - 配列の各項目には**中身から作った見出し**を出す（「#3」だけでは何の項目か分からないため）
 * - 長い配列は折りたたむ
 *
 * **グループの描画契約**: グループは「値が `undefined` / `null` の子項目」を描画しない。
 * 要素ごとに形が違う配列（`privacy` / `terms` の `blocks[]` は `{t:"p", value}` か
 * `{t:"ol", items}`）で、manifest がその形の**和**になっているため、一律に出すと
 * 段落ブロックへ箇条書き用の欄が出てしまうからである。
 * その代わり、値が無くても必ず出したい項目は manifest 側で `always: true` を宣言する
 * （`lib/content/manifest-core.ts` の `ALWAYS_SHOWN`）。呼び出し元がデータを空文字で
 * 埋めておく必要はない。
 */

export type ChangeHandler = (path: string, value: unknown) => void;

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null;
}

/** 配列の項目に出す見出しを中身から作る。 */
function itemTitle(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "オン" : "オフ";
  if (Array.isArray(value)) {
    const text = value
      .map((node) => (typeof node === "string" ? node : inlineText(node)))
      .join("")
      .trim();
    return text;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    // 見出しになりやすいキーから順に探す
    const CANDIDATES = [
      "t", "title", "label", "h", "q", "name", "term", "type", "jp", "en",
      "d", "desc", "lead", "text", "value", "p", "p1", "program", "a",
      "alt", "j", "time", "date", "no", "k", "heading", "kind", "src", "img", "href",
    ];
    for (const key of CANDIDATES) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        // 画像やリンクはパス全体だと読みにくいので末尾だけ出す
        return key === "src" || key === "img" ? candidate.split("/").pop() ?? candidate : candidate;
      }
      if (Array.isArray(candidate)) {
        const text = itemTitle(candidate);
        if (text) return text;
      }
    }
  }
  return "";
}

function inlineText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node !== "object" || node === null) return "";
  const record = node as Record<string, unknown>;
  if (record.t === "br") return " ";
  return Array.isArray(record.c) ? record.c.map(inlineText).join("") : "";
}

function truncate(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default function FieldEditor({
  field,
  value,
  path,
  onChange,
  depth = 0,
}: {
  field: Field;
  value: unknown;
  path: string;
  onChange: ChangeHandler;
  depth?: number;
}) {
  // 最上位は「いま選ばれているセクション」だけが表示されるので、折りたたまずカードの見出しにする
  const topHeader = (extra?: React.ReactNode) => (
    <div className="adm__section-head">
      <h2 className="adm__section-title">
        {field.label}
        {extra}
      </h2>
      {field.hint ? <p className="adm__section-hint">{field.hint}</p> : null}
    </div>
  );
  /* ---------------- グループ ---------------- */
  if (field.type === "group") {
    const record = (value ?? {}) as Record<string, unknown>;
    const children = field.fields.filter((child) => {
      const childKey = child.path.slice(field.path.length + 1);
      // 値が無くても出す項目は manifest 側で always を宣言する（上のコメント参照）
      return !isEmptyValue(record[childKey]) || child.always === true;
    });

    const body = children.map((child) => {
      const childKey = child.path.slice(field.path.length + 1);
      return (
        <FieldEditor
          key={child.path}
          field={child}
          value={record[childKey]}
          path={path ? `${path}.${childKey}` : childKey}
          onChange={onChange}
          depth={depth + 1}
        />
      );
    });

    // 最上位は折りたためるカード、入れ子は控えめな囲みにする
    if (depth === 0) {
      return (
        <section className="adm__section">
          {topHeader()}
          <div className="adm__section-body">{body}</div>
        </section>
      );
    }

    return (
      <div className="adm__nest">
        <p className="adm__nest-title">
          {field.label}
          {field.hint ? <span className="adm__hint">{field.hint}</span> : null}
        </p>
        {body}
      </div>
    );
  }

  /* ---------------- 配列 ---------------- */
  if (field.type === "array") {
    const items = Array.isArray(value) ? value : [];
    const setItems = (next: unknown[]) => onChange(path, next);
    const move = (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setItems(next);
    };

    const scalarItem =
      field.item.type === "text" || field.item.type === "textarea" || field.item.type === "image";

    const body = scalarItem ? (
      <>
        <div className="adm__items">
          {items.map((item, i) => (
            <div className="adm__scalar-row" key={i}>
              <span className="adm__item-no">{i + 1}</span>
              <input
                className="adm__field"
                type="text"
                value={typeof item === "string" ? item : ""}
                onChange={(e) => {
                  const next = items.slice();
                  next[i] = e.target.value;
                  setItems(next);
                }}
              />
              <button type="button" className="adm__mini" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="上へ移動">
                ↑
              </button>
              <button type="button" className="adm__mini" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label="下へ移動">
                ↓
              </button>
              <button
                type="button"
                className="adm__mini adm__mini--danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                aria-label="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="adm__mini adm__add"
          onClick={() => setItems([...items, structuredClone(field.template)])}
        >
          ＋ {field.label}を追加
        </button>
      </>
    ) : (
      <>
        <div className="adm__items">
          {items.map((item, i) => {
            const title = truncate(itemTitle(item));
            return (
              <details className="adm__item" key={i} open={items.length <= 3}>
                <summary>
                  <span className="adm__item-no">{i + 1}</span>
                  <span className={title ? "adm__item-title" : "adm__item-title adm__item-title--empty"}>
                    {title || "（未入力）"}
                  </span>
                  <span className="adm__item-tools">
                    <button type="button" className="adm__mini" onClick={(e) => { e.preventDefault(); move(i, i - 1); }} disabled={i === 0} aria-label="上へ移動">
                      ↑
                    </button>
                    <button type="button" className="adm__mini" onClick={(e) => { e.preventDefault(); move(i, i + 1); }} disabled={i === items.length - 1} aria-label="下へ移動">
                      ↓
                    </button>
                    <button
                      type="button"
                      className="adm__mini adm__mini--danger"
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(`「${title || "この項目"}」を削除します。よろしいですか？`)) {
                          setItems(items.filter((_, j) => j !== i));
                        }
                      }}
                    >
                      削除
                    </button>
                  </span>
                </summary>
                <div className="adm__item-body">
                  <FieldEditor field={field.item} value={item} path={`${path}.${i}`} onChange={onChange} depth={depth + 1} />
                </div>
              </details>
            );
          })}
        </div>
        <button
          type="button"
          className="adm__mini adm__add"
          onClick={() => setItems([...items, structuredClone(field.template)])}
        >
          ＋ {field.label}を追加
        </button>
      </>
    );

    if (depth === 0) {
      return (
        <section className="adm__section">
          {topHeader(<span className="adm__count">{items.length}件</span>)}
          <div className="adm__section-body">{body}</div>
        </section>
      );
    }

    return (
      <div className="adm__nest">
        <p className="adm__nest-title">
          {field.label}
          <span className="adm__count">{items.length}件</span>
          {field.hint ? <span className="adm__hint">{field.hint}</span> : null}
        </p>
        {body}
      </div>
    );
  }

  /* ---------------- 値 ---------------- */
  const labelBlock = (
    <>
      <span className="adm__label">{field.label}</span>
      {field.hint ? <span className="adm__hint">{field.hint}</span> : null}
    </>
  );

  if (field.type === "inline") {
    return wrapTop(
      depth,
      <div className="adm__row">
        {labelBlock}
        <InlineEditor value={value} onChange={(next) => onChange(path, next)} />
      </div>
    );
  }

  if (field.type === "boolean") {
    return wrapTop(
      depth,
      <div className="adm__row">
        <label className="adm__check">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(path, e.target.checked)} />
          <span>
            <span className="adm__label">{field.label}</span>
            {field.hint ? <span className="adm__hint">{field.hint}</span> : null}
          </span>
        </label>
      </div>
    );
  }

  if (field.type === "textarea") {
    return wrapTop(
      depth,
      <label className="adm__row">
        {labelBlock}
        <textarea
          className="adm__field adm__field--area"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(path, e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "image") {
    const src = typeof value === "string" ? value : "";
    return wrapTop(
      depth,
      <label className="adm__row">
        {labelBlock}
        <span className="adm__image">
          <input className="adm__field" type="text" value={src} onChange={(e) => onChange(path, e.target.value)} />
          {src.startsWith("/") ? (
            // 画像ファイル本体の差し替えはフェーズ2。ここではパス文字列の編集とプレビューまで
            // eslint-disable-next-line @next/next/no-img-element
            <img className="adm__thumb" src={src} alt="" />
          ) : null}
        </span>
      </label>
    );
  }

  return wrapTop(
    depth,
    <label className="adm__row">
      {labelBlock}
      <input
        className="adm__field"
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(path, e.target.value)}
        // 動画URLを貼ったら、欄を離れた時点で動画IDに変える。保存時にサーバ側でも同じ変換を
        // かけるが（lib/admin/ops.ts）、ここで見せておかないと「何が保存されるのか」が
        // 保存するまで分からない。打鍵のたびに変えると編集しづらいので blur に限る。
        {...(field.format === "youtube-id"
          ? {
              onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                const next = extractYouTubeId(e.target.value);
                if (next !== e.target.value) onChange(path, next);
              },
            }
          : {})}
      />
    </label>
  );
}

/** 最上位に単独で置かれる項目（注記など）はカードに入れて、他のセクションと揃える。 */
function wrapTop(depth: number, node: React.ReactElement): React.ReactElement {
  return depth === 0 ? <div className="adm__plain">{node}</div> : node;
}
