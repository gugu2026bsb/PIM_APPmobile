import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const roleLabel = user?.role === "admin" ? "Administrador" : user?.role === "barbeiro" ? "Barbeiro" : "Cliente";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: spacing.xl }}
    >
      <Text style={styles.title}>Perfil</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.nome?.[0]?.toUpperCase() || "?"}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">
          {user?.nome}
        </Text>
        <Text style={styles.email} testID="profile-email">
          {user?.email}
        </Text>
        <View style={styles.role}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações</Text>
        <Row label="Telefone" value={user?.telefone || "—"} />
        <Row label="CPF" value={user?.cpf || "—"} />
      </View>

      {user?.role === "admin" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administração</Text>
          <MenuBtn testID="admin-dashboard-btn" label="Painel do Administrador" onPress={() => router.push("/admin")} />
          <MenuBtn testID="admin-barbeiros-btn" label="Gerenciar Barbeiros" onPress={() => router.push("/admin/barbeiros")} />
          <MenuBtn testID="admin-servicos-btn" label="Gerenciar Serviços" onPress={() => router.push("/admin/servicos")} />
          <MenuBtn testID="admin-produtos-btn" label="Gerenciar Produtos" onPress={() => router.push("/admin/produtos")} />
          <MenuBtn testID="admin-usuarios-btn" label="Gerenciar Usuários" onPress={() => router.push("/admin/usuarios")} />
        </View>
      )}

      <Pressable testID="logout-button" style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MenuBtn({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} style={styles.menu} onPress={onPress}>
      <Text style={styles.menuText}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
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
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.brandPrimary,
  },
  avatarText: { color: colors.brand, fontSize: 36, fontWeight: "700" },
  name: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: spacing.md },
  email: { color: colors.muted, marginTop: 4 },
  role: {
    marginTop: spacing.md,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  roleText: { color: colors.brandSecondary, fontWeight: "700", letterSpacing: 1, fontSize: 12 },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  sectionTitle: { color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.onSurface, fontWeight: "600" },
  menu: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuText: { color: colors.onSurface, fontWeight: "600" },
  menuArrow: { color: colors.brand, fontSize: 24 },
  logout: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    backgroundColor: colors.error,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  logoutText: { color: colors.onError, fontWeight: "700", letterSpacing: 1 },
});
