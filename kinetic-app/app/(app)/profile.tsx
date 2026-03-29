import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { fs } from '../../theme/scale';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const GOALS = [
  { key: 'strength',    label: 'STRENGTH'    },
  { key: 'hypertrophy', label: 'HYPERTROPHY' },
  { key: 'endurance',   label: 'ENDURANCE'   },
  { key: 'fat_loss',    label: 'FAT LOSS'    },
];

const FITNESS_LEVELS = [
  { key: 'beginner',     label: 'BEGINNER'     },
  { key: 'intermediate', label: 'INTERMEDIATE' },
  { key: 'advanced',     label: 'ADVANCED'     },
];

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface LifetimeStats {
  totalWorkouts: number;
  totalVolume: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut]   = useState(false);
  const [email, setEmail]             = useState('');
  const [stats, setStats]             = useState<LifetimeStats>({ totalWorkouts: 0, totalVolume: 0 });

  const [fullName,      setFullName]      = useState('');
  const [age,           setAge]           = useState('');
  const [weightKg,      setWeightKg]      = useState('');
  const [heightCm,      setHeightCm]      = useState('');
  const [goal,            setGoal]            = useState('');
  const [units,           setUnits]           = useState('metric');
  const [fitnessLevel,    setFitnessLevel]    = useState('');
  const [defaultRest,     setDefaultRest]     = useState(90);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? '');
      const headers = await getAuthHeaders();
      const [profileRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/profile`, { headers }),
        fetch(`${API_URL}/logs`,    { headers }),
      ]);
      if (profileRes.ok) {
        const p = await profileRes.json();
        setFullName(p.full_name  ?? '');
        setAge(      p.age        ? String(p.age)        : '');
        setWeightKg( p.weight_kg  ? String(p.weight_kg)  : '');
        setHeightCm( p.height_cm  ? String(p.height_cm)  : '');
        setGoal(        p.goal             ?? '');
        setUnits(       p.units            ?? 'metric');
        setFitnessLevel(p.fitness_level    ?? '');
        setDefaultRest( p.default_rest_timer ?? 90);
      }
      if (logsRes.ok) {
        const logs: any[] = await logsRes.json();
        const totalVolume = logs.reduce((sum: number, log: any) =>
          sum + (log.log_sets ?? []).reduce((s: number, set: any) =>
            s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0), 0);
        setStats({ totalWorkouts: logs.length, totalVolume: Math.round(totalVolume) });
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {};
      if (fullName.trim())                      body.full_name = fullName.trim();
      const ageN = parseInt(age, 10);
      if (!isNaN(ageN) && ageN > 0)             body.age       = ageN;
      const wN = parseFloat(weightKg);
      if (!isNaN(wN) && wN > 0)                 body.weight_kg = wN;
      const hN = parseFloat(heightCm);
      if (!isNaN(hN) && hN > 0)                 body.height_cm = hN;
      if (goal)                                 body.goal          = goal;
      if (units)                                body.units         = units;
      if (fitnessLevel)                         body.fitness_level = fitnessLevel;
      if (defaultRest > 0)                      body.default_rest_timer = defaultRest;

      const res = await fetch(`${API_URL}/profile`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch {
      // silently fail — save button returns to normal state
    } finally {
      setSaving(false);
    }
  }

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  }

  const initials = fullName
    .trim().split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'K';

  const weightUnit = units === 'metric' ? 'KG'  : 'LBS';
  const heightUnit = units === 'metric' ? 'CM'  : 'IN';

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.emailText}>{email}</Text>
        <Text style={s.hint}>Edit your profile below</Text>
      </View>

      {/* Lifetime stats */}
      {(stats.totalWorkouts > 0) && (
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{stats.totalWorkouts}</Text>
            <Text style={s.statLabel}>WORKOUTS</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>
              {stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}k`
                : stats.totalVolume}
            </Text>
            <Text style={s.statLabel}>KG LIFTED</Text>
          </View>
        </View>
      )}

      {/* Personal Info */}
      <Text style={s.sectionLabel}>PERSONAL INFO</Text>
      <View style={s.card}>
        <FieldRow label="FULL NAME"          value={fullName}  onChange={setFullName}  placeholder="Your name" />
        <Sep />
        <FieldRow label="AGE"                value={age}       onChange={setAge}       placeholder="25"   keyboardType="numeric" />
        <Sep />
        <FieldRow label={`WEIGHT (${weightUnit})`} value={weightKg} onChange={setWeightKg} placeholder="70"  keyboardType="decimal-pad" />
        <Sep />
        <FieldRow label={`HEIGHT (${heightUnit})`} value={heightCm} onChange={setHeightCm} placeholder="175" keyboardType="decimal-pad" />
      </View>

      {/* Goal */}
      <Text style={s.sectionLabel}>FITNESS GOAL</Text>
      <View style={s.card}>
        <View style={s.chipWrap}>
          {GOALS.map(g => (
            <TouchableOpacity
              key={g.key}
              style={[s.chip, goal === g.key && s.chipOn]}
              onPress={() => setGoal(g.key)}
            >
              <Text style={[s.chipTxt, goal === g.key && s.chipTxtOn]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fitness Level */}
      <Text style={s.sectionLabel}>FITNESS LEVEL</Text>
      <View style={s.card}>
        <View style={s.chipWrap}>
          {FITNESS_LEVELS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, fitnessLevel === f.key && s.chipOn]}
              onPress={() => setFitnessLevel(f.key)}
            >
              <Text style={[s.chipTxt, fitnessLevel === f.key && s.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Units */}
      <Text style={s.sectionLabel}>UNITS</Text>
      <View style={s.card}>
        <View style={s.unitRow}>
          {(['metric', 'imperial'] as const).map(u => (
            <TouchableOpacity
              key={u}
              style={[s.unitChip, units === u && s.unitChipOn]}
              onPress={() => setUnits(u)}
            >
              <Text style={[s.chipTxt, units === u && s.chipTxtOn]}>
                {units === u ? '✓ ' : ''}{u === 'metric' ? 'METRIC (KG/CM)' : 'IMPERIAL (LBS/IN)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Rest Timer */}
      <Text style={s.sectionLabel}>DEFAULT REST TIMER</Text>
      <View style={s.card}>
        <Text style={s.restTimerDesc}>Auto-starts after each completed set</Text>
        <View style={s.restTimerRow}>
          {[30, 60, 90, 120, 180].map(sec => (
            <TouchableOpacity
              key={sec}
              style={[s.restChip, defaultRest === sec && s.chipOn]}
              onPress={() => setDefaultRest(sec)}
            >
              <Text style={[s.chipTxt, defaultRest === sec && s.chipTxtOn]}>
                {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnOff]} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
          : <Text style={s.saveTxt}>SAVE CHANGES</Text>
        }
      </TouchableOpacity>

      {/* Sign Out */}
      <TouchableOpacity style={s.signOutBtn} onPress={() => setShowSignOutModal(true)}>
        <Text style={s.signOutTxt}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* Sign Out Confirmation Modal */}
    <Modal visible={showSignOutModal} transparent animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>SIGN OUT</Text>
          <Text style={s.modalBody}>Are you sure you want to sign out?</Text>
          <TouchableOpacity
            style={[s.modalConfirmBtn, signingOut && s.saveBtnOff]}
            onPress={confirmSignOut}
            disabled={signingOut}
          >
            {signingOut
              ? <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
              : <Text style={s.modalConfirmTxt}>YES, SIGN OUT</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowSignOutModal(false)}>
            <Text style={s.modalCancelTxt}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldRow({
  label, value, onChange, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={fr.row}>
      <Text style={fr.label}>{label}</Text>
      <TextInput
        style={fr.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

function Sep() {
  return <View style={{ height: 1, backgroundColor: colors.outlineVariant + '22', marginHorizontal: -16 }} />;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 28 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 40, gap: 8 },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: fs(34), fontWeight: '900', color: colors.onPrimaryContainer },
  emailText:  { fontSize: fs(14), color: colors.onSurface, fontWeight: '600' },
  hint:       { fontSize: fs(11), color: colors.onSurfaceVariant },

  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 32 },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 18, alignItems: 'center', gap: 6,
  },
  statNum:   { fontSize: fs(26), fontWeight: '900', color: colors.primaryContainer },
  statLabel: { fontSize: fs(8), color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 2 },

  sectionLabel: {
    fontSize: fs(9), fontWeight: '800', color: colors.onSurfaceVariant,
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 18, marginBottom: 22,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitRow:      { flexDirection: 'row', gap: 10 },
  restTimerDesc:{ fontSize: fs(11), color: colors.onSurfaceVariant, marginBottom: 14 },
  restTimerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  restChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 50,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },

  chip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  unitChip: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 50, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  chipOn:     { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  unitChipOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  chipTxt:    { fontSize: fs(10), fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  chipTxtOn:  { color: colors.onPrimaryContainer },

  saveBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 20, alignItems: 'center', marginBottom: 14,
  },
  saveBtnOff: { backgroundColor: colors.surfaceContainerHigh },
  saveTxt: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },

  signOutBtn: {
    backgroundColor: colors.surfaceContainer, borderRadius: 50,
    paddingVertical: 18, alignItems: 'center',
  },
  signOutTxt: { color: colors.onSurfaceVariant, fontWeight: '800', fontSize: fs(11), letterSpacing: 1.5 },

  // Sign-out modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalBox: {
    backgroundColor: colors.surfaceContainerHigh, borderRadius: 24,
    padding: 32, width: '100%', maxWidth: 400, gap: 10,
  },
  modalTitle: { fontSize: fs(20), fontWeight: '900', color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  modalBody:  { fontSize: fs(14), color: colors.onSurfaceVariant, lineHeight: 22, marginBottom: 8 },
  modalConfirmBtn: {
    backgroundColor: colors.secondary, borderRadius: 50,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  modalConfirmTxt: { color: '#fff', fontWeight: '900', fontSize: fs(12), letterSpacing: 1.5 },
  modalCancelBtn:  { paddingVertical: 16, alignItems: 'center' },
  modalCancelTxt:  { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: fs(12), letterSpacing: 1 },
});

const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  label: {
    width: 150, fontSize: fs(9), fontWeight: '800',
    color: colors.onSurfaceVariant, letterSpacing: 1.5,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: fs(14),
    fontWeight: '600',
    textAlign: 'right',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  } as any,
});
