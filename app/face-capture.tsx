import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Camera, RotateCcw, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { uploadProfilePhoto } from "@/services/me";
import { MAX_EDGE, toResizedJpeg } from "@/utils/photos";
import { colors } from "@/theme/colors";

/**
 * Face capture for the profile photo: front camera with an oval guide. The API runs the photo
 * through the same face check as identity verification (exactly one clear, well-lit face) and
 * rejects it otherwise - the reason is shown so the user can retake.
 */
export default function FaceCaptureScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ovalWidth = Math.min(width * 0.68, 300);
  const ovalHeight = ovalWidth * 1.3;

  // Leaving is always allowed - even mid-capture or mid-upload - so the user is never stuck here.
  const closedRef = useRef(false);
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/personal-info");
  };

  const closeButton = (
    <Pressable
      onPress={close}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close"
      className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
    >
      <X size={22} color={colors.white} />
    </Pressable>
  );

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        mirror: true,
      });
      // Plenty for the face check, and a fraction of the camera's full-resolution file.
      if (picture?.uri) {
        setPhotoUri(await toResizedJpeg(picture.uri, MAX_EDGE.face));
      }
    } catch {
      setError("Couldn't take the photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const usePhoto = async () => {
    if (!photoUri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadProfilePhoto({
        uri: photoUri,
        name: "profile-photo.jpg",
        type: "image/jpeg",
      });
      await refreshUser();
      Toast.show({ type: "success", text1: "Profile photo updated" });
      close();
    } catch (err) {
      if (closedRef.current) return;
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't upload the photo. Please try again.",
      );
      setPhotoUri(null);
    } finally {
      setUploading(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color={colors.white} />
        <View
          style={{ position: "absolute", top: insets.top + 8, left: 20 }}
        >
          {closeButton}
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black px-8">
        <Camera size={36} color={colors.white} />
        <Text className="mt-4 text-center font-poppins-semibold text-lg text-white">
          Allow camera access
        </Text>
        <Text className="mt-2 text-center font-poppins text-sm text-white/70">
          We use your front camera to take your profile photo.
        </Text>
        <Pressable
          onPress={() =>
            permission.canAskAgain
              ? requestPermission()
              : Linking.openSettings()
          }
          className="mt-6 rounded-2xl bg-brand-600 px-6 py-3.5"
        >
          <Text className="font-poppins-semibold text-sm text-white">
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </Pressable>
        <Pressable onPress={close} className="mt-4 px-4 py-2">
          <Text className="font-poppins-medium text-sm text-white/70">
            Not now
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ flex: 1 }}
          resizeMode="cover"
        />
      ) : (
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
      )}

      {/* Oval face guide */}
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
      >
        <View
          style={{
            width: ovalWidth,
            height: ovalHeight,
            borderRadius: ovalWidth,
            borderWidth: 3,
            borderColor: error ? colors.danger : "rgba(255,255,255,0.9)",
          }}
        />
      </View>

      {/* Explicit absolute-fill + inset padding rather than a SafeAreaView with class names, so the
          controls always sit on top of the native camera preview and stay tappable. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            justifyContent: "space-between",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            zIndex: 10,
            elevation: 10,
          },
        ]}
        pointerEvents="box-none"
      >
        <View className="flex-row items-center justify-between px-5 pt-2">
          {closeButton}
          <Text className="font-poppins-semibold text-base text-white">
            Profile photo
          </Text>
          <View className="w-11" />
        </View>

        <View className="items-center px-6 pb-6">
          <View className="mb-5 rounded-2xl bg-black/55 px-4 py-3">
            <Text className="text-center font-poppins text-sm text-white">
              {error ??
                (photoUri
                  ? "Happy with it? We'll check it shows your face clearly."
                  : "Fit your face inside the oval, look at the camera, in good light.")}
            </Text>
          </View>

          {photoUri ? (
            <View className="w-full flex-row gap-3">
              <Pressable
                onPress={() => setPhotoUri(null)}
                disabled={uploading}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/60 py-4"
              >
                <RotateCcw size={18} color={colors.white} />
                <Text className="font-poppins-semibold text-sm text-white">
                  Retake
                </Text>
              </Pressable>
              <Pressable
                onPress={usePhoto}
                disabled={uploading}
                className="flex-1 items-center justify-center rounded-2xl bg-brand-600 py-4"
              >
                {uploading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text className="font-poppins-semibold text-sm text-white">
                    Use photo
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={capture}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"
            >
              <View
                className="h-16 w-16 rounded-full bg-white"
                style={{ opacity: capturing ? 0.5 : 1 }}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
