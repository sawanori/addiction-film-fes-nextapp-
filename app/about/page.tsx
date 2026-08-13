import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";

export const metadata: Metadata = {
  title: "About｜アディクション国際映画祭",
  description:
    "アディクション国際映画祭〔企画中〕について。開催の背景、3つのアプローチ、開催概要、実行委員会、パートナー募集。",
};

export default function AboutPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">About</span>
          <h1 className="display">
            Bias into
            <br />
            Dialogue
          </h1>
          <p className="page-head__jp">偏見を解きほぐす「追体験」の力</p>
          <p className="page-head__lead lead">依存症は、責めるべき個人の失敗としてではなく、誰の隣にもある出来事として語られるべきです。そのために選んだ手段が、説教ではなく映画でした。</p>
        </div>
      </section>

      {/* 開催の背景 */}
      <section className="section">
        <div className="wrap">
          <div className="cols-2">
            <div className="box box--dark rise">
              <h3>誤解や偏見と孤立の解消</h3>
              <p>依存症（アディクション）は誰にでも起こり得る身近な問題です。しかし、世間の強い偏見が当事者や家族を追い詰め、さらなる社会的孤立を引き起こしています。</p>
              <p style={{ marginTop: "14px" }}>偏見は知識の不足だけで生まれるものではありません。「自分とは関係のない世界の話だ」と感じている限り、どれだけ正しい情報を並べても届かない。だからわたしたちは、知識より先に、体験を届けます。</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>映画だからこそ届く「共感」</h3>
              <p>説教くさい啓発感を排除し、映画という極上のストーリーテリングを通じることで、心のバリアを取り払い、依存症を自分事として考えるきっかけを作ります。</p>
              <p style={{ marginTop: "14px" }}>2時間、他人の人生を生きること。それが映画の「追体験」の力です。理解しようと構える前に、いつの間にか隣に座っている。その距離の縮め方は、映画にしかできません。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3つのアプローチ */}
      <section className="panel panel--wine" id="approach">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                Approach
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                3 Approaches
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                映画祭を成功に導く3つのアプローチ
              </p>
            </div>
          </div>

          <div className="rows" style={{ borderColor: "var(--rule-w)" }}>
            <div
              className="row-item rise"
              style={{ borderColor: "var(--rule-w)" }}
            >
              <span
                className="row-item__no"
                style={{ color: "var(--red)" }}
              >
                01
              </span>
              <div>
                <p
                  className="row-item__t"
                  style={{ color: "var(--white)" }}
                >
                  極上の作品選定
                </p>
                <p
                  className="row-item__d"
                  style={{ color: "var(--mute)" }}
                >
                  映画ファンを唸らせる、国内外の受賞作や芸術性の高いエッジの効いた作品ラインナップ。「依存症を扱った作品だから」ではなく「その映画が観たいから」来場していただくことを目指します。
                </p>
              </div>
              <p
                className="row-item__meta"
                style={{ color: "var(--mute)" }}
              >
                Curation
              </p>
            </div>
            <div
              className="row-item rise"
              style={
                styleVars({
                  "--d": ".06s",
                  borderColor: "var(--rule-w)",
                })
              }
            >
              <span
                className="row-item__no"
                style={{ color: "var(--red)" }}
              >
                02
              </span>
              <div>
                <p
                  className="row-item__t"
                  style={{ color: "var(--white)" }}
                >
                  エンタメ×共感のトーク
                </p>
                <p
                  className="row-item__d"
                  style={{ color: "var(--mute)" }}
                >
                  トークショーでは、啓発っぽさを排除し、作品の感想戦の延長で語られるカジュアルで深いクロストークとなるよう、ゲストを厳選します。依存症から回復した著名人にも登壇いただく予定です。
                </p>
              </div>
              <p
                className="row-item__meta"
                style={{ color: "var(--mute)" }}
              >
                Talk
              </p>
            </div>
            <div
              className="row-item rise"
              style={
                styleVars({
                  "--d": ".12s",
                  borderColor: "var(--rule-w)",
                })
              }
            >
              <span
                className="row-item__no"
                style={{ color: "var(--red)" }}
              >
                03
              </span>
              <div>
                <p
                  className="row-item__t"
                  style={{ color: "var(--white)" }}
                >
                  啓発ノベルティ
                </p>
                <p
                  className="row-item__d"
                  style={{ color: "var(--mute)" }}
                >
                  プレミア感とデザイン性にこだわり、持って帰りたくなるお洒落な啓発グッズを配布します。会場を出たあとも手元に残り、日常の中でもう一度考えるきっかけになるものを。
                </p>
              </div>
              <p
                className="row-item__meta"
                style={{ color: "var(--mute)" }}
              >
                Novelty
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 開催概要 */}
      <section className="section" id="outline">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Outline</span>
              <h2 className="display display--sm">Outline</h2>
              <p className="jp-head">開催基本方針</p>
            </div>
          </div>
          <table className="table">
            <tbody>
              <tr>
                <td style={{ width: "180px" }}>
                  <strong>名称</strong>
                </td>
                <td>アディクション国際映画祭</td>
              </tr>
              <tr>
                <td>
                  <strong>会期</strong>
                </td>
                <td>2026年10月11日（日）・10月12日（月・祝）の2日間<span className="small muted">（10月12日はスポーツの日）</span></td>
              </tr>
              <tr>
                <td>
                  <strong>会場</strong>
                </td>
                <td>よみうりホール（東京・有楽町）</td>
              </tr>
              <tr>
                <td>
                  <strong>ターゲット</strong>
                </td>
                <td>依存症にまだ関心のない「一般の映画ファン」をメインに設定</td>
              </tr>
              <tr>
                <td>
                  <strong>主催</strong>
                </td>
                <td>アディクション国際映画祭 実行委員会</td>
              </tr>
              <tr>
                <td>
                  <strong>料金</strong>
                </td>
                <td>1日券 3,000円／2日券 5,000円</td>
              </tr>
              <tr>
                <td>
                  <strong>特徴</strong>
                </td>
                <td>
                  ・映画1本ごとにトークショーを企画し、依存症にちなんだ話を広げる。依存症から回復した著名人が登場
                  <br />
                  ・依存症の啓発になるようなノベルティを製作・配布
                </td>
              </tr>
              <tr>
                <td>
                  <strong>フェスティバル・ナビゲーター</strong>
                </td>
                <td>よしひろまさみち氏<span className="small muted">（映画ライター・編集者／<SmartLink href="/#navigator">プロフィール</SmartLink>）</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 実行委員会 */}
      <section className="section" id="org" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Organisation</span>
              <h2 className="display display--sm">Committee</h2>
              <p className="jp-head">実行委員会</p>
            </div>
          </div>
          <div className="cols-3">
            <div className="box rise">
              <h3>企画・運営</h3>
              <p>開催方針、予算、会場調整、当日運営を担当します。〔体制は調整中〕</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>作品選定</h3>
              <p>国内外の受賞作を中心に、上映作品の選定と権利交渉を担当します。〔体制は調整中〕</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".16s" })}
            >
              <h3>監修</h3>
              <p>依存症の当事者団体・支援団体・医療関係者に、表現と運営の監修をお願いする予定です。〔調整中〕</p>
            </div>
          </div>
          <p className="small muted" style={{ marginTop: "16px" }}>※ 実行委員会の構成メンバーは調整中です。確定後に掲載します。</p>
        </div>
      </section>

      {/* パートナー募集 */}
      <section className="section" id="partner" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-bar rise">
            <p className="cta-bar__t">第1回を、ともに立ち上げてください。</p>
            <a className="arrow" href="#contact">
              お問い合わせ
            </a>
          </div>

          <div className="cols-3" style={{ marginTop: "24px" }}>
            <div className="box rise">
              <h3>企業パートナー</h3>
              <p>会場内サイネージ、公式サイト、上映前スライド、ノベルティへのご掲出が可能です。依存症の啓発に取り組む企業・団体からのご協賛を歓迎します。</p>
              <a
                className="arrow"
                href="#contact"
                style={{ marginTop: "14px" }}
              >
                資料請求
              </a>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>メディアパートナー</h3>
              <p>取材、共同企画、チケット提供などで連携いただけるメディアを募集しています。当日はプレス席をご用意します。</p>
              <SmartLink
                className="arrow"
                href="/news#press"
                style={{ marginTop: "14px" }}
              >
                プレス情報
              </SmartLink>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".16s" })}
            >
              <h3>支援団体・専門家</h3>
              <p>トークショーへのご登壇、当日の相談ブースの設置、表現の監修などでご協力いただける方を探しています。</p>
              <a
                className="arrow"
                href="#contact"
                style={{ marginTop: "14px" }}
              >
                ご相談
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* お問い合わせ */}
      <section className="panel" id="contact">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <div className="panel__grid">
            <div className="rise">
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                Contact
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)", marginTop: "8px" }}
              >
                Get in
                <br />
                Touch
              </h2>
            </div>
            <div
              className="rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <table className="table table--dark">
                <tbody>
                  <tr>
                    <td style={{ width: "200px" }}>映画祭全般</td>
                    <td>info@example.jp〔仮〕</td>
                  </tr>
                  <tr>
                    <td>協賛・パートナー</td>
                    <td>partner@example.jp〔仮〕</td>
                  </tr>
                  <tr>
                    <td>取材・プレス</td>
                    <td>press@example.jp〔仮〕</td>
                  </tr>
                  <tr>
                    <td>登壇・監修のご相談</td>
                    <td>talk@example.jp〔仮〕</td>
                  </tr>
                  <tr>
                    <td>実行委員会</td>
                    <td>アディクション国際映画祭 実行委員会〔仮称〕<br />〔所在地・電話番号は調整中〕</td>
                  </tr>
                </tbody>
              </table>
              <p
                className="small"
                style={{ color: "var(--mute)", marginTop: "16px" }}
              >
                ※ 依存症に関する個別のご相談には、この窓口ではお応えできません。当日は会場に相談窓口のご案内を設置する予定です〔調整中〕。
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
