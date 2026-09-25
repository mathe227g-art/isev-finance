import { AuthScreen } from "@/components/auth-screen";
import { requireUser } from "@/services/session";
export default async function Password() {
  await requireUser();
  return <AuthScreen mode="password" />;
}
