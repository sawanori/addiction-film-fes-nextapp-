import ticketsJson from "@/content/tickets.json";
import type { TicketsDocument } from "@/lib/content/types";

/**
 * 同梱コンテンツ（正典データ）。
 *
 * 段階2で Turso 読み出しに切り替えたあとも、DB 障害時・環境変数未設定時の
 * フォールバック元としてここを使う。JSON import は型が広がる（`t: string` になる）ため
 * ドキュメント型を与えている。値が実際に正しいかは `npm run verify:text` の
 * DOM パス比較が保証する。
 */
export const tickets = ticketsJson as unknown as TicketsDocument;
