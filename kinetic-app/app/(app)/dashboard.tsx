import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function getTodayDay(): string {
  const d = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
  const map = [6, 0, 1, 2, 3, 4, 5]; // Sunday maps to index 6 (Sun), Monday to 0 (Mon)
  return DAYS[map[d]];
}

export default function Dashboard() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const todayDay = getTodayDay();
  const todayIndex = DAYS.indexOf(todayDay);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [plansRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/plans`, { headers }),
        fetch(`${API_URL}/profile`, { headers }),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (profileRes.ok) setProfile(await profileRes.json());
    } finally {
      setLoading(false);
    }
  }

  // Use the first plan as the "active" plan for dashboard
  const activePlan = plans[0] ?? null;

  const totalExercises = plans.reduce((sum, p) => sum + p.plan_sessions.length, 0);
  const todayExercises = activePlan?.plan_sessions.filter(s => s.day_of_week === todayDay) ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const firstName = profile.full_name?.split(' ')[0]?.toUpperCase() ?? 'ATHLETE';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{plans.length}</Text>
          <Text style={styles.statLabel}>PLANS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalExercises}</Text>
          <Text style={styles.statLabel}>EXERCISES</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{todayExercises.length}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </View>
      </View>

      {/* Weekly strip */}
      {activePlan && (
        <>
          <Text style={styles.sectionLabel}>THIS WEEK — {activePlan.name.toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekStrip} contentContainerStyle={styles.weekStripContent}>
            {DAYS.map((day, i) => {
              const isToday = day === todayDay;
              const sessions = activePlan.plan_sessions.filter(s => s.day_of_week === day);
              return (
                <View key={day} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                  <Text style={[styles.dayCardLabel, isToday && styles.dayCardLabelToday]}>{DAY_LABELS[i]}</Text>
                  <View style={styles.dayCardDot}>
                    {sessions.length > 0 ? (
                      <Text style={[styles.dayCardCount, isToday && styles.dayCardCountToday]}>{sessions.length}</Text>
                    ) : (
                      <Text style={styles.dayCardRest}>—</Text>
                    )}
                  </View>
                  {isToday && <View style={styles.todayIndicator} />}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Today's session hero */}
      <Text style={styles.sectionLabel}>TODAY'S SESSION</Text>
      {todayExercises.length > 0 ? (
        <View style={styles.todayCard}>
          <View style={styles.todayCardHeader}>
            <Text style={styles.todayCardDay}>{DAY_LABELS[todayIndex]}</Text>
            <Text style={styles.todayCardCount}>{todayExercises.length} EXERCISES</Text>
          </View>
          {todayExercises.map((session, idx) => (
            <View key={session.id} style={[styles.todayExerciseRow, idx < todayExercises.length - 1 && styles.todayExerciseRowBorder]}>
              <View style={styles.todayExerciseLeft}>
                <Text style={styles.todayExerciseName}>{session.exercises.name}</Text>
                <Text style={styles.todayExerciseMeta}>
                  {session.exercises.muscle_groups?.name} · {session.exercises.equipment}
                </Text>
              </View>
              <View style={styles.todayExerciseRight}>
                <Text style={styles.todaySets}>{session.exercises.sets_suggestion}×{session.exercises.reps_suggestion}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.startSessionBtn}
            onPress={() => router.push('/(app)/workout-builder')}
          >
            <Text style={styles.startSessionBtnText}>▶  VIEW IN BUILDER</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restCardTitle}>REST DAY</Text>
          <Text style={styles.restCardSubtext}>Recovery is part of performance.</Text>
          <TouchableOpacity
            style={styles.buildPlanBtn}
            onPress={() => router.push('/(app)/workout-builder')}
          >
            <Text style={styles.buildPlanBtnText}>OPEN WORKOUT BUILDER</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* All plans quick view */}
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
                {plan.goal && (
                  <Text style={styles.planRowGoal}>{plan.goal.replace('_', ' ').toUpperCase()}</Text>
                )}
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
          <TouchableOpacity
            style={styles.startSessionBtn}
            onPress={() => router.push('/(app)/workout-builder')}
          >
            <Text style={styles.startSessionBtnText}>CREATE A PLAN</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 24 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Greeting
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  greetingLabel: { fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 4 },
  greetingName: { fontSize: 32, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  goalBadge: {
    backgroundColor: colors.primaryContainer + '22', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.primaryContainer + '44',
  },
  goalBadgeText: { color: colors.primaryContainer, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: 28, fontWeight: '900', color: colors.primaryContainer },
  statLabel: { fontSize: 8, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 2 },

  // Section label
  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 3, marginBottom: 12 },

  // Weekly strip
  weekStrip: { flexGrow: 0, marginBottom: 28, marginHorizontal: -20 },
  weekStripContent: { paddingHorizontal: 20, gap: 8 },
  dayCard: {
    width: 56, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surfaceContainer,
    alignItems: 'center', gap: 8, position: 'relative',
  },
  dayCardToday: { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.primaryContainer },
  dayCardLabel: { fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  dayCardLabelToday: { color: colors.primaryContainer },
  dayCardDot: { width: 28, height: 28, borderRadius: 50, backgroundColor: colors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  dayCardCount: { fontSize: 13, fontWeight: '900', color: colors.onSurface },
  dayCardCountToday: { color: colors.primaryContainer },
  dayCardRest: { fontSize: 11, color: colors.outlineVariant },
  todayIndicator: { position: 'absolute', bottom: 0, left: '50%', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primaryContainer, marginLeft: -2 },

  // Today card
  todayCard: { backgroundColor: colors.surfaceContainer, borderRadius: 20, padding: 20, marginBottom: 28 },
  todayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  todayCardDay: { fontSize: 22, fontWeight: '900', color: colors.primaryContainer },
  todayCardCount: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5 },
  todayExerciseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  todayExerciseRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '33' },
  todayExerciseLeft: { flex: 1, gap: 2 },
  todayExerciseName: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  todayExerciseMeta: { fontSize: 10, color: colors.onSurfaceVariant },
  todayExerciseRight: { paddingLeft: 12 },
  todaySets: { fontSize: 13, fontWeight: '800', color: colors.tertiary },
  startSessionBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  startSessionBtnText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },

  // Rest card
  restCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 28,
  },
  restCardTitle: { fontSize: 28, fontWeight: '900', color: colors.onSurface },
  restCardSubtext: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 8 },
  buildPlanBtn: {
    backgroundColor: colors.surfaceContainerHigh, borderRadius: 50,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  buildPlanBtnText: { color: colors.onSurface, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  // Plan rows
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

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyStateTitle: { fontSize: 22, fontWeight: '900', color: colors.onSurface },
  emptyStateText: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 8 },
});
