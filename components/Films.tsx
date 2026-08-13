import type { ReactNode } from "react";
import { styleVars } from "@/lib/style";

type Film = {
  no: string;
  time: string;
  lead: boolean;
  delay?: string;
  lazy: boolean;
  img: string;
  alt: string;
  k: string;
  t: string;
  en: string;
  meta: ReactNode;
  d: string;
};

/**
 * 上映作品グリッド。index と programme で共用。
 * 変換元では 04「一瞬の楽園」のクレジットだけが2ページで異なる
 * （index は短縮版、programme は公式チラシどおりの全文）ため、
 * variant で出し分ける。それ以外の文言・構造は両ページで完全に同一。
 */
export default function Films({ variant }: { variant: "index" | "programme" }) {
  const films: Film[] = [
    {
      no: "01",
      time: "10/11 14:45",
      lead: true,
      lazy: false,
      img: "/assets/films/film-01-billw.jpg",
      alt: "『Bill W.』より、演壇に立つビル・ウィルソン",
      k: "Documentary ・ 104min〔確認中〕",
      t: "Bill W.",
      en: "Directed by Kevin Hanlon",
      meta: "製作：Muse Bookings（米）",
      d: "アルコホーリクス・アノニマス共同創始者ビル・ウィルソン。その内的変容を、共同創始者としてではなく一人の男の生涯として辿る。",
    },
    {
      no: "02",
      time: "10/12 15:00",
      lead: true,
      delay: ".06s",
      lazy: true,
      img: "/assets/films/film-02-contact.jpg",
      alt: "『Bill W. Conscious Contact』より、書棚の前で語る出演者",
      k: "Documentary ・ 58min〔確認中〕",
      t: "Bill W. Conscious Contact",
      en: "Directed by Kevin Hanlon",
      meta: "Cannes Indie International Film Festival 最優秀ドキュメンタリー長編賞ほか受賞多数",
      d: "霊的な探求者としてのビル・ウィルソン。ニューヨークの旧宅ステッピング・ストーンズに残された記録から、その旅を描く。",
    },
    {
      no: "03",
      time: "10/11 18:00",
      lead: false,
      lazy: true,
      img: "/assets/films/film-03-binetsu.jpg",
      alt: "『微熱』より、神社で手を合わせる母と娘",
      k: "Short ・ 30min",
      t: "微熱",
      en: "Slight Fever",
      meta: "監督・脚本・編集：小澤雅人／出演：佐々木悠麻、荻野みかん ほか／製作：SOUL AGE",
      d: "遊技台の光の前に立ちつづける男と、その傍らで日々を送る家族。現代日本の暗がりを、静かな筆致で描く。",
    },
    {
      no: "04",
      time: "10/11 18:30",
      lead: false,
      delay: ".06s",
      lazy: true,
      img: "/assets/films/film-04-paradise.jpg",
      alt: "『一瞬の楽園』より、夜の街を走る二人",
      k: "Short ・ 2020 ・ 27min",
      t: "一瞬の楽園",
      en: "A Moment of Paradise",
      meta:
        variant === "programme" ? (
          <>
            出演：入江海斗、ヴー・トゥ・ザン
            <br />
            古山憲太郎、川上麻衣子、橘ゆかり、村松和輝、辻井拓、佐藤たかみち、納見俊三千、グエン・ズイ・ティン
            <br />
            チャン・ハイ・リン、チャン・パオ・ソン、ダオ・チュン・ドック、ファン・タイン・ザン、ホアン・バン・ジェウ、レ・クァン・ズイ、グエン・フォン・アン
            <br />
            監督・脚本・編集：小澤雅人／撮影監督：アンドレアス・ハートマン／プロデューサー：木滝和幸／製作：田中紀子、木滝和幸
            <br />
            特別協力：ギャンブル依存症問題を考える会／製作・配給：マグネタイズ
            <br />
            2020年｜日本｜日本語・ベトナム語｜27分
          </>
        ) : (
          <>
            監督・脚本・編集：小澤雅人／出演：入江海斗、ヴー・トゥ・ザン ほか
            <br />
            製作・配給：マグネタイズ｜日本語・ベトナム語
          </>
        ),
      d: "重度のギャンブル依存症のケンタと、借金を抱えたベトナム人留学生ハン。暗闇に生きる二人が、光を求めてともに歩く。",
    },
    {
      no: "05",
      time: "10/12 10:00",
      lead: false,
      delay: ".12s",
      lazy: true,
      img: "/assets/films/film-05-addict.jpg",
      alt: "『アディクトを待ちながら』より、主演の高知東生",
      k: "Feature ・ 2024 ・ 82min",
      t: "アディクトを待ちながら",
      en: "LET IT RAIN",
      meta: (
        <>
          監督・脚本：ナカムラサヤカ／出演：高知東生、橋爪遼、宍戸開、升毅、青木さやか ほか
          <br />
          製作：ギャンブル依存症問題を考える会
        </>
      ),
      d: "やめたい。やめたい。誰か助けて——。実際に回復を続けている当事者や家族が多数出演し、依存症ゴスペルグループの再結成をめぐる日々を描く。アディクト（依存症者）に回復はあるのか。",
    },
    {
      no: "06",
      time: "10/12 13:30",
      lead: false,
      lazy: true,
      img: "/assets/films/film-06-secret.jpg",
      alt: "『嘘つきは〇○のはじまり』より、海辺を歩く家族",
      k: "Short ・ 2023 ・ 30min",
      t: "嘘つきは〇○のはじまり",
      en: "SECRET",
      meta: "監督：ナカムラサヤカ／企画・原案：田中紀子／出演：増田有華、青柳尊哉、高知東生、東ちづる ほか",
      d: "優しい夫、かわいい娘、やりがいのある仕事に、頼れるママ友。誰もがうらやむ彼女には、誰にも言えない秘密がありました。",
    },
  ];

  return (
    <>
      <div className="films">
        {films.map((film) => (
          <article
            key={film.no}
            className={film.lead ? "film film--lead rise" : "film rise"}
            {...(film.delay
              ? { style: styleVars({ "--d": film.delay }) }
              : {})}
          >
            <span className="film__img">
              <span className="film__no">{film.no}</span>
              <span className="film__time">{film.time}</span>
              <img
                src={film.img}
                alt={film.alt}
                {...(film.lazy ? { loading: "lazy" } : {})}
              />
            </span>
            <span className="film__k">{film.k}</span>
            <span className="film__t">{film.t}</span>
            <span className="film__en">{film.en}</span>
            <span className="film__meta">{film.meta}</span>
            <span className="film__d">{film.d}</span>
          </article>
        ))}
      </div>

      <p className="films__note">※ 上映日時はタイムスケジュール案に基づくもので、変更になる場合があります。登壇者は決まりしだい発表します。年齢の目安は調整中です。作品画像は各作品の宣伝素材をお借りしています。</p>
    </>
  );
}
