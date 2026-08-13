import ticketsJson from "@/content/tickets.json";
import legalJson from "@/content/legal.json";
import termsJson from "@/content/terms.json";
import newsJson from "@/content/news.json";
import privacyJson from "@/content/privacy.json";
import aboutJson from "@/content/about.json";
import indexJson from "@/content/index.json";
import programmeJson from "@/content/programme.json";
import filmsJson from "@/content/films.json";
import timetableJson from "@/content/timetable.json";
import siteJson from "@/content/site.json";
import type {
  AboutDocument,
  FilmsDocument,
  IndexDocument,
  LegalDocument,
  NewsDocument,
  PrivacyDocument,
  ProgrammeDocument,
  SiteDocument,
  TermsDocument,
  TicketsDocument,
  TimetableDocument,
} from "@/lib/content/types";

/**
 * 同梱コンテンツ（正典データ）。
 *
 * 段階2で Turso 読み出しに切り替えたあとも、DB 障害時・環境変数未設定時の
 * フォールバック元としてここを使う。JSON import は型が広がる（`t: string` になる）ため
 * ドキュメント型を与えている。値が実際に正しいかは `npm run verify:text` の
 * DOM パス比較が保証する。
 */
export const tickets = ticketsJson as unknown as TicketsDocument;
export const legal = legalJson as unknown as LegalDocument;
export const terms = termsJson as unknown as TermsDocument;
export const news = newsJson as unknown as NewsDocument;
export const privacy = privacyJson as unknown as PrivacyDocument;
export const about = aboutJson as unknown as AboutDocument;
export const index = indexJson as unknown as IndexDocument;
export const programme = programmeJson as unknown as ProgrammeDocument;
export const films = filmsJson as unknown as FilmsDocument;
export const timetable = timetableJson as unknown as TimetableDocument;
export const site = siteJson as unknown as SiteDocument;
