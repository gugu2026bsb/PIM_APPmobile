import { Tabs, Redirect } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const icon = (on: IconName, off: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: string }) {
    return <Ionicons name={focused ? on : off} size={22} color={color} />;
  };

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarButtonTestID: "tab-inicio", tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="servicos" options={{ title: "Serviços", tabBarButtonTestID: "tab-servicos-nav", tabBarIcon: icon("cut", "cut-outline") }} />
      <Tabs.Screen name="agendamentos" options={{ title: "Agenda", tabBarButtonTestID: "tab-agenda", tabBarIcon: icon("calendar", "calendar-outline") }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarButtonTestID: "tab-perfil", tabBarIcon: icon("person", "person-outline") }} />
    </Tabs>
  );
}
