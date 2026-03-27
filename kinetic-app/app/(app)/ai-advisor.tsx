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
