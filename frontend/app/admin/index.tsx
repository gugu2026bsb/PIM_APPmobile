import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";

type Stats = {
  total_users: number;
  total_clientes: number;
  total_barbeiros: number;
  total_servicos: number;
  total_produtos: number;
  total_agendamentos: number;
  agendamentos_hoje: number;
  receita_total: number;
};

export default function AdminDash() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useQuery<Stats>({ queryKey: ["admin-stats"], queryFn: () => apiFetch("/admin/stats") });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.header}>
        <Pressable testID="admin-back" onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Painel do Admin</Text>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric label="Receita" value={`R$ ${q.data?.receita_total.toFixed(2).replace(".", ",") || "0,00"}`} highlight />
            <Metric label="Agendamentos hoje" value={String(q.data?.agendamentos_hoje || 0)} />
            <Metric label="Clientes" value={String(q.data?.total_clientes || 0)} />
            <Metric label="Barbeiros" value={String(q.data?.total_barbeiros || 0)} />
            <Metric label="Serviços" value={String(q.data?.total_servicos || 0)} />
            <Metric label="Produtos" value={String(q.data?.total_produtos || 0)} />
          </View>

          <Text style={styles.sectionTitle}>Gestão</Text>
          <MenuItem testID="to-barbeiros" label="Barbeiros" onPress={() => router.push("/admin/barbeiros")} />
          <MenuItem testID="to-servicos" label="Serviços" onPress={() => router.push("/admin/servicos")} />
          <MenuItem testID="to-produtos" label="Produtos" onPress={() => router.push("/admin/produtos")} />
          <MenuItem testID="to-usuarios" label="Usuários & Permissões" onPress={() => router.push("/admin/usuarios")} />
          <MenuItem testID="to-all-ag" label="Todos os Agendamentos" onPress={() => router.push("/(tabs)/agendamentos")} />
        </>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.metricCard, highlight && styles.metricHighlight]}>
      <Text style={[styles.metricLabel, highlight && { color: colors.onBrandTertiary }]}>{label}</Text>
      <Text style={[styles.metricValue, highlight && { color: colors.brand }]}>{value}</Text>
    </View>
  );
}

function MenuItem({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} style={styles.menu} onPress={onPress}>
      <Text style={styles.menuText}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  back: { color: colors.brand, marginBottom: spacing.sm, fontWeight: "600" },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
  metricCard: {
    width: "48%",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricHighlight: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary, width: "100%" },
  metricLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  metricValue: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: 6 },
  sectionTitle: {
    color: colors.brandSecondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  menu: {
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuText: { color: colors.onSurface, fontWeight: "600" },
  menuArrow: { color: colors.brand, fontSize: 24 },
});
