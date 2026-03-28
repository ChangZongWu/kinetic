import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  plan_sessions: PlanSession[];
}

interface WorkoutSet {
  reps: string;
  weight: string;
  done: boolean;
}

interface ExerciseBlock {
  exercise: PlanExercise;
  sets: WorkoutSet[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function getTodayDay(): string {
  const d = new Date().getDay();
  return DAYS[(d + 6) % 7];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string; day?: string }>();

  const [plan, setPlan]           = useState<Plan | null>(null);
  const [blocks, setBlocks]       = useState<ExerciseBlock[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [finished, setFinished]   = useState(false);

  // Stopwatch
  const [elapsed, setElapsed]     = useState(0);
  const elapsedRef                = useRef(0);
  const stopwatchRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest timer
  const [restSeconds, setRestSeconds]         = useState(0);
  const [restActive, setRestActive]           = useState(false);
  const [restDuration, setRestDuration]       = useState(90);
  const [showRestConfig, setShowRestConfig]   = useState(false);
  const restRef                               = useRef<ReturnType<typeof setInterval> | null>(null);

  // Finish confirm modal
  const [showFinishModal, setShowFinishModal] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    load();
    startStopwatch();
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
      if (restRef.current)      clearInterval(restRef.current);
    };
  }, []));

  async function load() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/plans`, { headers });
      if (!res.ok) return;
      const plans: Plan[] = await res.json();

      let target = plans[0];
      if (params.planId) {
        target = plans.find(p => p.id === params.planId) ?? plans[0];
      }
      if (!target) return;

      const day = params.day ?? getTodayDay();
      const sessions = target.plan_sessions.filter(s => s.day_of_week === day);
      const useSessions = sessions.length > 0 ? sessions : target.plan_sessions.slice(0, 6);

      // Deduplicate exercises
      const seen = new Set<string>();
      const exerciseBlocks: ExerciseBlock[] = [];
      for (const s of useSessions) {
        if (!seen.has(s.exercises.id)) {
          seen.add(s.exercises.id);
          const count = s.exercises.sets_suggestion ?? 3;
          const repsHint = s.exercises.reps_suggestion?.split('-')[0] ?? '10';
          exerciseBlocks.push({
            exercise: s.exercises,
            sets: Array.from({ length: count }, () => ({ reps: repsHint, weight: '', done: false })),
          });
        }
      }

      setPlan(target);
      setBlocks(exerciseBlocks);
    } finally {
      setLoading(false);
    }
  }

  // ── Stopwatch ─────────────────────────────────────────────────────────────────

  function startStopwatch() {
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    stopwatchRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }

  // ── Rest timer ────────────────────────────────────────────────────────────────

  function startRest() {
    if (restRef.current) clearInterval(restRef.current);
    setRestSeconds(restDuration);
    setRestActive(true);
    let remaining = restDuration;
    restRef.current = setInterval(() => {
      remaining -= 1;
      setRestSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(restRef.current!);
        setRestActive(false);
      }
    }, 1000);
  }

  function skipRest() {
    if (restRef.current) clearInterval(restRef.current);
    setRestActive(false);
    setRestSeconds(0);
  }

  // ── Set updates ───────────────────────────────────────────────────────────────

  function updateSet(blockIdx: number, setIdx: number, field: 'reps' | 'weight', value: string) {
    setBlocks(prev => prev.map((b, bi) =>
      bi !== blockIdx ? b : {
        ...b,
        sets: b.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }),
      }
    ));
  }

  function toggleDone(blockIdx: number, setIdx: number) {
    setBlocks(prev => {
      const next = prev.map((b, bi) =>
        bi !== blockIdx ? b : {
          ...b,
          sets: b.sets.map((s, si) => si !== setIdx ? s : { ...s, done: !s.done }),
        }
      );
      // Start rest timer when marking a set as done
      const wasNotDone = !prev[blockIdx].sets[setIdx].done;
      if (wasNotDone) startRest();
      return next;
    });
  }

  function addSet(blockIdx: number) {
    setBlocks(prev => prev.map((b, bi) =>
      bi !== blockIdx ? b : {
        ...b,
        sets: [...b.sets, { reps: b.sets[0]?.reps ?? '10', weight: '', done: false }],
      }
    ));
  }

  // ── Finish & save ─────────────────────────────────────────────────────────────

  const totalDone = blocks.reduce((s, b) => s + b.sets.filter(st => st.done).length, 0);
  const totalSets = blocks.reduce((s, b) => s + b.sets.length, 0);

  async function finishWorkout() {
    setSaving(true);
    setShowFinishModal(false);
    if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    if (restRef.current)      clearInterval(restRef.current);

    try {
      const sets: { exercise_id: string; set_number: number; reps: number | null; weight_kg: number | null }[] = [];
      for (const block of blocks) {
        block.sets.forEach((s, idx) => {
          const reps   = parseInt(s.reps, 10);
          const weight = parseFloat(s.weight);
          sets.push({
            exercise_id: block.exercise.id,
            set_number:  idx + 1,
            reps:        isNaN(reps)   ? null : reps,
            weight_kg:   isNaN(weight) ? null : weight,
          });
        });
      }

      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan_id:          plan?.id ?? null,
          duration_minutes: Math.round(elapsedRef.current / 60),
          sets,
        }),
      });
      setFinished(true);
    } catch {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.primaryContainer} size="large" /></View>;
  }

  if (finished) {
    return (
      <View style={[s.center, { gap: 16, paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: 56 }}>🏆</Text>
        <Text style={s.doneTitle}>WORKOUT{'\n'}COMPLETE</Text>
        <Text style={s.doneSub}>
          {totalDone} sets · {formatTime(elapsedRef.current)}
        </Text>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(app)/progress')}>
          <Text style={s.doneBtnText}>VIEW PROGRESS →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.doneBtnSec} onPress={() => router.replace('/(app)/dashboard')}>
          <Text style={s.doneBtnSecText}>BACK TO DASHBOARD</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.stopwatch}>{formatTime(elapsed)}</Text>
          <Text style={s.planName}>{plan?.name?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          style={s.finishBtn}
          onPress={() => setShowFinishModal(true)}
          disabled={saving}
        >
          <Text style={s.finishBtnText}>FINISH</Text>
        </TouchableOpacity>
      </View>

      {/* Rest timer banner */}
      {restActive && (
        <View style={s.restBanner}>
          <View style={s.restBannerLeft}>
            <Text style={s.restLabel}>REST</Text>
            <Text style={s.restTime}>{formatTime(restSeconds)}</Text>
          </View>
          <View style={s.restActions}>
            <TouchableOpacity
              style={s.restConfigBtn}
              onPress={() => setShowRestConfig(true)}
            >
              <Text style={s.restConfigBtnText}>⚙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipRestBtn} onPress={skipRest}>
              <Text style={s.skipRestBtnText}>SKIP →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View style={s.progressBarBg}>
        <View style={[s.progressBarFill, { width: `${totalSets > 0 ? (totalDone / totalSets) * 100 : 0}%` as any }]} />
      </View>
      <Text style={s.progressText}>{totalDone} / {totalSets} sets done</Text>

      {/* Exercise blocks */}
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {blocks.map((block, bi) => (
          <View key={block.exercise.id} style={s.block}>
            {/* Exercise header */}
            <View style={s.blockHeader}>
              <View style={s.blockInfo}>
                <Text style={s.blockName}>{block.exercise.name}</Text>
                <Text style={s.blockMeta}>
                  {block.exercise.muscle_groups?.name?.toUpperCase()} · {block.exercise.equipment}
                </Text>
              </View>
            </View>

            {/* Column headers */}
            <View style={s.colHeader}>
              <View style={s.setNumCol} />
              <Text style={s.colLbl}>REPS</Text>
              <Text style={s.colLbl}>WEIGHT (KG)</Text>
              <View style={s.checkCol} />
            </View>

            {/* Sets */}
            {block.sets.map((set, si) => (
              <View key={si} style={[s.setRow, set.done && s.setRowDone]}>
                <View style={s.setNumCol}>
                  <Text style={[s.setNum, set.done && s.setNumDone]}>{si + 1}</Text>
                </View>
                <TextInput
                  style={[s.setInput, set.done && s.setInputDone]}
                  value={set.reps}
                  onChangeText={v => updateSet(bi, si, 'reps', v)}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={colors.outlineVariant}
                  selectTextOnFocus
                  editable={!set.done}
                />
                <TextInput
                  style={[s.setInput, set.done && s.setInputDone]}
                  value={set.weight}
                  onChangeText={v => updateSet(bi, si, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.outlineVariant}
                  selectTextOnFocus
                  editable={!set.done}
                />
                <TouchableOpacity
                  style={[s.checkBtn, set.done && s.checkBtnDone]}
                  onPress={() => toggleDone(bi, si)}
                >
                  <Text style={[s.checkBtnText, set.done && s.checkBtnTextDone]}>
                    {set.done ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add set */}
            <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(bi)}>
              <Text style={s.addSetBtnText}>+ ADD SET</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Finish confirm modal */}
      <Modal visible={showFinishModal} transparent animationType="fade" onRequestClose={() => setShowFinishModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>FINISH WORKOUT?</Text>
            <Text style={s.modalBody}>
              {totalDone} of {totalSets} sets completed · {formatTime(elapsed)}
            </Text>
            <TouchableOpacity style={s.modalConfirmBtn} onPress={finishWorkout}>
              {saving
                ? <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
                : <Text style={s.modalConfirmTxt}>SAVE & FINISH</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowFinishModal(false)}>
              <Text style={s.modalCancelTxt}>KEEP GOING</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rest duration config modal */}
      <Modal visible={showRestConfig} transparent animationType="fade" onRequestClose={() => setShowRestConfig(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>REST DURATION</Text>
            <View style={s.restOptions}>
              {[30, 60, 90, 120, 180].map(sec => (
                <TouchableOpacity
                  key={sec}
                  style={[s.restOption, restDuration === sec && s.restOptionActive]}
                  onPress={() => { setRestDuration(sec); setShowRestConfig(false); }}
                >
                  <Text style={[s.restOptionText, restDuration === sec && s.restOptionTextActive]}>
                    {sec < 60 ? `${sec}s` : `${sec / 60}m${sec % 60 > 0 ? `${sec % 60}s` : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowRestConfig(false)}>
              <Text style={s.modalCancelTxt}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '44',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: colors.onSurfaceVariant },
  topCenter:   { alignItems: 'center', gap: 2 },
  stopwatch:   { fontSize: 28, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1 },
  planName:    { fontSize: 8, color: colors.onSurfaceVariant, letterSpacing: 2 },
  finishBtn:   { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 8 },
  finishBtnText: { fontSize: 10, fontWeight: '900', color: colors.onPrimaryContainer, letterSpacing: 1 },

  // Rest banner
  restBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.primaryContainer + '33',
  },
  restBannerLeft: { gap: 2 },
  restLabel:  { fontSize: 8, fontWeight: '800', color: colors.primaryContainer, letterSpacing: 2 },
  restTime:   { fontSize: 24, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  restActions:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restConfigBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  restConfigBtnText: { fontSize: 18, color: colors.onSurfaceVariant },
  skipRestBtn:    { backgroundColor: colors.surfaceContainerHighest, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  skipRestBtnText: { fontSize: 9, fontWeight: '800', color: colors.onSurface, letterSpacing: 1 },

  // Progress bar
  progressBarBg:   { height: 3, backgroundColor: colors.surfaceContainerHigh, marginHorizontal: 0 },
  progressBarFill: { height: 3, backgroundColor: colors.primaryContainer, borderRadius: 2 },
  progressText:    { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 1.5, textAlign: 'center', paddingVertical: 8, fontWeight: '700' },

  // Scroll
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },

  // Exercise block
  block:       { backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 16, gap: 8 },
  blockHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  blockInfo:   { flex: 1 },
  blockName:   { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  blockMeta:   { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 0.5, marginTop: 2 },

  // Column headers
  colHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, marginBottom: 4 },
  setNumCol:  { width: 28 },
  colLbl:     { flex: 1, fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1.5, textAlign: 'center' },
  checkCol:   { width: 40 },

  // Set row
  setRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setRowDone: { opacity: 0.5 },
  setNum:     { fontSize: 10, fontWeight: '800', color: colors.onSurfaceVariant, textAlign: 'center' },
  setNumDone: { color: colors.primaryContainer },
  setInput: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 10,
    color: colors.onSurface, fontSize: 15, fontWeight: '700',
    textAlign: 'center', borderWidth: 1, borderColor: colors.outlineVariant,
  } as any,
  setInputDone: { borderColor: colors.primaryContainer + '44', backgroundColor: colors.surfaceContainerHighest },
  checkBtn:     { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  checkBtnText: { fontSize: 14, color: colors.outlineVariant },
  checkBtnTextDone: { color: colors.onPrimaryContainer, fontWeight: '800' },

  // Add set
  addSetBtn:     { backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addSetBtnText: { fontSize: 9, fontWeight: '800', color: colors.primaryContainer, letterSpacing: 1.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox:     { backgroundColor: colors.surfaceContainerHigh, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, gap: 8 },
  modalTitle:   { fontSize: 20, fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalBody:    { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 8 },
  modalConfirmBtn:  { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  modalConfirmTxt:  { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  modalCancelBtn:   { paddingVertical: 14, alignItems: 'center' },
  modalCancelTxt:   { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 12, letterSpacing: 1 },

  // Rest options
  restOptions:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  restOption:     { flex: 1, minWidth: 60, backgroundColor: colors.surfaceContainerHighest, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  restOptionActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  restOptionText: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant },
  restOptionTextActive: { color: colors.onPrimaryContainer },

  // Done screen
  doneTitle:    { fontSize: 48, fontWeight: '900', color: colors.onSurface, letterSpacing: -2, textAlign: 'center', lineHeight: 50 },
  doneSub:      { fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
  doneBtn:      { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 32, paddingVertical: 16, marginTop: 16 },
  doneBtnText:  { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  doneBtnSec:   { paddingVertical: 12 },
  doneBtnSecText: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
});
