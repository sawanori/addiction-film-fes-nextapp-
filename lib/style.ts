import type { CSSProperties } from "react";

/**
 * rise アニメの遅延を渡すカスタムプロパティ `--d` を載せられる style 型。
 * `{ "--d": ... } as CSSProperties` と object 全体をアサートすると
 * 通常の CSS プロパティの typo が型チェックをすり抜けるため、
 * アサーションではなくこの型で受ける形に統一する。
 */
export type StyleWithVars = CSSProperties & { "--d"?: string };

/** JSX の style prop に渡す object を StyleWithVars として受け取る */
export function styleVars(style: StyleWithVars): StyleWithVars {
  return style;
}
