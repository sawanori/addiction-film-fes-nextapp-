"use client";

import type { Field } from "@/lib/content/manifest-core";
import InlineEditor from "./InlineEditor";

/**
 * manifest のフィールド定義1件を描画する。group / array は再帰する。
 * 値の受け渡しは「具体パス（添字つき）と新しい値」で行い、状態の更新は
 * 呼び出し元（DocumentEditor）がまとめて持つ。
 */

export type ChangeHandler = (path: string, value: unknown) => void;

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null;
}

export default function FieldEditor({
  field,
  value,
  path,
  onChange,
}: {
  field: Field;
  value: unknown;
  path: string;
  onChange: ChangeHandler;
}) {
  if (field.type === "group") {
    const record = (value ?? {}) as Record<string, unknown>;
    return (
      <fieldset className="adm__group">
        <legend className="adm__legend">{field.label}</legend>
        {field.fields.map((child) => {
          const childKey = child.path.slice(field.path.length + 1);
          if (isEmptyValue(record[childKey])) return null;
          return (
            <FieldEditor
              key={child.path}
              field={child}
              value={record[childKey]}
              path={path ? `${path}.${childKey}` : childKey}
              onChange={onChange}
            />
          );
        })}
      </fieldset>
    );
  }

  if (field.type === "array") {
    const items = Array.isArray(value) ? value : [];
    const setItems = (next: unknown[]) => onChange(path, next);

    return (
      <fieldset className="adm__group adm__group--array">
        <legend className="adm__legend">
          {field.label}
          <span className="adm__count">{items.length}件</span>
        </legend>

        {items.map((item, i) => (
          <div className="adm__item" key={i}>
            <div className="adm__item-bar">
              <span className="adm__index">#{i + 1}</span>
              <button
                type="button"
                className="adm__mini"
                onClick={() => {
                  if (i === 0) return;
                  const next = items.slice();
                  const [moved] = next.splice(i, 1);
                  next.splice(i - 1, 0, moved);
                  setItems(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="adm__mini"
                onClick={() => {
                  if (i === items.length - 1) return;
                  const next = items.slice();
                  const [moved] = next.splice(i, 1);
                  next.splice(i + 1, 0, moved);
                  setItems(next);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="adm__mini adm__mini--danger"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                削除
              </button>
            </div>
            <FieldEditor field={field.item} value={item} path={`${path}.${i}`} onChange={onChange} />
          </div>
        ))}

        <button
          type="button"
          className="adm__mini"
          onClick={() => setItems([...items, structuredClone(field.template)])}
        >
          + 追加
        </button>
      </fieldset>
    );
  }

  if (field.type === "inline") {
    return (
      <label className="adm__row">
        <span className="adm__label">{field.label}</span>
        <InlineEditor value={value} onChange={(next) => onChange(path, next)} />
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="adm__row adm__row--check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(path, e.target.checked)}
        />
        <span className="adm__label">{field.label}</span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="adm__row">
        <span className="adm__label">{field.label}</span>
        <textarea
          className="adm__field adm__field--area"
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(path, e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "image") {
    return (
      <label className="adm__row">
        <span className="adm__label">{field.label}</span>
        <input
          className="adm__field"
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(path, e.target.value)}
        />
        {typeof value === "string" && value.startsWith("/") ? (
          // 画像ファイル本体の差し替えはフェーズ2。ここではパス文字列の編集とプレビューまで
          // eslint-disable-next-line @next/next/no-img-element
          <img className="adm__thumb" src={value} alt="" />
        ) : null}
      </label>
    );
  }

  return (
    <label className="adm__row">
      <span className="adm__label">{field.label}</span>
      <input
        className="adm__field"
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(path, e.target.value)}
      />
    </label>
  );
}
