import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Modal, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";

type Barbeiro = { id: string; nome: string; especialidade: string; foto_url: string; bio: string; telefone: string; status: string; galeria: string[] };

export default function BarbeiroDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [preview, setPreview] = useState<string | null>(null);
  const q = useQuery<Barbeiro>({ queryKey: ["barbeiro", id], queryFn: () => apiFetch(`/barbeiros/${id}`), enabled: !!user });

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  if (q.isLoading) {
    return (
      <View style={[styles.root, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const b = q.data;
  if (!b) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.bio}>Barbeiro não encontrado</Text>
        <Pressable testID="barbeiro-retry" onPress={() => q.refetch()} style={[styles.cta, { marginTop: 16, paddingHorizontal: 24 }]}>
          <Text style={styles.ctaText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const ativo = (b.status || "Ativo").toLowerCase() === "ativo";
  const tile = (Math.min(width, 600) - spacing.xl * 2 - spacing.sm) / 2;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={styles.hero}>
          <Image source={b.foto_url} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(20,20,20,0.1)", "rgba(20,20,20,0.95)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <Pressable testID="barbeiro-back" style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.name} testID="barbeiro-name">{b.nome}</Text>
            <Text style={styles.spec}>{b.especialidade}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          <Text style={styles.bio}>{b.bio || "Barbeiro experiente da BarbeariaShop."}</Text>

          <Text style={styles.sectionTitle}>Contato</Text>
          <Text style={styles.bio}>{b.telefone || "—"}</Text>

          <Text style={styles.sectionTitle}>Galeria de trabalhos</Text>
          {(b.galeria || []).length === 0 ? (
            <Text style={styles.muted} testID="galeria-empty">Nenhuma foto na galeria ainda</Text>
          ) : (
            <View style={styles.grid} testID="barbeiro-galeria">
              {b.galeria.map((url, i) => (
                <Pressable key={url + i} testID={`galeria-foto-${i}`} onPress={() => setPreview(url)}>
                  <Image source={url} style={{ width: tile, height: tile, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="barbeiro-book-cta"
          disabled={!ativo}
          style={[styles.cta, !ativo && { opacity: 0.4 }]}
          onPress={() => router.push({ pathname: "/booking", params: { barbeiroId: b.id } })}
        >
          <Text style={styles.ctaText}>{ativo ? `AGENDAR COM ${b.nome.split(" ")[0].toUpperCase()}` : "BARBEIRO INDISPONÍVEL"}</Text>
        </Pressable>
      </View>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBg} onPress={() => setPreview(null)} testID="galeria-preview">
          <Pressable testID="galeria-preview-close" style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={() => setPreview(null)}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          {preview && <Image source={preview} style={{ width: "100%", height: "70%" }} contentFit="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 360 },
  heroTop: { paddingHorizontal: spacing.lg },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20,20,20,0.6)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  heroContent: { position: "absolute", bottom: spacing.xl, left: spacing.xl, right: spacing.xl },
  name: { color: colors.onSurface, fontSize: 32, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  spec: { color: colors.brandSecondary, marginTop: 4 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  sectionTitle: { color: colors.brandSecondary, fontSize: 13, textTransform: "uppercase", letterSpacing: 1.5, marginTop: spacing.xl, marginBottom: spacing.sm },
  bio: { color: colors.onSurface, lineHeight: 22 },
  muted: { color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.brandPrimary, minHeight: 52, justifyContent: "center", borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", letterSpacing: 2 },
  closeBtn: { position: "absolute", right: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  previewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
});
