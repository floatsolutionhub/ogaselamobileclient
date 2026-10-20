import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Link as LinkIcon,
  LocateFixed,
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
import { OptionSheet } from "@/components/OptionSheet";
import { PostStepProgress } from "@/components/PostStepProgress";
import { PrimaryButton } from "@/components/PrimaryButton";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useLocation } from "@/context/LocationContext";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useVerificationOverview } from "@/hooks/useVerificationOverview";
import { ApiError } from "@/lib/apiClient";
import * as aiService from "@/services/ai";
import * as geoService from "@/services/geo";
import * as listingsService from "@/services/listings";
import { deviceRegion, LOCATION_FAILURE_MESSAGE, requestDeviceCoordinates } from "@/services/locationService";
import { getPromotionPlans } from "@/services/promotionPlans";
import { colors } from "@/theme/colors";
import { ListingCondition, type NigeriaCity, type NigeriaState } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { editMode, type EditMode } from "@/utils/listingLifecycle";
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

/**
 * Used until the plans load (or if they can't): a seller can add as many photos as the most
 * generous active plan allows, and the plan they pick decides how many are kept - the API drops the
 * rest from the end when the ad is submitted (ListingPublishService.SubmitAsync).
 */
const FALLBACK_MAX_PHOTOS = 5;

const STEPS = [
  { key: "details", fields: ["title", "categoryId", "state", "city", "condition"] },
  { key: "photos", fields: [] },
  { key: "copy", fields: ["description", "price"] },
] as const satisfies readonly { key: string; fields: readonly (keyof Values)[] }[];

type Values = {
  title: string;
  categoryId: string;
  subcategoryId: string;
  /** Where the item is - saved on the ad as "City, State". */
  state: string;
  city: string;
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
  state: "",
  city: "",
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

/** An ad's saved place, "City, State", back into its parts. */
function splitPlace(location: string | null): { city: string; state: string } {
  const at = location?.lastIndexOf(", ") ?? -1;
  return at > 0 ? { city: location!.slice(0, at), state: location!.slice(at + 2) } : { city: "", state: "" };
}

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
 *
 * The same steps edit an existing ad (see EditMode): a live ad is never saved halfway - its changes
 * go to review only when submitted at the end, and its plan (so its photo limit) can't change here -
 * and a rejected edit of one is resubmitted for free. An expired ad is saved like a draft and goes
 * on to checkout to be renewed.
 */
export default function PostScreen() {
  useProtectedRoute("/(app)/post");
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string }>();
  const { locationLabel, isNationwide, selectedState, selectedCity } = useLocation();
  /** A fresh ad starts in the area the seller is browsing (they can change it). */
  const blank = (): Values => (isNationwide ? EMPTY : { ...EMPTY, state: selectedState, city: selectedCity });
  const { tree } = useCategoryTree();

  // Only verified accounts can sell: until then the form is shown but Continue stays disabled.
  const { overview: verification } = useVerificationOverview();
  const canSell = verification?.personal.status === "Verified";

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  /** Photo limits across the active plans: the most a seller can add, and the fewest any plan keeps. */
  const [photoLimits, setPhotoLimits] = useState({ max: FALLBACK_MAX_PHOTOS, min: FALLBACK_MAX_PHOTOS });
  const [planPhotoLimits, setPlanPhotoLimits] = useState<Record<string, number>>({});
  const [listingId, setListingId] = useState<string | null>(null);
  /** What kind of edit this is - "new" for a fresh ad or an ordinary draft. */
  const [mode, setMode] = useState<EditMode>("new");
  /** An existing ad's own plan, place and moderator note. */
  const [existing, setExisting] = useState<{
    planId: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    reviewNote: string | null;
  } | null>(null);
  const resubmits = mode === "live" || mode === "fix";
  // A running plan can't change in an edit, so its photo limit is the limit.
  const lockedLimit = resubmits && existing?.planId ? planPhotoLimits[existing.planId] : undefined;
  const MAX_PHOTOS = lockedLimit ?? photoLimits.max;
  const [busy, setBusy] = useState<string | null>(null);
  // A draft opened from My Ads that hasn't loaded into the form yet.
  const resuming = !!params.listingId && params.listingId !== listingId;

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  /** Which picker sheet is open on the details step. */
  const [sheet, setSheet] = useState<"category" | "subcategory" | "state" | "city" | null>(null);
  const [states, setStates] = useState<NigeriaState[]>([]);
  /** The cities last loaded, and which state they belong to. */
  const [loadedCities, setLoadedCities] = useState<{ stateId: string; list: NigeriaCity[] } | null>(null);
  const [locating, setLocating] = useState(false);
  /** The "leave this ad?" prompt, shown when going back past the first step. */
  const [confirmLeave, setConfirmLeave] = useState(false);
  // What each pop-up was last offered for - it only pops up again if those inputs change.
  const askedFor = useRef<{ description?: string; price?: string }>({});
  const scrollRef = useRef<ScrollView>(null);
  /** Set when "Used" is tapped, so the receipt box scrolls into view once it has laid out. */
  const revealReceipt = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getPromotionPlans()
      .then((plans) => {
        const limits = plans.filter((p) => p.isActive && p.photoLimit > 0).map((p) => p.photoLimit);
        if (!cancelled) setPlanPhotoLimits(Object.fromEntries(plans.map((p) => [p.id, p.photoLimit])));
        if (!cancelled && limits.length > 0) {
          setPhotoLimits({ max: Math.max(...limits), min: Math.min(...limits) });
        }
      })
      .catch(() => {
        // Keep the fallback - the API still trims to the chosen plan either way.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = STEPS[step];
  const category = tree.find((c) => c.id === values.categoryId);
  const subcategory = category?.children.find((c) => c.id === values.subcategoryId);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues(blank());
    setPhotos([]);
    setErrors({});
    setStep(0);
    setListingId(null);
    setMode("new");
    setExisting(null);
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
        const adMode = editMode(ad);
        if (!adMode) {
          Toast.show({ type: "info", text1: "This ad can't be edited right now", text2: "Ads waiting for review, sold or paused can't be changed." });
          router.setParams({ listingId: undefined });
          return;
        }
        setMode(adMode);
        setExisting(
          adMode === "new"
            ? null
            : {
                planId: ad.promotionPlanId,
                location: ad.location,
                latitude: ad.latitude,
                longitude: ad.longitude,
                reviewNote: ad.reviewNote ?? null,
              },
        );
        // The ad is filed under a subcategory or directly under a top-level category.
        const parent = tree.find((c) => c.id === ad.categoryId || c.children.some((x) => x.id === ad.categoryId));
        setValues({
          title: ad.title,
          categoryId: parent?.id ?? ad.categoryId,
          subcategoryId: parent && parent.id !== ad.categoryId ? ad.categoryId : "",
          ...splitPlace(ad.location),
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
        setStep(!ad.title || !ad.categoryId || !ad.location ? 0 : ad.mediaUrls.length === 0 ? 1 : 2);
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

  // ---- Place (state & city) ----

  useEffect(() => {
    let active = true;
    geoService
      .getStates()
      .then((data) => active && setStates(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const placeStateId = states.find((s) => s.name === values.state)?.id;
  useEffect(() => {
    if (!placeStateId) return;
    let active = true;
    geoService
      .getCitiesByState(placeStateId)
      .catch(() => [] as NigeriaCity[])
      .then((list) => active && setLoadedCities({ stateId: placeStateId, list }));
    return () => {
      active = false;
    };
  }, [placeStateId]);
  const citiesLoaded = !!placeStateId && loadedCities?.stateId === placeStateId;
  const cities = citiesLoaded ? loadedCities.list : [];
  const placeCityId = cities.find((c) => c.name === values.city)?.id ?? "";

  /**
   * The ad's place and coordinates. The coordinates are the city's, never the device's - an ad
   * shows how far away it is without giving away where the seller lives.
   */
  const placeInput = (v: Values) => {
    if (!v.state || !v.city) return { location: null, latitude: null, longitude: null };
    const location = `${v.city}, ${v.state}`;
    const city = cities.find((c) => c.name === v.city);
    if (city?.latitude != null && city.longitude != null) {
      return { location, latitude: city.latitude, longitude: city.longitude };
    }
    // The cities haven't loaded (or have no coordinates) - an unchanged place keeps its own.
    if (existing?.location === location) return { location, latitude: existing.latitude, longitude: existing.longitude };
    return { location, latitude: null, longitude: null };
  };

  /** Fills in state and city from the city nearest the device. */
  const locateMe = async () => {
    setLocating(true);
    try {
      const device = await requestDeviceCoordinates();
      if (!device.ok) {
        const message = LOCATION_FAILURE_MESSAGE[device.reason];
        Toast.show({ type: "info", text1: message.title, text2: message.body });
        return;
      }
      const region = await deviceRegion(device.coords);
      const nearest = await geoService.getNearestCity(device.coords.latitude, device.coords.longitude, region);
      setValues((prev) => ({ ...prev, state: nearest.state.name, city: nearest.city.name }));
      setErrors((prev) => ({ ...prev, state: undefined, city: undefined }));
      Toast.show({ type: "success", text1: "Location set", text2: `${nearest.city.name}, ${nearest.state.name}` });
    } catch (error) {
      Toast.show({
        type: "info",
        text1: "Couldn't find your city",
        text2:
          error instanceof ApiError && error.code === "Geo.NoCityNearby"
            ? error.message
            : "Choose your state and city instead.",
      });
    } finally {
      setLocating(false);
    }
  };

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
  const toInput = (v: Values, list: PickedPhoto[]): listingsService.ListingInput => ({
      title: v.title.trim(),
      description: v.description.trim(),
      categoryId: v.subcategoryId || v.categoryId,
      price: v.price ? Number(v.price) : null,
      condition: (v.condition || "Used") as ListingCondition,
      mediaUrls: list.filter((p) => p.url).map((p) => p.url!),
      promotionPlanId: null,
      ...placeInput(v),
      hasOriginalReceipt: v.condition === "Used" ? v.hasReceipt : null,
      // A half-typed link is left out rather than failing the whole draft save; Continue flags it.
      ...Object.fromEntries(
        SOCIAL_PLATFORMS.map(({ key }) => {
          const url = v[LINK_FIELD[key]].trim();
          return [LINK_FIELD[key], url && isPlatformLink(key, url) ? url : null];
        }),
      ),
  });

  const saveDraft = async (v: Values, list: PickedPhoto[], id: string | null): Promise<string | null> => {
    if (!v.title.trim() || !v.categoryId) return id;
    // A live ad is only saved by submitting its changes - saving it would send it to review.
    if (mode === "live") return id;
    const input = toInput(v, list);
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

    setBusy(current.key === "photos" ? "Uploading photos..." : resubmits ? "Saving..." : "Saving your draft...");
    try {
      const list = current.key === "photos" ? await uploadPhotos(photos) : photos;

      if (resubmits && step === STEPS.length - 1 && listingId) {
        // The end of an edit of a live ad (or a rejected edit): off to review, not to payment.
        setBusy("Submitting your changes...");
        let updated = await listingsService.update(listingId, toInput(values, list));
        if (mode === "fix") updated = await listingsService.resubmit(listingId);
        const underReview = updated.status === "PendingReview";
        Toast.show({
          type: "success",
          text1: underReview ? "Sent for review" : "Changes saved",
          text2: underReview
            ? "Your ad will be back on sale as soon as our team approves the changes."
            : "Your ad is live with the changes.",
        });
        handedOff.current = true;
        reset();
        router.setParams({ listingId: undefined });
        router.push({ pathname: "/my-ads", params: { tab: underReview ? "pending" : "active" } });
        return;
      }

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

  /**
   * Leaves for good: the form starts fresh next time. Unlike switching tabs (which keeps the form
   * and saves it as a draft), nothing more is saved - what was saved at the last Continue stays.
   */
  const leave = () => {
    setConfirmLeave(false);
    handedOff.current = true;
    reset();
    router.setParams({ listingId: undefined });
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/home");
  };

  // From step 2 on there's real work to lose, so ask first.
  const goBack = () => (step > 0 ? setConfirmLeave(true) : leave());

  const saveAndLeave = async () => {
    setBusy("Saving your draft...");
    try {
      const list = await uploadPhotos(photos);
      await saveDraft(values, list, listingId);
      Toast.show({ type: "success", text1: "Saved to your drafts", text2: "Finish it any time from My Ads → Drafts." });
      leave();
    } catch (error) {
      showError("Couldn't save your draft", error);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----

  if (resuming) {
    return (
      <GradientScreen scroll={false} edges={["top", "left", "right"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand600} />
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen scroll={false} edges={["top", "left", "right"]}>
      <View className="px-6 pt-6">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={goBack}
            disabled={!!busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-full border border-brand-100 bg-white"
          >
            <ChevronLeft size={ICON.md} color={colors.ink700} />
          </Pressable>
          <Text className="flex-1 font-poppins-bold text-display text-ink-900">
            {mode === "renew" ? "Renew your ad" : listingId ? "Edit your ad" : "Post an ad"}
          </Text>
        </View>
        <Text className="mt-1 font-poppins text-body text-ink-500">
          {mode === "live"
            ? "Make your changes, then submit them for review."
            : mode === "fix"
              ? "Fix what our team flagged, then resubmit it. There's nothing to pay."
              : mode === "renew"
                ? "Freshen it up if you like, then choose a plan to put it back on sale."
                : listingId
            ? "Saved as a draft - finish it any time from My Ads."
            : isNationwide
              ? "Reach genuine buyers across Nigeria"
              : `Reach genuine buyers near ${locationLabel}`}
        </Text>
        <PostStepProgress current={step} finalLabel={resubmits ? "Review" : undefined} />
      </View>

      <ScrollView
        ref={scrollRef}
        className="px-6 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {mode === "live" ? (
          <View className="mb-5 flex-row gap-2 rounded-2xl border border-gold-50 bg-gold-50 p-4">
            <AlertCircle size={ICON.sm} color={colors.gold700} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-poppins text-caption text-ink-700">
              <Text className="font-poppins-semibold text-gold-700">This ad is live. </Text>
              Nothing changes until you submit at the end. Once you do, our team reviews the changes, and the ad is off
              the market until they approve them. Your plan and its end date stay the same. To change plan, use Upgrade
              plan in My Ads.
            </Text>
          </View>
        ) : null}
        {existing?.reviewNote ? (
          <View className="mb-5 flex-row gap-2 rounded-2xl bg-danger/5 p-4">
            <AlertCircle size={ICON.sm} color={colors.danger} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-poppins text-caption text-ink-700">
              <Text className="font-poppins-semibold text-danger">Not approved: </Text>
              {existing.reviewNote}
            </Text>
          </View>
        ) : null}
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
            <SelectButton
              label={category?.name ?? "Select Category"}
              placeholder={!category}
              error={!!errors.categoryId}
              onPress={() => setSheet("category")}
            />
            {errors.categoryId ? (
              <Text className="mt-2 font-poppins text-caption text-danger">{errors.categoryId}</Text>
            ) : null}

            <Text className={`mt-5 ${LABEL}`}>
              Sub Category <Text className="font-poppins text-body text-ink-500">(optional)</Text>
            </Text>
            <SelectButton
              label={
                subcategory?.name ??
                (category && category.children.length === 0 ? "No sub categories" : "Select Sub category")
              }
              placeholder={!subcategory}
              disabled={!category || category.children.length === 0}
              onPress={() => setSheet("subcategory")}
            />

            <View className="mb-2 mt-5 flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-subtitle text-ink-900">Location</Text>
              <Pressable
                onPress={locateMe}
                disabled={locating}
                hitSlop={8}
                accessibilityRole="button"
                className="flex-row items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5"
                style={{ opacity: locating ? 0.6 : 1 }}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.brand600} />
                ) : (
                  <LocateFixed size={ICON.sm} color={colors.brand600} />
                )}
                <Text className="font-poppins-semibold text-caption text-brand-700">Use my current location</Text>
              </Pressable>
            </View>
            <SelectButton
              label={values.state || "Select State"}
              placeholder={!values.state}
              error={!!errors.state}
              onPress={() => setSheet("state")}
            />
            {errors.state ? (
              <Text className="mt-2 font-poppins text-caption text-danger">{errors.state}</Text>
            ) : null}
            <View className="mt-3" />
            <SelectButton
              label={values.city || "Select City"}
              placeholder={!values.city}
              disabled={!values.state}
              error={!!errors.city}
              onPress={() => setSheet("city")}
            />
            {errors.city ? (
              <Text className="mt-2 font-poppins text-caption text-danger">{errors.city}</Text>
            ) : null}

            <Text className={`mt-5 ${LABEL}`}>Condition</Text>
            <View className="flex-row gap-3">
              {(["New", "Used"] as ListingCondition[]).map((option) => {
                const active = values.condition === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      if (option === "Used" && values.condition !== "Used") revealReceipt.current = true;
                      set("condition", option);
                    }}
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
                onLayout={() => {
                  // It's the last thing on this step, so the end of the list shows all of it.
                  if (!revealReceipt.current) return;
                  revealReceipt.current = false;
                  scrollRef.current?.scrollToEnd({ animated: true });
                }}
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
              {MAX_PHOTOS > photoLimits.min
                ? ` Each plan shows a set number of photos (from ${photoLimits.min}); if you add more than your plan allows, we keep the first ones and leave the rest off.`
                : ""}
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

      <View className="flex-row items-center gap-3 px-6 pb-2 pt-2">
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
            label={
              step < STEPS.length - 1
                ? "Continue"
                : mode === "live"
                  ? "Submit changes for review"
                  : mode === "fix"
                    ? "Resubmit for review"
                    : mode === "renew"
                      ? "Continue to renew"
                      : "Continue to promote & pay"
            }
            loading={!!busy}
            disabled={!canSell}
            onPress={next}
          />
        </View>
      </View>
      {busy ? (
        <Text className="pb-3 text-center font-poppins text-caption text-ink-500">{busy}</Text>
      ) : null}

      <OptionSheet
        visible={sheet === "category"}
        title="Select Category"
        options={tree}
        selectedId={values.categoryId}
        onSelect={(id) => {
          if (id === values.categoryId) return;
          // One update, so the subcategory is cleared together with the category change.
          setValues((prev) => ({ ...prev, categoryId: id, subcategoryId: "" }));
          setErrors((prev) => ({ ...prev, categoryId: undefined }));
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === "subcategory"}
        title="Select Sub category"
        options={category?.children ?? []}
        selectedId={values.subcategoryId}
        clearLabel="None"
        onSelect={(id) => set("subcategoryId", id)}
        onClose={() => setSheet(null)}
      />

      <OptionSheet
        visible={sheet === "state"}
        title="Select State"
        art="place"
        searchPlaceholder="Search state"
        options={states}
        loading={states.length === 0}
        selectedId={placeStateId ?? ""}
        onSelect={(id) => {
          const name = states.find((s) => s.id === id)?.name ?? "";
          if (name === values.state) return;
          // One update, so the city is cleared together with the state change.
          setValues((prev) => ({ ...prev, state: name, city: "" }));
          setErrors((prev) => ({ ...prev, state: undefined }));
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === "city"}
        title="Select City"
        art="place"
        searchPlaceholder="Search city"
        options={cities}
        loading={!citiesLoaded}
        selectedId={placeCityId}
        onSelect={(id) => set("city", cities.find((c) => c.id === id)?.name ?? "")}
        onClose={() => setSheet(null)}
      />

      <Modal visible={confirmLeave} transparent animationType="fade" onRequestClose={() => setConfirmLeave(false)}>
        <View className="flex-1 items-center justify-center bg-ink-900/50 px-6">
          <View className="w-full rounded-3xl bg-white p-6">
            <View className="mb-3 flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gold-50">
                <AlertCircle size={ICON.md} color={colors.gold700} />
              </View>
              <Text className="flex-1 font-poppins-semibold text-title text-ink-900">
                {mode === "live" ? "Discard your changes?" : "Leave this ad?"}
              </Text>
            </View>
            <Text className="font-poppins text-body leading-5 text-ink-700">
              {mode === "live"
                ? "Going back clears everything you've changed - your live ad stays as it is. To keep the changes, stay and submit them for review."
                : "Going back clears all the fields on this ad. To continue it later, tap Save as draft - it'll be waiting in My Ads → Drafts."}
            </Text>

            <View className="mt-5 gap-3">
              {mode !== "live" ? (
                <PrimaryButton label="Save as draft" loading={!!busy} onPress={saveAndLeave} />
              ) : null}
              <Pressable
                onPress={leave}
                disabled={!!busy}
                className="items-center rounded-2xl border border-danger/30 py-3.5"
              >
                <Text className="font-poppins-semibold text-body text-danger">
                  {mode === "live" ? "Discard changes & go back" : "Clear & go back"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmLeave(false)}
                disabled={!!busy}
                className="items-center rounded-2xl border border-brand-100 py-3.5"
              >
                <Text className="font-poppins-semibold text-body text-ink-700">Keep editing</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

/** A field-like button that opens a picker sheet. */
function SelectButton({
  label,
  placeholder,
  disabled,
  error,
  onPress,
}: {
  label: string;
  placeholder: boolean;
  disabled?: boolean;
  error?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`flex-row items-center justify-between rounded-2xl border px-4 py-3.5 ${
        error ? "border-danger" : "border-brand-100"
      } ${disabled ? "bg-ink-50" : "bg-surface"}`}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <Text
        numberOfLines={1}
        className={`flex-1 font-poppins text-subtitle ${placeholder ? "text-ink-300" : "text-ink-900"}`}
      >
        {label}
      </Text>
      <ChevronDown size={ICON.md} color={colors.ink500} />
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
