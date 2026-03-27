import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase";

const navItems = [
  { label: "DASHBOARD",       href: "/(app)/dashboard",       icon: "◈" },
  { label: "MUSCLE SELECTOR", href: "/(app)/muscle-selector", icon: "◉" },
  { label: "WORKOUT BUILDER", href: "/(app)/workout-builder", icon: "◇" },
  { label: "PROGRESS",        href: "/(app)/progress",        icon: "▲" },
  { label: "AI ADVISOR",      href: "/(app)/ai-advisor",      icon: "◎" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoArea}>
        <Text style={styles.logo}>KINETIC</Text>
        <Text style={styles.tagline}>PEAK PERFORMANCE</Text>
      </View>

      <View style={styles.nav}>
        {navItems.map(item => {
          const active = pathname.includes(item.href.replace("/(app)/", ""));
          return (
            <TouchableOpacity
              key={item.href}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.href as any)}
            >
              <Text style={[styles.navIcon, active && styles.navTextActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.navLabel, active && styles.navTextActive]}>
                {item.label}
              </Text>
              {active && <View style={styles.activeBorder} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/(app)/workout-builder')}>
        <Text style={styles.startBtnText}>&#x25B6;  START BUILDER</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>SIGN OUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
    paddingTop: 40,
    paddingBottom: 32,
    flexDirection: "column",
    height: "100%",
  },
  logoArea: { paddingHorizontal: 24, marginBottom: 40 },
  logo: {
    fontSize: 22, fontWeight: "900",
    color: colors.primaryContainer, letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 9, color: colors.onSurfaceVariant,
    letterSpacing: 3, marginTop: 2,
  },
  nav: { flex: 1 },
  navItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    position: "relative", gap: 12,
  },
  navItemActive: { backgroundColor: colors.surfaceContainer },
  navIcon:  { fontSize: 14, color: colors.onSurfaceVariant },
  navLabel: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceVariant, letterSpacing: 2 },
  navTextActive: { color: colors.primaryContainer },
  activeBorder: {
    position: "absolute", right: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: colors.primaryContainer,
  },
  startBtn: {
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 14, borderRadius: 50, alignItems: "center",
  },
  startBtnText: {
    color: colors.onPrimaryContainer,
    fontWeight: "900", fontSize: 11, letterSpacing: 1,
  },
  logoutBtn: {
    marginHorizontal: 16, marginTop: 10,
    paddingVertical: 12, borderRadius: 50, alignItems: "center",
    backgroundColor: colors.surfaceContainer,
  },
  logoutBtnText: {
    color: colors.onSurfaceVariant,
    fontWeight: "700", fontSize: 10, letterSpacing: 1.5,
  },
});
