import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Preencha e-mail e senha");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source="https://images.unsplash.com/photo-1536520002442-39764a41e987?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(20,20,20,0.6)", "rgba(20,20,20,0.95)", colors.surface]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.6, 1]}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>BarbeariaShop</Text>
        <Text style={styles.tagline}>Clássico. Preciso. Exclusivo.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Entrar</Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@email.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {error && (
            <Text testID="login-error" style={styles.error}>
              {error}
            </Text>
          )}

          <Pressable
            testID="login-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaText}>Entrar</Text>
            )}
          </Pressable>

          <View style={styles.row}>
            <Text style={styles.hint}>Não tem conta?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="go-to-register-button">
                <Text style={styles.link}>Cadastre-se</Text>
              </Pressable>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  brand: {
    color: colors.brand,
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
  },
  tagline: { color: colors.onSurface, textAlign: "center", marginTop: 6, marginBottom: 32, opacity: 0.85 },
  card: {
    backgroundColor: "rgba(30,28,26,0.92)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.onSurface,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: spacing.lg,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
  },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6, marginTop: spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16, letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: 6 },
  hint: { color: colors.muted },
  link: { color: colors.brand, fontWeight: "700" },
  error: { color: colors.onError, backgroundColor: colors.error, padding: 10, marginTop: 12, borderRadius: radius.md, textAlign: "center" },
});
