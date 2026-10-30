import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

export type SheetOption = { label: string; onPress: () => void; destructive?: boolean; testID?: string };

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption[];
  onClose: () => void;
};

export default function OptionsSheet({ visible, title, subtitle, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="options-sheet">
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <ScrollView style={{ maxHeight: 360 }}>
          {options.map((o, i) => (
            <Pressable
              key={o.label}
              testID={o.testID || `sheet-option-${i}`}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Text style={[styles.optionText, o.destructive && { color: colors.onError }]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable testID="sheet-cancel" style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Fechar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.brandPrimary,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.muted, marginTop: 4 },
  option: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginTop: spacing.sm,
  },
  optionText: { color: colors.brand, fontWeight: "700", fontSize: 16 },
  cancel: { marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.onSurface, fontWeight: "600" },
});
