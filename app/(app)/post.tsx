import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  Check,
  ChevronLeft,
  Link as LinkIcon,
  Plus,
  Sparkles,
  Tag,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { Modal } from "@/components/ActivityModal";
import { FormField } from "@/components/FormField";
import { GradientScreen } from "@/components/GradientScreen";
import { PostStepProgress } from "@/components/PostStepProgress";
import { PrimaryButton } from "@/components/PrimaryButton";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useLocation } from "@/context/LocationContext";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useVerificationOverview } from "@/hooks/useVerificationOverview";
import { ApiError } from "@/lib/apiClient";
import * as aiService from "@/services/ai";
import * as listingsService from "@/services/listings";
import { colors } from "@/theme/colors";
import { ListingCondition } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { prepareListingPhoto } from "@/utils/photos";
import {
  isPlatformLink,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/utils/socialLinks";
import { createListingSchema } from "@/utils/validation";
import { ICON } from "@/theme/typography";

/** Form labels on this screen are bigger and bolder than the app default. */
const LABEL = "mb-2 font-poppins-semibold text-subtitle text-ink-900";

/** The form field holding each platform's link. */
const LINK_FIELD: Record<SocialPlatform, "youTubeUrl" | "tikTokUrl" | "instagramUrl" | "facebookUrl"> = {
  youtube: "youTubeUrl",
  tiktok: "tikTokUrl",
  instagram: "instagramUrl",
  facebook: "facebookUrl",
};

/** The API's limit (Listing.MaxPhotoCount). */
const MAX_PHOTOS = 5;

const STEPS = [
  { key: "details", fields: ["title", "categoryId", "condition"] },
  { key: "photos", fields: [] },
  { key: "copy", fields: ["description", "price"] },
] as const satisfies readonly { key: string; fields: readonly (keyof Values)[] }[];

type Values = {
  title: string;
  categoryId: string;
  subcategoryId: string;
  condition: ListingCondition | "";
  description: string;
  price: string;
  /** Used items: whether the seller has the original receipt of purchase. */
  hasReceipt: boolean;
  youTubeUrl: string;
  tikTokUrl: string;
  instagramUrl: string;
  facebookUrl: string;
};

const EMPTY: Values = {
  title: "",
  categoryId: "",
  subcategoryId: "",
  condition: "",
  description: "",
  price: "",
  hasReceipt: false,
  youTubeUrl: "",
  tikTokUrl: "",
  instagramUrl: "",
  facebookUrl: "",
};

type PickedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  /** expo-image-picker's web-only File object - see listingsService.uploadImage for why it's required on web. */
  webFile?: File;
  /** Set once uploaded, so it's never uploaded twice. Photos of a resumed draft start with it set. */
  url?: string;
};

/** What the AI pop-up is offering. */
type Suggestion =
  | { kind: "description"; description: string }
  | { kind: "price"; suggested: number; min: number; max: number; comparables: number };

/**
 * Posting an ad, in grouped steps: item details (title, category, subcategory, condition) →
 * photos → description & price (with AI suggestions) → promote & pay (the checkout screen).
 *
 * The ad is a Draft on the server from the first Continue onwards and is saved again on every
 * Continue and whenever the seller leaves this screen, so closing midway never loses it - it's in
 * My Ads → Drafts, and opening it there resumes here. It only stops being a Draft once its plan
 * is paid for at checkout, which submits it for review.
 */
export default function PostScreen() {
  useProtectedRoute("/(app)/post");
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string }>();
  const { locationLabel, isNationwide } = useLocation();
  const { tree } = useCategoryTree();

  // Only verified accounts can sell: until then the form is shown but Continue stays disabled.
  const { overview: verification } = useVerificationOverview();
  const canSell = verification?.personal.status === "Verified";

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [listingId, setListingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // A draft opened from My Ads that hasn't loaded into the form yet.
  const resuming = !!params.listingId && params.listingId !== listingId;

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  // What each pop-up was last offered for - it only pops up again if those inputs change.
  const askedFor = useRef<{ description?: string; price?: string }>({});

  const current = STEPS[step];
  const category = tree.find((c) => c.id === values.categoryId);
  const subcategory = category?.children.find((c) => c.id === values.subcategoryId);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues(EMPTY);
    setPhotos([]);
    setErrors({});
    setStep(0);
    setListingId(null);
    askedFor.current = {};
  };

  // ---- Resuming a draft (from My Ads) ----

  useEffect(() => {
    const id = params.listingId;
    if (!id || id === listingId || tree.length === 0) return;
    let cancelled = false;
    listingsService
      .getById(id)
      .then((ad) => {
        if (cancelled) return;
        // The ad is filed under a subcategory or directly under a top-level category.
        const parent = tree.find((c) => c.id === ad.categoryId || c.children.some((x) => x.id === ad.categoryId));
        setValues({
          title: ad.title,
          categoryId: parent?.id ?? ad.categoryId,
          subcategoryId: parent && parent.id !== ad.categoryId ? ad.categoryId : "",
          condition: ad.condition,
          description: ad.description,
          price: ad.price != null ? String(ad.price) : "",
          hasReceipt: ad.hasOriginalReceipt === true,
          youTubeUrl: ad.youTubeUrl ?? "",
          tikTokUrl: ad.tikTokUrl ?? "",
          instagramUrl: ad.instagramUrl ?? "",
          facebookUrl: ad.facebookUrl ?? "",
        });
        setPhotos(ad.mediaUrls.map((url, i) => ({ uri: url, url, fileName: `photo-${i}.jpg`, mimeType: "image/jpeg" })));
        setListingId(ad.id);
        setErrors({});
        // Pick up at the first step that still needs something.
        setStep(!ad.title || !ad.categoryId ? 0 : ad.mediaUrls.length === 0 ? 1 : 2);
        askedFor.current = {};
      })
      .catch(() => {
        if (cancelled) return;
        Toast.show({ type: "error", text1: "Couldn't open that draft" });
        router.setParams({ listingId: undefined });
      });
    return () => {
      cancelled = true;
    };
    // Only when a different draft is opened, or once categories arrive to map it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.listingId, tree.length]);

  // ---- Draft saving ----

  /** Uploads any photo not uploaded yet; returns the full list with URLs. */
  const uploadPhotos = async (list: PickedPhoto[]): Promise<PickedPhoto[]> => {
    const uploaded: PickedPhoto[] = [];
    for (const photo of list) {
      if (photo.url) {
        uploaded.push(photo);
        continue;
      }
      const result = await listingsService.uploadImage({
        uri: photo.uri,
        name: photo.fileName,
        type: photo.mimeType,
        webFile: photo.webFile,
      });
      uploaded.push({ ...photo, url: result.url });
    }
    setPhotos(uploaded);
    return uploaded;
  };

  /**
   * Creates the draft, or updates it. Needs at least a title and category; everything else may
   * still be empty - the API only insists on completeness at checkout. Only uploaded photos are
   * saved; picked-but-not-uploaded ones go up when leaving the photos step.
   */
  const saveDraft = async (v: Values, list: PickedPhoto[], id: string | null): Promise<string | null> => {
    if (!v.title.trim() || !v.categoryId) return id;
    const input: listingsService.ListingInput = {
      title: v.title.trim(),
      description: v.description.trim(),
      categoryId: v.subcategoryId || v.categoryId,
      price: v.price ? Number(v.price) : null,
      condition: (v.condition || "Used") as ListingCondition,
      mediaUrls: list.filter((p) => p.url).map((p) => p.url!),
      promotionPlanId: null,
      // "All of Nigeria" isn't a place - save the ad without a location instead.
      location: isNationwide ? null : locationLabel,
      latitude: null,
      longitude: null,
      hasOriginalReceipt: v.condition === "Used" ? v.hasReceipt : null,
      // A half-typed link is left out rather than failing the whole draft save; Continue flags it.
      ...Object.fromEntries(
        SOCIAL_PLATFORMS.map(({ key }) => {
          const url = v[LINK_FIELD[key]].trim();
          return [LINK_FIELD[key], url && isPlatformLink(key, url) ? url : null];
        }),
      ),
    };
    if (id) {
      await listingsService.update(id, input);
      return id;
    }
    const created = await listingsService.createDraft(input);
    setListingId(created.id);
    return created.id;
  };

  // Leaving the screen mid-way (another tab, closing the app) saves what's there as a draft.
  const latest = useRef({ values, photos, listingId, saveDraft });
  useEffect(() => {
    latest.current = { values, photos, listingId, saveDraft };
  });
  // Set when handing a finished draft to checkout - it was just saved, and saving again here
  // would race the payment.
  const handedOff = useRef(false);
  useFocusEffect(
    useCallback(() => {
      handedOff.current = false;
      return () => {
        if (handedOff.current) return;
        const { values: v, photos: p, listingId: id, saveDraft: save } = latest.current;
        save(v, p, id).catch(() => {});
      };
    }, []),
  );

  // ---- AI suggestions ----

  const descriptionKey = (coverUrl: string | undefined) =>
    `${values.title}|${values.categoryId}|${values.subcategoryId}|${coverUrl ?? ""}`;
  const priceKey = `${values.title}|${values.subcategoryId || values.categoryId}|${values.condition}`;

  /** coverUrl is passed in right after the photos upload, before the photos state has caught up. */
  const suggestDescription = async (coverUrl = photos[0]?.url) => {
    askedFor.current.description = descriptionKey(coverUrl);
    setAiLoading(true);
    setAiNote(null);
    try {
      const keywords = [values.title, category?.name, subcategory?.name]
        .filter(Boolean)
        .join(", ");
      const result = await aiService.generateDescription(null, keywords, coverUrl ?? null);
      if (result.description?.trim()) {
        setSuggestion({ kind: "description", description: result.description.trim() });
        return;
      }
    } catch {
      setAiNote("AI suggestions aren't available right now - you can write it yourself.");
    } finally {
      setAiLoading(false);
    }
    // No description to offer - go straight on to the price.
    maybeSuggestPrice();
  };

  const suggestPrice = async () => {
    if (!values.condition) return;
    askedFor.current.price = priceKey;
    setAiLoading(true);
    setAiNote(null);
    try {
      const result = await aiService.suggestPrice(
        null,
        values.subcategoryId || values.categoryId,
        values.title.trim(),
        values.condition,
      );
      setSuggestion({
        kind: "price",
        suggested: Math.round(result.suggestedKobo),
        min: Math.round(result.minKobo),
        max: Math.round(result.maxKobo),
        comparables: result.comparableCount,
      });
    } catch (error) {
      setAiNote(
        error instanceof ApiError && error.code === "Ai.NotEnoughComparableData"
          ? "Not enough similar ads yet for a price suggestion - set your own price."
          : "Price suggestions aren't available right now - set your own price.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const maybeSuggestPrice = () => {
    if (!values.price.trim() && askedFor.current.price !== priceKey) suggestPrice();
  };

  /** Arriving on description & price: offer a description first, then a price once that's answered. */
  const offerSuggestions = (coverUrl: string | undefined) => {
    if (!values.description.trim() && askedFor.current.description !== descriptionKey(coverUrl)) {
      suggestDescription(coverUrl);
    } else {
      maybeSuggestPrice();
    }
  };

  const closeSuggestion = (accept: boolean) => {
    const offered = suggestion;
    if (accept && offered?.kind === "description") set("description", offered.description);
    if (accept && offered?.kind === "price") set("price", String(offered.suggested));
    setSuggestion(null);
    if (offered?.kind === "description") maybeSuggestPrice();
  };

  // ---- Photos ----

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: "error",
        text1: "Permission needed",
        text2: "Allow photo library access to add photos.",
      });
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets) return;

    setBusy("Preparing photos...");
    try {
      // Re-encoded as JPEG on the device - iPhone HEIC photos can't be read by the API.
      const picked = await Promise.all(result.assets.map(prepareListingPhoto));
      setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    } catch {
      Toast.show({ type: "error", text1: "Couldn't use those photos", text2: "Try picking them again." });
    } finally {
      setBusy(null);
    }
  };

  // ---- Navigation ----

  const validateStep = async () => {
    const found: Partial<Record<keyof Values, string>> = {};
    for (const field of current.fields) {
      try {
        await createListingSchema.validateAt(field, values);
      } catch (err) {
        found[field] = (err as Error).message;
      }
    }
    if (current.key === "copy") {
      for (const { key, label } of SOCIAL_PLATFORMS) {
        if (!isPlatformLink(key, values[LINK_FIELD[key]])) {
          found[LINK_FIELD[key]] = `Enter a full ${label} link (starting with https://), or leave it blank.`;
        }
      }
    }
    if (current.key === "photos" && photos.length === 0) {
      Toast.show({ type: "error", text1: "Add at least one photo", text2: "Ads with photos sell much faster." });
      return false;
    }
    setErrors((prev) => ({ ...prev, ...found }));
    return Object.keys(found).length === 0;
  };

  const showError = (title: string, error: unknown) =>
    Toast.show({
      type: "error",
      text1: title,
      text2: error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
    });

  const next = async () => {
    if (!(await validateStep())) return;

    setBusy(current.key === "photos" ? "Uploading photos..." : "Saving your draft...");
    try {
      const list = current.key === "photos" ? await uploadPhotos(photos) : photos;
      const id = await saveDraft(values, list, listingId);

      if (step < STEPS.length - 1) {
        setStep(step + 1);
        setAiNote(null);
        if (STEPS[step + 1].key === "copy") offerSuggestions(list[0]?.url);
        return;
      }

      // Complete and saved - on to choosing a plan and paying. The form starts fresh next time;
      // this ad lives on as a draft until it's paid for.
      handedOff.current = true;
      reset();
      router.setParams({ listingId: undefined });
      router.push({ pathname: "/choose-plan", params: { listingId: id!, fromPost: "1" } });
    } catch (error) {
      showError(current.key === "photos" ? "Couldn't upload your photos" : "Couldn't save your ad", error);
    } finally {
      setBusy(null);
    }
  };

  const back = () => {
    setAiNote(null);
    if (step > 0) setStep(step - 1);
  };

  // ---- Render ----

  if (resuming) {
    return (
      <GradientScreen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand600} />
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen scroll={false}>
      <View className="px-6 pt-6">
        <Text className="font-poppins-bold text-display text-ink-900">
          {listingId ? "Edit your ad" : "Post an ad"}
        </Text>
        <Text className="mt-1 font-poppins text-body text-ink-500">
          {listingId
            ? "Saved as a draft - finish it any time from My Ads."
            : isNationwide
              ? "Reach genuine buyers across Nigeria"
              : `Reach genuine buyers near ${locationLabel}`}
        </Text>
        <PostStepProgress current={step} />
      </View>

      <ScrollView
        className="px-6 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {verification && !canSell ? (
          <View className="mb-5">
            <VerificationBadge
              kind="personal"
              track={verification.personal}
              note={
                verification.personal.status === "PendingReview"
                  ? "You'll be able to post ads as a seller once our team approves your verification."
                  : "You need to complete account verification before you can become a seller and post ads."
              }
            />
          </View>
        ) : null}
        {current.key === "details" ? (
          <>
            <FormField
              label="Ad title"
              labelClassName={LABEL}
              placeholder="e.g. iPhone 13 Pro Max, 256GB"
              value={values.title}
              onChangeText={(text) => set("title", text)}
              maxLength={150}
              error={errors.title}
              touched={!!errors.title}
            />

            <Text className={LABEL}>Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {tree.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={c.id === values.categoryId}
                  onPress={() => {
                    // One update, so the subcategory is cleared together with the category change.
                    setValues((prev) => ({ ...prev, categoryId: c.id, subcategoryId: "" }));
                    setErrors((prev) => ({ ...prev, categoryId: undefined }));
                  }}
                />
              ))}
            </View>
            {errors.categoryId ? (
              <Text className="mt-2 font-poppins text-caption text-danger">{errors.categoryId}</Text>
            ) : null}

            {category && category.children.length > 0 ? (
              <>
                <Text className={`mt-5 ${LABEL}`}>
                  Sub Category{" "}
                  <Text className="font-poppins text-body text-ink-500">(optional)</Text>
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {category.children.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={c.id === values.subcategoryId}
                      onPress={() => set("subcategoryId", c.id === values.subcategoryId ? "" : c.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text className={`mt-5 ${LABEL}`}>Condition</Text>
            <View className="flex-row gap-3">
              {(["New", "Used"] as ListingCondition[]).map((option) => {
                const active = values.condition === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => set("condition", option)}
                    className={`flex-1 items-center rounded-2xl border px-4 py-3.5 ${
                      active ? "border-brand-600 bg-brand-600" : "border-brand-100 bg-surface"
                    }`}
                  >
                    <Text className={`font-poppins-medium text-body ${active ? "text-white" : "text-ink-700"}`}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.condition ? (
              <Text className="mt-1 font-poppins text-caption text-danger">{errors.condition}</Text>
            ) : null}

            {values.condition === "Used" ? (
              <Pressable
                onPress={() => set("hasReceipt", !values.hasReceipt)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: values.hasReceipt }}
                className="mt-4 flex-row items-center gap-3 rounded-2xl border border-brand-100 bg-surface px-4 py-3.5"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border-2 ${
                    values.hasReceipt ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
                  }`}
                >
                  {values.hasReceipt ? <Check size={ICON.sm} color={colors.white} strokeWidth={3} /> : null}
                </View>
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-body text-ink-900">
                    I have the original receipt of purchase
                  </Text>
                  <Text className="font-poppins text-caption text-ink-500">
                    Your ad will tell buyers whether a receipt comes with it.
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {current.key === "photos" ? (
          <>
            <Text className="mb-4 font-poppins text-caption text-ink-500">
              Up to {MAX_PHOTOS} photos. The first one is your cover - and helps our AI write your description.
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {photos.map((photo, index) => (
                <View key={photo.uri} className="relative h-28 w-28">
                  <Image
                    source={{ uri: photo.uri }}
                    className="h-28 w-28 rounded-2xl bg-brand-50"
                    resizeMode="cover"
                  />
                  {index === 0 ? (
                    <View className="absolute bottom-1.5 left-1.5 rounded-full bg-ink-900/70 px-2 py-0.5">
                      <Text className="font-poppins-medium text-micro text-white">Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((p) => p.uri !== photo.uri))}
                    hitSlop={8}
                    accessibilityLabel="Remove photo"
                    className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink-900"
                  >
                    <X size={ICON.xs} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}

              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={pickPhotos}
                  disabled={!!busy}
                  className="h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white"
                >
                  {photos.length === 0 ? (
                    <Camera size={ICON.lg} color={colors.brand500} />
                  ) : (
                    <Plus size={ICON.lg} color={colors.brand500} />
                  )}
                  <Text className="mt-1 font-poppins-medium text-micro text-brand-600">
                    {photos.length === 0 ? "Add photos" : "Add more"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {current.key === "copy" ? (
          <>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-subtitle text-ink-900">Description</Text>
              <AiButton label="Suggest with AI" loading={aiLoading} onPress={() => suggestDescription()} />
            </View>
            <TextInput
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Describe the condition, features, and reason for selling"
              placeholderTextColor={colors.ink300}
              value={values.description}
              onChangeText={(text) => set("description", text)}
              className={`rounded-2xl border bg-surface px-4 py-3.5 font-poppins text-subtitle text-ink-900 ${
                errors.description ? "border-danger" : "border-brand-100"
              }`}
              style={{ minHeight: 140 }}
            />
            {errors.description ? (
              <Text className="mt-1 font-poppins text-caption text-danger">{errors.description}</Text>
            ) : null}

            <View className="mt-5" />
            <FormField
              label="Price (₦)"
              labelClassName={LABEL}
              icon={Tag}
              placeholder="e.g. 250000"
              keyboardType="number-pad"
              digitsOnly
              value={values.price}
              onChangeText={(text) => set("price", text)}
              error={errors.price}
              touched={!!errors.price}
            />
            <View className="items-start">
              <AiButton label="Suggest a price" loading={aiLoading} onPress={suggestPrice} />
            </View>
            <AiNote loading={aiLoading} note={aiNote} />

            <Text className={`mt-6 ${LABEL}`}>
              Social links <Text className="font-poppins text-body text-ink-500">(optional)</Text>
            </Text>
            <Text className="-mt-1 mb-3 font-poppins text-caption text-ink-500">
              Got this item on TikTok, Instagram, Facebook or YouTube? Add the link - buyers can open it from
              your ad, and YouTube videos play right on it.
            </Text>
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <FormField
                key={key}
                label={label}
                icon={LinkIcon}
                placeholder={placeholder}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                value={values[LINK_FIELD[key]]}
                onChangeText={(text) => set(LINK_FIELD[key], text)}
                error={errors[LINK_FIELD[key]]}
                touched={!!errors[LINK_FIELD[key]]}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      <View className="flex-row items-center gap-3 px-6 pb-4 pt-2">
        {step > 0 ? (
          <Pressable
            onPress={back}
            disabled={!!busy}
            accessibilityLabel="Back"
            className="h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-white"
          >
            <ChevronLeft size={ICON.lg} color={colors.ink700} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <PrimaryButton
            label={step === STEPS.length - 1 ? "Continue to promote & pay" : "Continue"}
            loading={!!busy}
            disabled={!canSell}
            onPress={next}
          />
        </View>
      </View>
      {busy ? (
        <Text className="pb-3 text-center font-poppins text-caption text-ink-500">{busy}</Text>
      ) : null}

      <Modal visible={!!suggestion} transparent animationType="fade" onRequestClose={() => closeSuggestion(false)}>
        <View className="flex-1 items-center justify-center bg-ink-900/50 px-6">
          <View className="w-full rounded-3xl bg-white p-6">
            <View className="mb-3 flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <Sparkles size={ICON.md} color={colors.brand600} />
              </View>
              <Text className="font-poppins-semibold text-title text-ink-900">
                {suggestion?.kind === "price" ? "Suggested price" : "AI description"}
              </Text>
            </View>

            {suggestion?.kind === "description" ? (
              <ScrollView style={{ maxHeight: 260 }} className="rounded-2xl bg-surface p-4">
                <Text className="font-poppins text-body leading-5 text-ink-700">{suggestion.description}</Text>
              </ScrollView>
            ) : null}

            {suggestion?.kind === "price" ? (
              <View className="items-center rounded-2xl bg-surface p-4">
                <Text className="font-poppins-bold text-hero text-ink-900">
                  {formatNaira(suggestion.suggested)}
                </Text>
                <Text className="mt-1 text-center font-poppins text-caption text-ink-500">
                  Similar ads sold for {formatNaira(suggestion.min)} - {formatNaira(suggestion.max)} (
                  {suggestion.comparables} {suggestion.comparables === 1 ? "ad" : "ads"})
                </Text>
              </View>
            ) : null}

            <Text className="mt-4 font-poppins text-body text-ink-700">
              {suggestion?.kind === "price"
                ? "Would you like to use this price? You can still change it."
                : "Would you like to use this description? You can still edit it."}
            </Text>

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => closeSuggestion(false)}
                className="flex-1 items-center rounded-2xl border border-brand-100 py-3.5"
              >
                <Text className="font-poppins-semibold text-body text-ink-700">No, thanks</Text>
              </Pressable>
              <Pressable
                onPress={() => closeSuggestion(true)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-brand-600 py-3.5"
              >
                <Check size={ICON.sm} color={colors.white} />
                <Text className="font-poppins-semibold text-body text-white">Yes, use it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`rounded-full border px-4 py-2.5 ${selected ? "border-brand-600 bg-brand-600" : "border-brand-100 bg-white"}`}
    >
      <Text className={`font-poppins-medium text-body ${selected ? "text-white" : "text-ink-700"}`}>{label}</Text>
    </Pressable>
  );
}

function AiButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={8}
      className="flex-row items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5"
      style={{ opacity: loading ? 0.6 : 1 }}
    >
      <Sparkles size={ICON.sm} color={colors.brand600} />
      <Text className="font-poppins-semibold text-caption text-brand-700">{label}</Text>
    </Pressable>
  );
}

function AiNote({ loading, note }: { loading: boolean; note: string | null }) {
  if (loading) {
    return (
      <View className="mt-3 flex-row items-center gap-2">
        <ActivityIndicator size="small" color={colors.brand600} />
        <Text className="font-poppins text-caption text-ink-500">Getting an AI suggestion...</Text>
      </View>
    );
  }
  return note ? <Text className="mt-3 font-poppins text-caption text-ink-500">{note}</Text> : null;
}
