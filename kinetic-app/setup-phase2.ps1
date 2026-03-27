# ============================================================
# KINETIC APP - Phase 2 Setup Script
# Run this inside your kinetic-app folder:
# cd "C:\Users\chang zong wu\OneDrive\桌面\kinetic\kinetic-app"
# .\setup-phase2.ps1
# ============================================================

Write-Host "🚀 Setting up Phase 2 - Navigation Shell..." -ForegroundColor Yellow

# ── Create folders ───────────────────────────────────────────
New-Item -ItemType Directory -Force -Path "app"
New-Item -ItemType Directory -Force -Path "app/(app)"
New-Item -ItemType Directory -Force -Path "components/layout"
Write-Host "✅ Folders created" -ForegroundColor Green

# ── app/index.tsx ────────────────────────────────────────────
Set-Content -Path "app/index.tsx" -Encoding UTF8 -Value @'
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(app)/dashboard" />;
}
'@

# ── app/(app)/_layout.tsx ────────────────────────────────────
Set-Content -Path "app/(app)/_layout.tsx" -Encoding UTF8 -Value @'
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Slot } from "expo-router";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import BottomNav from "../../components/layout/BottomNav";
import { colors } from "../../theme/colors";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.root}>
      {isDesktop && <Sidebar />}
      <View style={styles.main}>
        <Header />
        <View style={styles.content}>
          <Slot />
        </View>
        {!isDesktop && <BottomNav />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  main:    { flex: 1, flexDirection: "column" },
  content: { flex: 1 },
});
'@

# ── app/(app)/dashboard.tsx ──────────────────────────────────
Set-Content -Path "app/(app)/dashboard.tsx" -Encoding UTF8 -Value @'
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DASHBOARD</Text>
      <Text style={styles.sub}>Coming in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center",
               backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "900", color: colors.primaryContainer,
           letterSpacing: -1 },
  sub:   { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
});
'@

# ── app/(app)/muscle-selector.tsx ────────────────────────────
Set-Content -Path "app/(app)/muscle-selector.tsx" -Encoding UTF8 -Value @'
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export default function MuscleSelector() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MUSCLE SELECTOR</Text>
      <Text style={styles.sub}>Coming in Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center",
               backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "900", color: colors.primaryContainer,
           letterSpacing: -1 },
  sub:   { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
});
'@

# ── app/(app)/workout-builder.tsx ────────────────────────────
Set-Content -Path "app/(app)/workout-builder.tsx" -Encoding UTF8 -Value @'
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export default function WorkoutBuilder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>WORKOUT BUILDER</Text>
      <Text style={styles.sub}>Coming in Phase 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center",
               backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "900", color: colors.primaryContainer,
           letterSpacing: -1 },
  sub:   { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
});
'@

# ── app/(app)/ai-advisor.tsx ─────────────────────────────────
Set-Content -Path "app/(app)/ai-advisor.tsx" -Encoding UTF8 -Value @'
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export default function AIAdvisor() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI ADVISOR</Text>
      <Text style={styles.sub}>Coming in Phase 7</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center",
               backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "900", color: colors.primaryContainer,
           letterSpacing: -1 },
  sub:   { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
});
'@

# ── components/layout/Sidebar.tsx ────────────────────────────
Set-Content -Path "components/layout/Sidebar.tsx" -Encoding UTF8 -Value @'
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "../../theme/colors";

const navItems = [
  { label: "DASHBOARD",       href: "/(app)/dashboard",       icon: "▦" },
  { label: "MUSCLE SELECTOR", href: "/(app)/muscle-selector", icon: "✦" },
  { label: "WORKOUT BUILDER", href: "/(app)/workout-builder", icon: "✕" },
  { label: "AI ADVISOR",      href: "/(app)/ai-advisor",      icon: "◎" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

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

      <TouchableOpacity style={styles.startBtn}>
        <Text style={styles.startBtnText}>▶  START SESSION</Text>
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
});
'@

# ── components/layout/Header.tsx ─────────────────────────────
Set-Content -Path "components/layout/Header.tsx" -Encoding UTF8 -Value @'
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export default function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.rightIcons}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.icon}>⚙️</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60, backgroundColor: colors.background,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: 50, paddingHorizontal: 16,
    paddingVertical: 8, flex: 1, maxWidth: 400, gap: 8,
  },
  searchIcon: { fontSize: 13 },
  searchInput: {
    flex: 1, color: colors.onSurface,
    fontSize: 13, outlineStyle: "none",
  } as any,
  rightIcons: {
    flexDirection: "row", alignItems: "center",
    gap: 16, marginLeft: 24,
  },
  icon: { fontSize: 18 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: {
    color: colors.primaryContainer, fontWeight: "900", fontSize: 14,
  },
});
'@

# ── components/layout/BottomNav.tsx ──────────────────────────
Set-Content -Path "components/layout/BottomNav.tsx" -Encoding UTF8 -Value @'
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors } from "../../theme/colors";

const navItems = [
  { label: "Home",    href: "/(app)/dashboard",       icon: "▦" },
  { label: "Muscles", href: "/(app)/muscle-selector", icon: "✦" },
  { label: "Workout", href: "/(app)/workout-builder", icon: "✕" },
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
'@

# ── Update app.json ───────────────────────────────────────────
Set-Content -Path "app.json" -Encoding UTF8 -Value @'
{
  "expo": {
    "name": "kinetic-app",
    "slug": "kinetic-app",
    "version": "1.0.0",
    "scheme": "kinetic",
    "web": {
      "bundler": "metro",
      "output": "static"
    },
    "plugins": [
      "expo-router",
      "expo-font"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
'@

# ── Update package.json main entry ───────────────────────────
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$pkg.main = "expo-router/entry"
$pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

# ── Delete old App.tsx ────────────────────────────────────────
if (Test-Path "App.tsx") { Remove-Item "App.tsx" }
if (Test-Path "index.ts") { Remove-Item "index.ts" }

Write-Host ""
Write-Host "🎉 Phase 2 setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  npx expo start" -ForegroundColor Cyan
Write-Host "Then press W to open in browser." -ForegroundColor Cyan
