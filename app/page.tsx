import type { Metadata } from "next";
import Hero from "@/components/Hero";
import Films from "@/components/Films";
import NewsletterForm from "@/components/NewsletterForm";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";

export const metadata: Metadata = {
  title: "アディクション国際映画祭｜映画の力で、偏見を対話に変える",
  description:
    "アディクション国際映画祭〔企画中〕公式サイト。依存症をテーマにした国内外の受賞作を、全作品トークショー付きで上映します。よみうりホール（東京・有楽町）で2026年10月11日–12日に開催。",
};

export default function Home() {
  return (
    <>
      {/* ============ HERO ============ */}
      <Hero />

      {/* ============ QUICK LINKS ============ */}
      <section className="quick">
        <div className="wrap">
          <div className="quick__grid">
            <SmartLink className="qcard rise" href="/tickets">
              <span>
                <span className="qcard__t">Tickets</span>
                <span className="qcard__jp">チケット</span>
                <span className="qcard__d">1日券 3,000円／2日券 5,000円。来場者には啓発ノベルティをお渡しします。</span>
              </span>
              <span className="qcard__arrow">→</span>
            </SmartLink>
            <SmartLink
              className="qcard rise"
              style={styleVars({ "--d": ".08s" })}
              href="/programme"
            >
              <span>
                <span className="qcard__t">Films &amp; Talks</span>
                <span className="qcard__jp">上映＋トークショー</span>
                <span className="qcard__d">全4回のトークショーと特別講演を併催します。登壇者は決まりしだい発表します。</span>
              </span>
              <span className="qcard__arrow">→</span>
            </SmartLink>
            <SmartLink
              className="qcard rise"
              style={styleVars({ "--d": ".16s" })}
              href="/about#partner"
            >
              <span>
                <span className="qcard__t">Partner</span>
                <span className="qcard__jp">協賛・パートナー</span>
                <span className="qcard__d">第1回をともに立ち上げる企業・団体・メディアを募集しています。</span>
              </span>
              <span className="qcard__arrow">→</span>
            </SmartLink>
          </div>
        </div>
      </section>

      {/* ============ STATEMENT ============ */}
      <section className="panel">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid panel__grid--why">
            <div className="rise">
              <h2
                className="display display--sm display--rose"
                style={{ color: "var(--red)" }}
              >
                Why
                <br />
                Now
              </h2>
              <SmartLink
                className="arrow"
                href="/about"
                style={{ color: "var(--red)", marginTop: "22px" }}
              >
                映画祭について
              </SmartLink>
            </div>
            <p
              className="panel__lead rise"
              style={styleVars({ "--d": ".1s" })}
            >
              わたしたちは、<em>説教くさい啓発感を排除します</em>。映画という極上のストーリーテリングを通じることで、心のバリアを取り払い、依存症を自分事として考えるきっかけをつくる。それがこの映画祭の役割です。まず届けたいのは、依存症にまだ関心のない「一般の映画ファン」。作品を観に来ていただき、帰るときには誰かと話したくなっている。その2日間を設計します。
            </p>
            <div
              className="panel__note rise"
              style={styleVars({ "--d": ".18s" })}
            >
              <span className="panel__note__k">Background</span>
              <p>依存症（アディクション）は誰にでも起こり得る身近な問題です。しかし、世間の強い偏見が当事者や家族を追い詰め、さらなる社会的孤立を引き起こしています。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 3 APPROACHES ============ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Approach</span>
              <h2 className="display">3 Approaches</h2>
              <p className="jp-head">映画祭を成功に導く3つのアプローチ</p>
            </div>
            <SmartLink className="arrow" href="/about#approach">
              くわしく
            </SmartLink>
          </div>

          <div className="sections-grid">
            <SmartLink
              className="scard scard--tall rise"
              href="/programme"
            >
              <span className="scard__no">01</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="scard__t">Curation</span>
                <span className="scard__jp">極上の作品選定</span>
                <span className="scard__d">映画ファンを唸らせる、国内外の受賞作や芸術性の高いエッジの効いた作品をラインナップします。「依存症の映画」である前に、一本の映画として観たくなること。それが選定の基準です。</span>
              </span>
            </SmartLink>

            <SmartLink
              className="scard rise"
              style={styleVars({ "--d": ".06s" })}
              href="/programme#talk"
            >
              <span className="scard__no">02</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="scard__t">Talk</span>
                <span className="scard__jp">エンタメ×共感のトーク</span>
                <span className="scard__d">啓発っぽさを排除し、作品の感想戦の延長で語られるカジュアルで深いクロストークに。ゲストは厳選します。</span>
              </span>
            </SmartLink>

            <SmartLink
              className="scard scard--red rise"
              style={styleVars({ "--d": ".12s" })}
              href="/tickets#novelty"
            >
              <span className="scard__no">03</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="scard__t">Novelty</span>
                <span className="scard__jp">啓発ノベルティ</span>
                <span className="scard__d">プレミア感とデザイン性にこだわり、持って帰りたくなるお洒落な啓発グッズを配布します。</span>
              </span>
            </SmartLink>
          </div>
        </div>
      </section>

      {/* ============ FILMS ============ */}
      <section className="section" id="films">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Line-up</span>
              <h2 className="display">Films</h2>
              <p className="jp-head">上映作品</p>
            </div>
            <SmartLink className="arrow" href="/programme#films">
              作品の詳細
            </SmartLink>
          </div>

          <Films variant="index" />
        </div>
      </section>

      {/* ============ FORMAT ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Format</span>
              <h2 className="display">
                1 Film,
                <br />
                1 Talk
              </h2>
              <p className="jp-head">映画1本ごとに、トークショーを。</p>
            </div>
            <SmartLink className="arrow" href="/programme">
              タイムテーブル
            </SmartLink>
          </div>

          <div className="cols-3">
            <div className="box box--dark rise">
              <h3>観る</h3>
              <p>国内外の受賞作を、よみうりホールの大スクリーンで。まずは映画として楽しめる2日間にします。</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>聴く</h3>
              <p>上映後、その場でトークショー。依存症から回復した著名人や作り手が登壇し、依存症にちなんだ話へと広げていきます。入口はあくまで作品の感想です。</p>
            </div>
            <div
              className="box box--dark rise"
              style={styleVars({ "--d": ".16s" })}
            >
              <h3>持ち帰る</h3>
              <p>会場では、デザイン性にこだわった啓発ノベルティを配布。帰った先の日常にも、きっかけが残るように。</p>
            </div>
          </div>

          <div
            className="rows"
            style={{ marginTop: "clamp(28px,4vw,52px)" }}
          >
            <div className="row-item rise">
              <span className="row-item__no">A</span>
              <div>
                <p className="row-item__t">まず届けたいのは、依存症にまだ関心のない「一般の映画ファン」</p>
                <p className="row-item__d">当事者や支援者に閉じたイベントにはしません。映画目当てで来た人が、帰り道に誰かと話している。その状態をつくることを最優先の設計目標にします。</p>
              </div>
              <p className="row-item__meta">Target</p>
            </div>
            <div
              className="row-item rise"
              style={styleVars({ "--d": ".06s" })}
            >
              <span className="row-item__no">B</span>
              <div>
                <p className="row-item__t">2日間を通した進行役を置きます</p>
                <p className="row-item__d">上映とトークをぶつ切りにせず、1本の流れとして届けるために、フェスティバル・ナビゲーターが2日間を通して進行します。</p>
              </div>
              <p className="row-item__meta">
                <a className="arrow" href="#navigator">
                  ナビゲーター
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NAVIGATOR ============ */}
      <section className="panel" id="navigator">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="navigator__grid">
            <figure className="navigator__img rise">
              <span className="navigator__badge">Navigator</span>
              <img
                src="/assets/navigator/yoshihiro.jpg"
                alt="フェスティバル・ナビゲーターのよしひろまさみち氏"
                loading="lazy"
              />
            </figure>

            <div
              className="rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                Festival Navigator
              </span>
              <h2
                className="display display--sm display--rose"
                style={{ color: "var(--red)", marginTop: "10px" }}
              >
                Guide
                <br />
                the Two Days
              </h2>
              <span className="navigator__k eyebrow">映画ライター・編集者</span>
              <span className="navigator__name">よしひろまさみち</span>
              <span className="navigator__en">Masamichi Yoshihiro</span>

              <p className="navigator__lead">2日間を通して、進行役を務めます。作品の見どころを映画ファンの言葉で伝え、上映からトークまでをひとつづきの時間にしていきます。</p>

              <p className="navigator__d">上映後のトークを「啓発の時間」にしてしまうと、この映画祭が最初に決めた「説教くさい啓発感を排除する」という約束が崩れます。必要なのは、あくまで映画の話の続きとして場を進められる人でした。映画・ドラマを専門に長く書き、テレビの生放送で作品を紹介し、イベントの登壇も数多くこなしてきたよしひろまさみち氏に、その役をお願いしました。</p>

              <ul className="navigator__facts">
                <li>
                  <b>Profile</b>
                  <span>1972年東京都生まれ。法政大学文学部卒業。雑誌編集者を経てフリーランスのライター・編集者に。現在は映画・ドラマを専門に執筆。</span>
                </li>
                <li>
                  <b>Field</b>
                  <span>英語圏の洋画、アジア映画、日本映画、海外ドラマ</span>
                </li>
                <li>
                  <b>Member</b>
                  <span>日本映画ペンクラブ会員／日本アカデミー賞協会会員</span>
                </li>
                <li>
                  <b>Media</b>
                  <span>『キネマ旬報』『SPA!』『oz magazine』『otona MUSE』『ELLE』『VOGUE JAPAN』ほかで映画レビュー・インタビューを連載</span>
                </li>
                <li>
                  <b>On Air</b>
                  <span>2012年より日本テレビ系『スッキリ!!』の映画紹介に出演</span>
                </li>
              </ul>

              <p className="navigator__note">※ プロフィールは公開情報をもとに構成した仮のテキストです。公開前にご本人・所属先の確認をお願いします。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NEWS ============ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Latest</span>
              <h2 className="display">News</h2>
              <p className="jp-head">お知らせ</p>
            </div>
            <SmartLink className="arrow" href="/news">
              すべて見る
            </SmartLink>
          </div>

          <div className="news">
            <SmartLink className="ncard rise" href="/news">
              <span className="ncard__date">2026.07.21</span>
              <span className="ncard__t">アディクション国際映画祭の開催企画を公開しました</span>
              <span className="arrow">Read</span>
            </SmartLink>
            <SmartLink
              className="ncard rise"
              style={styleVars({ "--d": ".06s" })}
              href="/news"
            >
              <span className="ncard__date">2026.08.04</span>
              <span className="ncard__t">開催日程と会場が決まりました（2026年10月11日–12日／よみうりホール）</span>
              <span className="arrow">Read</span>
            </SmartLink>
            <SmartLink
              className="ncard rise"
              style={styleVars({ "--d": ".12s" })}
              href="/news"
            >
              <span className="ncard__date">2026.09〔予定〕</span>
              <span className="ncard__t">上映作品とトークゲストの第1弾を発表します</span>
              <span className="arrow">Read</span>
            </SmartLink>
            <SmartLink
              className="ncard rise"
              style={styleVars({ "--d": ".18s" })}
              href="/news"
            >
              <span className="ncard__date">2026.10〔予定〕</span>
              <span className="ncard__t">協賛パートナーの募集を開始します</span>
              <span className="arrow">Read</span>
            </SmartLink>
          </div>
        </div>
      </section>

      {/* ============ MANIFESTO ============ */}
      <section className="panel panel--wine manifesto">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <p className="manifesto__mark" style={{ color: "var(--red)" }}>
            “
          </p>
          <p className="manifesto__t rise">
            映画の力で、
            <br />
            偏見を対話に変える。
          </p>
          <p className="manifesto__by" style={{ color: "var(--red)" }}>
            Addiction International Film Festival
          </p>
        </div>
      </section>

      {/* ============ CTA + NEWSLETTER ============ */}
      <section
        className="section"
        style={{ paddingTop: "clamp(40px,5vw,72px)" }}
      >
        <div className="wrap">
          <div className="cta-bar rise">
            <p className="cta-bar__t">第1回を、ともに立ち上げてください。</p>
            <SmartLink className="arrow" href="/about#partner">
              パートナー募集について
            </SmartLink>
          </div>
        </div>
      </section>

      <section className="newsletter">
        <div className="wrap">
          <div className="newsletter__grid">
            <div>
              <h2 className="display display--sm">
                Stay in
                <br />
                the Loop
              </h2>
              <p className="small muted" style={{ marginTop: "12px" }}>
                開催日程・会場・上映作品・チケット発売のお知らせをメールでお送りします。
              </p>
            </div>
            <NewsletterForm />
            <div className="social">
              <a href="#" aria-label="Instagram">
                IG
              </a>
              <a href="#" aria-label="X">
                X
              </a>
              <a href="#" aria-label="YouTube">
                YT
              </a>
              <a href="#" aria-label="note">
                NOTE
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
