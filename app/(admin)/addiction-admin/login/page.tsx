import LoginForm from "./LoginForm";

export const metadata = {
  title: "ログイン | 管理画面",
};

/**
 * next クエリの検証はサーバ側で行う（オープンリダイレクト対策）。
 * /addiction-admin で始まり、かつ // で始まらないものだけ採用する。
 */
function resolveNext(nextParam: string | string[] | undefined): string {
  if (
    typeof nextParam === "string" &&
    nextParam.startsWith("/addiction-admin") &&
    !nextParam.startsWith("//")
  ) {
    return nextParam;
  }
  return "/addiction-admin";
}

export default async function AdminLoginPage({ searchParams }: PageProps<"/addiction-admin/login">) {
  const params = await searchParams;
  return <LoginForm next={resolveNext(params.next)} />;
}
