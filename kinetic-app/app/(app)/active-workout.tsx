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
import { fs } from '../../theme/scale';

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
  plan_id: string;
  day_of_week: string;
  exercises: PlanExercise;
}

interface SessionSet {
  reps: number | null;
  weight_kg: number | null;
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

// ── Module-level workout session persistence (survives tab navigation) ─────────
// All vars survive component unmount/remount when switching tabs
let _workoutStartMs: number | null = null;
let _loadedKey: string | null = null;
let _savedBlocks: ExerciseBlock[] | null = null;
let _savedLastWeights: Record<string, { weight: number; reps: number }> = {};
let _savedPlan: Plan | null = null;
let _savedRestDuration = 90;
let _savedUnits: 'metric' | 'imperial' = 'metric';

// Unit conversion helpers
const KG_TO_LBS = 2.20462;
function toDisplayWeight(kg: number, units: 'metric' | 'imperial'): number {
  return units === 'imperial' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg;
}
function toStorageKg(val: number, units: 'metric' | 'imperial'): number {
  return units === 'imperial' ? Math.round((val / KG_TO_LBS) * 100) / 100 : val;
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
  const [isRestDay, setIsRestDay] = useState(false);
  const [units, setUnits]         = useState<'metric' | 'imperial'>(_savedUnits);
  // Last session weights: exerciseId → { weight, reps } (always in kg)
  const [lastWeights, setLastWeights] = useState<Record<string, { weight: number; reps: number }>>({});
  // Summary data captured at finish time
  const [summary, setSummary] = useState<{
    totalVolume: number;
    totalDone: number;
    elapsed: number;
    prs: string[];
    exercises: { name: string; sets: string }[];
  } | null>(null);

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
    const key = `${params.planId ?? 'none'}-${params.day ?? 'today'}`;
    if (_loadedKey !== key) {
      // New workout — reset everything and load fresh
      _workoutStartMs = Date.now();
      _loadedKey = key;
      _savedBlocks = null;
      elapsedRef.current = 0;
      setElapsed(0);
      load();
    } else if (_savedBlocks) {
      // Returning from another tab — restore persisted state, no re-fetch needed
      setBlocks(_savedBlocks);
      setLastWeights(_savedLastWeights);
      setPlan(_savedPlan);
      setRestDuration(_savedRestDuration);
      setUnits(_savedUnits);
      elapsedRef.current = Math.floor((Date.now() - (_workoutStartMs ?? Date.now())) / 1000);
      setElapsed(elapsedRef.current);
      setLoading(false);
    } else {
      // Key matches but no saved blocks yet (edge case) — reload
      load();
    }
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
      if (sessions.length === 0) {
        setPlan(target);
        setIsRestDay(true);
        setLoading(false);
        return;
      }
      const useSessions = sessions;

      // Fetch actual configured sets for each session in parallel
      const sessionSetsMap: Record<string, SessionSet[]> = {};
      await Promise.all(
        useSessions.map(async s => {
          // Use target.id — s.plan_id may not be in API response
          const res = await fetch(
            `${API_URL}/plans/${target.id}/sessions/${s.id}/sets`,
            { headers }
          );
          sessionSetsMap[s.id] = res.ok ? await res.json() : [];
        })
      );

      // Deduplicate exercises, using actual configured sets
      const seen = new Set<string>();
      const exerciseBlocks: ExerciseBlock[] = [];
      for (const s of useSessions) {
        if (!seen.has(s.exercises.id)) {
          seen.add(s.exercises.id);
          const configuredSets = sessionSetsMap[s.id] ?? [];
          const fallbackCount = s.exercises.sets_suggestion ?? 3;
          const fallbackReps = s.exercises.reps_suggestion?.split('-')[0] ?? '10';
          const sets: WorkoutSet[] = configuredSets.length > 0
            ? configuredSets.map(cs => ({
                reps: cs.reps != null ? String(cs.reps) : fallbackReps,
                weight: cs.weight_kg != null && cs.weight_kg > 0 ? String(cs.weight_kg) : '',
                done: false,
              }))
            : Array.from({ length: fallbackCount }, () => ({ reps: fallbackReps, weight: '', done: false }));
          exerciseBlocks.push({ exercise: s.exercises, sets });
        }
      }

      _savedPlan = target;
      _savedBlocks = exerciseBlocks;
      setPlan(target);
      setBlocks(exerciseBlocks);

      // Fetch profile for default rest timer and units
      const profileRes = await fetch(`${API_URL}/profile`, { headers });
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p.default_rest_timer) {
          _savedRestDuration = p.default_rest_timer;
          setRestDuration(p.default_rest_timer);
        }
        if (p.units === 'imperial' || p.units === 'metric') {
          _savedUnits = p.units;
          setUnits(p.units);
        }
      }

      // Fetch last session weights for reference
      const logsRes = await fetch(`${API_URL}/logs`, { headers });
      if (logsRes.ok) {
        const logs: any[] = await logsRes.json();
        const last: Record<string, { weight: number; reps: number }> = {};
        for (const log of logs) {
          for (const set of log.log_sets ?? []) {
            if (!last[set.exercise_id] && set.weight_kg) {
              last[set.exercise_id] = { weight: set.weight_kg, reps: set.reps ?? 0 };
            }
          }
        }
        _savedLastWeights = last;
        setLastWeights(last);
      }
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

  // Keep module-level blocks in sync so navigation away/back restores progress
  useEffect(() => {
    if (blocks.length > 0) _savedBlocks = blocks;
  }, [blocks]);

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

    // Capture summary before resetting state
    const doneSets = blocks.flatMap(b => b.sets.filter(s => s.done));
    const totalVolumeKg = blocks.reduce((sum, b) =>
      sum + b.sets.filter(s => s.done).reduce((s2, set) => {
        const w = toStorageKg(parseFloat(set.weight) || 0, units);
        const r = parseInt(set.reps, 10) || 0;
        return s2 + w * r;
      }, 0), 0);
    const prNames: string[] = [];
    for (const b of blocks) {
      const prev = lastWeights[b.exercise.id];
      if (prev) {
        const maxInputWeight = Math.max(0, ...b.sets.filter(s => s.done && parseFloat(s.weight) > 0).map(s => parseFloat(s.weight) || 0));
        const maxKg = toStorageKg(maxInputWeight, units);
        if (maxKg > prev.weight) prNames.push(b.exercise.name);
      }
    }
    const exerciseSummary = blocks
      .filter(b => b.sets.some(s => s.done))
      .map(b => {
        const doneSetsForEx = b.sets.filter(s => s.done);
        const topWeight = Math.max(0, ...doneSetsForEx.map(s => parseFloat(s.weight) || 0));
        const avgReps = doneSetsForEx.length > 0
          ? Math.round(doneSetsForEx.reduce((s, st) => s + (parseInt(st.reps, 10) || 0), 0) / doneSetsForEx.length)
          : 0;
        const weightLabel = topWeight > 0 ? `${topWeight}${units === 'imperial' ? 'lbs' : 'kg'}` : '';
        return {
          name: b.exercise.name,
          sets: weightLabel
            ? `${doneSetsForEx.length}×${avgReps} @ ${weightLabel}`
            : `${doneSetsForEx.length} sets`,
        };
      });
    setSummary({
      totalVolume: Math.round(totalVolumeKg),
      totalDone: doneSets.length,
      elapsed: elapsedRef.current,
      prs: prNames,
      exercises: exerciseSummary,
    });

    try {
      const sets: { exercise_id: string; set_number: number; reps: number | null; weight_kg: number | null }[] = [];
      for (const block of blocks) {
        block.sets.forEach((s, idx) => {
          const reps   = parseInt(s.reps, 10);
          const weightInput = parseFloat(s.weight);
          const weightKg = isNaN(weightInput) ? null : toStorageKg(weightInput, units);
          sets.push({
            exercise_id: block.exercise.id,
            set_number:  idx + 1,
            reps:        isNaN(reps) ? null : reps,
            weight_kg:   weightKg,
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
      // Reset session so next START WORKOUT loads fresh
      _workoutStartMs = null;
      _loadedKey = null;
      setFinished(true);
    } catch {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.primaryContainer} size="large" /></View>;
  }

  if (isRestDay) {
    const todayDay = getTodayDay();
    return (
      <View style={[s.center, { gap: 16, paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: fs(48) }}>😴</Text>
        <Text style={[s.doneTitle, { textAlign: 'center', fontSize: fs(32) }]}>REST DAY</Text>
        <Text style={{ fontSize: fs(13), color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 }}>
          {todayDay} is not scheduled in your plan.{'\n'}Recovery is part of performance.
        </Text>
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 8 }]}
          onPress={() => router.push('/(app)/workout-builder' as any)}
        >
          <Text style={s.doneBtnText}>ADD EXERCISES TO TODAY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.doneBtnSec} onPress={() => router.back()}>
          <Text style={s.doneBtnSecText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finished && summary) {
    const fmtVol = summary.totalVolume >= 1000
      ? `${(summary.totalVolume / 1000).toFixed(1)}k`
      : `${summary.totalVolume}`;
    return (
      <ScrollView contentContainerStyle={s.doneScroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.doneHeader}>
          <Text style={{ fontSize: fs(48) }}>🏆</Text>
          <Text style={s.doneTitle}>WORKOUT{'\n'}COMPLETE</Text>
          <Text style={s.doneSub}>{formatTime(summary.elapsed)}</Text>
        </View>

        {/* Stats row */}
        <View style={s.doneSummaryRow}>
          <View style={s.doneStat}>
            <Text style={s.doneStatNum}>{summary.totalDone}</Text>
            <Text style={s.doneStatLabel}>SETS DONE</Text>
          </View>
          <View style={s.doneStatDiv} />
          <View style={s.doneStat}>
            <Text style={s.doneStatNum}>{fmtVol}</Text>
            <Text style={s.doneStatLabel}>KG VOLUME</Text>
          </View>
          {summary.prs.length > 0 && (
            <>
              <View style={s.doneStatDiv} />
              <View style={s.doneStat}>
                <Text style={s.doneStatNum}>{summary.prs.length}</Text>
                <Text style={s.doneStatLabel}>NEW PR{summary.prs.length > 1 ? 'S' : ''}</Text>
              </View>
            </>
          )}
        </View>

        {/* PRs callout */}
        {summary.prs.length > 0 && (
          <View style={s.prCallout}>
            <Text style={s.prCalloutTitle}>🎯 NEW PERSONAL RECORDS</Text>
            {summary.prs.map(name => (
              <Text key={name} style={s.prCalloutItem}>· {name}</Text>
            ))}
          </View>
        )}

        {/* Exercise breakdown */}
        <Text style={s.doneBreakdownLabel}>EXERCISES</Text>
        <View style={s.doneBreakdownCard}>
          {summary.exercises.map((ex, i) => (
            <View key={i} style={[s.doneExRow, i > 0 && s.doneExRowBorder]}>
              <Text style={s.doneExName}>{ex.name}</Text>
              <Text style={s.doneExSets}>{ex.sets}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(app)/progress')}>
          <Text style={s.doneBtnText}>VIEW PROGRESS →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.doneBtnSec} onPress={() => router.replace('/(app)/dashboard')}>
          <Text style={s.doneBtnSecText}>BACK TO DASHBOARD</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
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

            {/* Last session reference */}
            {lastWeights[block.exercise.id] && (
              <Text style={s.lastRef}>
                Last time: {toDisplayWeight(lastWeights[block.exercise.id].weight, units)}{units === 'imperial' ? 'lbs' : 'kg'} × {lastWeights[block.exercise.id].reps} reps
              </Text>
            )}

            {/* Column headers */}
            <View style={s.colHeader}>
              <View style={s.setNumCol} />
              <Text style={s.colLbl}>REPS</Text>
              <Text style={s.colLbl}>WEIGHT ({units === 'imperial' ? 'LBS' : 'KG'})</Text>
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
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '44',
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: fs(18), color: colors.onSurfaceVariant },
  topCenter:   { alignItems: 'center', gap: 2 },
  stopwatch:   { fontSize: fs(28), fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1 },
  planName:    { fontSize: fs(8), color: colors.onSurfaceVariant, letterSpacing: 2 },
  finishBtn:   { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 10 },
  finishBtnText: { fontSize: fs(10), fontWeight: '900', color: colors.onPrimaryContainer, letterSpacing: 1 },

  // Rest banner
  restBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 22, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.primaryContainer + '33',
  },
  restBannerLeft: { gap: 2 },
  restLabel:  { fontSize: fs(8), fontWeight: '800', color: colors.primaryContainer, letterSpacing: 2 },
  restTime:   { fontSize: fs(24), fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  restActions:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restConfigBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  restConfigBtnText: { fontSize: fs(18), color: colors.onSurfaceVariant },
  skipRestBtn:    { backgroundColor: colors.surfaceContainerHighest, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10 },
  skipRestBtnText: { fontSize: fs(9), fontWeight: '800', color: colors.onSurface, letterSpacing: 1 },

  // Progress bar
  progressBarBg:   { height: 3, backgroundColor: colors.surfaceContainerHigh, marginHorizontal: 0 },
  progressBarFill: { height: 3, backgroundColor: colors.primaryContainer, borderRadius: 2 },
  progressText:    { fontSize: fs(9), color: colors.onSurfaceVariant, letterSpacing: 1.5, textAlign: 'center', paddingVertical: 10, fontWeight: '700' },

  // Scroll
  scrollContent: { paddingHorizontal: 18, paddingTop: 10, gap: 18 },

  // Exercise block
  block:       { backgroundColor: colors.surfaceContainer, borderRadius: 18, padding: 18, gap: 10 },
  blockHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  blockInfo:   { flex: 1 },
  blockName:   { fontSize: fs(16), fontWeight: '800', color: colors.onSurface },
  blockMeta:   { fontSize: fs(9), color: colors.onSurfaceVariant, letterSpacing: 0.5, marginTop: 2 },
  lastRef:     { fontSize: fs(10), color: colors.primaryContainer + 'cc', fontWeight: '700', marginBottom: 8, letterSpacing: 0.3 },

  // Column headers
  colHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, marginBottom: 4 },
  setNumCol:  { width: 32 },
  colLbl:     { flex: 1, fontSize: fs(8), fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1.5, textAlign: 'center' },
  checkCol:   { width: 44 },

  // Set row
  setRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setRowDone: { opacity: 0.5 },
  setNum:     { fontSize: fs(10), fontWeight: '800', color: colors.onSurfaceVariant, textAlign: 'center' },
  setNumDone: { color: colors.primaryContainer },
  setInput: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 12,
    color: colors.onSurface, fontSize: fs(15), fontWeight: '700',
    textAlign: 'center', borderWidth: 1, borderColor: colors.outlineVariant,
  } as any,
  setInputDone: { borderColor: colors.primaryContainer + '44', backgroundColor: colors.surfaceContainerHighest },
  checkBtn:     { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  checkBtnText: { fontSize: fs(14), color: colors.outlineVariant },
  checkBtnTextDone: { color: colors.onPrimaryContainer, fontWeight: '800' },

  // Add set
  addSetBtn:     { backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addSetBtnText: { fontSize: fs(9), fontWeight: '800', color: colors.primaryContainer, letterSpacing: 1.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox:     { backgroundColor: colors.surfaceContainerHigh, borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, gap: 10 },
  modalTitle:   { fontSize: fs(20), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalBody:    { fontSize: fs(13), color: colors.onSurfaceVariant, marginBottom: 8 },
  modalConfirmBtn:  { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  modalConfirmTxt:  { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },
  modalCancelBtn:   { paddingVertical: 16, alignItems: 'center' },
  modalCancelTxt:   { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: fs(12), letterSpacing: 1 },

  // Rest options
  restOptions:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  restOption:     { flex: 1, minWidth: 60, backgroundColor: colors.surfaceContainerHighest, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  restOptionActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  restOptionText: { fontSize: fs(12), fontWeight: '700', color: colors.onSurfaceVariant },
  restOptionTextActive: { color: colors.onPrimaryContainer },

  // Done screen
  doneScroll:   { paddingHorizontal: 28, paddingTop: 52, alignItems: 'center' },
  doneHeader:   { alignItems: 'center', gap: 10, marginBottom: 36 },
  doneTitle:    { fontSize: fs(40), fontWeight: '900', color: colors.onSurface, letterSpacing: -2, textAlign: 'center', lineHeight: 48 },
  doneSub:      { fontSize: fs(22), fontWeight: '900', color: colors.primaryContainer, letterSpacing: -0.5 },
  doneSummaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainer, borderRadius: 20, padding: 22, width: '100%', marginBottom: 18 },
  doneStat:     { flex: 1, alignItems: 'center', gap: 6 },
  doneStatNum:  { fontSize: fs(28), fontWeight: '900', color: colors.primaryContainer },
  doneStatLabel:{ fontSize: fs(8), fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1.5 },
  doneStatDiv:  { width: 1, height: 44, backgroundColor: colors.outlineVariant + '44' },
  prCallout:    { backgroundColor: colors.primaryContainer + '18', borderRadius: 16, padding: 18, width: '100%', marginBottom: 18, gap: 8, borderWidth: 1, borderColor: colors.primaryContainer + '44' },
  prCalloutTitle:{ fontSize: fs(11), fontWeight: '900', color: colors.primaryContainer, letterSpacing: 1 },
  prCalloutItem: { fontSize: fs(13), fontWeight: '700', color: colors.onSurface },
  doneBreakdownLabel: { fontSize: fs(9), fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 3, alignSelf: 'flex-start', marginBottom: 12 },
  doneBreakdownCard: { backgroundColor: colors.surfaceContainer, borderRadius: 16, width: '100%', marginBottom: 28, overflow: 'hidden' },
  doneExRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16 },
  doneExRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant + '33' },
  doneExName:   { fontSize: fs(13), fontWeight: '700', color: colors.onSurface, flex: 1 },
  doneExSets:   { fontSize: fs(12), fontWeight: '800', color: colors.primaryContainer },
  doneBtn:      { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 32, paddingVertical: 18, marginTop: 8, width: '100%', alignItems: 'center' },
  doneBtnText:  { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },
  doneBtnSec:   { paddingVertical: 14 },
  doneBtnSecText: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: fs(12), letterSpacing: 1 },
});
