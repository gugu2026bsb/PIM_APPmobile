import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";

type Servico = { id: string; nome: string; descricao: string; preco: number; duracao_minutos: number; imagem_url: string };
type Produto = { id: string; nome: string; descricao: string; preco: number; estoque: number; imagem_url: string };

export default function ServicosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<"servicos" | "produtos">("servicos");

  const servicosQ = useQuery<Servico[]>({ queryKey: ["servicos"], queryFn: () => apiFetch("/servicos") });
  const produtosQ = useQuery<Produto[]>({ queryKey: ["produtos"], queryFn: () => apiFetch("/produtos") });

  const data = tab === "servicos" ? servicosQ.data : produtosQ.data;
  const loading = tab === "servicos" ? servicosQ.isLoading : produtosQ.isLoading;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Catálogo</Text>

      <View style={styles.segment} testID="catalog-segment">
        <Pressable
          testID="tab-servicos"
          onPress={() => setTab("servicos")}
          style={[styles.segmentBtn, tab === "servicos" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, tab === "servicos" && styles.segmentTextActive]}>Serviços</Text>
        </Pressable>
        <Pressable
          testID="tab-produtos"
          onPress={() => setTab("produtos")}
          style={[styles.segmentBtn, tab === "produtos" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, tab === "produtos" && styles.segmentTextActive]}>Produtos</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.brand} />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum item cadastrado</Text>}
          renderItem={({ item }) => (
            <Pressable
              testID={`catalog-item-${item.id}`}
              onPress={() => tab === "servicos" && router.push({ pathname: "/booking", params: { servicoId: item.id } })}
              style={styles.card}
            >
              <Image source={item.imagem_url} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <Text style={styles.name}>{item.nome}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descricao}
                </Text>
                {"duracao_minutos" in item ? (
                  <Text style={styles.meta}>{(item as Servico).duracao_minutos} min</Text>
                ) : (
                  <Text style={styles.meta}>Estoque: {(item as Produto).estoque}</Text>
                )}
              </View>
              <Text style={styles.price}>R$ {item.preco.toFixed(2).replace(".", ",")}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
  },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.muted, fontWeight: "600" },
  segmentTextActive: { color: colors.onBrandPrimary },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  img: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  desc: { color: colors.muted, fontSize: 12, marginTop: 4 },
  meta: { color: colors.brandSecondary, fontSize: 11, marginTop: 4 },
  price: { color: colors.brand, fontWeight: "700", marginLeft: spacing.sm },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
});
