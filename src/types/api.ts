// Mirrors Ogasela.API's response/request DTOs exactly (property names, casing, enum string
// values) so this file and the backend controllers stay visibly in sync. One block per
// controller/bounded concern, matching src/services/*.ts's file split.

export type UserRole =
  | "Buyer"
  | "Seller"
  | "SupportAgent"
  | "Moderator"
  | "FinanceAdmin"
  | "SuperAdmin"
  | "Staff";

export interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  /** Present on ASP.NET model/FluentValidation failures - field name to its list of error messages. */
  errors?: Record<string, string[]>;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// Accounts (auth.ts) - Ogasela.Api/Controllers/Accounts/AuthController.cs

export interface RegisterResponse {
  userId: string;
  role: UserRole;
}

export interface AuthTokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

// Accounts (me.ts) - Ogasela.Api/Controllers/Accounts/MeController.cs

export interface SellerProfileSummary {
  id: string;
  businessName: string;
  rcNumber: string | null;
  nin: string | null;
  verificationStatus:
    "NotStarted" | "Pending" | "Verified" | "Failed" | "ManualReview";
  verifiedAt: string | null;
  storeAddress?: string | null;
  /** Null unless staff verified the business - a trust badge, separate from verificationStatus. */
  businessVerifiedAt?: string | null;
}

export interface CurrentUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  createdAt: string;
  sellerProfile: SellerProfileSummary | null;
  /** Short-lived signed URL; null until the user sets a photo with face capture. */
  profilePhotoUrl?: string | null;
}

// Listings (listings.ts) - Ogasela.Api/Controllers/Listings/ListingsController.cs

export type ListingCondition = "New" | "Used";
/** PendingReview: submitted and waiting for a moderator to approve it before it goes live. */
export type ListingStatus =
  | "Draft"
  | "Active"
  | "ExpiringSoon"
  | "Expired"
  | "Paused"
  | "Sold"
  | "PendingReview";

export interface Listing {
  id: string;
  sellerId: string;
  categoryId: string;
  promotionPlanId: string | null;
  title: string;
  description: string;
  price: number | null;
  condition: ListingCondition;
  status: ListingStatus;
  mediaUrls: string[];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Why a moderator rejected the last submission (the listing is back in Draft); null otherwise. */
  reviewNote?: string | null;
  /** Used items only: whether the seller has the original receipt. Null for new items. */
  hasOriginalReceipt?: boolean | null;
  tikTokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  /** Played in-app on the ad screen. */
  youTubeUrl?: string | null;
  /** Whether the "Request Office Pickup" button shows - set per category in the Control Portal. */
  officePickupAvailable?: boolean;
}

/** GET /listings/{id} - Listing plus what the ad detail screen needs. seller.phone is null unless signed in. */
export interface ListingDetail extends Listing {
  categoryName: string | null;
  parentCategoryId: string | null;
  promotionPlanName: PromotionPlanName | null;
  seller: {
    sellerProfileId: string;
    userId: string;
    businessName: string;
    name: string | null;
    phone: string | null;
    storeAddress: string | null;
    verificationStatus: string;
    memberSince: string;
    isBusinessVerified?: boolean;
  };
}

export interface UploadListingImageResponse {
  url: string;
}

// Search (search.ts) - Ogasela.Api/Controllers/Search/SearchController.cs

export type SearchSort =
  "relevance" | "newest" | "price_asc" | "price_desc" | "distance";
/** Plan names are free text - SuperAdmins add and rename plans in the Control Portal. A plan is free when its price is 0. */
export type PromotionPlanName = string;

export interface SearchResultItem {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  price: number | null;
  condition: ListingCondition;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null;
  createdAt: string;
  planTier: PromotionPlanName;
  distanceKm: number | null;
  score: number;
}

// Messaging (messaging.ts) - ConversationsController.cs, UsersController.cs, ReportsController.cs

export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  otherParticipantId: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  sentAt: string;
  readAt: string | null;
}

// Verification (verification.ts) - Ogasela.Api/Controllers/Verification/VerificationController.cs

export interface SubmitBiometricConsentResponse {
  consentId: string;
  consentVersion: string;
  acceptedAt: string;
}

export interface CreateLivenessSessionResponse {
  livenessSessionRef: string;
}

export interface SubmitVerificationResponse {
  verificationId: string;
  decision: "Verified" | "Failed" | "ManualReview";
  attemptNumber: number;
  maxAttempts: number;
}

export interface VerificationStatusResponse {
  status: "NotStarted" | "Pending" | "Verified" | "Failed" | "ManualReview";
  attemptsUsed: number;
  maxAttempts: number;
  latestVerificationId: string | null;
  latestSubmittedAt: string | null;
  latestDecidedAt: string | null;
  verifiedAt: string | null;
}

// Payments (wallet.ts) - Ogasela.Api/Controllers/Payments/WalletController.cs

export interface FundWalletResponse {
  transactionId: string;
  gatewayReference: string;
  redirectUrl: string;
}

export interface Wallet {
  sellerId: string;
  balanceKobo: number;
  updatedAt: string;
}

export type TransactionType = "PlanPurchase" | "AdSpendTopUp" | "Refund";
export type TransactionStatus = "Pending" | "Success" | "Failed" | "Refunded" | "Cancelled";

export interface Transaction {
  id: string;
  type: TransactionType;
  amountKobo: number;
  gatewayReference: string | null;
  status: TransactionStatus;
  relatedListingId: string | null;
  createdAt: string;
}

// Promotions (categories.ts, promotionPlans.ts) - Ogasela.Api/Controllers/Promotions/

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  isFreeEligible: boolean;
  attributeSchemaVersion: number;
  imageUrl: string | null;
}

export type AiToolTier = "Basic" | "Standard" | "Full";

export interface PromotionPlan {
  id: string;
  name: PromotionPlanName;
  /** One-line pitch for the plan. */
  description: string | null;
  /** What the plan offers, as short bullet points. */
  features: string[];
  durationDays: number;
  photoLimit: number;
  videoAllowed: boolean;
  boostWeight: number;
  price: number;
  aiToolTier: AiToolTier;
  adPlatformPushAllowed: boolean;
  bundledAdCreditKobo: number;
  isActive: boolean;
}

// Reviews (reviews.ts) - Ogasela.Api/Controllers/Reviews/ReviewsController.cs

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  listingId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewListItem {
  id: string;
  reviewerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerName: string | null;
}

export interface PagedReviews extends PagedResult<ReviewListItem> {
  averageRating: number;
}

// Notifications (notifications.ts) - Ogasela.Api/Controllers/Notifications/NotificationsController.cs

export type NotificationChannel = "Push" | "Sms" | "Email" | "WhatsApp";
export type NotificationDeliveryStatus = "Pending" | "Sent" | "Failed";

export interface NotificationListItem {
  id: string;
  channel: NotificationChannel;
  type: string;
  payload: string;
  status: NotificationDeliveryStatus;
  createdAt: string;
}

export interface NotificationPreferenceInput {
  channel: NotificationChannel;
  category: string;
  enabled: boolean;
}

// Ai (ai.ts) - Ogasela.Api/Controllers/Ai/AiController.cs

export interface ListingCopySuggestion {
  title: string;
  description: string;
}

export interface PriceSuggestion {
  minKobo: number;
  suggestedKobo: number;
  maxKobo: number;
  comparableCount: number;
}

export interface EnhanceImageResponse {
  enhancedImageKey: string;
  enhancedImageUrl: string;
}

// Geo (geo.ts) - Ogasela.Api/Controllers/Geo/GeoController.cs

export interface NigeriaState {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface NigeriaCity {
  id: string;
  stateId: string;
  name: string;
  createdAt: string;
}

// AdIntegrations (adIntegrations.ts) - Ogasela.Api/Controllers/AdIntegrations/

export type AdPlatform = "Facebook" | "TikTok";
export type AdCampaignStatus =
  "PendingReview" | "Active" | "Rejected" | "Paused" | "Ended";

export interface ConnectAdPlatformResponse {
  authorizationUrl: string;
}

export interface AdCampaign {
  id: string;
  listingId: string;
  platform: AdPlatform;
  externalCampaignId: string;
  budgetKobo: number;
  durationDays: number;
  status: AdCampaignStatus;
  lastMetricsSyncAt: string | null;
  createdAt: string;
}

export interface AdCampaignPerformance {
  platform: AdPlatform;
  status: AdCampaignStatus;
  impressions: number;
  clicks: number;
  spendKobo: number;
  lastMetricsSyncAt: string | null;
}

export interface AdPerformance {
  listingId: string;
  totalImpressions: number;
  totalClicks: number;
  totalSpendKobo: number;
  campaigns: AdCampaignPerformance[];
}
