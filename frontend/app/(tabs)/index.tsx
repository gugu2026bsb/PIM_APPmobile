import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { localISO, formatBR } from "@/src/date";

type Servico = { id: string; nome: string; preco: number; duracao_minutos: number; imagem_url: string };
type Barbeiro = { id: string; nome: string; especialidade: string; foto_url: string };
type Agendamento = {
  id: string;
  data: string;
  horario: string;
  servico_nome: string;
  barbeiro_nome: string;
  status: string;
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const servicosQ = useQuery<Servico[]>({ queryKey: ["servicos"], queryFn: () => apiFetch("/servicos") });
  const barbeirosQ = useQuery<Barbeiro[]>({ queryKey: ["barbeiros"], queryFn: () => apiFetch("/barbeiros") });
  const myAgQ = useQuery<Agendamento[]>({
    queryKey: ["my-agendamentos"],
    queryFn: () => apiFetch("/agendamentos/me"),
  });

  const today = localISO();
  const nowD = new Date();
  const nowHM = `${String(nowD.getHours()).padStart(2, "0")}:${String(nowD.getMinutes()).padStart(2, "0")}`;
  const tomorrowD = new Date();
  tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = localISO(tomorrowD);
  const nextAg = (myAgQ.data || [])
    .filter((a) => a.status !== "Cancelado" && a.status !== "Realizado" && (a.data > today || (a.data === today && a.horario > nowHM)))
    .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))[0];
  const reminder = nextAg && (nextAg.data === today ? "hoje" : nextAg.data === tomorrow ? "amanhã" : null);

  const onRefresh = useCallback(() => {
    servicosQ.refetch();
    barbeirosQ.refetch();
    myAgQ.refetch();
  }, [servicosQ, barbeirosQ, myAgQ]);

  const loading = servicosQ.isLoading || barbeirosQ.isLoading;

  return (
    <View style={styles.root}>
      <ScrollView
        testID="home-scroll"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={myAgQ.isFetching} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {/* Header hero */}
        <View style={styles.hero}>
          <Image
            source="https://images.unsplash.com/photo-1536520002442-39764a41e987?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(20,20,20,0.5)", "rgba(20,20,20,0.95)"]}
            style={StyleSheet.absoluteFill}
            locations={[0, 1]}
          />
          <View style={styles.heroContent}>
            <Text style={styles.hello}>Olá,</Text>
            <Text style={styles.name} testID="home-user-name">
              {user?.nome?.split(" ")[0] || "visitante"}
            </Text>
            <Text style={styles.heroSub}>Pronto para um visual impecável?</Text>
          </View>
        </View>

        {/* Next appointment card */}
        {reminder && nextAg && (
          <View style={styles.reminder} testID="home-reminder">
            <Ionicons name="notifications" size={20} color={colors.onWarning} />
            <Text style={styles.reminderText}>
              Lembrete: seu horário é {reminder} às {nextAg.horario} com {nextAg.barbeiro_nome.split(" ")[0]}
            </Text>
          </View>
        )}
        {nextAg && (
          <Pressable style={styles.nextCard} testID="next-appointment-card" onPress={() => router.push("/(tabs)/agendamentos")}>
            <Text style={styles.nextTitle}>Próximo agendamento</Text>
            <Text style={styles.nextService}>{nextAg.servico_nome}</Text>
            <Text style={styles.nextInfo}>
              {formatBR(nextAg.data)} • {nextAg.horario} • com {nextAg.barbeiro_nome} • {nextAg.status}
            </Text>
          </Pressable>
        )}

        {/* Primary CTA */}
        <View style={styles.ctaWrap}>
          <Pressable
            testID="home-book-cta"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/booking")}
          >
            <Text style={styles.ctaText}>AGENDAR HORÁRIO</Text>
          </Pressable>
        </View>

        {/* Barbers */}
        <Text style={styles.sectionTitle}>Nossos Barbeiros</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 24 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barberRow}>
            {(barbeirosQ.data || []).map((b) => (
              <Pressable
                key={b.id}
                testID={`home-barber-${b.id}`}
                style={styles.barberCard}
                onPress={() => router.push({ pathname: "/barbeiro/[id]", params: { id: b.id } })}
              >
                <Image source={b.foto_url} style={styles.barberImg} contentFit="cover" />
                <Text style={styles.barberName}>{b.nome}</Text>
                <Text style={styles.barberSpec} numberOfLines={2}>
                  {b.especialidade}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Featured services */}
        <Text style={styles.sectionTitle}>Serviços em destaque</Text>
        <View style={{ paddingHorizontal: spacing.xl }}>
          {(servicosQ.data || []).slice(0, 4).map((s) => (
            <Pressable
              key={s.id}
              testID={`home-servico-${s.id}`}
              style={styles.serviceRow}
              onPress={() => router.push("/(tabs)/servicos")}
            >
              <Image source={s.imagem_url} style={styles.serviceImg} contentFit="cover" />
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <Text style={styles.serviceName}>{s.nome}</Text>
                <Text style={styles.serviceMeta}>{s.duracao_minutos} min</Text>
              </View>
              <Text style={styles.servicePrice}>R$ {s.preco.toFixed(2).replace(".", ",")}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 220, marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  heroContent: { padding: spacing.xl },
  hello: { color: colors.onSurface, opacity: 0.85 },
  name: { color: colors.brand, fontSize: 30, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  heroSub: { color: colors.onSurface, marginTop: 4, opacity: 0.9 },
  reminder: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reminderText: { color: colors.onWarning, fontWeight: "700", flex: 1 },
  nextCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  nextTitle: { color: colors.brandSecondary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  nextService: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  nextInfo: { color: colors.onBrandTertiary, marginTop: 4 },
  ctaWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", letterSpacing: 2 },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
  },
  barberRow: { paddingHorizontal: spacing.xl, gap: spacing.md },
  barberCard: {
    width: 160,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barberImg: { width: "100%", height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  barberName: { color: colors.onSurface, fontWeight: "700", marginTop: spacing.sm },
  barberSpec: { color: colors.muted, fontSize: 12, marginTop: 2 },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceImg: { width: 70, height: 70, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  serviceName: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  serviceMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  servicePrice: { color: colors.brand, fontWeight: "700" },
});
