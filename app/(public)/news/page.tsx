import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";

export const metadata: Metadata = {
  title: "News｜アディクション国際映画祭",
  description:
    "アディクション国際映画祭〔企画中〕のお知らせ・プレスリリース・取材のご依頼。",
};

export default function NewsPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">News</span>
          <h1 className="display">News</h1>
          <p className="page-head__jp">お知らせ</p>
          <p className="page-head__lead lead">第1回の準備の過程を、決まったことも決まっていないことも含めて公開していきます。開催日程・会場・上映作品・トークゲストは、確定しだいこのページでお知らせします。</p>
        </div>
      </section>

      {/* 最新 */}
      <section className="section">
        <div className="wrap">
          <div className="sections-grid">
            <SmartLink className="scard scard--tall rise" href="/news">
              <span className="scard__no">01</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="ecard__k" style={{ color: "var(--red)" }}>
                  Announcement ・ 2026.07.21
                </span>
                <span
                  className="scard__jp"
                  style={{
                    fontSize: "clamp(19px,2vw,28px)",
                    marginTop: "10px",
                  }}
                >
                  アディクション国際映画祭の開催企画を公開しました
                </span>
                <span className="scard__d">依存症をテーマに、国内外の受賞作を全作品トークショー付きで上映する2日間の映画祭です。2026年10月11日（日）・12日（月・祝）、よみうりホール（東京・有楽町）で開催します。</span>
              </span>
            </SmartLink>
            <SmartLink
              className="scard rise"
              style={styleVars({ "--d": ".06s" })}
              href="/news"
            >
              <span className="scard__no">02</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="ecard__k" style={{ color: "var(--red)" }}>
                  Announcement ・ 2026.08.04
                </span>
                <span className="scard__jp">開催日程と会場が決まりました</span>
                <span className="scard__d">決まりしだい、アクセスとあわせて公開します。</span>
              </span>
            </SmartLink>
            <SmartLink
              className="scard scard--red rise"
              style={styleVars({ "--d": ".12s" })}
              href="/news"
            >
              <span className="scard__no">03</span>
              <span className="scard__dots" aria-hidden="true"></span>
              <span>
                <span className="ecard__k" style={{ color: "var(--red)" }}>
                  Coming ・ 2026.09〔予定〕
                </span>
                <span className="scard__jp">上映作品・トークゲスト 第1弾発表</span>
                <span className="scard__d">ラインナップとゲストを順次お知らせします。</span>
              </span>
            </SmartLink>
          </div>
        </div>
      </section>

      {/* 一覧 */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Archive</span>
              <h2 className="display display--sm">All Posts</h2>
              <p className="jp-head">お知らせ一覧</p>
            </div>
          </div>

          <div className="rows">
            <SmartLink className="row-item rise" href="/news">
              <span className="row-item__no">
                2026
                <br />
                <span style={{ fontSize: ".5em" }}>07.21</span>
              </span>
              <div>
                <p className="row-item__t">アディクション国際映画祭の開催企画を公開しました</p>
                <p className="row-item__d">映画の力で、偏見を対話に変える。企画の全体像と3つのアプローチを公開しました。</p>
              </div>
              <p className="row-item__meta">Announcement</p>
            </SmartLink>
            <SmartLink
              className="row-item rise"
              style={styleVars({ "--d": ".04s" })}
              href="/news"
            >
              <span className="row-item__no">
                2026
                <br />
                <span style={{ fontSize: ".5em" }}>08.04</span>
              </span>
              <div>
                <p className="row-item__t">開催日程と会場が決まりました</p>
                <p className="row-item__d">2026年10月11日（日）・12日（月・祝）の2日間、よみうりホール（東京・有楽町）で開催します。10月12日はスポーツの日で、10日（土）からの3連休にあたります。</p>
              </div>
              <p className="row-item__meta">Coming</p>
            </SmartLink>
            <SmartLink
              className="row-item rise"
              style={styleVars({ "--d": ".08s" })}
              href="/news"
            >
              <span className="row-item__no">
                2026
                <br />
                <span style={{ fontSize: ".5em" }}>09〔予定〕</span>
              </span>
              <div>
                <p className="row-item__t">上映作品とトークゲストの第1弾を発表します</p>
                <p className="row-item__d">国内外の受賞作を中心としたラインナップと、登壇ゲストを順次公開します。</p>
              </div>
              <p className="row-item__meta">Coming</p>
            </SmartLink>
            <SmartLink
              className="row-item rise"
              style={styleVars({ "--d": ".12s" })}
              href="/news"
            >
              <span className="row-item__no">
                2026
                <br />
                <span style={{ fontSize: ".5em" }}>10〔予定〕</span>
              </span>
              <div>
                <p className="row-item__t">協賛パートナーの募集を開始します</p>
                <p className="row-item__d">企業パートナー、メディアパートナー、ノベルティ協賛の3区分でご案内する予定です。</p>
              </div>
              <p className="row-item__meta">Coming</p>
            </SmartLink>
            <SmartLink
              className="row-item rise"
              style={styleVars({ "--d": ".16s" })}
              href="/news"
            >
              <span className="row-item__no">
                2026
                <br />
                <span style={{ fontSize: ".5em" }}>11〔予定〕</span>
              </span>
              <div>
                <p className="row-item__t">チケットの発売日をお知らせします</p>
                <p className="row-item__d">1日券 3,000円／2日券 5,000円。販売方法とあわせてご案内します。</p>
              </div>
              <p className="row-item__meta">Coming</p>
            </SmartLink>
          </div>

          <p className="small muted" style={{ marginTop: "20px" }}>※ 2026年8月以降の項目は、今後の発表予定を示す仮置きです。日付・内容は確定したものではありません。</p>
        </div>
      </section>

      {/* プレス */}
      <section className="panel" id="press">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid">
            <div className="rise">
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                For Press
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)", marginTop: "8px" }}
              >
                Press
                <br />
                Room
              </h2>
            </div>
            <div
              className="rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <p className="panel__lead">
                取材のご希望、<em>企画資料のご請求</em>はこちらから。
              </p>
              <p className="panel__body">依存症をテーマにした映画祭という性質上、取材にあたっては当事者や登壇者への配慮についてあらかじめご相談させてください。プレスリリースの配信登録、ロゴなどの素材提供は準備中です。</p>
              <div
                style={{
                  marginTop: "22px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <SmartLink className="btn btn--light" href="/about#contact">
                  取材のお問い合わせ
                </SmartLink>
                <SmartLink className="btn btn--red" href="/about#contact">
                  配信登録（準備中）
                </SmartLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
