import type { DocumentManifest, Field } from "@/lib/content/manifest-core";

/**
 * PATCH の差分オペレーションの検証と適用。
 *
 * 設計上の要点:
 * - **manifest に無いパスは触れない。** 実データから導出した manifest を唯一の許可リストにする
 *   ことで、DOM 構造そのものを書き換えるような編集を構造的に防ぐ（CLAUDE.md の不変条件）。
 * - **文字列を trim・正規化・全角半角変換しない**（`docs/implementation-plan.md` §8.4）。
 *   唯一の例外は改行コードで、`\r\n` を `\n` に揃える（現行値に `\r` は存在しない）。
 * - **inline（リッチテキスト）は許可タグ5種のみ**。`dangerouslySetInnerHTML` を使わない設計と
 *   合わせて、保存型XSSの面積を構造的に小さくする。
 * - 全 ops が検証を通ったときだけ適用する（壊れた途中状態を保存しない）。
 */

export type Op =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; index: number; item: unknown }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };

export type OpError = { path: string; message: string };

export type ApplyResult =
  | { ok: true; data: unknown }
  | { ok: false; errors: OpError[] };

/* ------------------------------------------------------------------ *
 * パス
 * ------------------------------------------------------------------ */

/** `price.rows.3.type` → `price.rows[].type`（manifest の正規化パスに合わせる）。 */
export function normalizePath(path: string): string {
  const segments = path.split(".");
  let out = "";
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      out += "[]";
      continue;
    }
    out = out ? `${out}.${segment}` : segment;
  }
  return out;
}

/** manifest の全フィールドを正規化パスで引けるようにする。 */
export function indexFields(manifest: DocumentManifest): Map<string, Field> {
  const index = new Map<string, Field>();
  const walk = (field: Field): void => {
    index.set(field.path, field);
    if (field.type === "group") field.fields.forEach(walk);
    if (field.type === "array") walk(field.item);
  };
  manifest.fields.forEach(walk);
  return index;
}

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return typeof value === "object" && value !== null;
}

/** パスの親コンテナと末端キーを取り出す。存在しないパスは null。 */
function resolveParent(
  root: unknown,
  path: string
): { parent: Container; key: string | number } | null {
  const segments = path.split(".");
  let current: unknown = root;

  for (let i = 0; i < segments.length - 1; i++) {
    if (!isContainer(current)) return null;
    const segment = segments[i];
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
  }

  if (!isContainer(current)) return null;
  const last = segments[segments.length - 1];
  return { parent: current, key: Array.isArray(current) ? Number(last) : last };
}

function readPath(root: unknown, path: string): unknown {
  const resolved = resolveParent(root, path);
  if (!resolved) return undefined;
  const { parent, key } = resolved;
  return Array.isArray(parent) ? parent[key as number] : parent[key as string];
}

/* ------------------------------------------------------------------ *
 * 値の検証
 * ------------------------------------------------------------------ */

const INLINE_TAGS = new Set(["br", "strong", "em", "b", "span", "link"]);

/** 許可タグ5種だけからなる Inline AST か。 */
export function isValidInline(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((node) => {
    if (typeof node === "string") return true;
    if (typeof node !== "object" || node === null) return false;

    const record = node as Record<string, unknown>;
    const tag = record.t;
    if (typeof tag !== "string" || !INLINE_TAGS.has(tag)) return false;

    if (tag === "br") return Object.keys(record).length === 1;

    if (tag === "link") {
      if (typeof record.href !== "string") return false;
      if ("cls" in record && typeof record.cls !== "string") return false;
      const allowed = new Set(["t", "href", "cls", "c"]);
      if (!Object.keys(record).every((k) => allowed.has(k))) return false;
      return isValidInline(record.c);
    }

    if (tag === "span") {
      if ("cls" in record && typeof record.cls !== "string") return false;
      const allowed = new Set(["t", "cls", "c"]);
      if (!Object.keys(record).every((k) => allowed.has(k))) return false;
      return isValidInline(record.c);
    }

    // strong / em / b
    const allowed = new Set(["t", "c"]);
    if (!Object.keys(record).every((k) => allowed.has(k))) return false;
    return isValidInline(record.c);
  });
}

/** 改行コードだけ揃える。trim も正規化もしない（§8.4）。 */
function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

/** 文字列を含む値を再帰的に改行正規化する（配列要素の追加で使う）。 */
function normalizeDeep(value: unknown): unknown {
  if (typeof value === "string") return normalizeNewlines(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (isContainer(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeDeep(v)])
    );
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * ドキュメント全体の検証（管理画面UIの保存経路）
 * ------------------------------------------------------------------ */

/**
 * 送られてきたドキュメント全体を manifest と突き合わせる。
 *
 * 管理画面のフォームは「その場で編集した結果のドキュメント全体」を送る（差分 ops を
 * クライアント側で組み立てると、配列の挿入・並べ替えで添字がずれた ops を作りうるため）。
 * そのぶん検証はここで全リーフに対して行う:
 *
 * - manifest に無いパスがあれば拒否（DOM構造ごと差し替える編集を防ぐ）
 * - 型が違えば拒否（真偽値の欄に文字列、など）
 * - inline は許可タグ5種のみ
 */
export function validateDocument(doc: unknown, manifest: DocumentManifest): OpError[] {
  const fields = indexFields(manifest);
  const errors: OpError[] = [];

  const walk = (value: unknown, path: string): void => {
    const field = path === "" ? undefined : fields.get(normalizeArrayPath(path));

    if (field?.type === "inline") {
      if (!isValidInline(value)) {
        errors.push({ path, message: "許可タグ（br/strong/em/b/span/link）以外を含みます" });
      }
      return;
    }

    if (Array.isArray(value)) {
      if (path !== "" && field?.type !== "array") {
        errors.push({ path, message: "manifest では配列ではありません" });
        return;
      }
      value.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)));
      return;
    }

    if (isContainer(value)) {
      if (path !== "" && field && field.type !== "group") {
        errors.push({ path, message: "manifest ではオブジェクトではありません" });
        return;
      }
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
      }
      return;
    }

    // ここまで来たらリーフ
    if (!field) {
      errors.push({ path, message: `manifest に無いパスです（${normalizeArrayPath(path)}）` });
      return;
    }
    if (field.type === "boolean") {
      if (typeof value !== "boolean") errors.push({ path, message: "真偽値が必要です" });
      return;
    }
    if (field.type === "text" || field.type === "textarea" || field.type === "image") {
      if (typeof value !== "string") errors.push({ path, message: "文字列が必要です" });
      return;
    }
    errors.push({ path, message: `${field.type} フィールドに値を直接置けません` });
  };

  walk(doc, "");
  return errors.slice(0, 50);
}

/** 具体パス（添字つき）を manifest の正規化パスへ。`normalizePath` の別名。 */
const normalizeArrayPath = normalizePath;

/** 保存前に改行コードだけ揃える（trim も正規化もしない。§8.4）。 */
export function normalizeDocument(doc: unknown): unknown {
  return normalizeDeep(doc);
}

/* ------------------------------------------------------------------ *
 * 適用
 * ------------------------------------------------------------------ */

/**
 * ops を検証してから適用する。1件でも不正なら何も適用せずエラーを返す。
 * `doc` は変更せず、新しいオブジェクトを返す。
 */
export function applyOps(doc: unknown, ops: Op[], manifest: DocumentManifest): ApplyResult {
  const fields = indexFields(manifest);
  const errors: OpError[] = [];

  if (!Array.isArray(ops)) {
    return { ok: false, errors: [{ path: "", message: "ops が配列ではありません" }] };
  }
  if (ops.length === 0) {
    return { ok: false, errors: [{ path: "", message: "ops が空です" }] };
  }

  // 1. 検証（この時点では何も変更しない）
  for (const op of ops) {
    if (typeof op !== "object" || op === null || typeof (op as Op).path !== "string") {
      errors.push({ path: "", message: "op の形式が不正です" });
      continue;
    }

    const normalized = normalizePath(op.path);
    const field = fields.get(normalized);
    if (!field) {
      errors.push({ path: op.path, message: `manifest に無いパスです（${normalized}）` });
      continue;
    }

    if (op.op === "set") {
      if (field.type === "boolean") {
        if (typeof op.value !== "boolean") {
          errors.push({ path: op.path, message: "真偽値が必要です" });
        }
      } else if (field.type === "inline") {
        if (!isValidInline(op.value)) {
          errors.push({ path: op.path, message: "許可タグ（br/strong/em/b/span/link）以外を含みます" });
        }
      } else if (field.type === "text" || field.type === "textarea" || field.type === "image") {
        if (typeof op.value !== "string") {
          errors.push({ path: op.path, message: "文字列が必要です" });
        }
      } else {
        errors.push({ path: op.path, message: `${field.type} フィールドには set できません` });
      }
      if (readPath(doc, op.path) === undefined) {
        errors.push({ path: op.path, message: "対象が存在しません" });
      }
      continue;
    }

    // insert / remove / move は配列フィールドが対象
    if (field.type !== "array") {
      errors.push({ path: op.path, message: `${op.op} は配列フィールドにのみ使えます` });
      continue;
    }
    const target = readPath(doc, op.path);
    if (!Array.isArray(target)) {
      errors.push({ path: op.path, message: "対象が配列ではありません" });
      continue;
    }
    if (op.op === "insert") {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index > target.length) {
        errors.push({ path: op.path, message: "index が範囲外です" });
      }
    } else if (op.op === "remove") {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= target.length) {
        errors.push({ path: op.path, message: "index が範囲外です" });
      }
    } else if (op.op === "move") {
      const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < target.length;
      if (!inRange(op.from) || !inRange(op.to)) {
        errors.push({ path: op.path, message: "from / to が範囲外です" });
      }
    } else {
      // 型の上では到達しないが、外部入力なので実行時には来うる
      errors.push({ path: (op as Op).path, message: "未知の op です" });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // 2. 適用（検証を全部通ったあとにコピーへ適用する）
  const next: unknown = JSON.parse(JSON.stringify(doc));

  for (const op of ops) {
    const resolved = resolveParent(next, op.path);
    if (!resolved) {
      return { ok: false, errors: [{ path: op.path, message: "適用中に対象を見失いました" }] };
    }
    const { parent, key } = resolved;

    if (op.op === "set") {
      const value = typeof op.value === "string" ? normalizeNewlines(op.value) : normalizeDeep(op.value);
      if (Array.isArray(parent)) parent[key as number] = value;
      else parent[key as string] = value;
      continue;
    }

    const array = (Array.isArray(parent) ? parent[key as number] : parent[key as string]) as unknown[];
    if (op.op === "insert") array.splice(op.index, 0, normalizeDeep(op.item));
    else if (op.op === "remove") array.splice(op.index, 1);
    else if (op.op === "move") {
      const [moved] = array.splice(op.from, 1);
      array.splice(op.to, 0, moved);
    }
  }

  return { ok: true, data: next };
}
