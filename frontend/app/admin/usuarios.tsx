import { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import OptionsSheet, { SheetOption } from "@/src/components/OptionsSheet";
import { useToast } from "@/src/components/Toast";

type User = { id: string; nome: string; email: string; role: "cliente" | "barbeiro" | "admin"; barbeiro_id?: string };
type Barbeiro = { id: string; nome: string };

export default function AdminUsuarios() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<User | null>(null);

  const users = useQuery<User[]>({ queryKey: ["admin-users"], queryFn: () => apiFetch("/admin/users") });
  const barbeiros = useQuery<Barbeiro[]>({ queryKey: ["barbeiros"], queryFn: () => apiFetch("/barbeiros") });

  const setRole = useMutation({
    mutationFn: ({ id, role, barbeiro_id }: { id: string; role: string; barbeiro_id?: string }) =>
      apiFetch(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role, barbeiro_id }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast("Permissão atualizada");
    },
    onError: (e: any) => toast(e?.message || "Falha ao alterar papel", "error"),
  });

  const barberName = (id?: string) => barbeiros.data?.find((b) => b.id === id)?.nome;

  const options: SheetOption[] = selected
    ? [
        { label: "Cliente", testID: "role-cliente", onPress: () => setRole.mutate({ id: selected.id, role: "cliente" }) },
        { label: "Administrador", testID: "role-admin", onPress: () => setRole.mutate({ id: selected.id, role: "admin" }) },
        ...(barbeiros.data || []).map((b) => ({
          label: `Barbeiro: ${b.nome}`,
          testID: `role-barbeiro-${b.id}`,
          onPress: () => setRole.mutate({ id: selected.id, role: "barbeiro", barbeiro_id: b.id }),
        })),
      ]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Pressable testID="users-back" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Usuários</Text>
        <Text style={styles.hint}>Toque em um usuário para alterar a permissão</Text>
      </View>
      {users.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={users.data || []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onRefresh={users.refetch}
          refreshing={users.isFetching && !users.isLoading}
          renderItem={({ item }) => (
            <Pressable
              testID={`user-row-${item.id}`}
              disabled={item.id === me?.id}
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.nome}{item.id === me?.id ? " (você)" : ""}</Text>
                <Text style={styles.email}>{item.email}</Text>
                {item.role === "barbeiro" && <Text style={styles.email}>Vinculado a: {barberName(item.barbeiro_id) || "—"}</Text>}
              </View>
              <View style={[styles.role, item.role === "admin" && { backgroundColor: colors.brandPrimary }]}>
                <Text style={[styles.roleText, item.role === "admin" && { color: colors.onBrandPrimary }]} testID={`user-role-${item.id}`}>
                  {item.role}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
      <OptionsSheet
        visible={!!selected}
        title={`Permissão de ${selected?.nome || ""}`}
        subtitle={selected?.email}
        options={options}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  back: { color: colors.brand, marginBottom: spacing.sm, fontWeight: "600" },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  hint: { color: colors.muted, marginTop: 4, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 56 },
  name: { color: colors.onSurface, fontWeight: "600" },
  email: { color: colors.muted, fontSize: 12, marginTop: 2 },
  role: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary },
  roleText: { color: colors.brandSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
});
