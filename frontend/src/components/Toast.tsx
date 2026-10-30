import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

type Kind = "success" | "error";
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, kind: Kind = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ msg, kind });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
      }, 2800);
    },
    [opacity]
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          testID="toast"
          style={[
            styles.toast,
            { bottom: insets.bottom + 96, opacity },
            toast.kind === "error" ? { backgroundColor: colors.error } : { backgroundColor: colors.success },
          ]}
        >
          <Text style={[styles.text, { color: toast.kind === "error" ? colors.onError : colors.onSuccess }]} testID="toast-message">
            {toast.msg}
          </Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  text: { fontWeight: "700", textAlign: "center" },
});
