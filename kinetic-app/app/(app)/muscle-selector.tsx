import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface MuscleGroup {
  id: string;
  name: string;
  body_region: string;
}

const MUSCLE_ICON: Record<string, string> = {
  Chest:      '◈',
  Back:       '◉',
  Biceps:     '◐',
  Triceps:    '◑',
  Shoulders:  '◇',
  Abs:        '▣',
  Quads:      '▷',
  Hamstrings: '◁',
  Glutes:     '◆',
  Calves:     '△',
};

const REGION_COLOR: Record<string, string> = {
  front: colors.primaryContainer,
  back:  colors.tertiary,
  core:  colors.secondary,
};

async function fetchMuscles(): Promise<MuscleGroup[]> {
  const res = await fetch(`${API_URL}/muscles`);
  if (!res.ok) throw new Error('Failed to load muscles');
  return res.json();
}

export default function MuscleSelector() {
  const router = useRouter();
  const { mode, planId, day } = useLocalSearchParams<{ mode?: string; planId?: string; day?: string }>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: muscles, isLoading, isError } = useQuery({
    queryKey: ['muscles'],
    queryFn: fetchMuscles,
  });

  function toggleMuscle(muscle: MuscleGroup) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(muscle.id)) {
        next.delete(muscle.id);
      } else {
        next.add(muscle.id);
      }
      return next;
    });
  }

  function handleViewExercises() {
    if (selected.size === 0) return;
    const muscleIds = Array.from(selected).join(',');
    const selectedMuscles = muscles?.filter(m => selected.has(m.id)) ?? [];
    const muscleName = selectedMuscles.length === 1
      ? selectedMuscles[0].name
      : `${selectedMuscles.length} Muscles`;

    router.push({
      pathname: '/(app)/exercise-list',
      params: {
        muscleId: muscleIds,
        muscleName,
        ...(mode ? { mode, planId, day } : {}),
      },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load muscle groups.</Text>
      </View>
    );
  }

  const sections = [
    { title: 'FRONT', key: 'front', items: muscles?.filter(m => m.body_region === 'front') ?? [] },
    { title: 'BACK',  key: 'back',  items: muscles?.filter(m => m.body_region === 'back')  ?? [] },
    { title: 'CORE',  key: 'core',  items: muscles?.filter(m => m.body_region === 'core')  ?? [] },
  ];

  const selectedNames = muscles?.filter(m => selected.has(m.id)).map(m => m.name) ?? [];

  return (
    <View style={styles.root}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>TARGET</Text>
          <Text style={styles.pageTitleAccent}>ZONES</Text>
        </View>
        <Text style={styles.pageSubtitle}>
          {selected.size === 0 ? 'SELECT MUSCLE GROUPS' : `${selected.size} SELECTED`}
        </Text>
      </View>

      {/* AI suggestion chip */}
      <View style={styles.aiChip}>
        <Text style={styles.aiChipLabel}>◎  AI SUGGESTION</Text>
        <Text style={styles.aiChipText}>
          Based on your training history, <Text style={styles.aiChipAccent}>CHEST</Text> and{' '}
          <Text style={styles.aiChipAccent}>TRICEPS</Text> are optimal for today.
        </Text>
      </View>

      <FlatList
        data={sections}
        keyExtractor={s => s.key}
        contentContainerStyle={[styles.listContent, selected.size > 0 && { paddingBottom: 120 }]}
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: REGION_COLOR[section.key] ?? colors.onSurfaceVariant }]}>
              {section.title}
            </Text>
            {section.items.map(muscle => {
              const isActive = selected.has(muscle.id);
              const accentColor = REGION_COLOR[muscle.body_region] ?? colors.primaryContainer;
              return (
                <TouchableOpacity
                  key={muscle.id}
                  style={[
                    styles.muscleRow,
                    isActive && { ...styles.muscleRowActive, borderLeftColor: accentColor },
                  ]}
                  onPress={() => toggleMuscle(muscle)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconContainer, isActive && { backgroundColor: accentColor + '22' }]}>
                    <Text style={[styles.icon, { color: isActive ? accentColor : colors.onSurfaceVariant }]}>
                      {MUSCLE_ICON[muscle.name] ?? '◎'}
                    </Text>
                  </View>

                  <Text style={[styles.muscleName, isActive && { color: colors.onSurface }]}>
                    {muscle.name.toUpperCase()}
                  </Text>

                  {/* Checkmark when selected */}
                  <View style={[
                    styles.checkBox,
                    isActive && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}>
                    {isActive && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      {/* Sticky CTA — appears when ≥1 muscle selected */}
      {selected.size > 0 && (
        <View style={styles.ctaBar}>
          <View style={styles.ctaBarInner}>
            <View style={styles.ctaLeft}>
              <Text style={styles.ctaCount}>{selected.size}</Text>
              <View style={styles.ctaNames}>
                <Text style={styles.ctaLabel}>MUSCLE{selected.size > 1 ? 'S' : ''} SELECTED</Text>
                <Text style={styles.ctaNamesText} numberOfLines={1}>
                  {selectedNames.join(' · ')}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.ctaBtn} onPress={handleViewExercises} activeOpacity={0.85}>
              <Text style={styles.ctaBtnText}>VIEW EXERCISES  ›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>CLEAR SELECTION</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.secondary, fontSize: 14 },

  pageHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pageTitle:       { fontSize: 38, fontWeight: '900', color: colors.onSurface,        letterSpacing: -1, lineHeight: 38 },
  pageTitleAccent: { fontSize: 38, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1, lineHeight: 42 },
  pageSubtitle:    { fontSize: 9,  fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2.5 },

  aiChip: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: colors.tertiaryContainer + '18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.tertiaryContainer + '30',
    padding: 14,
  },
  aiChipLabel:  { fontSize: 9,  fontWeight: '700', color: colors.tertiaryContainer, letterSpacing: 2, marginBottom: 6 },
  aiChipText:   { fontSize: 12, color: colors.onSurface, lineHeight: 18 },
  aiChipAccent: { color: colors.tertiaryContainer, fontWeight: '700' },

  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  section:     { marginBottom: 24 },
  sectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 3, marginBottom: 8, marginLeft: 2 },

  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 14,
    padding: 16,
    marginBottom: 6,
    gap: 14,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  muscleRowActive: { backgroundColor: colors.surfaceContainerHigh },
  iconContainer: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:       { fontSize: 18 },
  muscleName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.5 },

  checkBox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: colors.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 13, color: colors.onPrimaryContainer, fontWeight: '900' },

  // Sticky CTA bar
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surfaceContainerHigh,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant + '44',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
    gap: 10,
  },
  ctaBarInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaCount: {
    fontSize: 32, fontWeight: '900', color: colors.primaryContainer, lineHeight: 36,
  },
  ctaNames:     { flex: 1, gap: 2 },
  ctaLabel:     { fontSize: 8, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2 },
  ctaNamesText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  ctaBtn: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 50, paddingHorizontal: 20, paddingVertical: 14,
  },
  ctaBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  clearBtn:     { alignItems: 'center' },
  clearBtnText: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5 },
});
