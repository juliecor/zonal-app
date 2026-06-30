// Capture a rendered View to PNG and open the share sheet (Messenger/WhatsApp/etc).
// react-native-view-shot is a native module → works in a real build, not Expo Go.
// We lazy-require it so its absence (Expo Go) only fails the share, never the bundle.
import * as Sharing from "expo-sharing";

export async function shareViewAsImage(ref: any, dialogTitle = "Zonal value"): Promise<{ ok: boolean; reason?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureRef } = require("react-native-view-shot") as { captureRef: (r: any, o: any) => Promise<string> };
    const uri = await captureRef(ref, { format: "png", quality: 0.96, result: "tmpfile" });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle, UTI: "public.png" });
    }
    return { ok: true };
  } catch (e: any) {
    // In Expo Go the native screenshot module is unavailable — surface a friendly hint.
    return { ok: false, reason: e?.message || "Image capture isn't available here." };
  }
}
