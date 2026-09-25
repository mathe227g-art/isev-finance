import { AuthScreen } from "@/components/auth-screen";
const notices: Record<string, string> = {
  password: "Senha atualizada. Entre com sua nova senha.",
  logout: "Você saiu da sua conta com segurança.",
  expired: "Este link expirou ou já foi utilizado. Solicite um novo link.",
  recovery: "Solicite um link de recuperação para definir uma nova senha.",
  oauth: "Não foi possível concluir o acesso com Google. Tente novamente ou use seu e-mail e senha.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <AuthScreen mode="login" notice={notice ? notices[notice] : undefined} />
  );
}
