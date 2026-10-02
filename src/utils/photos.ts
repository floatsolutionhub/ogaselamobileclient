import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

/**
 * Every photo is compressed on the device before it's uploaded - never send a camera original
 * (3-5MB, often HEIC on iPhone, which the API can't read). Longest edge per use:
 */
export const MAX_EDGE = {
  /** Listing photos. */
  listing: 1600,
  /** Profile/face photos - plenty for the face check. */
  face: 1280,
  /** IDs, bills, registration docs, dispute evidence - text must stay readable. */
  document: 2000,
} as const;

/** A file ready for FormData - the shape services' appendFile/LocalFile expect. */
export type CompressedFile = {
  uri: string;
  name: string;
  type: string;
  /** Web only: the real File to upload (see listingsService.uploadImage). */
  webFile?: File;
};

export type PreparedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  /** Web only - see listingsService.uploadImage. */
  webFile?: File;
};

/**
 * Re-encodes a local image as a JPEG no larger than maxEdge on its longest side and returns the
 * new file's uri - typically a few hundred KB.
 */
export async function toResizedJpeg(uri: string, maxEdge: number, compress = 0.8): Promise<string> {
  // Read the real size from the image itself - file pickers don't report it.
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(image.width, image.height) > maxEdge) {
    image = await ImageManipulator.manipulate(uri)
      .resize(image.width >= image.height ? { width: maxEdge } : { height: maxEdge })
      .renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  return saved.uri;
}

/** Compresses a picked/captured image to a JPEG, on native and web alike. */
export async function compressImage(
  asset: { uri: string; fileName?: string | null },
  maxEdge: number,
  fallbackName = "photo",
): Promise<CompressedFile> {
  const uri = await toResizedJpeg(asset.uri, maxEdge);
  const name = `${(asset.fileName ?? `${fallbackName}-${Date.now()}`).replace(/\.[^.]+$/, "")}.jpg`;

  if (Platform.OS === "web") {
    // On web the manipulator hands back a blob/data URL; uploads need a real File.
    const blob = await (await fetch(uri)).blob();
    return { uri, name, type: "image/jpeg", webFile: new File([blob], name, { type: "image/jpeg" }) };
  }
  return { uri, name, type: "image/jpeg" };
}

/** Listing photos (see MAX_EDGE.listing). */
export async function prepareListingPhoto(asset: ImagePickerAsset): Promise<PreparedPhoto> {
  const file = await compressImage(asset, MAX_EDGE.listing);
  return { uri: file.uri, fileName: file.name, mimeType: file.type, webFile: file.webFile };
}

/** PDFs can't be meaningfully recompressed on a phone, so they're capped instead. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
