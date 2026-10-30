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
import { useRouter, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";

export default function Register() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!nome || !email || !password) {
      setError("Preencha nome, e-mail e senha");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({ nome: nome.trim(), email: email.trim(), password, telefone, cpf });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Criar Conta</Text>
        <Text style={styles.tagline}>Bem-vindo à BarbeariaShop</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            testID="register-nome-input"
            value={nome}
            onChangeText={(v) => { setNome(v); setError(null); }}
            style={styles.input}
            placeholder="Seu nome"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            testID="register-email-input"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholder="voce@email.com"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            testID="register-telefone-input"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            style={styles.input}
            placeholder="(11) 99999-9999"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>CPF</Text>
          <TextInput
            testID="register-cpf-input"
            value={cpf}
            onChangeText={setCpf}
            keyboardType="numeric"
            style={styles.input}
            placeholder="000.000.000-00"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Senha</Text>
          <TextInput
            testID="register-password-input"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.muted}
          />

          {error && (
            <Text testID="register-error" style={styles.error}>
              {error}
            </Text>
          )}

          <Pressable
            testID="register-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
          >
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Cadastrar</Text>}
          </Pressable>

          <View style={styles.row}>
            <Text style={styles.hint}>Já tem conta?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="go-to-login-button">
                <Text style={styles.link}>Entrar</Text>
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
  brand: { color: colors.brand, fontSize: 32, fontWeight: "700", textAlign: "center", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  tagline: { color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6, marginTop: spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16, letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, gap: 6 },
  hint: { color: colors.muted },
  link: { color: colors.brand, fontWeight: "700" },
  error: { color: colors.onError, backgroundColor: colors.error, padding: 10, marginTop: 12, borderRadius: radius.md, textAlign: "center" },
});
