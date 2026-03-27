import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";

export default function Header() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>&#x2299;</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={colors.onSurfaceVariant}
        />
      </View>
      <TouchableOpacity
        style={styles.avatar}
        onPress={() => router.push("/(app)/profile" as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.avatarText}>K</Text>
      </TouchableOpacity>
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
  searchIcon:  { fontSize: 13 },
  searchInput: {
    flex: 1, color: colors.onSurface, fontSize: 13, outlineStyle: "none",
  } as any,
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primaryContainer,
    alignItems: "center", justifyContent: "center",
    marginLeft: 16,
  },
  avatarText: { color: colors.onPrimaryContainer, fontWeight: "900", fontSize: 14 },
});
