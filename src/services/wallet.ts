// Ogasela.Api/Controllers/Payments/WalletController.cs - one function per route.
// There is no "purchase a plan" endpoint - listings.publish()/repost() debit the wallet
// automatically for the listing's chosen promotionPlanId. Fund the wallet first if the balance
// would be insufficient (Payment.InsufficientBalance, 402).
import { api } from "@/lib/apiClient";
import type { FundWalletResponse, PagedResult, Transaction, Wallet } from "@/types/api";

/** Returns a hosted checkout URL - open it with expo-web-browser's openBrowserAsync, then re-fetch getWallet() on return/app-foreground (funding happens async via a server-to-server webhook, nothing to poll for immediate confirmation). */
export function fundWallet(amountKobo: number): Promise<FundWalletResponse> {
  return api.post<FundWalletResponse>("/wallet/fund", { amountKobo });
}

export function getWallet(): Promise<Wallet> {
  return api.get<Wallet>("/wallet");
}

export function getTransactions(page = 1, pageSize = 20): Promise<PagedResult<Transaction>> {
  return api.get<PagedResult<Transaction>>(`/transactions?page=${page}&pageSize=${pageSize}`);
}
