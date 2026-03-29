import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { fs } from '../../theme/scale';

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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const max = Math.max(...weeks.map(w => w.volume), 1);
  const fmtKg = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k kg` : `${Math.round(v)} kg`;
  return (
    <View>
      {/* Tooltip */}
      {selectedIdx !== null && weeks[selectedIdx].volume > 0 && (
        <View style={vc.tooltip}>
          <Text style={vc.tooltipLabel}>{weeks[selectedIdx].label}</Text>
          <Text style={vc.tooltipValue}>{fmtKg(weeks[selectedIdx].volume)}</Text>
        </View>
      )}
      <View style={vc.row}>
        {weeks.map((w, i) => {
          const barH = w.volume > 0 ? Math.max((w.volume / max) * CHART_H, 8) : 4;
          const isNow = i === weeks.length - 1;
          const isEmpty = w.volume === 0;
          const isSelected = selectedIdx === i;
          return (
            <TouchableOpacity
              key={i}
              style={vc.col}
              onPress={() => setSelectedIdx(isSelected ? null : i)}
              activeOpacity={0.7}
              disabled={isEmpty}
            >
              {w.volume > 0 && (
                <Text style={[vc.barVal, isNow && vc.barValNow]}>{w.volume >= 1000 ? `${(w.volume/1000).toFixed(1)}k` : `${Math.round(w.volume)}`}</Text>
              )}
              <View style={[vc.barBg, { height: CHART_H }]}>
                <View style={[
                  vc.barFill,
                  { height: barH },
                  isNow ? vc.barNow : vc.barPast,
                  isEmpty && vc.barEmpty,
                  isSelected && vc.barSelected,
                ]} />
              </View>
              <Text style={[vc.lbl, isNow && vc.lblNow, isSelected && vc.lblSelected]}>{w.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Zero baseline */}
      <View style={vc.baseline} />
      <Text style={vc.yAxisNote}>tap a bar for details · kg volume per week</Text>
    </View>
  );
}

const vc = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col:       { flex: 1, alignItems: 'center', gap: 4 },
  barBg:     { width: '100%', backgroundColor: colors.surfaceContainerHigh, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:   { width: '100%', borderRadius: 6 },
  barNow:    { backgroundColor: colors.primaryContainer },
  barPast:   { backgroundColor: colors.surfaceContainerHighest },
  barEmpty:  { backgroundColor: colors.surfaceContainerHigh, opacity: 0.5 },
  barVal:    { fontSize: fs(6), fontWeight: '800', color: colors.onSurfaceVariant },
  barValNow: { color: colors.primaryContainer },
  lbl:       { fontSize: fs(7), color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 0.5 },
  lblNow:    { color: colors.primaryContainer },
  baseline:  { height: 1, backgroundColor: colors.outlineVariant + '55', marginTop: 2 },
  yAxisNote: { fontSize: fs(7), color: colors.onSurfaceVariant, marginTop: 6, textAlign: 'right' },
  barSelected: { backgroundColor: colors.tertiary },
  lblSelected: { color: colors.tertiary, fontWeight: '900' },
  tooltip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'center', marginBottom: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primaryContainer + '55',
  },
  tooltipLabel: { fontSize: fs(9), color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1 },
  tooltipValue: { fontSize: fs(16), fontWeight: '900', color: colors.primaryContainer },
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
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateStr = localDateStr(date);
  if (dateStr === localDateStr(today)) return 'Today';
  if (dateStr === localDateStr(yesterday)) return 'Yesterday';
  const diffDays = Math.round((today.setHours(0,0,0,0) - date.setHours(0,0,0,0)) / 86400000);
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ── 1RM + Strength Progress Chart ─────────────────────────────────────────────

// Epley formula: weight × (1 + reps/30)
function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

interface ExerciseProgress {
  name: string;
  points: { date: string; maxWeight: number; orm: number }[];
}

function buildStrengthProgress(logs: WorkoutLog[]): ExerciseProgress[] {
  // Group by exercise, collect max 1RM per session date
  const map: Record<string, { name: string; byDate: Record<string, { maxWeight: number; orm: number }> }> = {};
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  for (const log of sorted) {
    for (const s of log.log_sets ?? []) {
      if (!s.weight_kg || s.weight_kg === 0) continue;
      const name = s.exercises?.name ?? 'Unknown';
      const date = log.logged_at.slice(0, 10);
      const orm = estimate1RM(s.weight_kg, s.reps ?? 1);
      if (!map[s.exercise_id]) map[s.exercise_id] = { name, byDate: {} };
      const existing = map[s.exercise_id].byDate[date];
      if (!existing || orm > existing.orm) {
        map[s.exercise_id].byDate[date] = { maxWeight: s.weight_kg, orm };
      }
    }
  }
  return Object.values(map)
    .map(ex => ({
      name: ex.name,
      points: Object.entries(ex.byDate).map(([date, v]) => ({ date, maxWeight: v.maxWeight, orm: v.orm })),
    }))
    .filter(ex => ex.points.length >= 2)
    .slice(0, 5);
}

const CHART_W = 260;
const SCHART_H = 56;

function StrengthChart({ points }: { points: { date: string; maxWeight: number; orm: number }[] }) {
  const max = Math.max(...points.map(p => p.orm));
  const min = Math.min(...points.map(p => p.orm));
  const range = max - min || 1;
  const step  = CHART_W / (points.length - 1);

  const pts = points.map((p, i) => ({
    x: i * step,
    y: SCHART_H - ((p.orm - min) / range) * SCHART_H,
    orm: p.orm,
    maxWeight: p.maxWeight,
  }));

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <View>
      <View style={{ height: SCHART_H, position: 'relative' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(f => (
          <View key={f} style={{
            position: 'absolute', left: 0, right: 0,
            top: f * SCHART_H,
            height: 1, backgroundColor: colors.outlineVariant + '33',
          }} />
        ))}
        {/* Dots and connecting lines */}
        {pts.map((pt, i) => (
          <View key={i}>
            {/* Connecting line to next point */}
            {i < pts.length - 1 && (() => {
              const next = pts[i + 1];
              const dx = next.x - pt.x;
              const dy = next.y - pt.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View style={{
                  position: 'absolute',
                  left: pt.x, top: pt.y,
                  width: len, height: 1.5,
                  backgroundColor: colors.primaryContainer + 'aa',
                  transformOrigin: '0 50%',
                  transform: [{ rotate: `${angle}deg` }],
                } as any} />
              );
            })()}
            {/* Dot */}
            <View style={{
              position: 'absolute',
              left: pt.x - 4, top: pt.y - 4,
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: i === pts.length - 1 ? colors.primaryContainer : colors.surfaceContainerHighest,
              borderWidth: 1.5, borderColor: colors.primaryContainer,
            }} />
          </View>
        ))}
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={sc.axisLbl}>
          {(() => { const d = new Date(pts[0] ? points[0].date : ''); return `${monthNames[d.getMonth()]} ${d.getDate()}`; })()}
        </Text>
        <Text style={[sc.axisLbl, { color: colors.primaryContainer }]}>
          {max}kg 1RM
        </Text>
        <Text style={sc.axisLbl}>
          {(() => { const d = new Date(points[points.length - 1].date); return `${monthNames[d.getMonth()]} ${d.getDate()}`; })()}
        </Text>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  axisLbl: { fontSize: fs(8), color: colors.onSurfaceVariant, fontWeight: '700' },
});

// ── Calendar ──────────────────────────────────────────────────────────────────

function TrainingCalendar({
  logs,
  onDayPress,
}: {
  logs: WorkoutLog[];
  onDayPress: (dateStr: string) => void;
}) {
  // Map date string → log for quick lookup
  const dateToLog: Record<string, WorkoutLog> = {};
  for (const l of logs) {
    const d = l.logged_at.slice(0, 10);
    if (!dateToLog[d]) dateToLog[d] = l;
  }
  const trainedDates = new Set(Object.keys(dateToLog));

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build grid: start week on Mon (shift Sun to end)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [...Array(startOffset).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <Text style={cal.monthLabel}>{monthNames[month].toUpperCase()} {year}</Text>
      {/* Day headers */}
      <View style={cal.row}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <Text key={i} style={cal.dayHeader}>{d}</Text>
        ))}
      </View>
      {/* Calendar grid */}
      {Array.from({ length: cells.length / 7 }, (_, wi) => (
        <View key={wi} style={cal.row}>
          {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
            if (!day) return <View key={di} style={cal.cell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const trained = trainedDates.has(dateStr);
            const isToday = dateStr === todayStr;
            const CellWrapper = trained ? TouchableOpacity : View;
            return (
              <CellWrapper
                key={di}
                style={[cal.cell, trained && cal.trainedCell, isToday && cal.todayCell]}
                onPress={trained ? () => onDayPress(dateStr) : undefined}
                activeOpacity={0.7}
              >
                <Text style={[cal.dayNum, trained && cal.trainedNum, isToday && cal.todayNum]}>
                  {day}
                </Text>
                {trained && <View style={cal.trainedDot} />}
              </CellWrapper>
            );
          })}
        </View>
      ))}
      <View style={cal.legend}>
        <View style={[cal.legendDot, { backgroundColor: colors.primaryContainer }]} />
        <Text style={cal.legendText}>Training day · tap to view</Text>
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  monthLabel: { fontSize: fs(11), fontWeight: '800', color: colors.onSurface, letterSpacing: 1, marginBottom: 12 },
  row:        { flexDirection: 'row', marginBottom: 4 },
  dayHeader:  { flex: 1, textAlign: 'center', fontSize: fs(8), fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1 },
  cell:       { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  trainedCell:{ backgroundColor: colors.primaryContainer + '28' },
  todayCell:  { borderWidth: 1.5, borderColor: colors.primaryContainer },
  dayNum:     { fontSize: fs(11), color: colors.onSurfaceVariant },
  trainedNum: { color: colors.primaryContainer, fontWeight: '800' },
  todayNum:   { color: colors.primaryContainer, fontWeight: '900' },
  trainedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primaryContainer, marginTop: 1 },
  legend:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fs(9), color: colors.onSurfaceVariant },
});

// ── Component ──────────────────────────────────────────────────────────────────

export default function Progress() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; body: string } | null>(null);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [calDayLog, setCalDayLog] = useState<WorkoutLog | null>(null);

  const weightUnit = units === 'imperial' ? 'lbs' : 'kg';
  const KG_TO_LBS = 2.20462;
  function toStorageKg(val: number): number {
    return units === 'imperial' ? Math.round((val / KG_TO_LBS) * 100) / 100 : val;
  }

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
      const [logsRes, plansRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/logs`, { headers }),
        fetch(`${API_URL}/plans`, { headers }),
        fetch(`${API_URL}/profile`, { headers }),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p.units === 'imperial' || p.units === 'metric') setUnits(p.units);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openModal() {
    // Use the same active plan the dashboard uses
    let savedId: string | null = null;
    try { savedId = localStorage.getItem('activePlanId'); } catch {}
    const activePlan = (savedId ? plans.find(p => p.id === savedId) : null) ?? plans[0] ?? null;

    if (!activePlan) {
      setInfoModal({ title: 'NO PLAN', body: 'Create a workout plan first in the Workout Builder.' });
      return;
    }

    const today = getTodayDay();
    const todaySessions = activePlan.plan_sessions.filter(s => s.day_of_week === today);

    if (todaySessions.length === 0) {
      setInfoModal({ title: 'REST DAY', body: `${today} is not scheduled in your plan. Use the Active Workout screen on a training day to log your session.` });
      return;
    }

    const sessions = todaySessions;

    // Deduplicate by exercise id (keep session reference for set fetching)
    const seen = new Set<string>();
    const exercises: PlanExercise[] = [];
    const sessionByExercise: Record<string, typeof sessions[0]> = {};
    for (const s of sessions) {
      if (s.exercises?.id && !seen.has(s.exercises.id)) {
        seen.add(s.exercises.id);
        exercises.push(s.exercises);
        sessionByExercise[s.exercises.id] = s;
      }
    }

    // Fetch actual configured sets from workout builder for each session
    const headers = await getAuthHeaders();
    const inputs: Record<string, { reps: string; weight: string }[]> = {};
    await Promise.all(exercises.map(async ex => {
      const session = sessionByExercise[ex.id];
      const res = await fetch(`${API_URL}/plans/${activePlan.id}/sessions/${session.id}/sets`, { headers });
      const configuredSets: { reps: number | null; weight_kg: number | null }[] = res.ok ? await res.json() : [];

      if (configuredSets.length > 0) {
        // Use the actual configured sets from the builder
        inputs[ex.id] = configuredSets.map(s => ({
          reps: s.reps != null ? String(s.reps) : ex.reps_suggestion?.split('-')[0]?.trim() ?? '',
          weight: '',
        }));
      } else {
        // Fall back to exercise suggestion if no sets configured
        const count = ex.sets_suggestion ?? 3;
        const defaultReps = ex.reps_suggestion?.split('-')[0]?.trim() ?? '';
        inputs[ex.id] = Array.from({ length: count }, () => ({ reps: defaultReps, weight: '' }));
      }
    }));

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
        const weightInput = parseFloat(s.weight);
        const weightKg = isNaN(weightInput) ? null : toStorageKg(weightInput);
        if (!isNaN(reps) || weightKg !== null) {
          sets.push({
            exercise_id: exerciseId,
            set_number: idx + 1,
            reps: isNaN(reps) ? null : reps,
            weight_kg: weightKg,
          });
        }
      });
    }

    if (sets.length === 0) {
      setInfoModal({ title: 'NO SETS', body: 'Enter at least one set before saving.' });
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
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteLog() {
    if (!deleteTargetId) return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/logs/${deleteTargetId}`, { method: 'DELETE', headers });
    if (res.ok) setLogs(prev => prev.filter(l => l.id !== deleteTargetId));
    setDeleteTargetId(null);
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
            <Text style={styles.statLabel}>ALL TIME</Text>
            <Text style={styles.statUnit}>workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{thisWeek}</Text>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statUnit}>workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {fmtVolume(totalVolume)}
            </Text>
            <Text style={styles.statLabel}>TOTAL VOLUME</Text>
            <Text style={styles.statUnit}>kg lifted</Text>
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

        {/* Training Calendar */}
        <Text style={styles.sectionLabel}>TRAINING CALENDAR</Text>
        <View style={styles.chartCard}>
          <TrainingCalendar
            logs={logs}
            onDayPress={dateStr => {
              const log = logs.find(l => l.logged_at.slice(0, 10) === dateStr) ?? null;
              setCalDayLog(log);
            }}
          />
        </View>

        {/* Strength Progress */}
        {(() => {
          const progress = buildStrengthProgress(logs);
          if (progress.length === 0) return null;
          return (
            <>
              <Text style={styles.sectionLabel}>STRENGTH PROGRESS</Text>
              {progress.map(ex => (
                <View key={ex.name} style={[styles.chartCard, { marginBottom: 12 }]}>
                  <Text style={styles.strengthExName}>{ex.name}</Text>
                  <Text style={styles.strengthExSub}>
                    EST. 1RM: {ex.points[0].orm}kg → {ex.points[ex.points.length - 1].orm}kg
                    {'  '}
                    {ex.points[ex.points.length - 1].orm > ex.points[0].orm
                      ? <Text style={{ color: colors.primaryContainer }}>
                          +{ex.points[ex.points.length - 1].orm - ex.points[0].orm}kg ↑
                        </Text>
                      : null}
                  </Text>
                  <View style={{ marginTop: 12 }}>
                    <StrengthChart points={ex.points} />
                  </View>
                </View>
              ))}
            </>
          );
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
                  <TouchableOpacity onPress={() => setDeleteTargetId(log.id)} style={styles.deleteBtn}>
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

      {/* Calendar Day Detail Modal */}
      <Modal
        visible={!!calDayLog}
        transparent
        animationType="slide"
        onRequestClose={() => setCalDayLog(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={styles.confirmTitle}>
                  {calDayLog ? new Date(calDayLog.logged_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
                </Text>
                {calDayLog?.workout_plans && (
                  <Text style={{ fontSize: fs(9), color: colors.primaryContainer, letterSpacing: 1.5, marginTop: 2 }}>
                    {calDayLog.workout_plans.name.toUpperCase()}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setCalDayLog(null)}>
                <Text style={{ fontSize: fs(20), color: colors.onSurfaceVariant }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {calDayLog && getExerciseSummary(calDayLog.log_sets ?? []).map((ex, i) => (
                <View key={i} style={[styles.logExRow, i > 0 && styles.logExRowBorder]}>
                  <View style={styles.logExLeft}>
                    <Text style={styles.logExName}>{ex.name}</Text>
                    {ex.muscle ? <Text style={styles.logExMuscle}>{ex.muscle}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.logExSets}>{ex.sets}×{ex.avgReps}</Text>
                    {ex.maxWeight > 0 && (
                      <Text style={{ fontSize: fs(10), color: colors.onSurfaceVariant }}>
                        {ex.maxWeight}{weightUnit} max
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              {calDayLog && (
                <View style={[styles.logCardFooter, { marginTop: 12 }]}>
                  <Text style={styles.logFooterStat}>{(calDayLog.log_sets ?? []).length} sets</Text>
                  {(() => {
                    const vol = (calDayLog.log_sets ?? []).reduce((s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0);
                    return vol > 0 ? <Text style={styles.logFooterStat}>{Math.round(vol)} kg total</Text> : null;
                  })()}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.confirmDeleteBtn, { marginTop: 16 }]} onPress={() => setCalDayLog(null)}>
              <Text style={styles.confirmDeleteTxt}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                      placeholder="Reps"
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
                    <Text style={styles.setKg}>{weightUnit}</Text>
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

      {/* Delete confirmation modal */}
      <Modal visible={!!deleteTargetId} transparent animationType="fade" onRequestClose={() => setDeleteTargetId(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>DELETE WORKOUT</Text>
            <Text style={styles.confirmBody}>Remove this log from your history? This cannot be undone.</Text>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDeleteLog}>
              <Text style={styles.confirmDeleteTxt}>YES, DELETE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDeleteTargetId(null)}>
              <Text style={styles.confirmCancelTxt}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save error modal */}
      <Modal visible={saveError} transparent animationType="fade" onRequestClose={() => setSaveError(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>SAVE FAILED</Text>
            <Text style={styles.confirmBody}>Could not save workout. Please try again.</Text>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => setSaveError(false)}>
              <Text style={styles.confirmDeleteTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info modal (no plan / no sets) */}
      <Modal visible={!!infoModal} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{infoModal?.title}</Text>
            <Text style={styles.confirmBody}>{infoModal?.body}</Text>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => setInfoModal(null)}>
              <Text style={styles.confirmDeleteTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28,
  },
  pageLabel: { fontSize: fs(9), color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 4 },
  pageTitle: { fontSize: fs(32), fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  logBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  logBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(10), letterSpacing: 1 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 32 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 18, alignItems: 'center', gap: 6,
  },
  statNum: { fontSize: fs(26), fontWeight: '900', color: colors.primaryContainer },
  statUnit: { fontSize: fs(8), fontWeight: '600', color: colors.onSurfaceVariant },
  statLabel: { fontSize: fs(8), color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 2 },

  // Section
  sectionLabel: {
    fontSize: fs(9), fontWeight: '800', color: colors.onSurfaceVariant,
    letterSpacing: 3, marginBottom: 12,
  },

  // Chart
  chartCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20, padding: 20, paddingTop: 22, marginBottom: 32,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 64, gap: 14 },
  emptyIcon: { fontSize: fs(36), color: colors.outlineVariant },
  emptyTitle: { fontSize: fs(16), fontWeight: '900', color: colors.onSurface },
  emptyText: {
    fontSize: fs(12), color: colors.onSurfaceVariant,
    textAlign: 'center', maxWidth: 280, lineHeight: 22,
  },

  // Log cards
  logCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20, padding: 18, marginBottom: 14,
  },
  logCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  logDate: { fontSize: fs(16), fontWeight: '800', color: colors.onSurface },
  logPlan: { fontSize: fs(9), color: colors.primaryContainer, letterSpacing: 1.5, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.onSurfaceVariant, fontSize: fs(14) },

  logExRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logExRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant + '33' },
  logExLeft: { flex: 1, gap: 4 },
  logExName: { fontSize: fs(13), fontWeight: '700', color: colors.onSurface },
  logExMuscle: { fontSize: fs(10), color: colors.onSurfaceVariant },
  logExSets: { fontSize: fs(13), fontWeight: '800', color: colors.tertiary },
  prBadge: { fontSize: fs(9), fontWeight: '800', color: colors.primaryContainer, letterSpacing: 0.5 },
  strengthExName: { fontSize: fs(13), fontWeight: '800', color: colors.onSurface, marginBottom: 2 },
  strengthExSub:  { fontSize: fs(10), color: colors.onSurfaceVariant },

  logCardFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 16,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant + '22',
    marginTop: 10, paddingTop: 10,
  },
  logFooterStat: { fontSize: fs(10), color: colors.onSurfaceVariant, fontWeight: '600' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  modalContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 28,
  },
  modalTitle: { fontSize: fs(22), fontWeight: '900', color: colors.onSurface },
  modalSub: { fontSize: fs(11), color: colors.onSurfaceVariant, marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalClose: { fontSize: fs(20), color: colors.onSurfaceVariant },

  modalExBlock: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 18, padding: 18, marginBottom: 18,
  },
  modalExHeader: { marginBottom: 14 },
  modalExName: { fontSize: fs(15), fontWeight: '800', color: colors.onSurface },
  modalExMuscle: { fontSize: fs(9), color: colors.primaryContainer, letterSpacing: 1.5, marginTop: 2 },

  setColHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  setColLabel: { flex: 1, fontSize: fs(9), color: colors.onSurfaceVariant, letterSpacing: 1, fontWeight: '700', textAlign: 'center' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  setNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  setNumText: { fontSize: fs(10), fontWeight: '800', color: colors.onSurfaceVariant },
  setInput: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    color: colors.onSurface, fontSize: fs(16), fontWeight: '700',
    textAlign: 'center', borderWidth: 1, borderColor: colors.outlineVariant,
  },
  setX: { fontSize: fs(16), color: colors.onSurfaceVariant, fontWeight: '700' },
  setKg: { fontSize: fs(11), color: colors.onSurfaceVariant, width: 24 },

  saveBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 20, alignItems: 'center', marginTop: 10,
  },
  saveBtnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  saveBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },

  // Confirm / error modals
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: { backgroundColor: colors.surfaceContainerHigh, borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, gap: 10 },
  confirmTitle: { fontSize: fs(18), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  confirmBody: { fontSize: fs(14), color: colors.onSurfaceVariant, lineHeight: 22, marginBottom: 8 },
  confirmDeleteBtn: { backgroundColor: colors.secondary, borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  confirmDeleteTxt: { color: '#fff', fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },
  confirmCancelBtn: { paddingVertical: 16, alignItems: 'center' },
  confirmCancelTxt: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: fs(12), letterSpacing: 1 },
});
