import { FinancialDashboard } from "@/components/finance/dashboard";
import {
  normalizeParams,
  type SearchParams,
} from "@/components/finance/transaction-page";
export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await normalizeParams(searchParams);
  return (
    <FinancialDashboard
      month={params.month}
      window={params.window}
      created={params.created === "1"}
    />
  );
}
