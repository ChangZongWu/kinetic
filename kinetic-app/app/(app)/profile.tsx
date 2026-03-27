import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const GOALS = [
  { key: 'strength',    label: 'STRENGTH'    },
  { key: 'hypertrophy', label: 'HYPERTROPHY' },
  { key: 'endurance',   label: 'ENDURANCE'   },
  { key: 'fat_loss',    label: 'FAT LOSS'    },
];

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [email, setEmail]       = useState('');

  const [fullName,  setFullName]  = useState('');
  const [age,       setAge]       = useState('');
  const [weightKg,  setWeightKg]  = useState('');
  const [heightCm,  setHeightCm]  = useState('');
  const [goal,      setGoal]      = useState('');
  const [units,     setUnits]     = useState('metric');

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
      const res = await fetch(`${API_URL}/profile`, { headers });
      if (res.ok) {
        const p = await res.json();
        setFullName(p.full_name  ?? '');
        setAge(      p.age        ? String(p.age)        : '');
        setWeightKg( p.weight_kg  ? String(p.weight_kg)  : '');
        setHeightCm( p.height_cm  ? String(p.height_cm)  : '');
        setGoal(     p.goal       ?? '');
        setUnits(    p.units      ?? 'metric');
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
      if (goal)                                 body.goal      = goal;
      if (units)                                body.units     = units;

      const res = await fetch(`${API_URL}/profile`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Alert.alert('Saved', 'Profile updated.');
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
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
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.emailText}>{email}</Text>
        <Text style={s.hint}>Edit your profile below</Text>
      </View>

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

      {/* Units */}
      <Text style={s.sectionLabel}>UNITS</Text>
      <View style={s.card}>
        <View style={s.unitRow}>
          {(['metric', 'imperial'] as const).map(u => (
            <TouchableOpacity
              key={u}
              style={[s.unitChip, units === u && s.chipOn]}
              onPress={() => setUnits(u)}
            >
              <Text style={[s.chipTxt, units === u && s.chipTxtOn]}>{u.toUpperCase()}</Text>
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
      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutTxt}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 24 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 36, gap: 6 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: colors.onPrimaryContainer },
  emailText:  { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  hint:       { fontSize: 11, color: colors.onSurfaceVariant },

  sectionLabel: {
    fontSize: 9, fontWeight: '800', color: colors.onSurfaceVariant,
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 16, marginBottom: 20,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitRow:  { flexDirection: 'row', gap: 10 },

  chip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  unitChip: {
    flex: 1, backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 50, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  chipOn:    { backgroundColor: colors.primaryContainer + '22', borderColor: colors.primaryContainer },
  chipTxt:   { fontSize: 10, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  chipTxtOn: { color: colors.primaryContainer },

  saveBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 50,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
  },
  saveBtnOff: { backgroundColor: colors.surfaceContainerHigh },
  saveTxt: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },

  signOutBtn: {
    backgroundColor: colors.surfaceContainer, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center',
  },
  signOutTxt: { color: colors.onSurfaceVariant, fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
});

const fr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  label: {
    width: 130, fontSize: 9, fontWeight: '800',
    color: colors.onSurfaceVariant, letterSpacing: 1.5,
  },
  input: {
    flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: '600', textAlign: 'right',
  },
});
