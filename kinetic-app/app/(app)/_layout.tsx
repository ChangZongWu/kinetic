import { useEffect, useState } from "react";
import { View, StyleSheet, useWindowDimensions, ActivityIndicator } from "react-native";
import { Slot, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import BottomNav from "../../components/layout/BottomNav";
import OnboardingOverlay from "../../components/OnboardingOverlay";
import { colors } from "../../theme/colors";
import { useAuth } from "../../hooks/useAuth";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const router = useRouter();
  const { session, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/(auth)/login");
    }
    if (!loading && session) {
      AsyncStorage.getItem("kinetic_onboarded").then(v => {
        if (!v) setShowOnboarding(true);
      });
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  if (!session) return null;

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
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  main:    { flex: 1, flexDirection: "column" },
  content: { flex: 1 },
});
