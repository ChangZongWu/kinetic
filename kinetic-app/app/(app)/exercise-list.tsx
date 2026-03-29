import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { fs } from '../../theme/scale';
import { supabase } from '../../lib/supabase';

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Exercise {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string;
  sets_suggestion: number;
  reps_suggestion: string;
  rpe_suggestion: number;
  muscle_groups: { name: string; body_region: string };
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner:     '#4ade80',
  intermediate: colors.primaryContainer,
  advanced:     colors.secondary,
};

const EQUIPMENT_ICON: Record<string, string> = {
  barbell:    '⊟',
  dumbbell:   '⊞',
  cable:      '⊕',
  bodyweight: '◎',
  machine:    '⊠',
};

async function fetchExercises(muscleId: string): Promise<Exercise[]> {
  const url = muscleId
    ? `${API_URL}/exercises?muscle_id=${muscleId}`
    : `${API_URL}/exercises`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load exercises');
  return res.json();
}

const FORM_CUES: Record<string, string[]> = {
  'Bench Press':          ['Retract shoulder blades and keep them pinned', 'Bar path: lower chest to mid-chest', 'Drive feet into floor for leg drive'],
  'Barbell Bench Press':  ['Retract shoulder blades and keep them pinned', 'Bar path: lower chest to mid-chest', 'Drive feet into floor for leg drive'],
  'Squat':                ['Brace core before descending', 'Keep knees tracking over toes', 'Drive through mid-foot, not heels'],
  'Back Squat':           ['Brace core before descending', 'Keep knees tracking over toes', 'Drive through mid-foot, not heels'],
  'Deadlift':             ['Hip hinge, not a squat — push the floor away', 'Bar stays over mid-foot throughout', 'Lock out hips and glutes at the top'],
  'Romanian Deadlift':    ['Hinge at hips, soft knee bend', 'Feel hamstring stretch at bottom', 'Keep bar close to legs throughout'],
  'Overhead Press':       ['Squeeze glutes and brace core', 'Push head through at lockout', 'Elbows slightly forward, not flared'],
  'Pull Up':              ['Start from dead hang, depress scapula first', 'Lead with chest to the bar', 'Control the negative for 2 seconds'],
  'Lat Pulldown':         ['Lean back slightly, pull to upper chest', 'Drive elbows down and back', 'Squeeze lats at bottom for 1 second'],
  'Row':                  ['Brace core, neutral spine', 'Drive elbows past your torso', 'Squeeze shoulder blades together'],
  'Hip Thrust':           ['Chin to chest throughout to keep neutral spine', 'Drive through heels, not toes', 'Full glute squeeze at the top'],
  'Leg Press':            ['Feet hip-width, don\'t lock knees at top', 'Lower until 90° knee angle', 'Keep lower back flat on pad'],
  'Dumbbell Curl':        ['Keep elbows pinned at sides', 'Supinate wrist at top', 'Lower slowly — 3 second negative'],
  'Tricep Pushdown':      ['Elbows fixed at sides, only forearms move', 'Fully extend at bottom, squeeze triceps', 'Keep wrists neutral'],
};

const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'cable', 'bodyweight', 'machine'];
const DIFFICULTY_OPTIONS = ['beginner', 'intermediate', 'advanced'];

function CreateExerciseModal({
  visible,
  onClose,
  muscleId,
  muscleName,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  muscleId: string;
  muscleName: string;
  onCreated: () => void;
}) {
  const firstMuscleId = muscleId?.split(',')[0] ?? '';
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [equipment, setEquipment] = useState('bodyweight');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(''); setDescription(''); setDifficulty('beginner');
    setEquipment('bodyweight'); setSets('3'); setReps('10');
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Required', 'Exercise name is required.'); return; }
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          muscle_group_id: firstMuscleId,
          description: description.trim(),
          difficulty,
          equipment,
          sets_suggestion: parseInt(sets) || 3,
          reps_suggestion: reps.trim() || '10',
          rpe_suggestion: 7.0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail ?? 'Failed to create exercise.');
        return;
      }
      reset();
      onCreated();
      onClose();
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalSheet, isMobile && styles.modalSheetMobile]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />
            <Text style={styles.createTitle}>NEW EXERCISE</Text>
            <Text style={styles.createMuscle}>{muscleName?.toUpperCase()}</Text>

            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={[styles.fieldInput, isMobile && styles.fieldInputMobile]}
              placeholder="e.g. Cable Crossover"
              placeholderTextColor={colors.outlineVariant}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={[styles.fieldInput, isMobile && styles.fieldInputMobile, styles.fieldInputMulti]}
              placeholder="Brief description..."
              placeholderTextColor={colors.outlineVariant}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.fieldLabel}>DIFFICULTY</Text>
            <View style={styles.optionRow}>
              {DIFFICULTY_OPTIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.optionChip, difficulty === d && styles.optionChipActive]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={[styles.optionChipText, difficulty === d && styles.optionChipTextActive]}>
                    {d.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>EQUIPMENT</Text>
            <View style={styles.optionRow}>
              {EQUIPMENT_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.optionChip, equipment === e && styles.optionChipActive]}
                  onPress={() => setEquipment(e)}
                >
                  <Text style={[styles.optionChipText, equipment === e && styles.optionChipTextActive]}>
                    {e.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldLabel}>SETS</Text>
                <TextInput
                  style={[styles.fieldInput, isMobile && styles.fieldInputMobile]}
                  placeholder="3"
                  placeholderTextColor={colors.outlineVariant}
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldLabel}>REPS</Text>
                <TextInput
                  style={[styles.fieldInput, isMobile && styles.fieldInputMobile]}
                  placeholder="10-12"
                  placeholderTextColor={colors.outlineVariant}
                  value={reps}
                  onChangeText={setReps}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>{saving ? 'SAVING...' : 'CREATE EXERCISE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ExerciseList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { muscleId, muscleName, mode, planId, day } = useLocalSearchParams<{
    muscleId: string;
    muscleName: string;
    mode?: string;
    planId?: string;
    day?: string;
  }>();
  const isAddMode = mode === 'addToPlan';
  const isMultiMuscle = muscleId?.includes(',');
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  const { data: exercises, isLoading, isError } = useQuery({
    queryKey: ['exercises', muscleId],
    queryFn: () => fetchExercises(muscleId ?? ''),
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    return exercises.filter(ex => {
      const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const matchDiff   = !diffFilter || ex.difficulty === diffFilter;
      return matchSearch && matchDiff;
    });
  }, [exercises, search, diffFilter]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.pageTitle}>{(muscleName ?? 'ALL').toUpperCase()}</Text>
          <Text style={styles.pageSubtitle}>EXERCISES</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
        {!isMultiMuscle && (
          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setCreateVisible(true)}>
            <Text style={styles.addExerciseBtnText}>+</Text>
          </TouchableOpacity>
        )}
      </View>
      {isAddMode && (
        <View style={styles.addModeBanner}>
          <Text style={styles.addModeBannerText}>
            Adding to {day?.toUpperCase()} — tap an exercise to add it
          </Text>
        </View>
      )}

      {/* Search + filters */}
      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⊙</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={colors.outlineVariant}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {[null, 'beginner', 'intermediate', 'advanced'].map(d => (
            <TouchableOpacity
              key={d ?? 'all'}
              style={[styles.filterChip, diffFilter === d && styles.filterChipActive]}
              onPress={() => setDiffFilter(d)}
            >
              <Text style={[styles.filterChipText, diffFilter === d && styles.filterChipTextActive]}>
                {d ? d.toUpperCase() : 'ALL'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load exercises.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={ex => ex.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: ex }) => (
            <TouchableOpacity
              style={[styles.exerciseCard, { borderLeftColor: DIFFICULTY_COLOR[ex.difficulty] }]}
              onPress={async () => {
                if (isAddMode && planId && day) {
                  setAdding(true);
                  try {
                    const headers = await getAuthHeaders();
                    await fetch(`${API_URL}/plans/${planId}/sessions`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ exercise_id: ex.id, day_of_week: day, is_rest_day: false }),
                    });
                  } finally {
                    setAdding(false);
                  }
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(app)/workout-builder');
                  }
                } else {
                  setSelected(ex);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLOR[ex.difficulty] + '22' }]}>
                  <Text style={[styles.diffBadgeText, { color: DIFFICULTY_COLOR[ex.difficulty] }]}>
                    {ex.difficulty.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.exerciseDesc} numberOfLines={2}>{ex.description}</Text>

              {isMultiMuscle && ex.muscle_groups?.name && (
                <View style={styles.muscleTag}>
                  <Text style={styles.muscleTagText}>{ex.muscle_groups.name.toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>{EQUIPMENT_ICON[ex.equipment] ?? '◎'}</Text>
                  <Text style={styles.metaText}>{ex.equipment}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>▷</Text>
                  <Text style={styles.metaText}>{ex.sets_suggestion} sets</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>◈</Text>
                  <Text style={styles.metaText}>{ex.reps_suggestion} reps</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No exercises found.</Text>
            </View>
          }
        />
      )}

      {/* Create Exercise modal */}
      <CreateExerciseModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        muscleId={muscleId ?? ''}
        muscleName={muscleName ?? ''}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['exercises', muscleId] })}
      />

      {/* Exercise detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Close handle */}
              <View style={styles.sheetHandle} />

              {selected && (
                <>
                  {/* Difficulty badge */}
                  <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLOR[selected.difficulty] + '22', alignSelf: 'flex-start', marginBottom: 12 }]}>
                    <Text style={[styles.diffBadgeText, { color: DIFFICULTY_COLOR[selected.difficulty] }]}>
                      {selected.difficulty.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.modalTitle}>{selected.name}</Text>
                  <Text style={styles.modalMuscle}>{selected.muscle_groups?.name?.toUpperCase()}</Text>
                  <Text style={styles.modalDesc}>{selected.description}</Text>

                  {/* Form cues */}
                  {FORM_CUES[selected.name] && (
                    <View style={styles.formCuesBox}>
                      <Text style={styles.formCuesTitle}>FORM CUES</Text>
                      {FORM_CUES[selected.name].map((cue, i) => (
                        <View key={i} style={styles.formCueRow}>
                          <Text style={styles.formCueDot}>▸</Text>
                          <Text style={styles.formCueText}>{cue}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Stats grid */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.sets_suggestion}</Text>
                      <Text style={styles.statLabel}>SETS</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.reps_suggestion}</Text>
                      <Text style={styles.statLabel}>REPS</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.rpe_suggestion}</Text>
                      <Text style={styles.statLabel}>RPE</Text>
                    </View>
                  </View>

                  {/* Equipment */}
                  <View style={styles.equipRow}>
                    <Text style={styles.equipIcon}>{EQUIPMENT_ICON[selected.equipment] ?? '◎'}</Text>
                    <Text style={styles.equipText}>{selected.equipment.toUpperCase()}</Text>
                  </View>

                  {/* CTA */}
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                      setSelected(null);
                      router.push({
                        pathname: '/(app)/workout-builder',
                        params: {},
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addBtnText}>GO TO WORKOUT BUILDER</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtnText}>CLOSE</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  errorText: { color: colors.secondary, fontSize: fs(14) },
  emptyText: { color: colors.onSurfaceVariant, fontSize: fs(13) },

  addModeBanner: {
    backgroundColor: colors.primaryContainer + '22',
    borderLeftWidth: 3, borderLeftColor: colors.primaryContainer,
    paddingHorizontal: 22, paddingVertical: 12, marginHorizontal: 22,
    borderRadius: 8, marginBottom: 10,
  },
  addModeBannerText: { color: colors.primaryContainer, fontSize: fs(11), fontWeight: '700', letterSpacing: 0.5 },

  // Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    gap: 14,
  },
  backBtn:     { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: fs(24), color: colors.onSurface, lineHeight: 30 },
  headerText:  { flex: 1 },
  pageTitle:   { fontSize: fs(26), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5 },
  pageSubtitle:{ fontSize: fs(9), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 3 },
  countBadge:  { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7 },
  countText:   { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(13) },
  addExerciseBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  addExerciseBtnText: { fontSize: fs(22), color: colors.onPrimaryContainer, fontWeight: '900', lineHeight: 28 },

  // Controls
  controls:  { paddingHorizontal: 22, marginBottom: 14, gap: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 50, paddingHorizontal: 18, paddingVertical: 12, gap: 10,
  },
  searchIcon:  { fontSize: fs(14), color: colors.onSurfaceVariant },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: fs(13) } as any,
  filterRow:   { flexDirection: 'row', gap: 8 },
  filterChip:  {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 50, backgroundColor: colors.surfaceContainer,
  },
  filterChipActive:    { backgroundColor: colors.primaryContainer },
  filterChipText:      { fontSize: fs(9), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1.5 },
  filterChipTextActive:{ color: colors.onPrimaryContainer },

  // Exercise card
  listContent: { paddingHorizontal: 22, paddingBottom: 40 },
  exerciseCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 18,
    padding: 22,
    marginBottom: 12,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  exerciseName: { flex: 1, fontSize: fs(18), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.3 },
  diffBadge:    { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  diffBadgeText:{ fontSize: fs(8), fontWeight: '900', letterSpacing: 1 },
  exerciseDesc: { fontSize: fs(12), color: colors.onSurfaceVariant, lineHeight: 20 },
  muscleTag: { alignSelf: 'flex-start', backgroundColor: colors.tertiary + '22', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  muscleTagText: { fontSize: fs(8), fontWeight: '800', color: colors.tertiary, letterSpacing: 1.5 },
  cardMeta:     { flexDirection: 'row', gap: 16, marginTop: 2 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaIcon:     { fontSize: fs(11), color: colors.onSurfaceVariant },
  metaText:     { fontSize: fs(11), color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 0.3 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surfaceContainerHigh,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    maxHeight: '85%',
  },
  modalSheetMobile: {
    maxHeight: '92%',
    padding: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: 'center', marginBottom: 28,
  },
  modalTitle:  { fontSize: fs(28), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalMuscle: { fontSize: fs(9), fontWeight: '700', color: colors.primaryContainer, letterSpacing: 3, marginBottom: 18 },
  modalDesc:   { fontSize: fs(13), color: colors.onSurfaceVariant, lineHeight: 22, marginBottom: 28 },

  formCuesBox:  { backgroundColor: colors.surfaceContainerHighest, borderRadius: 14, padding: 16, marginBottom: 22, gap: 10 },
  formCuesTitle:{ fontSize: fs(8), fontWeight: '900', color: colors.primaryContainer, letterSpacing: 2, marginBottom: 4 },
  formCueRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  formCueDot:   { fontSize: fs(10), color: colors.primaryContainer, marginTop: 1 },
  formCueText:  { flex: 1, fontSize: fs(12), color: colors.onSurface, lineHeight: 20 },

  statsGrid: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  statBox:   {
    flex: 1, backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 14, padding: 18, alignItems: 'center',
  },
  statNum:   { fontSize: fs(24), fontWeight: '900', color: colors.primaryContainer },
  statLabel: { fontSize: fs(8), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2, marginTop: 4 },

  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  equipIcon:{ fontSize: fs(18), color: colors.onSurfaceVariant },
  equipText:{ fontSize: fs(11), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2 },

  addBtn: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 50, paddingVertical: 20,
    alignItems: 'center', marginBottom: 14,
  },
  addBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(12), letterSpacing: 2 },

  closeBtn:     { paddingVertical: 16, alignItems: 'center' },
  closeBtnText: { color: colors.onSurfaceVariant, fontSize: fs(11), fontWeight: '700', letterSpacing: 1.5 },

  // Create exercise form
  createTitle:  { fontSize: fs(26), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  createMuscle: { fontSize: fs(9), fontWeight: '700', color: colors.primaryContainer, letterSpacing: 3, marginBottom: 28 },
  fieldLabel:   { fontSize: fs(9), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 6, marginTop: 16 },
  fieldInput:   {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: colors.onSurface, fontSize: fs(14),
  } as any,
  fieldInputMobile: {
    paddingVertical: 18,
    fontSize: fs(16),
    borderRadius: 14,
  } as any,
  fieldInputMulti: { minHeight: 64, textAlignVertical: 'top' } as any,
  optionRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:   { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50, backgroundColor: colors.surfaceContainerHighest },
  optionChipActive:    { backgroundColor: colors.primaryContainer },
  optionChipText:      { fontSize: fs(9), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1 },
  optionChipTextActive:{ color: colors.onPrimaryContainer },
  rowFields: { flexDirection: 'row', gap: 12, marginTop: 0 },
});
