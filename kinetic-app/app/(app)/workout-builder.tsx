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
} from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const DAYS      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ── Types ──────────────────────────────────────────────────────────────────────

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
}

interface SessionSet {
  id: string;
  session_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Templates ──────────────────────────────────────────────────────────────────

interface TemplateDefinition {
  name: string;
  goal: string;
  label: string;
  desc: string;
  days: Record<string, string[]>;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Push Pull Legs',
    goal: 'hypertrophy',
    label: 'PUSH PULL LEGS',
    desc: '6-day split. Classic muscle-building program.',
    days: {
      Mon: ['Bench Press', 'Overhead Press', 'Tricep'],
      Tue: ['Pull Up', 'Barbell Row', 'Bicep Curl'],
      Wed: ['Back Squat', 'Romanian Deadlift', 'Calf'],
      Thu: ['Bench Press', 'Lateral Raise', 'Tricep'],
      Fri: ['Deadlift', 'Pull Up', 'Bicep Curl'],
      Sat: ['Back Squat', 'Leg Press', 'Calf'],
    },
  },
  {
    name: 'Upper Lower Split',
    goal: 'strength',
    label: 'UPPER / LOWER',
    desc: '4-day split. Great for strength & size.',
    days: {
      Mon: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Bicep Curl'],
      Tue: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf'],
      Thu: ['Incline Bench', 'Pull Up', 'Lateral Raise', 'Tricep'],
      Fri: ['Deadlift', 'Back Squat', 'Leg Curl', 'Calf'],
    },
  },
  {
    name: 'Full Body 3x',
    goal: 'strength',
    label: 'FULL BODY 3×',
    desc: '3-day split. Ideal for beginners.',
    days: {
      Mon: ['Back Squat', 'Bench Press', 'Barbell Row', 'Overhead Press'],
      Wed: ['Deadlift', 'Incline Bench', 'Pull Up', 'Bicep Curl'],
      Fri: ['Back Squat', 'Bench Press', 'Barbell Row', 'Tricep'],
    },
  },
  {
    name: '5x5 Strength',
    goal: 'strength',
    label: '5×5 STRENGTH',
    desc: '3-day alternating. Build raw strength fast.',
    days: {
      Mon: ['Back Squat', 'Bench Press', 'Barbell Row'],
      Wed: ['Back Squat', 'Overhead Press', 'Deadlift'],
      Fri: ['Back Squat', 'Bench Press', 'Barbell Row'],
    },
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkoutBuilder() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ addExerciseId?: string; addDay?: string; addPlanId?: string; jumpDay?: string }>();

  const [plans,              setPlans]              = useState<Plan[]>([]);
  const [activePlanId,       setActivePlanId]        = useState<string | null>(null);
  const [activeDay,          setActiveDay]           = useState('Mon');
  const [loading,            setLoading]             = useState(true);
  const [showNewPlanModal,   setShowNewPlanModal]    = useState(false);
  const [showTemplatesModal, setShowTemplatesModal]  = useState(false);
  const [applyingTemplate,   setApplyingTemplate]    = useState(false);
  const [newPlanName,        setNewPlanName]         = useState('');
  const [newPlanGoal,        setNewPlanGoal]         = useState<string | null>(null);
  const [renamingPlanId,     setRenamingPlanId]      = useState<string | null>(null);
  const [renameText,         setRenameText]          = useState('');
  const addExerciseHandled = useRef<string | null>(null);

  // Inline sets state
  // daySets:   { [sessionId]: SessionSet[] }
  // setInputs: { [sessionId]: { [setId]: { reps: string; weight: string } } }
  const [daySets,      setDaySets]      = useState<Record<string, SessionSet[]>>({});
  const [setInputs,    setSetInputs]    = useState<Record<string, Record<string, { reps: string; weight: string }>>>({});
  const [daySetsLoading, setDaySetsLoading] = useState(false);

  const activePlan    = plans.find(p => p.id === activePlanId) ?? null;
  const dayExercises  = activePlan?.plan_sessions.filter(s => s.day_of_week === activeDay && !s.is_rest_day) ?? [];

  // ── Load plans ───────────────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/plans`, { headers });
      if (!res.ok) throw new Error();
      const data: Plan[] = await res.json();
      setPlans(data);
      if (data.length > 0 && !activePlanId) setActivePlanId(data[0].id);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    loadPlans();
    // Jump to a specific day if passed from dashboard
    if (params.jumpDay && DAYS.includes(params.jumpDay)) {
      setActiveDay(params.jumpDay);
      router.setParams({ jumpDay: undefined });
    }
  }, [loadPlans, params.jumpDay]));

  // Handle navigate-back-with-exercise params — guard against double-fire
  useFocusEffect(useCallback(() => {
    const { addExerciseId, addDay, addPlanId } = params;
    const key = addExerciseId ? `${addExerciseId}-${addDay}-${addPlanId}` : null;
    if (addExerciseId && addDay && addPlanId && key !== addExerciseHandled.current) {
      addExerciseHandled.current = key;
      router.setParams({ addExerciseId: undefined, addDay: undefined, addPlanId: undefined });
      addExerciseToPlan(addPlanId, addExerciseId, addDay);
    }
  }, [params.addExerciseId]));

  // ── Fetch inline sets when day/exercises change ───────────────────────────────

  useEffect(() => {
    if (dayExercises.length === 0) {
      setDaySets({});
      setSetInputs({});
      return;
    }
    fetchDaySets(dayExercises);
  }, [activeDay, activePlanId, plans.length]);

  async function fetchDaySets(sessions: PlanSession[]) {
    setDaySetsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const results = await Promise.all(
        sessions.map(async s => {
          const res = await fetch(`${API_URL}/plans/${s.plan_id}/sessions/${s.id}/sets`, { headers });
          const sets: SessionSet[] = res.ok ? await res.json() : [];
          return { sessionId: s.id, sets: Array.isArray(sets) ? sets : [] };
        })
      );
      const newDaySets: Record<string, SessionSet[]> = {};
      const newInputs: Record<string, Record<string, { reps: string; weight: string }>> = {};
      for (const { sessionId, sets } of results) {
        newDaySets[sessionId] = sets;
        newInputs[sessionId] = {};
        for (const set of sets) {
          newInputs[sessionId][set.id] = {
            reps:   set.reps      != null ? String(set.reps)      : '',
            weight: set.weight_kg != null ? String(set.weight_kg) : '',
          };
        }
      }
      setDaySets(newDaySets);
      setSetInputs(newInputs);
    } finally {
      setDaySetsLoading(false);
    }
  }

  // ── Plan / session management ─────────────────────────────────────────────────

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
      await fetch(`${API_URL}/plans/${planId}/sessions/${sessionId}`, { method: 'DELETE', headers });
      await loadPlans();
    } catch {}
  }

  async function createPlan() {
    if (!newPlanName.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const res  = await fetch(`${API_URL}/plans`, {
        method: 'POST', headers,
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

  async function renamePlan(planId: string, name: string) {
    if (!name.trim()) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${planId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ name: name.trim() }),
      });
      setRenamingPlanId(null);
      await loadPlans();
    } catch {}
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  async function applyTemplate(template: TemplateDefinition) {
    setApplyingTemplate(true);
    setShowTemplatesModal(false);
    try {
      const headers = await getAuthHeaders();
      // 1. Fetch all exercises to match by name
      const exRes = await fetch(`${API_URL}/exercises`, { headers });
      const allExercises: any[] = exRes.ok ? await exRes.json() : [];

      function findEx(name: string) {
        return allExercises.find((e: any) =>
          e.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(e.name.toLowerCase())
        );
      }

      // 2. Create plan
      const planRes = await fetch(`${API_URL}/plans`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: template.name, goal: template.goal }),
      });
      const plan = await planRes.json();

      // 3. Add sessions
      for (const [day, exercises] of Object.entries(template.days)) {
        for (const exName of exercises) {
          const ex = findEx(exName);
          if (ex) {
            await fetch(`${API_URL}/plans/${plan.id}/sessions`, {
              method: 'POST', headers,
              body: JSON.stringify({ exercise_id: ex.id, day_of_week: day, is_rest_day: false }),
            });
          }
        }
      }

      await loadPlans();
      setActivePlanId(plan.id);
    } catch {}
    finally { setApplyingTemplate(false); }
  }

  // ── Inline set operations ─────────────────────────────────────────────────────

  function updateSetInput(sessionId: string, setId: string, field: 'reps' | 'weight', value: string) {
    setSetInputs(prev => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], [setId]: { ...prev[sessionId]?.[setId], [field]: value } },
    }));
  }

  async function saveSetInput(session: PlanSession, set: SessionSet) {
    const vals = setInputs[session.id]?.[set.id];
    if (!vals) return;
    const reps     = parseInt(vals.reps, 10);
    const weightKg = parseFloat(vals.weight);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets/${set.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          reps:      isNaN(reps)     ? null : reps,
          weight_kg: isNaN(weightKg) ? null : weightKg,
        }),
      });
    } catch {}
  }

  async function addSet(session: PlanSession) {
    try {
      const headers  = await getAuthHeaders();
      const existing = daySets[session.id] ?? [];
      const defReps  = parseInt(session.exercises.reps_suggestion?.split('-')[0] ?? '10', 10) || 10;
      const res      = await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets`, {
        method: 'POST', headers,
        body: JSON.stringify({ set_number: existing.length + 1, reps: defReps, weight_kg: 0 }),
      });
      const newSet: SessionSet = await res.json();
      setDaySets(prev => ({ ...prev, [session.id]: [...(prev[session.id] ?? []), newSet] }));
      setSetInputs(prev => ({
        ...prev,
        [session.id]: {
          ...prev[session.id],
          [newSet.id]: { reps: String(defReps), weight: '0' },
        },
      }));
    } catch {}
  }

  async function removeSet(session: PlanSession, setId: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/plans/${session.plan_id}/sessions/${session.id}/sets/${setId}`, {
        method: 'DELETE', headers,
      });
      setDaySets(prev => ({
        ...prev,
        [session.id]: (prev[session.id] ?? []).filter(s => s.id !== setId),
      }));
      setSetInputs(prev => {
        const copy = { ...prev[session.id] };
        delete copy[setId];
        return { ...prev, [session.id]: copy };
      });
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.primaryContainer} size="large" /></View>;
  }

  return (
    <View style={s.root}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <View style={s.headerLeft}>
          <Text style={s.pageTitle}>WORKOUT</Text>
          <Text style={s.pageTitleAccent}>BUILDER</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.templateBtn} onPress={() => setShowTemplatesModal(true)}>
            <Text style={s.templateBtnText}>TEMPLATES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.newPlanBtn} onPress={() => setShowNewPlanModal(true)}>
            <Text style={s.newPlanBtnText}>+ NEW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan selector tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.planTabsScroll} contentContainerStyle={s.planTabs}>
        {plans.map(plan => (
          <TouchableOpacity
            key={plan.id}
            style={[s.planTab, activePlanId === plan.id && s.planTabActive]}
            onPress={() => setActivePlanId(plan.id)}
            onLongPress={() => { setRenamingPlanId(plan.id); setRenameText(plan.name); }}
          >
            <Text style={[s.planTabText, activePlanId === plan.id && s.planTabTextActive]}>
              {plan.name.toUpperCase()}
            </Text>
            {plan.goal && (
              <Text style={[s.planTabGoal, activePlanId === plan.id && s.planTabGoalActive]}>
                {plan.goal.toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        ))}
        {plans.length === 0 && (
          <Text style={s.noPlansText}>No plans yet. Create one to get started.</Text>
        )}
      </ScrollView>

      {activePlan && (
        <>
          {/* Plan meta */}
          <View style={s.planActions}>
            <TouchableOpacity
              style={s.renamePlanRow}
              onPress={() => { setRenamingPlanId(activePlan.id); setRenameText(activePlan.name); }}
            >
              <Text style={s.planActionsLabel}>{activePlan.plan_sessions.length} exercises total</Text>
              <Text style={s.renameIcon}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deletePlan(activePlan.id)} style={s.deletePlanBtn}>
              <Text style={s.deletePlanBtnText}>DELETE PLAN</Text>
            </TouchableOpacity>
          </View>

          {/* Day tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayTabsScroll} contentContainerStyle={s.dayTabs}>
            {DAYS.map((day, i) => {
              const hasSessions = activePlan.plan_sessions.some(s => s.day_of_week === day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[s.dayTab, activeDay === day && s.dayTabActive]}
                  onPress={() => setActiveDay(day)}
                >
                  <Text style={[s.dayTabText, activeDay === day && s.dayTabTextActive]}>{DAY_LABELS[i]}</Text>
                  {hasSessions && <View style={[s.dayDot, activeDay === day && s.dayDotActive]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Exercise cards */}
          <FlatList
            data={dayExercises}
            keyExtractor={item => item.id}
            contentContainerStyle={s.exerciseList}
            ListHeaderComponent={
              <TouchableOpacity
                style={s.addExerciseBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/muscle-selector',
                    params: { mode: 'addToPlan', planId: activePlan.id, day: activeDay },
                  })
                }
              >
                <Text style={s.addExerciseBtnText}>+ ADD EXERCISE TO {activeDay.toUpperCase()}</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <View style={s.emptyDay}>
                <Text style={s.emptyDayText}>Rest day</Text>
                <Text style={s.emptyDaySubtext}>Tap above to add exercises</Text>
              </View>
            }
            renderItem={({ item: session }) => {
              const sets = daySets[session.id] ?? [];
              return (
                <View style={s.card}>
                  {/* Card header */}
                  <View style={s.cardHeader}>
                    <View style={s.cardInfo}>
                      <Text style={s.cardName}>{session.exercises.name}</Text>
                      <Text style={s.cardMuscle}>
                        {session.exercises.muscle_groups?.name?.toUpperCase()} · {session.exercises.equipment}
                      </Text>
                    </View>
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeSession(activePlan.id, session.id)}>
                      <Text style={s.removeBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sets — inline, always visible */}
                  {daySetsLoading && sets.length === 0 ? (
                    <ActivityIndicator size="small" color={colors.primaryContainer} style={{ marginVertical: 8 }} />
                  ) : (
                    <>
                      {sets.length > 0 && (
                        <View style={s.setsBlock}>
                          {/* Column headers */}
                          <View style={s.setsColHeader}>
                            <View style={s.setNumCol} />
                            <Text style={s.setsColLbl}>REPS</Text>
                            <View style={{ width: 20 }} />
                            <Text style={s.setsColLbl}>WEIGHT (KG)</Text>
                            <View style={{ width: 28 }} />
                          </View>
                          {sets.map((set, idx) => {
                            const vals = setInputs[session.id]?.[set.id] ?? { reps: '', weight: '' };
                            return (
                              <View key={set.id} style={s.setRow}>
                                <View style={s.setNumCol}>
                                  <Text style={s.setNum}>{idx + 1}</Text>
                                </View>
                                <TextInput
                                  style={s.setInput}
                                  value={vals.reps}
                                  onChangeText={v => updateSetInput(session.id, set.id, 'reps', v)}
                                  onEndEditing={() => saveSetInput(session, set)}
                                  keyboardType="numeric"
                                  placeholder="—"
                                  placeholderTextColor={colors.outlineVariant}
                                  selectTextOnFocus
                                />
                                <Text style={s.setX}>×</Text>
                                <TextInput
                                  style={s.setInput}
                                  value={vals.weight}
                                  onChangeText={v => updateSetInput(session.id, set.id, 'weight', v)}
                                  onEndEditing={() => saveSetInput(session, set)}
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor={colors.outlineVariant}
                                  selectTextOnFocus
                                />
                                <TouchableOpacity style={s.removeSetBtn} onPress={() => removeSet(session, set.id)}>
                                  <Text style={s.removeSetBtnText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Add set */}
                      <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(session)}>
                        <Text style={s.addSetBtnText}>+ ADD SET</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            }}
          />
        </>
      )}

      {!activePlan && !loading && (
        <View style={s.center}>
          <Text style={s.emptyStateText}>Create a plan to start building your workout</Text>
          <TouchableOpacity style={s.createFirstPlanBtn} onPress={() => setShowNewPlanModal(true)}>
            <Text style={s.createFirstPlanText}>CREATE FIRST PLAN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Applying template overlay */}
      {applyingTemplate && (
        <View style={s.applyingOverlay}>
          <ActivityIndicator color={colors.primaryContainer} size="large" />
          <Text style={s.applyingText}>BUILDING YOUR PLAN…</Text>
        </View>
      )}

      {/* Templates Modal */}
      <Modal visible={showTemplatesModal} transparent animationType="slide" onRequestClose={() => setShowTemplatesModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>TEMPLATES</Text>
            <Text style={s.modalSubtitle}>START WITH A PROVEN PROGRAM</Text>
            {TEMPLATES.map(t => (
              <TouchableOpacity
                key={t.name}
                style={s.templateCard}
                onPress={() => applyTemplate(t)}
                activeOpacity={0.8}
              >
                <View style={s.templateCardLeft}>
                  <Text style={s.templateCardLabel}>{t.label}</Text>
                  <Text style={s.templateCardDesc}>{t.desc}</Text>
                  <Text style={s.templateCardDays}>
                    {Object.keys(t.days).join(' · ')}
                  </Text>
                </View>
                <Text style={s.templateCardGoal}>{t.goal.replace('_',' ').toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowTemplatesModal(false)}>
              <Text style={s.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename Plan Modal */}
      <Modal visible={!!renamingPlanId} transparent animationType="slide" onRequestClose={() => setRenamingPlanId(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>RENAME PLAN</Text>
            <Text style={s.inputLabel}>PLAN NAME</Text>
            <TextInput
              style={s.textInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity style={s.createBtn} onPress={() => renamingPlanId && renamePlan(renamingPlanId, renameText)}>
              <Text style={s.createBtnText}>SAVE NAME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setRenamingPlanId(null)}>
              <Text style={s.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Plan Modal */}
      <Modal visible={showNewPlanModal} transparent animationType="slide" onRequestClose={() => setShowNewPlanModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.modalTitle}>NEW PLAN</Text>

            <Text style={s.inputLabel}>PLAN NAME</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Push Pull Legs"
              placeholderTextColor={colors.outlineVariant}
              value={newPlanName}
              onChangeText={setNewPlanName}
              autoFocus
            />

            <Text style={s.inputLabel}>GOAL (OPTIONAL)</Text>
            <View style={s.goalChips}>
              {[null, 'strength', 'hypertrophy', 'endurance', 'fat_loss'].map(g => (
                <TouchableOpacity
                  key={g ?? 'none'}
                  style={[s.goalChip, newPlanGoal === g && s.goalChipActive]}
                  onPress={() => setNewPlanGoal(g)}
                >
                  <Text style={[s.goalChipText, newPlanGoal === g && s.goalChipTextActive]}>
                    {g ? g.replace('_', ' ').toUpperCase() : 'NONE'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.createBtn} onPress={createPlan}>
              <Text style={s.createBtnText}>CREATE PLAN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNewPlanModal(false)}>
              <Text style={s.cancelBtnText}>CANCEL</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
  },
  headerLeft:       { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  pageTitle:        { fontSize: 28, fontWeight: '900', color: colors.onSurface, letterSpacing: -1 },
  pageTitleAccent:  { fontSize: 28, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1 },
  newPlanBtn:       { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  newPlanBtnText:   { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  templateBtn:      { backgroundColor: colors.surfaceContainerHigh, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.outlineVariant },
  templateBtnText:  { color: colors.onSurface, fontWeight: '800', fontSize: 10, letterSpacing: 1 },

  // Template modal
  templateCard: {
    backgroundColor: colors.surfaceContainerHighest, borderRadius: 14, padding: 16,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
  },
  templateCardLeft:  { flex: 1, gap: 3 },
  templateCardLabel: { fontSize: 13, fontWeight: '900', color: colors.onSurface, letterSpacing: 0.5 },
  templateCardDesc:  { fontSize: 11, color: colors.onSurfaceVariant, lineHeight: 16 },
  templateCardDays:  { fontSize: 9, color: colors.primaryContainer, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  templateCardGoal:  { fontSize: 8, fontWeight: '800', color: colors.tertiary, letterSpacing: 1 },

  // Applying overlay
  applyingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', gap: 16, zIndex: 100,
  },
  applyingText: { color: colors.primaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 2 },

  planTabsScroll: { flexGrow: 0 },
  planTabs:       { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  planTab:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surfaceContainer, gap: 2 },
  planTabActive:  { backgroundColor: colors.primaryContainer },
  planTabText:    { fontSize: 11, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  planTabTextActive: { color: colors.onPrimaryContainer },
  planTabGoal:    { fontSize: 8, color: colors.outlineVariant, letterSpacing: 1 },
  planTabGoalActive: { color: colors.onPrimaryContainer + 'aa' },
  noPlansText:    { color: colors.onSurfaceVariant, fontSize: 13, paddingVertical: 8 },

  planActions:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  renamePlanRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planActionsLabel:  { fontSize: 11, color: colors.onSurfaceVariant },
  renameIcon:        { fontSize: 13, color: colors.primaryContainer },
  deletePlanBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceContainer },
  deletePlanBtnText: { fontSize: 9, color: colors.secondary, fontWeight: '700', letterSpacing: 1 },

  dayTabsScroll: { flexGrow: 0, marginBottom: 8 },
  dayTabs:       { paddingHorizontal: 20, gap: 6 },
  dayTab:        { width: 52, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', gap: 4 },
  dayTabActive:  { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.primaryContainer },
  dayTabText:    { fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  dayTabTextActive: { color: colors.primaryContainer },
  dayDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.outlineVariant },
  dayDotActive:  { backgroundColor: colors.primaryContainer },

  exerciseList:    { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  addExerciseBtn:  {
    backgroundColor: colors.surfaceContainer, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant, borderStyle: 'dashed', marginBottom: 4,
  },
  addExerciseBtnText: { color: colors.primaryContainer, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  emptyDay:        { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyDayText:    { fontSize: 22, fontWeight: '900', color: colors.onSurfaceVariant },
  emptyDaySubtext: { fontSize: 11, color: colors.outlineVariant, letterSpacing: 1 },

  // Exercise card
  card:       { backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo:   { flex: 1, gap: 2 },
  cardName:   { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  cardMuscle: { fontSize: 10, color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  removeBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 18, color: colors.secondary, lineHeight: 22 },

  // Inline sets
  setsBlock:     { gap: 4 },
  setsColHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 },
  setsColLbl:    { flex: 1, fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1.5, textAlign: 'center' },
  setNumCol:     { width: 28, alignItems: 'center' },
  setNum:        { fontSize: 10, fontWeight: '800', color: colors.onSurfaceVariant },

  setRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setInput:   {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10,
    color: colors.onSurface, fontSize: 15, fontWeight: '700',
    textAlign: 'center', borderWidth: 1, borderColor: colors.outlineVariant,
  } as any,
  setX:          { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '700' },
  removeSetBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  removeSetBtnText: { fontSize: 16, color: colors.secondary, lineHeight: 20 },

  addSetBtn:     { backgroundColor: colors.surfaceContainerHigh, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  addSetBtnText: { fontSize: 9, fontWeight: '800', color: colors.primaryContainer, letterSpacing: 1.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surfaceContainerHigh, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 24, fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalSubtitle:{ fontSize: 9, color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 16 },
  inputLabel:   { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  textInput:    { backgroundColor: colors.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.onSurface, fontSize: 15 } as any,

  goalChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: colors.surfaceContainerHighest },
  goalChipActive:   { backgroundColor: colors.primaryContainer },
  goalChipText:     { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1 },
  goalChipTextActive: { color: colors.onPrimaryContainer },

  createBtn:        { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginTop: 24 },
  createBtnText:    { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  cancelBtn:        { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:    { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  emptyStateText:    { color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  createFirstPlanBtn:{ backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 32, paddingVertical: 14 },
  createFirstPlanText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
});
