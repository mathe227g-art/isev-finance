import {
  TransactionPage,
  type SearchParams,
} from "@/components/finance/transaction-page";
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <TransactionPage searchParams={searchParams} type="income" />;
}
