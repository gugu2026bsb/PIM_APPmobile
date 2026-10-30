// Design tokens for BarbeariaShop. Classic barbershop: midnight black + antique gold.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#141414",
  onSurface: "#F4EFEA",
  surfaceSecondary: "#1E1C1A",
  onSurfaceSecondary: "#F4EFEA",
  surfaceTertiary: "#2A2724",
  onSurfaceTertiary: "#E0D7CD",
  surfaceInverse: "#F4EFEA",
  onSurfaceInverse: "#141414",
  muted: "#968F88",

  // Brand (antique gold)
  brand: "#D4AF37",
  onBrand: "#141414",
  brandPrimary: "#C5A028",
  onBrandPrimary: "#141414",
  brandSecondary: "#E1C671",
  onBrandSecondary: "#141414",
  brandTertiary: "#3D331A",
  onBrandTertiary: "#E1C671",

  // Status
  success: "#3A5A40",
  onSuccess: "#D5E0D5",
  warning: "#9C6A24",
  onWarning: "#FDECC8",
  error: "#7A2A2A",
  onError: "#F2D5D5",
  info: "#2A4B5C",
  onInfo: "#D5E6F2",

  // Lines
  border: "#36322E",
  borderStrong: "#4F4943",
  divider: "#25221F",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export const colors = dark;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.light ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" && themes.light ? "light" : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
};

export const typography = {
  display: "serif", // Will fallback nicely; Cormorant feel via serif
  text: "System",
};
