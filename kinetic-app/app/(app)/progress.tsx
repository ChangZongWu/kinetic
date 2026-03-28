import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LogSet {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  exercises: { name: string; muscle_groups: { name: string } | null } | null;
}

interface WorkoutLog {
  id: string;
  logged_at: string;
  plan_id: string | null;
  duration_minutes: number | null;
  notes: string | null;
  workout_plans: { name: string } | null;
  log_sets: LogSet[];
}

interface PlanExercise {
  id: string;
  name: string;
  sets_suggestion: number;
  reps_suggestion: string;
  equipment: string;
  muscle_groups: { name: string } | null;
}

interface PlanSession {
  id: string;
  day_of_week: string;
  exercises: PlanExercise;
}

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  plan_sessions: PlanSession[];
}

// ── Weekly chart helpers ───────────────────────────────────────────────────────

const CHART_H = 64;

function getVolumeLast6Weeks(logs: WorkoutLog[]): { label: string; volume: number }[] {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? 6 : dow - 1;

  return Array.from({ length: 6 }, (_, i) => {
    const weeksAgo = 5 - i;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMon - weeksAgo * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const volume = logs
      .filter(l => { const d = new Date(l.logged_at); return d >= monday && d < sunday; })
      .reduce((sum, l) =>
        sum + (l.log_sets ?? []).reduce((s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0), 0
      );
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = weeksAgo === 0
      ? 'NOW'
      : `${monthNames[monday.getMonth()]} ${monday.getDate()}`;
    return { label, volume };
  });
}

function VolumeChart({ weeks }: { weeks: { label: string; volume: number }[] }) {
  const max = Math.max(...weeks.map(w => w.volume), 1);
  return (
    <View>
      <View style={vc.row}>
        {weeks.map((w, i) => {
          const barH = w.volume > 0 ? Math.max((w.volume / max) * CHART_H, 8) : 4;
          const isNow = i === weeks.length - 1;
          const isEmpty = w.volume === 0;
          return (
            <View key={i} style={vc.col}>
              <View style={[vc.barBg, { height: CHART_H }]}>
                <View style={[
                  vc.barFill,
                  { height: barH },
                  isNow ? vc.barNow : vc.barPast,
                  isEmpty && vc.barEmpty,
                ]} />
              </View>
              <Text style={[vc.lbl, isNow && vc.lblNow]}>{w.label}</Text>
            </View>
          );
        })}
      </View>
      {/* Zero baseline */}
      <View style={vc.baseline} />
    </View>
  );
}

const vc = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col:     { flex: 1, alignItems: 'center', gap: 6 },
  barBg:   { width: '100%', backgroundColor: colors.surfaceContainerHigh, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  barNow:   { backgroundColor: colors.primaryContainer },
  barPast:  { backgroundColor: colors.surfaceContainerHighest },
  barEmpty: { backgroundColor: colors.surfaceContainerHigh, opacity: 0.5 },
  lbl:      { fontSize: 7, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 0.5 },
  lblNow:   { color: colors.primaryContainer },
  baseline: { height: 1, backgroundColor: colors.outlineVariant + '55', marginTop: 2 },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getTodayDay(): string {
  const d = new Date().getDay();
  const map = [6, 0, 1, 2, 3, 4, 5];
  return DAYS[map[d]];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getExerciseSummary(sets: LogSet[]) {
  const map: Record<string, { name: string; muscle: string; reps: number[]; count: number; maxWeight: number }> = {};
  for (const s of sets) {
    const key = s.exercise_id;
    const name = s.exercises?.name ?? 'Exercise';
    const muscle = s.exercises?.muscle_groups?.name ?? '';
    if (!map[key]) map[key] = { name, muscle, reps: [], count: 0, maxWeight: 0 };
    map[key].count++;
    if (s.reps) map[key].reps.push(s.reps);
    if (s.weight_kg && s.weight_kg > map[key].maxWeight) map[key].maxWeight = s.weight_kg;
  }
  return Object.values(map).map(ex => ({
    name: ex.name,
    muscle: ex.muscle,
    sets: ex.count,
    maxWeight: ex.maxWeight,
    avgReps: ex.reps.length > 0
      ? Math.round(ex.reps.reduce((a, b) => a + b, 0) / ex.reps.length).toString()
      : '—',
  }));
}

// Compute all-time max weight per exercise from all logs
function computePRs(logs: WorkoutLog[]): Record<string, number> {
  const prs: Record<string, number> = {};
  for (const log of logs) {
    for (const s of log.log_sets ?? []) {
      if (s.weight_kg && s.weight_kg > (prs[s.exercise_id] ?? 0)) {
        prs[s.exercise_id] = s.weight_kg;
      }
    }
  }
  return prs;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Progress() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal: flat map of exerciseId → array of {reps, weight} per set
  const [setInputs, setSetInputs] = useState<Record<string, { reps: string; weight: string }[]>>({});
  const [modalExercises, setModalExercises] = useState<PlanExercise[]>([]);
  const [modalPlanId, setModalPlanId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [logsRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/logs`, { headers }),
        fetch(`${API_URL}/plans`, { headers }),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    const activePlan = plans[0] ?? null;
    if (!activePlan) {
      Alert.alert('No Plan', 'Create a workout plan first in the Workout Builder.');
      return;
    }

    const today = getTodayDay();
    const todaySessions = activePlan.plan_sessions.filter(s => s.day_of_week === today);
    const sessions = todaySessions.length > 0 ? todaySessions : activePlan.plan_sessions;

    // Deduplicate by exercise id
    const seen = new Set<string>();
    const exercises: PlanExercise[] = [];
    for (const s of sessions) {
      if (s.exercises?.id && !seen.has(s.exercises.id)) {
        seen.add(s.exercises.id);
        exercises.push(s.exercises);
      }
    }

    // Build set inputs pre-filled with suggested reps, empty weight
    const inputs: Record<string, { reps: string; weight: string }[]> = {};
    for (const ex of exercises) {
      const count = ex.sets_suggestion ?? 3;
      inputs[ex.id] = Array.from({ length: count }, () => ({
        reps: ex.reps_suggestion ?? '',
        weight: '',
      }));
    }

    setModalExercises(exercises);
    setSetInputs(inputs);
    setModalPlanId(activePlan.id);
    setShowModal(true);
  }

  function updateSet(exerciseId: string, setIdx: number, field: 'reps' | 'weight', value: string) {
    setSetInputs(prev => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] ?? []).map((s, i) =>
        i === setIdx ? { ...s, [field]: value } : s
      ),
    }));
  }

  async function saveLog() {
    const sets: {
      exercise_id: string;
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
    }[] = [];

    for (const [exerciseId, setsArr] of Object.entries(setInputs)) {
      setsArr.forEach((s, idx) => {
        const reps = parseInt(s.reps, 10);
        const weight = parseFloat(s.weight);
        if (!isNaN(reps) || !isNaN(weight)) {
          sets.push({
            exercise_id: exerciseId,
            set_number: idx + 1,
            reps: isNaN(reps) ? null : reps,
            weight_kg: isNaN(weight) ? null : weight,
          });
        }
      });
    }

    if (sets.length === 0) {
      Alert.alert('No Sets', 'Enter at least one set before saving.');
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan_id: modalPlanId, sets }),
      });
      if (!res.ok) throw new Error('Save failed');
      const newLog: WorkoutLog = await res.json();
      setLogs(prev => [newLog, ...prev]);
      setShowModal(false);
    } catch {
      Alert.alert('Error', 'Could not save workout. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(logId: string) {
    Alert.alert('Delete Workout', 'Remove this log from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_URL}/logs/${logId}`, { method: 'DELETE', headers });
          if (res.ok) setLogs(prev => prev.filter(l => l.id !== logId));
        },
      },
    ]);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalWorkouts = logs.length;
  const weekStart = getWeekStart();
  const thisWeek = logs.filter(l => new Date(l.logged_at) >= weekStart).length;
  // PRs: for each log, check if any set in that log set a new all-time record
  // We build PRs from all logs BEFORE the current one (chronologically)
  const allTimePRs = computePRs(logs);
  const totalVolume = logs.reduce(
    (sum, log) =>
      sum + (log.log_sets ?? []).reduce(
        (s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0
      ),
    0
  );

  const fmtVolume = (v: number) => {
    if (v === 0) return '0';
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return `${Math.round(v)}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageLabel}>TRAINING</Text>
            <Text style={styles.pageTitle}>PROGRESS</Text>
          </View>
          <TouchableOpacity style={styles.logBtn} onPress={openModal}>
            <Text style={styles.logBtnText}>+ LOG WORKOUT</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{thisWeek}</Text>
            <Text style={styles.statLabel}>THIS WEEK</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {fmtVolume(totalVolume)}
              <Text style={styles.statUnit}>kg</Text>
            </Text>
            <Text style={styles.statLabel}>VOLUME</Text>
          </View>
        </View>

        {/* Volume by week chart */}
        {logs.length > 0 && (() => {
          const weeks = getVolumeLast6Weeks(logs);
          const anyVolume = weeks.some(w => w.volume > 0);
          return anyVolume ? (
            <>
              <Text style={styles.sectionLabel}>VOLUME BY WEEK</Text>
              <View style={styles.chartCard}>
                <VolumeChart weeks={weeks} />
              </View>
            </>
          ) : null;
        })()}

        {/* History */}
        <Text style={styles.sectionLabel}>RECENT WORKOUTS</Text>

        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>◇</Text>
            <Text style={styles.emptyTitle}>NO WORKOUTS LOGGED YET</Text>
            <Text style={styles.emptyText}>
              Tap "Log Workout" after your session to track your sets and build a history.
            </Text>
          </View>
        ) : (
          logs.map(log => {
            const summary = getExerciseSummary(log.log_sets ?? []);
            const volume = (log.log_sets ?? []).reduce(
              (s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0
            );
            const totalSets = (log.log_sets ?? []).length;

            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logCardHeader}>
                  <View>
                    <Text style={styles.logDate}>{formatDate(log.logged_at)}</Text>
                    {log.workout_plans && (
                      <Text style={styles.logPlan}>{log.workout_plans.name.toUpperCase()}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => deleteLog(log.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {summary.map((ex, i) => {
                  // Find exercise_id from log_sets
                  const exId = log.log_sets?.find(s => s.exercises?.name === ex.name)?.exercise_id;
                  const isPR = exId && allTimePRs[exId] > 0 && ex.maxWeight >= allTimePRs[exId] && ex.maxWeight > 0;
                  return (
                    <View key={i} style={[styles.logExRow, i > 0 && styles.logExRowBorder]}>
                      <View style={styles.logExLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.logExName}>{ex.name}</Text>
                          {isPR && <Text style={styles.prBadge}>🏆 PR</Text>}
                        </View>
                        {ex.muscle ? <Text style={styles.logExMuscle}>{ex.muscle}</Text> : null}
                      </View>
                      <Text style={styles.logExSets}>{ex.sets}×{ex.avgReps}</Text>
                    </View>
                  );
                })}

                <View style={styles.logCardFooter}>
                  <Text style={styles.logFooterStat}>{totalSets} sets</Text>
                  {volume > 0 && (
                    <Text style={styles.logFooterStat}>{Math.round(volume)} kg total</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Log Workout Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>LOG WORKOUT</Text>
                <Text style={styles.modalSub}>Fill in your actual reps and weights</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalExercises.map(ex => (
              <View key={ex.id} style={styles.modalExBlock}>
                <View style={styles.modalExHeader}>
                  <Text style={styles.modalExName}>{ex.name}</Text>
                  {ex.muscle_groups && (
                    <Text style={styles.modalExMuscle}>{ex.muscle_groups.name.toUpperCase()}</Text>
                  )}
                </View>

                <View style={styles.setColHeader}>
                  <View style={styles.setNumBadge} />
                  <Text style={styles.setColLabel}>REPS</Text>
                  <Text style={[styles.setColLabel, { marginHorizontal: 8 }]}> </Text>
                  <Text style={styles.setColLabel}>WEIGHT</Text>
                </View>

                {(setInputs[ex.id] ?? []).map((setInput, idx) => (
                  <View key={idx} style={styles.setRow}>
                    <View style={styles.setNumBadge}>
                      <Text style={styles.setNumText}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.setInput}
                      placeholder={ex.reps_suggestion ?? 'Reps'}
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="numeric"
                      value={setInput.reps}
                      onChangeText={v => updateSet(ex.id, idx, 'reps', v)}
                      maxLength={4}
                    />
                    <Text style={styles.setX}>×</Text>
                    <TextInput
                      style={styles.setInput}
                      placeholder="0"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      value={setInput.weight}
                      onChangeText={v => updateSet(ex.id, idx, 'weight', v)}
                      maxLength={6}
                    />
                    <Text style={styles.setKg}>kg</Text>
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveLog}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
              ) : (
                <Text style={styles.saveBtnText}>SAVE WORKOUT</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24,
  },
  pageLabel: { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 4 },
  pageTitle: { fontSize: 32, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  logBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  logBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: 26, fontWeight: '900', color: colors.primaryContainer },
  statUnit: { fontSize: 14, fontWeight: '600' },
  statLabel: { fontSize: 8, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 2 },

  // Section
  sectionLabel: {
    fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant,
    letterSpacing: 3, marginBottom: 12,
  },

  // Chart
  chartCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20, padding: 16, paddingTop: 20, marginBottom: 28,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 36, color: colors.outlineVariant },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.onSurface },
  emptyText: {
    fontSize: 12, color: colors.onSurfaceVariant,
    textAlign: 'center', maxWidth: 260, lineHeight: 18,
  },

  // Log cards
  logCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20, padding: 16, marginBottom: 12,
  },
  logCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  logDate: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  logPlan: { fontSize: 9, color: colors.primaryContainer, letterSpacing: 1.5, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.onSurfaceVariant, fontSize: 14 },

  logExRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  logExRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant + '33' },
  logExLeft: { flex: 1, gap: 2 },
  logExName: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  logExMuscle: { fontSize: 10, color: colors.onSurfaceVariant },
  logExSets: { fontSize: 13, fontWeight: '800', color: colors.tertiary },
  prBadge: { fontSize: 9, fontWeight: '800', color: colors.primaryContainer, letterSpacing: 0.5 },

  logCardFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 16,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant + '22',
    marginTop: 8, paddingTop: 8,
  },
  logFooterStat: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: colors.onSurface },
  modalSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalClose: { fontSize: 20, color: colors.onSurfaceVariant },

  modalExBlock: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  modalExHeader: { marginBottom: 12 },
  modalExName: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  modalExMuscle: { fontSize: 9, color: colors.primaryContainer, letterSpacing: 1.5, marginTop: 2 },

  setColHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingLeft: 32,
  },
  setColLabel: { flex: 1, fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 1, fontWeight: '700', textAlign: 'center' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNumBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  setNumText: { fontSize: 10, fontWeight: '800', color: colors.onSurfaceVariant },
  setInput: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.onSurface, fontSize: 16, fontWeight: '700',
    textAlign: 'center', borderWidth: 1, borderColor: colors.outlineVariant,
  },
  setX: { fontSize: 16, color: colors.onSurfaceVariant, fontWeight: '700' },
  setKg: { fontSize: 11, color: colors.onSurfaceVariant, width: 20 },

  saveBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  saveBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
});
