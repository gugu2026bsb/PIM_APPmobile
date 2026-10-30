import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "barbearia_access_token";

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(KEY, token);
    } catch {}
  } else {
    await SecureStore.setItemAsync(KEY, token);
  }
}

export async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
