import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { fs } from '../../theme/scale';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!fullName) { setError('Full name is required.'); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            units: 'metric',
            tier: 'free',
          });
        }
      }
      router.replace('/(app)/dashboard');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scroll, isMobile && styles.scrollMobile]} keyboardShouldPersistTaps="handled">
        {/* Left hero panel — hidden on mobile */}
        {!isMobile && <View style={styles.hero}>
          <Text style={styles.heroLogo}>KINETIC</Text>
          <Text style={styles.heroTitle}>PERFORMANCE.{'\n'}UNLOCKED.</Text>
          <Text style={styles.heroSub}>AI-powered workout planning{'\n'}built for peak athletes.</Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatNum}>01.</Text>
              <Text style={styles.heroStatLabel}>PRECISION{'\n'}TRACKING</Text>
            </View>
            <View>
              <Text style={styles.heroStatNum}>02.</Text>
              <Text style={styles.heroStatLabel}>AI{'\n'}OPTIMIZATION</Text>
            </View>
          </View>
        </View>}

        {/* Form panel */}
        <View style={[styles.formPanel, isMobile && styles.formPanelMobile]}>
          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                LOGIN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                SIGN UP
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Welcome Back.' : 'Join Kinetic.'}
          </Text>
          <Text style={styles.formSub}>
            {mode === 'login'
              ? 'Access your performance metrics and builder tools.'
              : 'Create your account to start building your plan.'}
          </Text>

          {/* Fields */}
          {mode === 'signup' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Alex Johnson"
                placeholderTextColor={colors.outlineVariant}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="name@kinetic.ai"
              placeholderTextColor={colors.outlineVariant}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.outlineVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.onPrimaryContainer} />
              : <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    flexDirection: 'row',
    minHeight: '100%',
  },

  // Hero (left side — hidden on narrow screens via minWidth trick)
  hero: {
    flex: 1,
    minWidth: 320,
    maxWidth: 560,
    backgroundColor: '#0a0a0a',
    padding: 48,
    justifyContent: 'space-between',
    // On mobile the ScrollView will just clip this naturally
    display: 'flex',
  },
  heroLogo: {
    color: colors.primaryContainer,
    fontSize: fs(22),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroTitle: {
    color: colors.primaryContainer,
    fontSize: fs(52),
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 60,
    marginTop: 24,
  },
  heroSub: {
    color: colors.onSurfaceVariant,
    fontSize: fs(13),
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 40,
  },
  heroStatNum: {
    color: colors.primaryContainer,
    fontSize: fs(22),
    fontWeight: '700',
  },
  heroStatLabel: {
    color: colors.onSurfaceVariant,
    fontSize: fs(9),
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  scrollMobile: {
    flexDirection: 'column',
  },

  // Form panel (right side)
  formPanel: {
    flex: 1,
    minWidth: 300,
    backgroundColor: colors.surfaceContainer,
    padding: 48,
    justifyContent: 'center',
  },
  formPanelMobile: {
    padding: 32,
    minWidth: 0,
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 50,
    padding: 4,
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  tab: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
  },
  tabActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabText: {
    fontSize: fs(10),
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onPrimaryContainer,
  },
  formTitle: {
    fontSize: fs(32),
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  formSub: {
    fontSize: fs(13),
    color: colors.onSurfaceVariant,
    marginBottom: 32,
  },
  fieldGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: colors.onSurface,
    fontSize: fs(14),
  } as any,
  errorText: {
    color: colors.secondary,
    fontSize: fs(12),
    marginBottom: 12,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 50,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.onPrimaryContainer,
    fontWeight: '900',
    fontSize: fs(12),
    letterSpacing: 2,
  },
});
