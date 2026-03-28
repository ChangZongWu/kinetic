import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LBLS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanSession {
  id: string;
  day_of_week: string;
  exercises: {
    name: string;
    sets_suggestion: number;
    reps_suggestion: string;
    equipment: string;
    muscle_groups: { name: string };
  };
}

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  plan_sessions: PlanSession[];
}

interface Profile {
  full_name?: string;
  goal?: string;
  email?: string;
}

interface LogSet {
  reps: number | null;
  weight_kg: number | null;
}

interface WorkoutLog {
  id: string;
  logged_at: string;
  log_sets: LogSet[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function getTodayDay(): string {
  const d = new Date().getDay();
  const map = [6, 0, 1, 2, 3, 4, 5];
  return DAYS[map[d]];
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreak(logs: WorkoutLog[]): number {
  const dateSet = new Set(logs.map(l => l.logged_at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If today has no log, start streak check from yesterday
  if (!dateSet.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dateSet.has(localDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeeklyVolumes(logs: WorkoutLog[]): number[] {
  // Returns array [Mon, Tue, Wed, Thu, Fri, Sat, Sun] volumes for the current week
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const diffToMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  monday.setHours(0, 0, 0, 0);

  const volumes = [0, 0, 0, 0, 0, 0, 0];
  for (const log of logs) {
    const d = new Date(log.logged_at);
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    if (d >= monday) {
      const vol = (log.log_sets ?? []).reduce(
        (s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0
      );
      volumes[dayIdx] += vol;
    }
  }
  return volumes;
}

// ── Weekly bar chart ───────────────────────────────────────────────────────────

const CHART_H = 72;

function WeeklyChart({ volumes, todayIdx }: { volumes: number[]; todayIdx: number }) {
  const max = Math.max(...volumes, 1);
  return (
    <View style={cs.row}>
      {volumes.map((vol, i) => {
        const barH = vol > 0 ? Math.max((vol / max) * CHART_H, 8) : 0;
        const isToday = i === todayIdx;
        return (
          <View key={i} style={cs.col}>
            <View style={[cs.barBg, { height: CHART_H }]}>
              {barH > 0 && (
                <View style={[
                  cs.barFill, { height: barH },
                  isToday ? cs.barActive : cs.barDim,
                ]} />
              )}
            </View>
            <Text style={[cs.lbl, isToday && cs.lblActive]}>{DAY_LBLS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const cs = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col:   { flex: 1, alignItems: 'center', gap: 6 },
  barBg: {
    width: '100%', backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill:  { width: '100%', borderRadius: 6 },
  barActive:{ backgroundColor: colors.primaryContainer },
  barDim:   { backgroundColor: colors.surfaceContainerHighest },
  lbl:      { fontSize: 7, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 0.5 },
  lblActive:{ color: colors.primaryContainer },
});

// ── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [plans,      setPlans]      = useState<Plan[]>([]);
  const [profile,    setProfile]    = useState<Profile>({});
  const [logs,       setLogs]       = useState<WorkoutLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [previewDay, setPreviewDay] = useState<string | null>(null);

  const todayDay   = getTodayDay();
  const todayIndex = DAYS.indexOf(todayDay);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const headers = await getAuthHeaders();
      const [plansRes, profileRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/plans`,   { headers }),
        fetch(`${API_URL}/profile`, { headers }),
        fetch(`${API_URL}/logs`,    { headers }),
      ]);
      if (plansRes.ok)   setPlans(await plansRes.json());
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile({ ...p, email: user?.email ?? '' });
      }
      if (logsRes.ok)    setLogs(await logsRes.json());
    } finally {
      setLoading(false);
    }
  }

  const activePlan     = plans[0] ?? null;
  const totalExercises = plans.reduce((s, p) => s + p.plan_sessions.length, 0);
  const todayExercises = activePlan?.plan_sessions.filter(s => s.day_of_week === todayDay) ?? [];
  const streak         = calcStreak(logs);
  const weeklyVols     = getWeeklyVolumes(logs);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  // Bug 4: fall back to email username instead of generic "ATHLETE"
  const emailUsername = profile.email?.split('@')[0]?.toUpperCase() ?? 'ATHLETE';
  const firstName = profile.full_name?.split(' ')[0]?.toUpperCase() || emailUsername;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  return (
  <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greetingLabel}>{greeting()}</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>
        {profile.goal && (
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>{profile.goal.replace('_', ' ').toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Stats row — each card is a navigation shortcut */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/workout-builder')} activeOpacity={0.75}>
          <Text style={styles.statNum}>{plans.length}</Text>
          <Text style={styles.statLabel}>PLANS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/muscle-selector')} activeOpacity={0.75}>
          <Text style={styles.statNum}>{totalExercises}</Text>
          <Text style={styles.statLabel}>EXERCISES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/progress')} activeOpacity={0.75}>
          <Text style={styles.statNum}>{streak}</Text>
          <Text style={styles.statLabel}>STREAK 🔥</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => setPreviewDay(todayDay)} activeOpacity={0.75}>
          <Text style={styles.statNum}>{todayExercises.length}</Text>
          <Text style={styles.statLabel}>EXERCISES</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly volume chart */}
      <Text style={styles.sectionLabel}>WEEKLY VOLUME</Text>
      <View style={styles.chartCard}>
        <WeeklyChart volumes={weeklyVols} todayIdx={todayIndex} />
        {weeklyVols.every(v => v === 0) && (
          <Text style={styles.chartEmpty}>Log workouts to see your weekly volume</Text>
        )}
      </View>

      {/* Weekly strip */}
      {activePlan && (
        <>
          <Text style={styles.sectionLabel}>THIS WEEK — {activePlan.name.toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekStrip} contentContainerStyle={styles.weekStripContent}>
            {DAYS.map((day, i) => {
              const isToday   = day === todayDay;
              const sessions  = activePlan.plan_sessions.filter(s => s.day_of_week === day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayCard, isToday && styles.dayCardToday]}
                  onPress={() => setPreviewDay(day)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dayCardLabel, isToday && styles.dayCardLabelToday]}>{DAY_LBLS[i]}</Text>
                  <View style={styles.dayCardDot}>
                    {sessions.length > 0
                      ? <Text style={[styles.dayCardCount, isToday && styles.dayCardCountToday]}>{sessions.length}</Text>
                      : <Text style={styles.dayCardRest}>—</Text>
                    }
                  </View>
                  {isToday && <View style={styles.todayIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Last trained nudge */}
      {(() => {
        if (logs.length === 0) return null;
        const last = new Date(logs[0].logged_at);
        const diffDays = Math.floor((Date.now() - last.getTime()) / 86400000);
        if (diffDays === 0) return null; // trained today, no nudge needed
        const msg = diffDays === 1
          ? 'Last trained yesterday — keep it up!'
          : diffDays <= 3
          ? `${diffDays} days since your last workout — time to train!`
          : `You haven't trained in ${diffDays} days — let's get back on track!`;
        return (
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeIcon}>{diffDays >= 3 ? '🔔' : '💪'}</Text>
            <Text style={styles.nudgeText}>{msg}</Text>
          </View>
        );
      })()}

      {/* Today's session */}
      <Text style={styles.sectionLabel}>TODAY'S SESSION</Text>
      {todayExercises.length > 0 ? (
        <View style={styles.todayCard}>
          <View style={styles.todayCardHeader}>
            <Text style={styles.todayCardDay}>{DAY_LBLS[todayIndex]}</Text>
            <Text style={styles.todayCardCount}>{todayExercises.length} EXERCISES</Text>
          </View>
          {todayExercises.map((session, idx) => (
            <View key={session.id} style={[styles.todayExRow, idx < todayExercises.length - 1 && styles.todayExRowBorder]}>
              <View style={styles.todayExLeft}>
                <Text style={styles.todayExName}>{session.exercises.name}</Text>
                <Text style={styles.todayExMeta}>
                  {session.exercises.muscle_groups?.name} · {session.exercises.equipment}
                </Text>
              </View>
              <Text style={styles.todaySets}>{session.exercises.sets_suggestion}×{session.exercises.reps_suggestion}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.startSessionBtn}
            onPress={() => router.push({
              pathname: '/(app)/active-workout',
              params: { planId: activePlan?.id, day: todayDay },
            } as any)}
          >
            <Text style={styles.startSessionBtnText}>▶  START WORKOUT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restCardTitle}>REST DAY</Text>
          <Text style={styles.restCardSubtext}>Recovery is part of performance.</Text>
          <TouchableOpacity style={styles.buildPlanBtn} onPress={() => router.push('/(app)/workout-builder')}>
            <Text style={styles.buildPlanBtnText}>OPEN WORKOUT BUILDER</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* All plans */}
      {plans.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>YOUR PLANS</Text>
          {plans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planRow}
              onPress={() => router.push('/(app)/workout-builder')}
              activeOpacity={0.8}
            >
              <View style={styles.planRowLeft}>
                <Text style={styles.planRowName}>{plan.name}</Text>
                {plan.goal && <Text style={styles.planRowGoal}>{plan.goal.replace('_', ' ').toUpperCase()}</Text>}
              </View>
              <View style={styles.planRowRight}>
                <Text style={styles.planRowCount}>{plan.plan_sessions.length}</Text>
                <Text style={styles.planRowCountLabel}>exercises</Text>
              </View>
              <Text style={styles.planRowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {plans.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>NO PLANS YET</Text>
          <Text style={styles.emptyStateText}>Build your first workout plan to get started</Text>
          <TouchableOpacity style={styles.startSessionBtn} onPress={() => router.push('/(app)/workout-builder')}>
            <Text style={styles.startSessionBtnText}>CREATE A PLAN</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>

    {/* Day preview modal */}
    {activePlan && (
      <Modal
        visible={!!previewDay}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewDay(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPreviewDay(null)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDayLabel}>{previewDay}</Text>
                <Text style={styles.modalPlanName}>{activePlan.name.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => { setPreviewDay(null); router.push('/(app)/workout-builder'); }}>
                <Text style={styles.modalEditBtn}>EDIT ›</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              const sessions = activePlan.plan_sessions.filter(s => s.day_of_week === previewDay);
              if (sessions.length === 0) return (
                <Text style={styles.modalEmpty}>Rest day — no exercises scheduled.</Text>
              );
              return sessions.map((s, i) => (
                <View key={s.id} style={[styles.modalExRow, i > 0 && styles.modalExRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalExName}>{s.exercises.name}</Text>
                    <Text style={styles.modalExMeta}>{s.exercises.muscle_groups?.name} · {s.exercises.equipment}</Text>
                  </View>
                  <Text style={styles.modalExSets}>{s.exercises.sets_suggestion}×{s.exercises.reps_suggestion}</Text>
                </View>
              ));
            })()}
            {previewDay === todayDay && (
              <TouchableOpacity
                style={styles.startSessionBtn}
                onPress={() => { setPreviewDay(null); router.push({ pathname: '/(app)/active-workout', params: { planId: activePlan.id, day: todayDay } } as any); }}
              >
                <Text style={styles.startSessionBtnText}>▶  START WORKOUT</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    )}
  </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 24 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  greetingLabel: { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 4 },
  greetingName: { fontSize: 32, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  goalBadge: {
    backgroundColor: colors.primaryContainer + '22', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.primaryContainer + '44',
  },
  goalBadgeText: { color: colors.primaryContainer, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
  },
  statNum:   { fontSize: 22, fontWeight: '900', color: colors.primaryContainer },
  statLabel: { fontSize: 7, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5 },

  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 12 },

  // Chart
  chartCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: 20,
    padding: 16, paddingTop: 20, marginBottom: 28,
  },
  chartEmpty: { fontSize: 11, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 12, paddingBottom: 4 },

  // Weekly strip
  weekStrip: { flexGrow: 0, marginBottom: 28, marginHorizontal: -20 },
  weekStripContent: { paddingHorizontal: 20, gap: 8 },
  dayCard: {
    width: 56, paddingVertical: 12, borderRadius: 14,
    backgroundColor: colors.surfaceContainer, alignItems: 'center', gap: 8, position: 'relative',
  },
  dayCardToday: { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.primaryContainer },
  dayCardLabel: { fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  dayCardLabelToday: { color: colors.primaryContainer },
  dayCardDot: {
    width: 28, height: 28, borderRadius: 50,
    backgroundColor: colors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center',
  },
  dayCardCount: { fontSize: 13, fontWeight: '900', color: colors.onSurface },
  dayCardCountToday: { color: colors.primaryContainer },
  dayCardRest: { fontSize: 11, color: colors.outlineVariant },
  todayIndicator: {
    position: 'absolute', bottom: 0, left: '50%',
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.primaryContainer, marginLeft: -2,
  },

  // Today card
  todayCard: { backgroundColor: colors.surfaceContainer, borderRadius: 20, padding: 20, marginBottom: 28 },
  todayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  todayCardDay: { fontSize: 22, fontWeight: '900', color: colors.primaryContainer },
  todayCardCount: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5 },
  todayExRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  todayExRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '33' },
  todayExLeft: { flex: 1, gap: 2 },
  todayExName: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  todayExMeta: { fontSize: 10, color: colors.onSurfaceVariant },
  todaySets: { fontSize: 13, fontWeight: '800', color: colors.tertiary },
  startSessionBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  startSessionBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },

  restCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 28,
  },
  restCardTitle: { fontSize: 28, fontWeight: '900', color: colors.onSurface },
  restCardSubtext: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 8 },
  buildPlanBtn: {
    backgroundColor: colors.surfaceContainerHigh, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12,
  },
  buildPlanBtnText: { color: colors.onSurface, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  planRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  planRowLeft: { flex: 1, gap: 2 },
  planRowName: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  planRowGoal: { fontSize: 9, color: colors.primaryContainer, letterSpacing: 1.5 },
  planRowRight: { alignItems: 'center', paddingHorizontal: 12, gap: 2 },
  planRowCount: { fontSize: 20, fontWeight: '900', color: colors.onSurface },
  planRowCountLabel: { fontSize: 8, color: colors.onSurfaceVariant, letterSpacing: 1 },
  planRowChevron: { fontSize: 24, color: colors.onSurfaceVariant },

  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: colors.primaryContainer,
  },
  nudgeIcon: { fontSize: 20 },
  nudgeText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 18, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyStateTitle: { fontSize: 22, fontWeight: '900', color: colors.onSurface },
  emptyStateText: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 8 },

  // Day preview modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surfaceContainerHigh,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, maxHeight: '70%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.outlineVariant, alignSelf: 'center', marginBottom: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalDayLabel: { fontSize: 28, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -0.5 },
  modalPlanName: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  modalEditBtn: { fontSize: 11, fontWeight: '800', color: colors.primaryContainer, letterSpacing: 1 },
  modalEmpty: { fontSize: 13, color: colors.onSurfaceVariant, paddingVertical: 24, textAlign: 'center' },
  modalExRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  modalExRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant + '33' },
  modalExName: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  modalExMeta: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  modalExSets: { fontSize: 14, fontWeight: '800', color: colors.tertiary },
});
