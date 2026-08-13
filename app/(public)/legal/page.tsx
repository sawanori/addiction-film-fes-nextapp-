import type { Metadata } from "next";
import SmartLink from "@/components/SmartLink";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記｜アディクション国際映画祭",
  description:
    "アディクション国際映画祭〔企画中〕のチケット販売に関する特定商取引法に基づく表記。",
};

export default function LegalPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="eyebrow">Legal</span>
          <h1 className="display display--sm">Legal Notice</h1>
          <p className="page-head__jp">特定商取引法に基づく表記</p>
          <p className="page-head__lead lead">チケットのオンライン販売にあたって、特定商取引に関する法律第11条に基づき表示します。</p>
        </div>
      </section>

      <section className="doc">
        <div className="wrap">
          <div className="doc__sheet">
            <p className="doc__intro"><strong>この表記は雛形です。</strong>チケットの販売方法が未定のため、大半の項目が〔調整中〕です。<strong>自社サイトで直接チケットを販売する場合は、この表記が法律上必須</strong>になります。外部のプレイガイド（イープラス・チケットぴあ等）経由での販売のみとする場合は、販売主体がそちらになるため、本ページは不要になる可能性があります。販売方法の決定後、法務の確認を受けてください。</p>

            <table className="table">
              <tbody>
                <tr>
                  <td>販売事業者</td>
                  <td>アディクション国際映画祭 実行委員会〔仮称〕</td>
                </tr>
                <tr>
                  <td>運営責任者</td>
                  <td>〔調整中〕</td>
                </tr>
                <tr>
                  <td>所在地</td>
                  <td>〔調整中〕<br /><span className="small muted">※ 請求があった場合は遅滞なく開示します</span></td>
                </tr>
                <tr>
                  <td>電話番号</td>
                  <td>〔調整中〕<br /><span className="small muted">※ 受付時間：〔調整中〕</span></td>
                </tr>
                <tr>
                  <td>メールアドレス</td>
                  <td>〔調整中〕</td>
                </tr>
                <tr>
                  <td>ホームページ</td>
                  <td>〔ドメイン未定〕</td>
                </tr>
                <tr>
                  <td>販売価格</td>
                  <td>1日券 3,000円（税込）／2日券 5,000円（税込）</td>
                </tr>
                <tr>
                  <td>商品代金以外の必要料金</td>
                  <td>システム利用料、決済手数料〔金額・調整中〕<br />インターネット接続料金および通信料金はお客さまのご負担となります</td>
                </tr>
                <tr>
                  <td>支払方法</td>
                  <td>〔調整中〕</td>
                </tr>
                <tr>
                  <td>支払時期</td>
                  <td>〔調整中〕</td>
                </tr>
                <tr>
                  <td>商品の引渡時期</td>
                  <td>〔調整中〕<br /><span className="small muted">※ 電子チケットの場合は決済完了後ただちに発行、といった記載になります</span></td>
                </tr>
                <tr>
                  <td>キャンセル・返品について</td>
                  <td>〔調整中〕<br />主催者都合により公演を中止した場合の取扱いは<SmartLink href="/terms#c2">利用規約 第10条</SmartLink>をご確認ください</td>
                </tr>
                <tr>
                  <td>動作環境</td>
                  <td>〔電子チケットを採用する場合に記載〕</td>
                </tr>
              </tbody>
            </table>

            <h2>関連するページ</h2>
            <ul>
              <li><SmartLink href="/tickets">チケット</SmartLink> — 券種・料金・購入の流れ</li>
              <li><SmartLink href="/terms#c2">利用規約 第2章</SmartLink> — 転売の禁止、キャンセル、中止時の取扱い</li>
              <li><SmartLink href="/privacy">プライバシーポリシー</SmartLink> — 購入時に取得する情報の取扱い</li>
            </ul>

            <div className="doc__meta">
              <p>制定日：〔調整中〕<br />アディクション国際映画祭 実行委員会〔仮称〕</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
