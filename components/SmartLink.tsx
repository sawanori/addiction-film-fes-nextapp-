import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

type SmartLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/**
 * 内部リンク用の共通コンポーネント。
 * 同一ページ内アンカー（"#…"）は素の <a>、それ以外は next/link の <Link> で出し分ける。
 */
export default function SmartLink({ href, ...rest }: SmartLinkProps) {
  if (href.startsWith("#")) {
    return <a href={href} {...rest} />;
  }
  return <Link href={href} {...rest} />;
}
