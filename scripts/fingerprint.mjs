#!/usr/bin/env node
/**
 * スナップショットしたHTMLから、DOMパスごとの値を取り出して指紋(fingerprint)にする。
 *
 * CLAUDE.md の不変条件「可視テキスト・DOM構造・class名・title/description は
 * 変換元の8ページと完全一致」を機械判定するための土台。
 *
 * 「タグの出現回数が同じ」だけでは DOM 構造の一致を保証できない
 * （例: <strong>1日券</strong> と <strong>2日券</strong> を別のセルへ移しても数は2のまま）。
 * そのため要素ごとに **ルートからのパス** を振り、そのパスでの
 * タグ名・全属性・直下の子ノード列（テキストは中身そのまま）を記録して突き合わせる。
 *
 * ビルドごとに変わる値（/_next/ 配下のチャンクハッシュ、React のインスタンスID）は
 * 正規化して比較対象から外す。
 *
 * 使い方:
 *   node scripts/fingerprint.mjs <snapshotDir> > out.json
 *   node scripts/fingerprint.mjs --compare <baseline.json> <current.json>
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";

/* ------------------------------------------------------------------ *
 * 正規化
 * ------------------------------------------------------------------ */

// ビルドのたびに変わる部分。値の差ではなく「同じ役割のものが同じ位置にある」ことだけ見たい。
const VOLATILE = [
  [/\/_next\/static\/chunks\/[^"'\s]+/g, "/_next/static/chunks/<HASH>"],
  [/\/_next\/static\/css\/[^"'\s]+/g, "/_next/static/css/<HASH>"],
  [/\/_next\/static\/media\/[^"'\s]+/g, "/_next/static/media/<HASH>"],
  [/\/_next\/static\/[A-Za-z0-9_-]+\/_(buildManifest|ssgManifest)\.js/g, "/_next/static/<BUILD>/_manifest.js"],
];

const normalize = (value) => {
  let out = value;
  for (const [re, to] of VOLATILE) out = out.replace(re, to);
  return out;
};

/* ------------------------------------------------------------------ *
 * DOM 走査
 * ------------------------------------------------------------------ */

const isElement = (node) => typeof node.tagName === "string";
const isText = (node) => node.nodeName === "#text";
const isComment = (node) => node.nodeName === "#comment";

// <script> と <style> の中身は可視結果ではないので、子ノード列には出さない。
// （タグ自体が同じ位置にあることは記録する）
const OPAQUE = new Set(["script", "style"]);

/**
 * 子ノード列の署名。
 * テキストノードは中身をそのまま持つ（テキストノードの境界が変わったことを検出するため）。
 * React SSR は隣接テキストノードの境界に <!-- --> を挿入するので、コメントも記録する。
 */
function childSignature(node) {
  if (OPAQUE.has(node.tagName)) return ["<opaque>"];
  const out = [];
  for (const child of node.childNodes ?? []) {
    if (isText(child)) out.push(`#text:${normalize(child.value)}`);
    else if (isComment(child)) out.push(`#comment:${child.data}`);
    else if (isElement(child)) out.push(child.tagName);
  }
  return out;
}

function attrsOf(node) {
  const out = {};
  for (const { name, value } of node.attrs ?? []) out[name] = normalize(value);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * 要素ごとに1エントリを作る。
 * path は「親の要素の子のうち何番目の要素か」を . で連ねたもの（例 "0.1.2"）。
 */
function walk(node, path, acc) {
  acc.push({
    path,
    tag: node.tagName,
    attrs: attrsOf(node),
    children: childSignature(node),
  });
  let i = 0;
  for (const child of node.childNodes ?? []) {
    if (isElement(child)) {
      walk(child, path === "" ? String(i) : `${path}.${i}`, acc);
      i += 1;
    }
  }
}

function countComments(node, box) {
  for (const child of node.childNodes ?? []) {
    if (isComment(child)) box.n += 1;
    if (isElement(child) || child.childNodes) countComments(child, box);
  }
}

function findOne(node, predicate) {
  if (isElement(node) && predicate(node)) return node;
  for (const child of node.childNodes ?? []) {
    const hit = findOne(child, predicate);
    if (hit) return hit;
  }
  return null;
}

function findAll(node, predicate, acc = []) {
  if (isElement(node) && predicate(node)) acc.push(node);
  for (const child of node.childNodes ?? []) findAll(child, predicate, acc);
  return acc;
}

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value ?? null;

/**
 * <head> の不変条件。
 * CLAUDE.md は title/description に加えて robots と Google Fonts の link 3行も
 * 不変としているため、ここで拾う。
 */
function headOf(doc) {
  const html = findOne(doc, (n) => n.tagName === "html");
  const titleEl = findOne(doc, (n) => n.tagName === "title");
  const metas = {};
  for (const m of findAll(doc, (n) => n.tagName === "meta")) {
    const key = attr(m, "name") ?? attr(m, "property") ?? attr(m, "charset") ?? null;
    if (key) metas[key] = attr(m, "content") ?? "";
  }
  const links = findAll(doc, (n) => n.tagName === "link")
    .map((l) => `${attr(l, "rel") ?? ""} ${normalize(attr(l, "href") ?? "")}`.trim())
    .sort();
  return {
    lang: html ? attr(html, "lang") : null,
    title: titleEl?.childNodes?.[0]?.value ?? null,
    metas: Object.fromEntries(Object.entries(metas).sort(([a], [b]) => (a < b ? -1 : 1))),
    links,
  };
}

/** 可視テキストノードを出現順に並べたもの。差分が出たとき人間が読むために残す。 */
function visibleText(node, acc = []) {
  if (isElement(node) && OPAQUE.has(node.tagName)) return acc;
  if (isText(node)) {
    const t = node.value.replace(/\s+/g, " ").trim();
    if (t) acc.push(t);
  }
  for (const child of node.childNodes ?? []) visibleText(child, acc);
  return acc;
}

function fingerprintHtml(html) {
  const doc = parse(html);
  const body = findOne(doc, (n) => n.tagName === "body");
  const elements = [];
  if (body) walk(body, "", elements);
  const box = { n: 0 };
  countComments(doc, box);
  return {
    head: headOf(doc),
    commentCount: box.n,
    elementCount: elements.length,
    text: body ? visibleText(body) : [],
    elements,
  };
}

/* ------------------------------------------------------------------ *
 * 比較
 * ------------------------------------------------------------------ */

function diffRoute(name, base, cur, problems) {
  const push = (msg) => problems.push(`[${name}] ${msg}`);

  if (JSON.stringify(base.head) !== JSON.stringify(cur.head)) {
    for (const key of ["lang", "title"]) {
      if (base.head[key] !== cur.head[key]) push(`head.${key}: "${base.head[key]}" → "${cur.head[key]}"`);
    }
    for (const key of new Set([...Object.keys(base.head.metas), ...Object.keys(cur.head.metas)])) {
      if (base.head.metas[key] !== cur.head.metas[key]) {
        push(`head.meta[${key}]: "${base.head.metas[key] ?? "(なし)"}" → "${cur.head.metas[key] ?? "(なし)"}"`);
      }
    }
    const bl = new Set(base.head.links);
    const cl = new Set(cur.head.links);
    for (const l of bl) if (!cl.has(l)) push(`head.link 消失: ${l}`);
    for (const l of cl) if (!bl.has(l)) push(`head.link 追加: ${l}`);
  }

  // React SSR は隣接テキストノードの境界に <!-- --> を入れる。
  // baseline は全ページ0個なので、増えたらインライン構造が変わった合図。
  if (base.commentCount !== cur.commentCount) {
    push(`コメントノード数: ${base.commentCount} → ${cur.commentCount}（隣接テキストノードが生まれた可能性）`);
  }

  const baseByPath = new Map(base.elements.map((e) => [e.path, e]));
  const curByPath = new Map(cur.elements.map((e) => [e.path, e]));

  for (const [path, b] of baseByPath) {
    const c = curByPath.get(path);
    if (!c) {
      push(`要素が消失: ${path} <${b.tag}${b.attrs.class ? ` class="${b.attrs.class}"` : ""}>`);
      continue;
    }
    if (b.tag !== c.tag) push(`${path} タグ: <${b.tag}> → <${c.tag}>`);
    for (const key of new Set([...Object.keys(b.attrs), ...Object.keys(c.attrs)])) {
      if (b.attrs[key] !== c.attrs[key]) {
        push(`${path} <${b.tag}> 属性 ${key}: "${b.attrs[key] ?? "(なし)"}" → "${c.attrs[key] ?? "(なし)"}"`);
      }
    }
    if (JSON.stringify(b.children) !== JSON.stringify(c.children)) {
      push(`${path} <${b.tag}> 子ノード列:\n      期待: ${JSON.stringify(b.children)}\n      実際: ${JSON.stringify(c.children)}`);
    }
  }
  for (const path of curByPath.keys()) {
    if (!baseByPath.has(path)) {
      const c = curByPath.get(path);
      push(`要素が増加: ${path} <${c.tag}${c.attrs.class ? ` class="${c.attrs.class}"` : ""}>`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * エントリポイント
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);

if (args[0] === "--compare") {
  const [, basePath, curPath] = args;
  if (!basePath || !curPath) {
    console.error("usage: node scripts/fingerprint.mjs --compare <baseline.json> <current.json>");
    process.exit(2);
  }
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  const cur = JSON.parse(readFileSync(curPath, "utf8"));
  const problems = [];

  for (const route of Object.keys(base)) {
    if (!cur[route]) {
      problems.push(`[${route}] ルートが取得できていない`);
      continue;
    }
    diffRoute(route, base[route], cur[route], problems);
  }
  for (const route of Object.keys(cur)) {
    if (!base[route]) problems.push(`[${route}] baseline に存在しないルート`);
  }

  if (problems.length === 0) {
    const routes = Object.keys(base).length;
    const els = Object.values(base).reduce((n, r) => n + r.elementCount, 0);
    const texts = Object.values(base).reduce((n, r) => n + r.text.length, 0);
    console.log(`完全一致: ${routes}ルート / 要素${els}個 / テキストノード${texts}個 / コメントノード0個`);
    process.exit(0);
  }

  console.error(`差分 ${problems.length} 件:\n`);
  for (const p of problems.slice(0, 60)) console.error(`  - ${p}`);
  if (problems.length > 60) console.error(`  … 他 ${problems.length - 60} 件`);
  process.exit(1);
}

const dir = args[0];
if (!dir) {
  console.error("usage: node scripts/fingerprint.mjs <snapshotDir> > out.json");
  process.exit(2);
}

const out = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".html")).sort()) {
  out[file.replace(/\.html$/, "")] = fingerprintHtml(readFileSync(join(dir, file), "utf8"));
}
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
