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
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  plan_sessions: PlanSession[];
}

interface PlanSession {
  id: string;
  plan_id: string;
  exercise_id: string;
  day_of_week: string;
  is_rest_day: boolean;
  exercises: {
    name: string;
    difficulty: string;
    equipment: string;
    sets_suggestion: number;
    reps_suggestion: string;
    muscle_groups: { name: string };
  };
  session_sets?: SessionSet[];
}

interface SessionSet {
  id: string;
  session_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function WorkoutBuilder() {
  const router = useRouter();
  const params = useLocalSearchParams<{ addExerciseId?: string; addDay?: string; addPlanId?: string }>();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState('Mon');
  const [loading, setLoading] = useState(true);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanGoal, setNewPlanGoal] = useState<string | null>(null);
  const [setsModal, setSetsModal] = useState<PlanSession | null>(null);
  const [sessionSets, setSessionSets] = useState<SessionSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);

  const activePlan = plans.find(p => p.id === activePlanId) ?? null;
  const dayExercises = activePlan?.plan_sessions.filter(s => s.day_of_week === activeDay && !s.is_rest_day) ?? [];

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/plans`, { headers });
      if (!res.ok) throw new Error('Failed to load plans');
      const data: Plan[] = await res.json();
      setPlans(data);
      if (data.length > 0 && !activePlanId) setActivePlanId(data[0].id);
    } catch (e) {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when returning from exercise-list with a new exercise added
  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans])
  );

  // If exercise-list navigated back with addExerciseId, add it
  useFocusEffect(
    useCallback(() => {
      const { addExerciseId, addDay, addPlanId } = params;
      if (addExerciseId && addDay && addPlanId) {
        addExerciseToPlan(addPlanId, addExerciseId, addDay);
        router.setParams({ addExerciseId: undefined, addDay: undefined, addPlanId: undefined });
      }
    }, [params.addExerciseId])
  );

  async function addExerciseToPlan(planId: string, exerciseId: string, day: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${planId}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ exercise_id: exerciseId, day_of_week: day, is_rest_day: false }),
      });
      await loadPlans();
    } catch {}
  }

  async function removeSession(planId: string, sessionId: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${planId}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
      });
      await loadPlans();
    } catch {}
  }

  async function createPlan() {
    if (!newPlanName.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newPlanName.trim(), goal: newPlanGoal }),
      });
      const plan = await res.json();
      setNewPlanName('');
      setNewPlanGoal(null);
      setShowNewPlanModal(false);
      await loadPlans();
      setActivePlanId(plan.id);
    } catch {}
  }

  async function deletePlan(planId: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${planId}`, { method: 'DELETE', headers });
      setActivePlanId(null);
      await loadPlans();
    } catch {}
  }

  async function openSetsModal(session: PlanSession) {
    setSetsModal(session);
    setSetsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets`, { headers });
      const data: SessionSet[] = res.ok ? await res.json() : [];
      setSessionSets(Array.isArray(data) ? data : []);
    } catch {
      setSessionSets([]);
    } finally {
      setSetsLoading(false);
    }
  }

  async function addSet(session: PlanSession, reps: number, weightKg: number) {
    try {
      const headers = await getAuthHeaders();
      const setNumber = sessionSets.length + 1;
      const res = await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ set_number: setNumber, reps, weight_kg: weightKg }),
      });
      const newSet: SessionSet = await res.json();
      setSessionSets(prev => [...prev, newSet]);
    } catch {}
  }

  async function removeSet(session: PlanSession, setId: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets/${setId}`, {
        method: 'DELETE',
        headers,
      });
      setSessionSets(prev => prev.filter(s => s.id !== setId));
    } catch {}
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>WORKOUT</Text>
          <Text style={styles.pageTitleAccent}>BUILDER</Text>
        </View>
        <TouchableOpacity style={styles.newPlanBtn} onPress={() => setShowNewPlanModal(true)}>
          <Text style={styles.newPlanBtnText}>+ NEW PLAN</Text>
        </TouchableOpacity>
      </View>

      {/* Plan selector tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planTabsScroll} contentContainerStyle={styles.planTabs}>
        {plans.map(plan => (
          <TouchableOpacity
            key={plan.id}
            style={[styles.planTab, activePlanId === plan.id && styles.planTabActive]}
            onPress={() => setActivePlanId(plan.id)}
          >
            <Text style={[styles.planTabText, activePlanId === plan.id && styles.planTabTextActive]}>
              {plan.name.toUpperCase()}
            </Text>
            {plan.goal && (
              <Text style={[styles.planTabGoal, activePlanId === plan.id && styles.planTabGoalActive]}>
                {plan.goal.toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        ))}
        {plans.length === 0 && (
          <Text style={styles.noPlansText}>No plans yet. Create one to get started.</Text>
        )}
      </ScrollView>

      {activePlan && (
        <>
          {/* Delete plan */}
          <View style={styles.planActions}>
            <Text style={styles.planActionsLabel}>
              {activePlan.plan_sessions.length} exercises total
            </Text>
            <TouchableOpacity
              onPress={() => deletePlan(activePlan.id)}
              style={styles.deletePlanBtn}
            >
              <Text style={styles.deletePlanBtnText}>DELETE PLAN</Text>
            </TouchableOpacity>
          </View>

          {/* Day tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabsScroll} contentContainerStyle={styles.dayTabs}>
            {DAYS.map((day, i) => {
              const hasSessions = activePlan.plan_sessions.some(s => s.day_of_week === day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayTab, activeDay === day && styles.dayTabActive]}
                  onPress={() => setActiveDay(day)}
                >
                  <Text style={[styles.dayTabText, activeDay === day && styles.dayTabTextActive]}>
                    {DAY_LABELS[i]}
                  </Text>
                  {hasSessions && <View style={[styles.dayDot, activeDay === day && styles.dayDotActive]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Exercise list for selected day */}
          <FlatList
            data={dayExercises}
            keyExtractor={s => s.id}
            contentContainerStyle={styles.exerciseList}
            ListHeaderComponent={
              <TouchableOpacity
                style={styles.addExerciseBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/muscle-selector',
                    params: { mode: 'addToPlan', planId: activePlan.id, day: activeDay },
                  })
                }
              >
                <Text style={styles.addExerciseBtnText}>+ ADD EXERCISE TO {activeDay.toUpperCase()}</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <View style={styles.emptyDay}>
                <Text style={styles.emptyDayText}>Rest day</Text>
                <Text style={styles.emptyDaySubtext}>Tap above to add exercises</Text>
              </View>
            }
            renderItem={({ item: session }) => (
              <View style={styles.exerciseCard}>
                <View style={styles.exerciseCardTop}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{session.exercises.name}</Text>
                    <Text style={styles.exerciseMuscle}>
                      {session.exercises.muscle_groups?.name?.toUpperCase()} · {session.exercises.equipment}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeSession(activePlan.id, session.id)}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Suggested sets/reps */}
                <View style={styles.suggestionRow}>
                  <View style={styles.suggestionItem}>
                    <Text style={styles.suggestionNum}>{session.exercises.sets_suggestion}</Text>
                    <Text style={styles.suggestionLabel}>SETS</Text>
                  </View>
                  <View style={styles.suggestionDivider} />
                  <View style={styles.suggestionItem}>
                    <Text style={styles.suggestionNum}>{session.exercises.reps_suggestion}</Text>
                    <Text style={styles.suggestionLabel}>REPS</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editSetsBtn}
                    onPress={() => openSetsModal(session)}
                  >
                    <Text style={styles.editSetsBtnText}>EDIT SETS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {!activePlan && !loading && (
        <View style={styles.center}>
          <Text style={styles.emptyStateText}>Create a plan to start building your workout</Text>
          <TouchableOpacity style={styles.createFirstPlanBtn} onPress={() => setShowNewPlanModal(true)}>
            <Text style={styles.createFirstPlanText}>CREATE FIRST PLAN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* New Plan Modal */}
      <Modal visible={showNewPlanModal} transparent animationType="slide" onRequestClose={() => setShowNewPlanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>NEW PLAN</Text>

            <Text style={styles.inputLabel}>PLAN NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Push Pull Legs"
              placeholderTextColor={colors.outlineVariant}
              value={newPlanName}
              onChangeText={setNewPlanName}
              autoFocus
            />

            <Text style={styles.inputLabel}>GOAL (OPTIONAL)</Text>
            <View style={styles.goalChips}>
              {[null, 'strength', 'hypertrophy', 'endurance', 'fat_loss'].map(g => (
                <TouchableOpacity
                  key={g ?? 'none'}
                  style={[styles.goalChip, newPlanGoal === g && styles.goalChipActive]}
                  onPress={() => setNewPlanGoal(g)}
                >
                  <Text style={[styles.goalChipText, newPlanGoal === g && styles.goalChipTextActive]}>
                    {g ? g.replace('_', ' ').toUpperCase() : 'NONE'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={createPlan}>
              <Text style={styles.createBtnText}>CREATE PLAN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewPlanModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sets Editor Modal */}
      {setsModal && (
        <SetsEditorModal
          session={setsModal}
          sets={sessionSets}
          loading={setsLoading}
          onClose={() => setSetsModal(null)}
          onAddSet={addSet}
          onRemoveSet={removeSet}
        />
      )}
    </View>
  );
}

// ── Sets Editor ────────────────────────────────────────────────────────────────

interface SetsEditorProps {
  session: PlanSession;
  sets: SessionSet[];
  loading: boolean;
  onClose: () => void;
  onAddSet: (session: PlanSession, reps: number, weightKg: number) => void;
  onRemoveSet: (session: PlanSession, setId: string) => void;
}

function SetsEditorModal({ session, sets, loading, onClose, onAddSet, onRemoveSet }: SetsEditorProps) {
  const [reps, setReps] = useState(String(session.exercises.reps_suggestion?.split('-')[0] ?? '10'));
  const [weight, setWeight] = useState('0');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>{session.exercises.name.toUpperCase()}</Text>
          <Text style={styles.modalSubtitle}>EDIT SETS</Text>

          {loading ? (
            <ActivityIndicator color={colors.primaryContainer} style={{ marginVertical: 24 }} />
          ) : (
            <>
              {/* Existing sets */}
              {sets.length > 0 && (
                <View style={styles.setsTable}>
                  <View style={styles.setsTableHeader}>
                    <Text style={[styles.setsTableCell, styles.setsTableHeaderText]}>SET</Text>
                    <Text style={[styles.setsTableCell, styles.setsTableHeaderText]}>REPS</Text>
                    <Text style={[styles.setsTableCell, styles.setsTableHeaderText]}>KG</Text>
                    <Text style={[styles.setsTableCell, { width: 32 }]} />
                  </View>
                  {sets.map(s => (
                    <View key={s.id} style={styles.setsTableRow}>
                      <Text style={[styles.setsTableCell, styles.setsTableNumText]}>{s.set_number}</Text>
                      <Text style={[styles.setsTableCell, styles.setsTableNumText]}>{s.reps ?? '-'}</Text>
                      <Text style={[styles.setsTableCell, styles.setsTableNumText]}>{s.weight_kg ?? '0'}</Text>
                      <TouchableOpacity style={{ width: 32 }} onPress={() => onRemoveSet(session, s.id)}>
                        <Text style={styles.removeBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add a set */}
              <Text style={styles.inputLabel}>ADD SET</Text>
              <View style={styles.addSetRow}>
                <View style={styles.addSetField}>
                  <Text style={styles.addSetFieldLabel}>REPS</Text>
                  <TextInput
                    style={styles.addSetInput}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.addSetField}>
                  <Text style={styles.addSetFieldLabel}>WEIGHT (KG)</Text>
                  <TextInput
                    style={styles.addSetInput}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => onAddSet(session, parseInt(reps) || 10, parseFloat(weight) || 0)}
                >
                  <Text style={styles.addSetBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.createBtn} onPress={onClose}>
            <Text style={styles.createBtnText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Page header
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  pageTitle: { fontSize: 28, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  pageTitleAccent: { fontSize: 28, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1 },
  newPlanBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  newPlanBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  // Plan tabs
  planTabsScroll: { flexGrow: 0 },
  planTabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  planTab: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surfaceContainer, gap: 2,
  },
  planTabActive: { backgroundColor: colors.primaryContainer },
  planTabText: { fontSize: 11, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  planTabTextActive: { color: colors.onPrimaryContainer },
  planTabGoal: { fontSize: 8, color: colors.outlineVariant, letterSpacing: 1 },
  planTabGoalActive: { color: colors.onPrimaryContainer + 'aa' },
  noPlansText: { color: colors.onSurfaceVariant, fontSize: 13, paddingVertical: 8 },

  // Plan actions
  planActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  planActionsLabel: { fontSize: 11, color: colors.onSurfaceVariant },
  deletePlanBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceContainer },
  deletePlanBtnText: { fontSize: 9, color: colors.secondary, fontWeight: '700', letterSpacing: 1 },

  // Day tabs
  dayTabsScroll: { flexGrow: 0, marginBottom: 8 },
  dayTabs: { paddingHorizontal: 20, gap: 6 },
  dayTab: {
    width: 52, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surfaceContainer, alignItems: 'center', gap: 4,
  },
  dayTabActive: { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.primaryContainer },
  dayTabText: { fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  dayTabTextActive: { color: colors.primaryContainer },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.outlineVariant },
  dayDotActive: { backgroundColor: colors.primaryContainer },

  // Exercise list
  exerciseList: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  addExerciseBtn: {
    backgroundColor: colors.surfaceContainer, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant, borderStyle: 'dashed',
    marginBottom: 4,
  },
  addExerciseBtnText: { color: colors.primaryContainer, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  emptyDay: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyDayText: { fontSize: 22, fontWeight: '900', color: colors.onSurfaceVariant },
  emptyDaySubtext: { fontSize: 11, color: colors.outlineVariant, letterSpacing: 1 },

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 16, gap: 12,
  },
  exerciseCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  exerciseInfo: { flex: 1, gap: 2 },
  exerciseName: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  exerciseMuscle: { fontSize: 10, color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 18, color: colors.secondary, lineHeight: 22 },

  // Suggestion row
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  suggestionItem: { alignItems: 'center', gap: 2 },
  suggestionNum: { fontSize: 18, fontWeight: '900', color: colors.primaryContainer },
  suggestionLabel: { fontSize: 7, color: colors.onSurfaceVariant, letterSpacing: 2 },
  suggestionDivider: { width: 1, height: 28, backgroundColor: colors.outlineVariant },
  editSetsBtn: {
    marginLeft: 'auto', backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50,
  },
  editSetsBtnText: { fontSize: 8, fontWeight: '800', color: colors.tertiary, letterSpacing: 1.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surfaceContainerHigh, borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalSubtitle: { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 20 },

  inputLabel: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  textInput: {
    backgroundColor: colors.surfaceContainerHighest, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.onSurface, fontSize: 15,
  } as any,

  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: colors.surfaceContainerHighest },
  goalChipActive: { backgroundColor: colors.primaryContainer },
  goalChipText: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1 },
  goalChipTextActive: { color: colors.onPrimaryContainer },

  createBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 18, alignItems: 'center', marginTop: 24,
  },
  createBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  emptyStateText: { color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  createFirstPlanBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  createFirstPlanText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },

  // Sets table
  setsTable: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 12, padding: 12, marginBottom: 8 },
  setsTableHeader: { flexDirection: 'row', marginBottom: 8 },
  setsTableHeaderText: { fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 2 },
  setsTableRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.outlineVariant + '44', alignItems: 'center' },
  setsTableCell: { flex: 1, fontSize: 14 },
  setsTableNumText: { color: colors.onSurface, fontWeight: '700' },

  // Add set row
  addSetRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  addSetField: { flex: 1, gap: 6 },
  addSetFieldLabel: { fontSize: 8, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1.5 },
  addSetInput: {
    backgroundColor: colors.surfaceContainerHighest, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.onSurface,
    fontSize: 16, fontWeight: '700', textAlign: 'center',
  } as any,
  addSetBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  addSetBtnText: { fontSize: 24, color: colors.onPrimaryContainer, fontWeight: '900', lineHeight: 28 },
});
