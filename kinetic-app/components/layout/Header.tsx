import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase";
import { fs } from "../../theme/scale";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

interface ExerciseResult {
  id: string;
  name: string;
  difficulty: string;
  equipment: string;
  muscle_group_id: string;
  muscle_groups: { name: string; body_region: string } | null;
}

export default function Header() {
  const router = useRouter();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [open, setOpen]       = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch(
          `${API_URL}/exercises?q=${encodeURIComponent(text.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const exercises: ExerciseResult[] = await res.json();
          setResults(exercises.slice(0, 6));
          setOpen(exercises.length > 0);
        }
      } catch {}
    }, 300);
  }

  function pickExercise(ex: ExerciseResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    // Navigate to exercise list filtered to that muscle group
    router.push({
      pathname: "/(app)/exercise-list" as any,
      params: { muscleId: ex.muscle_group_id, muscleName: ex.muscle_groups?.name ?? "Exercises" },
    });
  }

  function dismiss() {
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⊙</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={query}
            onChangeText={search}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={dismiss} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => { dismiss(); router.push("/(app)/profile" as any); }}
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>K</Text>
        </TouchableOpacity>
      </View>

      {/* Search dropdown */}
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => pickExercise(item)}>
                <View style={styles.resultLeft}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultMeta}>
                    {item.muscle_groups?.name?.toUpperCase() ?? ""} · {item.equipment}
                  </Text>
                </View>
                <Text style={styles.resultDiff}>{item.difficulty.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 100 },
  header: {
    height: 68, backgroundColor: colors.background,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: 50, paddingHorizontal: 16,
    paddingVertical: 10, flex: 1, maxWidth: 480, gap: 8,
  },
  searchIcon:  { fontSize: fs(13), color: colors.onSurfaceVariant },
  searchInput: {
    flex: 1, color: colors.onSurface, fontSize: fs(13), outlineStyle: "none",
  } as any,
  clearBtn:     { padding: 2 },
  clearBtnText: { fontSize: fs(11), color: colors.onSurfaceVariant },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: "center", justifyContent: "center",
    marginLeft: 16,
  },
  avatarText: { color: colors.onPrimaryContainer, fontWeight: "900", fontSize: fs(15) },

  dropdown: {
    position: "absolute", top: 68, left: 24, right: 24,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: colors.outlineVariant,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
    zIndex: 200,
  },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  resultLeft:  { flex: 1, gap: 2 },
  resultName:  { fontSize: fs(14), fontWeight: "700", color: colors.onSurface },
  resultMeta:  { fontSize: fs(10), color: colors.onSurfaceVariant },
  resultDiff:  { fontSize: fs(8), fontWeight: "800", color: colors.primaryContainer, letterSpacing: 1 },
  sep:         { height: 1, backgroundColor: colors.outlineVariant + "33", marginHorizontal: 16 },
});
