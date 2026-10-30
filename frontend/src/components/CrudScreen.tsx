import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Platform, Modal } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useState } from "react";
import { colors, spacing, radius } from "@/src/theme";
import { apiFetch } from "@/src/api";
import OptionsSheet from "@/src/components/OptionsSheet";
import { useToast } from "@/src/components/Toast";

export type CrudField = {
  key: string;
  label: string;
  type?: "text" | "number" | "integer" | "multiline" | "list";
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

type Props = {
  title: string;
  endpoint: string;
  fields: CrudField[];
  renderPrimary: (item: any) => string;
  renderSecondary?: (item: any) => string;
};

export default function CrudScreen({ title, endpoint, fields, renderPrimary, renderSecondary }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: [endpoint], queryFn: () => apiFetch(endpoint) });

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const open = (item?: any) => {
    setEditing(item || {});
    setFormError(null);
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      const v = item ? item[f.key] : undefined;
      initial[f.key] = f.type === "list" ? (Array.isArray(v) ? v.join("\n") : "") : v === undefined || v === null ? "" : String(v);
    });
    setForm(initial);
  };

  const close = () => {
    setEditing(null);
    setForm({});
    setFormError(null);
  };

  const buildBody = (): Record<string, any> | string => {
    const body: Record<string, any> = {};
    for (const f of fields) {
      const raw = (form[f.key] || "").trim();
      if (f.required && !raw) return `Preencha o campo "${f.label}"`;
      if (f.options && !f.options.includes(raw)) return `"${f.label}" deve ser: ${f.options.join(" ou ")}`;
      if (f.type === "number" || f.type === "integer") {
        const n = Number(raw.replace(",", "."));
        if (!raw || isNaN(n) || n < 0) return `"${f.label}" deve ser um número válido`;
        if (f.type === "integer" && !Number.isInteger(n)) return `"${f.label}" deve ser um número inteiro`;
        body[f.key] = n;
      } else if (f.type === "list") {
        body[f.key] = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      } else {
        body[f.key] = raw;
      }
    }
    return body;
  };

  const saveMut = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      if (editing?.id) return apiFetch(`${endpoint}/${editing.id}`, { method: "PUT", body: JSON.stringify(body) });
      return apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [endpoint] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast(editing?.id ? "Alterações salvas" : "Cadastro realizado");
      close();
    },
    onError: (e: any) => setFormError(e?.message || "Falha ao salvar"),
  });

  const onSave = () => {
    const body = buildBody();
    if (typeof body === "string") {
      setFormError(body);
      return;
    }
    saveMut.mutate(body);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [endpoint] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast("Registro excluído");
    },
    onError: (e: any) => toast(e?.message || "Falha ao excluir", "error"),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Pressable testID="crud-back" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable testID="crud-add" style={styles.addBtn} onPress={() => open()}>
            <Text style={styles.addText}>+ Novo</Text>
          </Pressable>
        </View>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum registro</Text>}
          onRefresh={q.refetch}
          refreshing={q.isFetching && !q.isLoading}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`crud-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowPrimary}>{renderPrimary(item)}</Text>
                {renderSecondary && <Text style={styles.rowSecondary}>{renderSecondary(item)}</Text>}
              </View>
              <Pressable testID={`crud-edit-${item.id}`} onPress={() => open(item)} style={styles.editBtn}>
                <Text style={styles.editText}>Editar</Text>
              </Pressable>
              <Pressable testID={`crud-delete-${item.id}`} onPress={() => setToDelete(item)} style={styles.delBtn}>
                <Text style={styles.delText}>×</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.modalBg}>
          <View style={[styles.form, { paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.lg }]} testID="crud-form">
            <Text style={styles.formTitle}>{editing?.id ? "Editar registro" : "Novo registro"}</Text>
            <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
              {fields.map((f) => (
                <View key={f.key}>
                  <Text style={styles.label}>{f.label}{f.required ? " *" : ""}</Text>
                  <TextInput
                    testID={`crud-field-${f.key}`}
                    value={form[f.key]}
                    onChangeText={(v) => {
                      setForm((s) => ({ ...s, [f.key]: v }));
                      setFormError(null);
                    }}
                    placeholder={f.placeholder || (f.type === "list" ? "Uma URL por linha" : undefined)}
                    placeholderTextColor={colors.muted}
                    multiline={f.type === "multiline" || f.type === "list"}
                    keyboardType={f.type === "number" ? "decimal-pad" : f.type === "integer" ? "number-pad" : "default"}
                    autoCapitalize={f.key.includes("url") || f.type === "list" ? "none" : "sentences"}
                    style={[styles.input, (f.type === "multiline" || f.type === "list") && { minHeight: 80, textAlignVertical: "top" }]}
                  />
                </View>
              ))}
              {formError && (
                <Text style={styles.formError} testID="crud-form-error">
                  {formError}
                </Text>
              )}
              <View style={styles.formActions}>
                <Pressable testID="crud-cancel" style={styles.cancelBtn} onPress={close}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable testID="crud-save" style={styles.saveBtn} onPress={onSave} disabled={saveMut.isPending}>
                  {saveMut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Salvar</Text>}
                </Pressable>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <OptionsSheet
        visible={!!toDelete}
        title={`Excluir "${toDelete ? renderPrimary(toDelete) : ""}"?`}
        subtitle="Esta ação não pode ser desfeita."
        options={[{ label: "Excluir", destructive: true, testID: "crud-confirm-delete", onPress: () => toDelete && deleteMut.mutate(toDelete.id) }]}
        onClose={() => setToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  back: { color: colors.brand, marginBottom: spacing.sm, fontWeight: "600" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "700", fontFamily: Platform.select({ ios: "Georgia", android: "serif" }) },
  addBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center", borderRadius: radius.pill },
  addText: { color: colors.onBrandPrimary, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  form: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: colors.brandPrimary },
  formTitle: { color: colors.brandSecondary, fontWeight: "700", fontSize: 18, marginBottom: spacing.sm },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.md, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  formError: { color: colors.onError, backgroundColor: colors.error, padding: 10, marginTop: spacing.md, borderRadius: radius.md, textAlign: "center" },
  formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, backgroundColor: colors.surfaceTertiary, minHeight: 48, justifyContent: "center", borderRadius: radius.md, alignItems: "center" },
  cancelText: { color: colors.onSurface, fontWeight: "600" },
  saveBtn: { flex: 1, backgroundColor: colors.brandPrimary, minHeight: 48, justifyContent: "center", borderRadius: radius.md, alignItems: "center" },
  saveText: { color: colors.onBrandPrimary, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  rowPrimary: { color: colors.onSurface, fontWeight: "600" },
  rowSecondary: { color: colors.muted, fontSize: 12, marginTop: 2 },
  editBtn: { paddingHorizontal: 12, minHeight: 44, justifyContent: "center", backgroundColor: colors.brandTertiary, borderRadius: radius.md },
  editText: { color: colors.brand, fontWeight: "700", fontSize: 12 },
  delBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  delText: { color: colors.onError, fontSize: 20, fontWeight: "700" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
});
