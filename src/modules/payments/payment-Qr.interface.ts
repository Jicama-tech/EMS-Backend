export type PaymentScheme = "UPI" | "PAYNOW";

export interface PaymentQrConfig {
  scheme: PaymentScheme;
  payeeId: string; // e.g. VPA for UPI, UEN/Mobile for PayNow
  payeeName: string;
  countryCode: string; // "IN" for UPI, "SG" for PayNow
  currency: string; // e.g. INR, SGD
  amount: string; // formatted decimal, e.g. "12.50"
  billNumber?: string;
  editableAmount?: boolean;
}
