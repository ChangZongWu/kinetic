import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const { width } = Dimensions.get('window');

const GOALS = [
  { key: 'strength',    label: 'STRENGTH',    icon: '🏋️', desc: 'Build max power & 1RM' },
  { key: 'hypertrophy', label: 'HYPERTROPHY', icon: '💪', desc: 'Grow muscle size & mass' },
  { key: 'endurance',   label: 'ENDURANCE',   icon: '🏃', desc: 'Improve stamina & cardio' },
  { key: 'fat_loss',    label: 'FAT LOSS',    icon: '🔥', desc: 'Burn fat & get lean' },
];

const LEVELS = [
  { key: 'beginner',     label: 'BEGINNER',     desc: 'Less than 1 year of training' },
  { key: 'intermediate', label: 'INTERMEDIATE', desc: '1–3 years of consistent training' },
  { key: 'advanced',     label: 'ADVANCED',     desc: '3+ years, serious lifting' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingOverlay({ onComplete }: Props) {
  const [step,  setStep]  = useState(0);
  const [goal,  setGoal]  = useState('');
  const [level, setLevel] = useState('');
  const fadeAnim          = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  function nextStep() {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(s => s + 1), 150);
  }

  async function finish() {
    try {
      // Save goal + fitness level to profile
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token && (goal || level)) {
        await fetch(`${API_URL}/profile`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(goal  ? { goal }           : {}),
            ...(level ? { fitness_level: level } : {}),
          }),
        });
      }
    } catch {}
    await AsyncStorage.setItem('kinetic_onboarded', 'true');
    onComplete();
  }

  async function skip() {
    await AsyncStorage.setItem('kinetic_onboarded', 'true');
    onComplete();
  }

  return (
    <View style={s.overlay}>
      <Animated.View style={[s.container, { opacity: fadeAnim }]}>

        {/* Progress dots */}
        <View style={s.dots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.dot, step === i && s.dotActive]} />
          ))}
        </View>

        {/* ── Step 0: Goal ─────────────────────────────────────── */}
        {step === 0 && (
          <View style={s.stepContent}>
            <Text style={s.welcome}>WELCOME TO</Text>
            <Text style={s.brand}>KINETIC</Text>
            <Text style={s.subtitle}>What's your primary fitness goal?</Text>

            <View style={s.optionList}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.key}
                  style={[s.optionCard, goal === g.key && s.optionCardOn]}
                  onPress={() => setGoal(g.key)}
                  activeOpacity={0.8}
                >
                  <Text style={s.optionIcon}>{g.icon}</Text>
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, goal === g.key && s.optionLabelOn]}>{g.label}</Text>
                    <Text style={s.optionDesc}>{g.desc}</Text>
                  </View>
                  <View style={[s.radio, goal === g.key && s.radioOn]}>
                    {goal === g.key && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, !goal && s.btnDisabled]}
              onPress={nextStep}
              disabled={!goal}
            >
              <Text style={s.btnText}>CONTINUE →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={skip}>
              <Text style={s.skipText}>SKIP SETUP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 1: Experience ───────────────────────────────── */}
        {step === 1 && (
          <View style={s.stepContent}>
            <Text style={s.stepTag}>STEP 2 OF 3</Text>
            <Text style={s.stepTitle}>What's your{'\n'}experience level?</Text>
            <Text style={s.stepSub}>This helps us tailor exercise difficulty for you.</Text>

            <View style={s.optionList}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[s.optionCard, level === l.key && s.optionCardOn]}
                  onPress={() => setLevel(l.key)}
                  activeOpacity={0.8}
                >
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, level === l.key && s.optionLabelOn]}>{l.label}</Text>
                    <Text style={s.optionDesc}>{l.desc}</Text>
                  </View>
                  <View style={[s.radio, level === l.key && s.radioOn]}>
                    {level === l.key && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, !level && s.btnDisabled]}
              onPress={nextStep}
              disabled={!level}
            >
              <Text style={s.btnText}>CONTINUE →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={() => setStep(2)}>
              <Text style={s.skipText}>SKIP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Ready ────────────────────────────────────── */}
        {step === 2 && (
          <View style={s.stepContent}>
            <Text style={s.readyIcon}>✦</Text>
            <Text style={s.readyTitle}>YOU'RE{'\n'}ALL SET.</Text>
            <Text style={s.readySub}>
              Here's how Kinetic works:
            </Text>

            <View style={s.howList}>
              {[
                { n: '01', title: 'MUSCLE SELECTOR', desc: 'Tap muscles on the body map to discover exercises' },
                { n: '02', title: 'WORKOUT BUILDER',  desc: 'Build weekly plans with sets, reps & weights' },
                { n: '03', title: 'PROGRESS',         desc: 'Log workouts and track your volume over time' },
                { n: '04', title: 'AI ADVISOR',       desc: 'Ask your Claude-powered coach anything' },
              ].map(item => (
                <View key={item.n} style={s.howRow}>
                  <Text style={s.howNum}>{item.n}</Text>
                  <View style={s.howText}>
                    <Text style={s.howTitle}>{item.title}</Text>
                    <Text style={s.howDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.btn} onPress={finish}>
              <Text style={s.btnText}>START TRAINING →</Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.background,
    zIndex: 1000,
    justifyContent: 'center', alignItems: 'center',
  },
  container: {
    width: '100%', maxWidth: 480,
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40,
    flex: 1,
  },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 32, justifyContent: 'center' },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHighest },
  dotActive: { width: 20, backgroundColor: colors.primaryContainer },

  stepContent: { flex: 1, justifyContent: 'center' },

  // Step 0
  welcome: { fontSize: 11, color: colors.onSurfaceVariant, letterSpacing: 4, marginBottom: 4 },
  brand:   { fontSize: 56, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -2, lineHeight: 56, marginBottom: 12 },
  subtitle:{ fontSize: 18, color: colors.onSurface, fontWeight: '700', marginBottom: 28 },

  // Step 1
  stepTag:   { fontSize: 9, color: colors.primaryContainer, letterSpacing: 3, fontWeight: '700', marginBottom: 12 },
  stepTitle: { fontSize: 34, fontWeight: '900', color: colors.onSurface, letterSpacing: -1, lineHeight: 38, marginBottom: 8 },
  stepSub:   { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 28, lineHeight: 20 },

  // Options
  optionList: { gap: 10, marginBottom: 28 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optionCardOn: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceContainerHigh },
  optionIcon:  { fontSize: 24 },
  optionText:  { flex: 1 },
  optionLabel: { fontSize: 13, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  optionLabelOn: { color: colors.primaryContainer },
  optionDesc:  { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  radioOn:     { borderColor: colors.primaryContainer },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryContainer },

  // Buttons
  btn:         { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  btnText:     { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  skipBtn:     { alignItems: 'center', paddingVertical: 10 },
  skipText:    { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  // Step 2
  readyIcon:  { fontSize: 48, color: colors.primaryContainer, textAlign: 'center', marginBottom: 16 },
  readyTitle: { fontSize: 48, fontWeight: '900', color: colors.onSurface, letterSpacing: -2, lineHeight: 50, marginBottom: 20 },
  readySub:   { fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 20 },
  howList:    { gap: 14, marginBottom: 32 },
  howRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  howNum:     { fontSize: 11, fontWeight: '900', color: colors.primaryContainer, letterSpacing: 1, width: 28, paddingTop: 2 },
  howText:    { flex: 1 },
  howTitle:   { fontSize: 11, fontWeight: '800', color: colors.onSurface, letterSpacing: 1.5, marginBottom: 2 },
  howDesc:    { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 18 },
});
