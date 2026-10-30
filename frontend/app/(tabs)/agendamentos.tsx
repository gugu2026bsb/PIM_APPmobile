import { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { localISO, formatBR } from "@/src/date";
import OptionsSheet, { SheetOption } from "@/src/components/OptionsSheet";
import { useToast } from "@/src/components/Toast";

type Agendamento = {
  id: string;
  cliente_nome: string;
  barbeiro_nome: string;
  servico_nome: string;
  servico_preco: number;
  data: string;
  horario: string;
  status: "Pendente" | "Confirmado" | "Realizado" | "Cancelado";
};

const FINAL = ["Realizado", "Cancelado"];

export default function AgendamentosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [selected, setSelected] = useState<Agendamento | null>(null);

  const endpoint = user?.role === "cliente" ? "/agendamentos/me" : "/agendamentos";
  const q = useQuery<Agendamento[]>({ queryKey: ["agendamentos-list", endpoint], queryFn: () => apiFetch(endpoint) });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/agendamentos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["agendamentos-list"] });
      qc.invalidateQueries({ queryKey: ["my-agendamentos"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast(`Status alterado para ${v.status}`);
    },
    onError: (e: any) => toast(e?.message || "Falha ao alterar status", "error"),
  });

  const today = localISO();
  const isUpcoming = (a: Agendamento) => a.data >= today && !FINAL.includes(a.status);
  const items = (q.data || [])
    .filter((a) => (filter === "upcoming" ? isUpcoming(a) : !isUpcoming(a)))
    .sort((a, b) => {
      const ka = `${a.data} ${a.horario}`;
      const kb = `${b.data} ${b.horario}`;
      return filter === "upcoming" ? ka.localeCompare(kb) : kb.localeCompare(ka);
    });

  const statusColor = (s: string) =>
    s === "Confirmado" ? colors.brandSecondary : s === "Pendente" ? colors.warning : s === "Realizado" ? colors.success : s === "Cancelado" ? colors.error : colors.muted;

  const optionsFor = (ag: Agendamento): SheetOption[] => {
    const set = (status: string) => () => updateStatus.mutate({ id: ag.id, status });
    if (FINAL.includes(ag.status)) return [];
    if (user?.role === "cliente") return [{ label: "Cancelar agendamento", onPress: set("Cancelado"), destructive: true, testID: "opt-cancelar" }];
    const opts: SheetOption[] = [];
    if (ag.status === "Pendente") opts.push({ label: "Confirmar", onPress: set("Confirmado"), testID: "opt-confirmar" });
    opts.push({ label: "Marcar como Realizado", onPress: set("Realizado"), testID: "opt-realizado" });
    opts.push({ label: "Cancelar", onPress: set("Cancelado"), destructive: true, testID: "opt-cancelar" });
    return opts;
  };

  const title = user?.role === "cliente" ? "Meus Agendamentos" : user?.role === "barbeiro" ? "Minha Agenda" : "Agendamentos";

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.segment}>
        {(["upcoming", "past"] as const).map((f) => (
          <Pressable
            key={f}
            testID={f === "upcoming" ? "filter-upcoming" : "filter-past"}
            style={[styles.segBtn, filter === f && styles.segActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.segText, filter === f && styles.segTextActive]}>{f === "upcoming" ? "Próximos" : "Histórico"}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : q.isError ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Falha ao carregar agendamentos</Text>
          <Pressable testID="ag-retry" style={styles.emptyCta} onPress={() => q.refetch()}>
            <Text style={styles.emptyCtaText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap} testID="ag-empty">
              <Ionicons name="calendar-clear-outline" size={48} color={colors.brandPrimary} />
              <Text style={styles.empty}>Nenhum agendamento</Text>
              {user?.role === "cliente" && filter === "upcoming" && (
                <Pressable testID="ag-empty-book" style={styles.emptyCta} onPress={() => router.push("/booking")}>
                  <Text style={styles.emptyCtaText}>Agendar agora</Text>
                </Pressable>
              )}
            </View>
          }
          onRefresh={q.refetch}
          refreshing={q.isFetching && !q.isLoading}
          renderItem={({ item }) => {
            const actionable = !FINAL.includes(item.status);
            return (
              <Pressable
                testID={`ag-row-${item.id}`}
                onPress={() => actionable && setSelected(item)}
                style={({ pressed }) => [styles.card, pressed && actionable && { opacity: 0.85 }]}
              >
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{item.data.slice(8, 10)}</Text>
                  <Text style={styles.dateMonth}>{item.data.slice(5, 7)}/{item.data.slice(2, 4)}</Text>
                  <Text style={styles.dateTime}>{item.horario}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.svc}>{item.servico_nome}</Text>
                  <Text style={styles.sub}>
                    {user?.role === "cliente" ? `com ${item.barbeiro_nome}` : `Cliente: ${item.cliente_nome}`}
                  </Text>
                  {user?.role === "admin" && <Text style={styles.sub}>Barbeiro: {item.barbeiro_nome}</Text>}
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                    <Text style={[styles.status, { color: statusColor(item.status) }]} testID={`ag-status-${item.id}`}>
                      {item.status}
                    </Text>
                    <Text style={styles.price}>R$ {item.servico_preco.toFixed(2).replace(".", ",")}</Text>
                  </View>
                </View>
                {actionable && <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />}
              </Pressable>
            );
          }}
        />
      )}

      <OptionsSheet
        visible={!!selected}
        title={selected?.servico_nome || ""}
        subtitle={selected ? `${formatBR(selected.data)} às ${selected.horario} • ${selected.status}` : ""}
        options={selected ? optionsFor(selected) : []}
        onClose={() => setSelected(null)}
      />
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
  segBtn: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segActive: { backgroundColor: colors.brandPrimary },
  segText: { color: colors.muted, fontWeight: "600" },
  segTextActive: { color: colors.onBrandPrimary },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBox: {
    width: 68,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  dateDay: { color: colors.brandSecondary, fontSize: 24, fontWeight: "700" },
  dateMonth: { color: colors.onBrandTertiary, fontSize: 11 },
  dateTime: { color: colors.brand, fontWeight: "700", marginTop: 2 },
  svc: { color: colors.onSurface, fontWeight: "700", fontSize: 16 },
  sub: { color: colors.muted, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, fontWeight: "700", flex: 1 },
  price: { color: colors.brand, fontWeight: "700" },
  emptyWrap: { alignItems: "center", marginTop: 48, gap: spacing.md },
  empty: { color: colors.muted, textAlign: "center" },
  emptyCta: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center", borderRadius: radius.md },
  emptyCtaText: { color: colors.onBrandPrimary, fontWeight: "700" },
});
