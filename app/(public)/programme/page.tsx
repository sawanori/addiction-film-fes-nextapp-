import type { Metadata } from "next";
import Films from "@/components/Films";
import Timetable from "@/components/Timetable";
import SmartLink from "@/components/SmartLink";
import { styleVars } from "@/lib/style";

export const metadata: Metadata = {
  title: "Programme｜アディクション国際映画祭",
  description:
    "アディクション国際映画祭〔企画中〕のプログラム。全作品トークショー付きの上映構成、2日間のタイムテーブル、会場について。",
};

export default function ProgrammePage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Programme</span>
          <h1 className="display">
            1 Film,
            <br />
            1 Talk
          </h1>
          <p className="page-head__jp">映画1本ごとに、トークショーを。</p>
          <p className="page-head__lead lead">上映して終わりにはしません。1本ごとに、その場でトークショーを併催します。作品の感想から始まり、いつのまにか依存症の話になっている。その流れを2日間くり返します。</p>
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
            <SmartLink className="arrow" href="/tickets">
              チケットを見る
            </SmartLink>
          </div>

          <Films variant="programme" />
        </div>
      </section>

      {/* 上映の考え方 */}
      <section className="section">
        <div className="wrap">
          <div className="rows">
            <div className="row-item rise">
              <span className="row-item__no">01</span>
              <div>
                <p className="row-item__t">上映作品<span className="small muted">／Films</span></p>
                <p className="row-item__d">映画ファンを唸らせる、国内外の受賞作や芸術性の高いエッジの効いた作品をラインナップします。啓発用に作られた映像ではなく、映画館で観るために作られた映画を選びます。長編2本・中編1本・短編3本の全6作品が決定しました。</p>
              </div>
              <p className="row-item__meta">
                全6作品／2日間
                <br />
                <a className="arrow" href="#films">
                  作品一覧
                </a>
              </p>
            </div>
            <div
              className="row-item rise"
              style={styleVars({ "--d": ".06s" })}
              id="talk"
            >
              <span className="row-item__no">02</span>
              <div>
                <p className="row-item__t">トークショー<span className="small muted">／Talk Show</span></p>
                <p className="row-item__d">上映後、同じホールでそのままトークへ。啓発っぽさを排除し、作品の感想戦の延長で語られるカジュアルで深いクロストークになるよう、ゲストを厳選します。依存症から回復した著名人にも登壇いただく予定です。</p>
              </div>
              <p className="row-item__meta">
                会期中 全4回
                <br />
                ほか特別講演・質疑応答
              </p>
            </div>
            <div
              className="row-item rise"
              style={styleVars({ "--d": ".12s" })}
              id="navigator"
            >
              <span className="row-item__no">03</span>
              <div>
                <p className="row-item__t">フェスティバル・ナビゲーター</p>
                <p className="row-item__d">2日間を通した進行役は、映画ライター・編集者のよしひろまさみち氏。作品の見どころを伝え、トークの入口をつくる役割です。上映とトークをぶつ切りにせず、1本の流れとして届けます。</p>
              </div>
              <p className="row-item__meta">
                よしひろまさみち
                <br />
                <SmartLink className="arrow" href="/#navigator">
                  プロフィール
                </SmartLink>
              </p>
            </div>
            <div
              className="row-item rise"
              style={styleVars({ "--d": ".18s" })}
              id="novelty-link"
            >
              <span className="row-item__no">04</span>
              <div>
                <p className="row-item__t">啓発ノベルティ<span className="small muted">／Novelty</span></p>
                <p className="row-item__d">プレミア感とデザイン性にこだわった啓発グッズを来場者に配布します。会場を出たあとも手元に残るものを想定しています。</p>
              </div>
              <p className="row-item__meta">
                <SmartLink className="arrow" href="/tickets#novelty">
                  くわしく
                </SmartLink>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* タイムテーブル */}
      <section className="panel panel--wine">
        <div className="panel__dots" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow" style={{ color: "var(--red)" }}>
                2 Days
              </span>
              <h2
                className="display display--sm"
                style={{ color: "var(--white)" }}
              >
                Timetable
              </h2>
              <p className="jp-head" style={{ color: "var(--red)" }}>
                2日間のタイムスケジュール
              </p>
            </div>
          </div>
          <Timetable />
          <p className="small muted" style={{ marginTop: "16px" }}>※ タイムスケジュールは案です。開始時刻は変更になる場合があります。登壇者は決まりしだい発表します。</p>
        </div>
      </section>

      {/* 会場 */}
      <section className="section" id="venue">
        <div className="wrap">
          <div className="section__head">
            <div>
              <span className="eyebrow">Venue</span>
              <h2 className="display display--sm">Venue</h2>
              <p className="jp-head">会場</p>
            </div>
            <SmartLink className="arrow" href="/tickets">
              チケットを見る
            </SmartLink>
          </div>

          <div className="cols-2">
            <div className="box box--dark rise">
              <h3>よみうりホール（東京・有楽町）</h3>
              <p>2日間を通して、会場は1か所です。分散させず、同じ空間に人が集まりつづける構成にします。上映もトークも同じホールで行うため、席を立たずにそのまま話を聴くことができます。</p>
              <p style={{ marginTop: "14px" }}>アクセス・座席図・バリアフリー情報は、確定しだい掲載します。</p>
            </div>
            <div
              className="box rise"
              style={styleVars({ "--d": ".08s" })}
            >
              <h3>会場でできること〔想定〕</h3>
              <p>・ノベルティの受け取り<br />・支援団体・相談窓口のご案内ブース<br />・書籍や資料の展示<br />・トーク登壇者との交流スペース</p>
              <p style={{ marginTop: "14px" }} className="small muted">※ 企画書に記載のない想定です。実施の可否は今後の検討によります。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-bar rise">
            <p className="cta-bar__t">上映作品とトークゲストは、決まりしだい発表します。</p>
            <SmartLink className="arrow" href="/news">
              お知らせを見る
            </SmartLink>
          </div>
        </div>
      </section>
    </>
  );
}
