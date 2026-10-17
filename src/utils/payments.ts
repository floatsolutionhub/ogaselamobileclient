import * as WebBrowser from "expo-web-browser";

import { holdActivity } from "@/lib/activityClock";

/**
 * The link the website's payment result page (ogasela.com/payment/complete) sends the payer back
 * through. openAuthSessionAsync closes the checkout as soon as the browser reaches it.
 */
export const PAYMENT_RETURN_URL = "ogasela://payment-complete";

/**
 * "completed": the payer finished checkout and came back through the result page - confirm it.
 * "closed": they shut the payment page (or the gateway reported a cancel) - ask the API to cancel,
 * which still settles it if the gateway says the money went through.
 */
export type CheckoutReturn = "completed" | "closed";

export async function openCheckout(url: string): Promise<CheckoutReturn> {
  // Paying can take a while (OTPs, bank apps) - that isn't inactivity, so don't sign them out for it.
  const release = holdActivity();
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_URL);
  } finally {
    release();
  }
  if (result.type !== "success") return "closed";
  const status = new URL(result.url).searchParams.get("status");
  return status === "cancelled" ? "closed" : "completed";
}
