import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { localISO } from "@/src/date";
import { useToast } from "@/src/components/Toast";

type Servico = { id: string; nome: string; preco: number; duracao_minutos: number; imagem_url: string };
type Barbeiro = { id: string; nome: string; especialidade: string; foto_url: string; status: string };
type Slot = { horario: string; disponivel: boolean };

const WEEK = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: localISO(d),
      day: String(d.getDate()).padStart(2, "0"),
      weekday: i === 0 ? "HOJE" : WEEK[d.getDay()],
      month: String(d.getMonth() + 1).padStart(2, "0"),
    };
  });
}

const tap = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
};

export default function Booking() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<{ servicoId?: string; barbeiroId?: string }>();
  const qc = useQueryClient();

  const [servicoId, setServicoId] = useState<string | null>(params.servicoId || null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(params.barbeiroId || null);
  const [data, setData] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);

  const servicosQ = useQuery<Servico[]>({ queryKey: ["servicos"], queryFn: () => apiFetch("/servicos") });
  const barbeirosQ = useQuery<Barbeiro[]>({ queryKey: ["barbeiros"], queryFn: () => apiFetch("/barbeiros") });
  const slotsQ = useQuery<Slot[]>({
    queryKey: ["horarios", barbeiroId, data, servicoId],
    queryFn: () => apiFetch(`/horarios?barbeiro_id=${barbeiroId}&data=${data}&servico_id=${servicoId}`),
    enabled: !!barbeiroId && !!data && !!servicoId,
  });

  const days = nextDays(14);
  const ativos = (barbeirosQ.data || []).filter((b) => (b.status || "Ativo").toLowerCase() === "ativo");

  const confirmMut = useMutation({
    mutationFn: () =>
      apiFetch("/agendamentos", {
        method: "POST",
        body: JSON.stringify({ servico_id: servicoId, barbeiro_id: barbeiroId, data, horario }),
      }),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["my-agendamentos"] });
      qc.invalidateQueries({ queryKey: ["agendamentos-list"] });
      toast("Agendamento realizado com sucesso!");
      router.replace("/(tabs)/agendamentos");
    },
    onError: (e: any) => {
      toast(e?.message || "Falha ao agendar", "error");
      slotsQ.refetch();
    },
  });

  useEffect(() => {
    setHorario(null);
  }, [data, barbeiroId, servicoId]);

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const canConfirm = !!(servicoId && barbeiroId && data && horario) && !confirmMut.isPending;
  const svc = servicosQ.data?.find((s) => s.id === servicoId);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="booking-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.back} hitSlop={12}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Novo Agendamento</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140 + insets.bottom }}>
        <Section title="1. Escolha o serviço">
          {servicosQ.isLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            (servicosQ.data || []).map((s) => (
              <Pressable
                key={s.id}
                testID={`booking-servico-${s.id}`}
                style={[styles.rowCard, servicoId === s.id && styles.rowSelected]}
                onPress={() => {
                  tap();
                  setServicoId(s.id);
                }}
              >
                <Image source={s.imagem_url} style={styles.rowImg} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.rowName}>{s.nome}</Text>
                  <Text style={styles.rowMeta}>{s.duracao_minutos} min</Text>
                </View>
                <Text style={styles.rowPrice}>R$ {s.preco.toFixed(2).replace(".", ",")}</Text>
              </Pressable>
            ))
          )}
        </Section>

        {servicoId && (
          <Section title="2. Escolha o barbeiro">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {ativos.map((b) => (
                <Pressable
                  key={b.id}
                  testID={`booking-barbeiro-${b.id}`}
                  style={[styles.barberChip, barbeiroId === b.id && styles.chipSelected]}
                  onPress={() => {
                    tap();
                    setBarbeiroId(b.id);
                  }}
                >
                  <Image source={b.foto_url} style={styles.barberChipImg} contentFit="cover" />
                  <Text style={[styles.barberChipName, barbeiroId === b.id && { color: colors.onBrandPrimary }]}>{b.nome.split(" ")[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>
        )}

        {servicoId && barbeiroId && (
          <Section title="3. Escolha o dia">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {days.map((d) => (
                <Pressable
                  key={d.iso}
                  testID={`booking-day-${d.iso}`}
                  style={[styles.dayChip, data === d.iso && styles.chipSelected]}
                  onPress={() => {
                    tap();
                    setData(d.iso);
                  }}
                >
                  <Text style={[styles.dayWeek, data === d.iso && { color: colors.onBrandPrimary }]}>{d.weekday}</Text>
                  <Text style={[styles.dayNum, data === d.iso && { color: colors.onBrandPrimary }]}>{d.day}</Text>
                  <Text style={[styles.dayMonth, data === d.iso && { color: colors.onBrandPrimary }]}>/{d.month}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Section>
        )}

        {servicoId && barbeiroId && data && (
          <Section title="4. Escolha o horário">
            {slotsQ.isLoading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (slotsQ.data || []).every((s) => !s.disponivel) ? (
              <Text style={styles.noSlots} testID="booking-no-slots">Nenhum horário disponível neste dia</Text>
            ) : (
              <View style={styles.slotGrid}>
                {(slotsQ.data || []).map((s) => (
                  <Pressable
                    key={s.horario}
                    testID={`booking-slot-${s.horario}`}
                    disabled={!s.disponivel}
                    style={[styles.slot, !s.disponivel && styles.slotDisabled, horario === s.horario && styles.slotSelected]}
                    onPress={() => {
                      tap();
                      setHorario(s.horario);
                    }}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        !s.disponivel && { color: colors.muted, textDecorationLine: "line-through" },
                        horario === s.horario && { color: colors.onBrandPrimary },
                      ]}
                    >
                      {s.horario}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        )}
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
        {svc && horario && data && (
          <Text style={styles.summary} testID="booking-summary">
            {svc.nome} • {data.slice(8, 10)}/{data.slice(5, 7)} às {horario} • R$ {svc.preco.toFixed(2).replace(".", ",")}
          </Text>
        )}
        <Pressable
          testID="booking-confirm"
          disabled={!canConfirm}
          onPress={() => confirmMut.mutate()}
          style={[styles.confirmBtn, !canConfirm && { opacity: 0.4 }]}
        >
          {confirmMut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.confirmText}>CONFIRMAR AGENDAMENTO</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { marginBottom: spacing.sm, alignSelf: "flex-start" },
  backText: { color: colors.brand, fontWeight: "600" },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  section: { marginTop: spacing.lg },
  sectionTitle: { color: colors.brandSecondary, fontSize: 13, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: spacing.md },
  rowCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  rowSelected: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  rowImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  rowName: { color: colors.onSurface, fontWeight: "700" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowPrice: { color: colors.brand, fontWeight: "700" },
  barberChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.sm, alignItems: "center", width: 90, borderWidth: 1, borderColor: colors.border },
  barberChipImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceTertiary },
  barberChipName: { color: colors.onSurface, fontSize: 12, marginTop: 6, fontWeight: "600" },
  chipSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brand },
  dayChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", minWidth: 64, borderWidth: 1, borderColor: colors.border },
  dayWeek: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
  dayNum: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 2 },
  dayMonth: { color: colors.muted, fontSize: 10 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: { minHeight: 44, minWidth: 76, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border },
  slotDisabled: { backgroundColor: colors.surfaceTertiary, opacity: 0.5 },
  slotSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brand },
  slotText: { color: colors.onBrandTertiary, fontWeight: "600" },
  noSlots: { color: colors.muted },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  summary: { color: colors.onSurfaceTertiary, textAlign: "center", marginBottom: spacing.sm, fontSize: 13 },
  confirmBtn: { backgroundColor: colors.brandPrimary, minHeight: 52, justifyContent: "center", borderRadius: radius.md, alignItems: "center" },
  confirmText: { color: colors.onBrandPrimary, fontWeight: "700", letterSpacing: 2 },
});
