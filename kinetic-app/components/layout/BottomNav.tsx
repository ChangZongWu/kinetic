import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "../../theme/colors";

const navItems = [
  { label: "Home",    href: "/(app)/dashboard",       icon: "◈" },
  { label: "Muscles", href: "/(app)/muscle-selector", icon: "◉" },
  { label: "Workout", href: "/(app)/workout-builder", icon: "◇" },
  { label: "AI",      href: "/(app)/ai-advisor",      icon: "◎" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {navItems.map(item => {
        const active = pathname.includes(item.href.replace("/(app)/", ""));
        return (
          <TouchableOpacity
            key={item.href}
            style={styles.item}
            onPress={() => router.push(item.href as any)}
          >
            <Text style={[styles.icon, active && styles.active]}>{item.icon}</Text>
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
    paddingVertical: 10,
  },
  item:   { flex: 1, alignItems: "center", gap: 4 },
  icon:   { fontSize: 18, color: colors.onSurfaceVariant },
  label:  { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 1 },
  active: { color: colors.primaryContainer },
});
