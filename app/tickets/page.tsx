import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";

export const metadata: Metadata = {
  title: "Tickets｜アディクション国際映画祭",
  description:
    "アディクション国際映画祭〔企画中〕のチケット。1日券3,000円／2日券5,000円。来場者には啓発ノベルティを配布します。",
};

export default function TicketsPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Tickets</span>
          <h1 className="display">Tickets</h1>
          <p className="page-head__jp">チケット</p>
          <p className="page-head__lead lead">1日券 3,000円、2日券 5,000円。上映とトークショーはすべてこのチケットでご覧いただけます。来場者には啓発ノベルティをお渡しします。</p>
        </div>
      </section>

      {/* 券種 */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Price</span>
              <h2 className="display display--sm">Ticket Types</h2>
              <p className="jp-head">券種と料金</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>券種</th>
                <th>内容</th>
                <th>料金</th>
                <th>発売</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>1日券</strong>
                </td>
                <td>ご来場日の全上映・全トークショーをご覧いただけます。</td>
                <td>3,000円</td>
                <td>〔調整中〕</td>
              </tr>
              <tr>
                <td>
                  <strong>2日券</strong>
                </td>
                <td>2日間の全上映・全トークショーをご覧いただけます。</td>
                <td>5,000円</td>
                <td>〔調整中〕</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: "16px" }}>※ 料金は企画書に基づく金額です。発売日・販売方法・座席指定の有無・払い戻し規定は調整中です。</p>

          <div className="cols-3" style={{ marginTop: "32px" }}>
            <div className="box rise">
              <h3>ご購入について</h3>
              <p>オンラインでの事前販売を予定しています。販売開始日、プレイガイド、当日券の有無は決まりしだいお知らせします。〔調整中〕</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>入退場について</h3>
              <p>上映中の途中入退場は自由です。体調やお気持ちに合わせて、無理のない範囲でお過ごしください。再入場もできます。〔運用は調整中〕</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".16s" })}
            >
              <h3>アクセシビリティ</h3>
              <p>よみうりホールの車椅子席のご案内、字幕の有無、託児の可否については、確定しだいご案内します。〔調整中〕</p>
            </div>
          </div>
        </div>
      </section>

      {/* ノベルティ */}
      <section className="panel panel--wine" id="novelty">
        <div className="panel__dots panel__dots--red" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                Included
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                Novelty
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                啓発ノベルティ
              </p>
            </div>
          </div>

          <p className="panel__lead" style={{ maxWidth: "26ch" }}>
            持って帰りたくなる、<em>お洒落な啓発グッズ</em>を。
          </p>
          <p className="panel__body">プレミア感とデザイン性にこだわった啓発ノベルティを、来場者にお渡しします。「配られたから持っている」ものではなく、日常で使いたくなるもの。会場を出たあとにこそ、もう一度考えるきっかけになるように設計します。</p>

          <div className="cols-3" style={{ marginTop: "32px" }}>
            <div
              className="box box--dark rise"
              style={{ borderColor: "var(--red)" }}
            >
              <h3 style={{ color: "var(--red)" }}>アイテム例</h3>
              <p>ミネラルウォーター（企画書記載）ほか、日常に持ち込めるアイテムを検討中です。</p>
            </div>
            <div
              className="box box--dark rise"
              style={
                styleVars({ "--d": ".08s", borderColor: "var(--red)" })
              }
            >
              <h3 style={{ color: "var(--red)" }}>デザイン方針</h3>
              <p>啓発物に見えないこと。ロゴとコピーの見せ方で、手に取った人が説明したくなるものを目指します。〔仮〕</p>
            </div>
            <div
              className="box box--dark rise"
              style={
                styleVars({ "--d": ".16s", borderColor: "var(--red)" })
              }
            >
              <h3 style={{ color: "var(--red)" }}>協賛について</h3>
              <p>ノベルティ製作へのご協賛も受け付けます。パッケージへのご掲出が可能です。〔調整中〕</p>
            </div>
          </div>

          <div style={{ marginTop: "28px" }}>
            <SmartLink className="btn btn--light" href="/about#partner">
              ノベルティ協賛について
            </SmartLink>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Help</span>
              <h2 className="display display--sm">FAQ</h2>
              <p className="jp-head">よくあるご質問</p>
            </div>
          </div>
          <dl className="faq cols-2">
            <div>
              <dt>依存症について詳しくないのですが、楽しめますか？</dt>
              <dd>はい。むしろ、依存症にまだ関心のない映画ファンの方にこそ来ていただきたい映画祭です。上映するのは、まず映画として見応えのある作品ばかりです。</dd>
              <dt>トークショーだけ観ることはできますか？</dt>
              <dd>トークショーは上映とセットで、同じホールで続けて行います。チケットをお持ちの方はどなたでもご覧いただけます。</dd>
              <dt>途中で退出してもいいですか？</dt>
              <dd>自由です。作品によっては、ご自身の経験と重なる場面があるかもしれません。無理をせず、いつでも席を立っていただけます。</dd>
            </div>
            <div>
              <dt>当事者や家族として参加してもいいですか？</dt>
              <dd>もちろんです。ただし、この映画祭は当事者の方に何かを求める場ではありません。一人の観客として、静かに映画を観ていただける場所にします。</dd>
              <dt>相談窓口はありますか？</dt>
              <dd>会場に支援団体・相談窓口のご案内を設置する予定です〔調整中〕。お問い合わせフォームでは個別のご相談にはお応えできません。</dd>
              <dt>子どもと一緒に行けますか？</dt>
              <dd>作品ごとに年齢の目安を明記する予定です。上映作品が決まりしだいご案内します。〔調整中〕</dd>
            </div>
          </dl>
          <p className="small muted" style={{ marginTop: "20px" }}>※ 〔調整中〕と記した項目は、企画書に記載のない検討中の内容です。</p>
        </div>
      </section>
    </>
  );
}
