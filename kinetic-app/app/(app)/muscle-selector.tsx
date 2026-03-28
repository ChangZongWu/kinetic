import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, {
  Ellipse,
  Circle,
  Rect,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../../theme/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface MuscleGroup {
  id: string;
  name: string;
  body_region: string;
}

async function fetchMuscles(): Promise<MuscleGroup[]> {
  const res = await fetch(`${API_URL}/muscles`);
  if (!res.ok) throw new Error('Failed to load muscles');
  return res.json();
}

// ── SVG Body Map ───────────────────────────────────────────────────────────────

const SILHOUETTE  = '#20201f';
const LIME        = '#cefc22';
const INACTIVE_F  = '#262626';
const INACTIVE_S  = '#484847';
const LABEL_ON    = '#4b5e00';
const LABEL_OFF   = '#6e6e6e';

interface RegionDef {
  name: string;   // matches API muscle name
  cx: number; cy: number; rx: number; ry: number;
  label: string;
}

const FRONT_REGIONS: RegionDef[] = [
  { name: 'Shoulders', cx: 48,  cy: 103, rx: 18, ry: 15, label: 'DELT'  },
  { name: 'Shoulders', cx: 152, cy: 103, rx: 18, ry: 15, label: 'DELT'  },
  { name: 'Chest',     cx: 100, cy: 131, rx: 36, ry: 23, label: 'CHEST' },
  { name: 'Biceps',    cx: 33,  cy: 158, rx: 12, ry: 25, label: 'BIC'   },
  { name: 'Biceps',    cx: 167, cy: 158, rx: 12, ry: 25, label: 'BIC'   },
  { name: 'Abs',       cx: 100, cy: 178, rx: 26, ry: 30, label: 'ABS'   },
  { name: 'Quads',     cx: 76,  cy: 270, rx: 22, ry: 48, label: 'QUAD'  },
  { name: 'Quads',     cx: 124, cy: 270, rx: 22, ry: 48, label: 'QUAD'  },
  { name: 'Calves',    cx: 76,  cy: 368, rx: 16, ry: 36, label: 'CALF'  },
  { name: 'Calves',    cx: 124, cy: 368, rx: 16, ry: 36, label: 'CALF'  },
];

const BACK_REGIONS: RegionDef[] = [
  { name: 'Shoulders',  cx: 48,  cy: 103, rx: 18, ry: 15, label: 'DELT'   },
  { name: 'Shoulders',  cx: 152, cy: 103, rx: 18, ry: 15, label: 'DELT'   },
  { name: 'Back',       cx: 100, cy: 149, rx: 44, ry: 55, label: 'LATS'   },
  { name: 'Triceps',    cx: 33,  cy: 158, rx: 12, ry: 25, label: 'TRI'    },
  { name: 'Triceps',    cx: 167, cy: 158, rx: 12, ry: 25, label: 'TRI'    },
  { name: 'Glutes',     cx: 100, cy: 231, rx: 48, ry: 24, label: 'GLUTES' },
  { name: 'Hamstrings', cx: 76,  cy: 280, rx: 22, ry: 47, label: 'HAMS'  },
  { name: 'Hamstrings', cx: 124, cy: 280, rx: 22, ry: 47, label: 'HAMS'  },
  { name: 'Calves',     cx: 76,  cy: 372, rx: 16, ry: 35, label: 'CALF'  },
  { name: 'Calves',     cx: 124, cy: 372, rx: 16, ry: 35, label: 'CALF'  },
];

function BodyMap({
  muscles,
  selected,
  onToggle,
  view,
}: {
  muscles: MuscleGroup[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  view: 'front' | 'back';
}) {
  function isSel(name: string) {
    return !!(muscles.find(m => m.name === name) && selected.has(muscles.find(m => m.name === name)!.id));
  }

  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  return (
    <Svg viewBox="0 0 200 430" height={420} width="100%">

      {/* ── Silhouette background ──────────────────────────────── */}
      <Circle cx={100} cy={44}  r={26}                    fill={SILHOUETTE} />
      <Rect   x={91}  y={69}   width={18} height={18} rx={6} fill={SILHOUETTE} />
      <Ellipse cx={100} cy={155} rx={50} ry={78}           fill={SILHOUETTE} />
      {/* Arms */}
      <Ellipse cx={37}  cy={149} rx={14} ry={43}           fill={SILHOUETTE} />
      <Ellipse cx={163} cy={149} rx={14} ry={43}           fill={SILHOUETTE} />
      <Ellipse cx={28}  cy={215} rx={11} ry={32}           fill={SILHOUETTE} />
      <Ellipse cx={172} cy={215} rx={11} ry={32}           fill={SILHOUETTE} />
      {/* Legs */}
      <Ellipse cx={76}  cy={272} rx={25} ry={52}           fill={SILHOUETTE} />
      <Ellipse cx={124} cy={272} rx={25} ry={52}           fill={SILHOUETTE} />
      <Ellipse cx={76}  cy={368} rx={18} ry={40}           fill={SILHOUETTE} />
      <Ellipse cx={124} cy={368} rx={18} ry={40}           fill={SILHOUETTE} />
      <Ellipse cx={76}  cy={408} rx={16} ry={10}           fill={SILHOUETTE} />
      <Ellipse cx={124} cy={408} rx={16} ry={10}           fill={SILHOUETTE} />

      {/* ── Muscle regions ─────────────────────────────────────── */}
      {regions.map((r, i) => {
        const on = isSel(r.name);
        return (
          <G key={`${r.name}-${i}`} onPress={() => onToggle(r.name)}>
            <Ellipse
              cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry}
              fill={on ? LIME : INACTIVE_F}
              stroke={on ? LIME : INACTIVE_S}
              strokeWidth={1}
              opacity={on ? 0.92 : 0.75}
            />
            <SvgText
              x={r.cx} y={r.cy}
              dy="0.35em"
              textAnchor="middle"
              fontSize={7}
              fontWeight="bold"
              fill={on ? LABEL_ON : LABEL_OFF}
            >
              {r.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MuscleSelector() {
  const router = useRouter();
  const { mode, planId, day } = useLocalSearchParams<{ mode?: string; planId?: string; day?: string }>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: muscles, isLoading, isError } = useQuery({
    queryKey: ['muscles'],
    queryFn: fetchMuscles,
  });

  function toggleMuscle(muscle: MuscleGroup) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(muscle.id) ? next.delete(muscle.id) : next.add(muscle.id);
      return next;
    });
  }

  function toggleMuscleByName(name: string) {
    const muscle = muscles?.find(m => m.name === name);
    if (muscle) toggleMuscle(muscle);
  }

  function handleViewExercises() {
    if (selected.size === 0) return;
    const muscleIds = Array.from(selected).join(',');
    const selectedMuscles = muscles?.filter(m => selected.has(m.id)) ?? [];
    const muscleName = selectedMuscles.length === 1
      ? selectedMuscles[0].name
      : `${selectedMuscles.length} Muscles`;
    router.push({
      pathname: '/(app)/exercise-list',
      params: { muscleId: muscleIds, muscleName, ...(mode ? { mode, planId, day } : {}) },
    });
  }

  if (isLoading) return <View style={s.center}><ActivityIndicator color={colors.primaryContainer} size="large" /></View>;
  if (isError)   return <View style={s.center}><Text style={s.errText}>Could not load muscles.</Text></View>;

  const sections = [
    { title: 'FRONT', key: 'front', items: muscles?.filter(m => m.body_region === 'front') ?? [] },
    { title: 'BACK',  key: 'back',  items: muscles?.filter(m => m.body_region === 'back')  ?? [] },
    { title: 'CORE',  key: 'core',  items: muscles?.filter(m => m.body_region === 'core')  ?? [] },
  ];

  const selectedNames = muscles?.filter(m => selected.has(m.id)).map(m => m.name) ?? [];

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, selected.size > 0 && { paddingBottom: 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>TARGET</Text>
            <Text style={s.titleAccent}>ZONES</Text>
          </View>
          <Text style={s.selectedCount}>
            {selected.size === 0 ? 'TAP TO SELECT' : `${selected.size} SELECTED`}
          </Text>
        </View>

        {/* SVG Body Maps — side by side */}
        <View style={s.mapsRow}>
          <View style={s.mapHalf}>
            <Text style={s.mapLabel}>ANTERIOR</Text>
            <BodyMap
              muscles={muscles ?? []}
              selected={selected}
              onToggle={toggleMuscleByName}
              view="front"
            />
          </View>
          <View style={s.mapDivider} />
          <View style={s.mapHalf}>
            <Text style={s.mapLabel}>POSTERIOR</Text>
            <BodyMap
              muscles={muscles ?? []}
              selected={selected}
              onToggle={toggleMuscleByName}
              view="back"
            />
          </View>
        </View>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerTxt}>OR SELECT FROM LIST</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Muscle list */}
        {sections.map(section => (
          section.items.length > 0 && (
            <View key={section.key} style={s.section}>
              <Text style={[s.sectionTitle, {
                color: section.key === 'front' ? colors.primaryContainer
                      : section.key === 'back'  ? colors.tertiary
                      : colors.secondary,
              }]}>
                {section.title}
              </Text>
              {section.items.map(muscle => {
                const isActive = selected.has(muscle.id);
                const accent = section.key === 'front' ? colors.primaryContainer
                             : section.key === 'back'  ? colors.tertiary
                             : colors.secondary;
                return (
                  <TouchableOpacity
                    key={muscle.id}
                    style={[s.muscleRow, isActive && { ...s.muscleRowActive, borderLeftColor: accent }]}
                    onPress={() => toggleMuscle(muscle)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.iconBox, isActive && { backgroundColor: accent + '22' }]}>
                      <Text style={[s.icon, { color: isActive ? accent : colors.onSurfaceVariant }]}>
                        {isActive ? '●' : '○'}
                      </Text>
                    </View>
                    <Text style={[s.muscleName, isActive && { color: colors.onSurface }]}>
                      {muscle.name.toUpperCase()}
                    </Text>
                    <View style={[s.check, isActive && { backgroundColor: accent, borderColor: accent }]}>
                      {isActive && <Text style={s.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ))}
      </ScrollView>

      {/* Sticky CTA */}
      {selected.size > 0 && (
        <View style={s.cta}>
          <View style={s.ctaInner}>
            <View style={s.ctaLeft}>
              <Text style={s.ctaCount}>{selected.size}</Text>
              <View style={s.ctaNames}>
                <Text style={s.ctaLabel}>MUSCLE{selected.size > 1 ? 'S' : ''} SELECTED</Text>
                <Text style={s.ctaNamesText} numberOfLines={1}>{selectedNames.join(' · ')}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.ctaBtn} onPress={handleViewExercises} activeOpacity={0.85}>
              <Text style={s.ctaBtnText}>VIEW EXERCISES ›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setSelected(new Set())} style={s.clearBtn}>
            <Text style={s.clearBtnText}>CLEAR SELECTION</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errText: { color: colors.secondary, fontSize: 14 },
  scroll:  { paddingBottom: 32 },

  header: {
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  title:         { fontSize: 36, fontWeight: '900', color: colors.onSurface, letterSpacing: -1, lineHeight: 38 },
  titleAccent:   { fontSize: 36, fontWeight: '900', color: colors.primaryContainer, letterSpacing: -1, lineHeight: 40 },
  selectedCount: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2.5 },

  // Body maps side by side
  mapsRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20, overflow: 'hidden',
    paddingVertical: 12,
  },
  mapHalf:    { flex: 1, alignItems: 'center' },
  mapLabel:   { fontSize: 8, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 2, marginBottom: 4 },
  mapDivider: { width: 1, backgroundColor: colors.outlineVariant + '44', marginVertical: 8 },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant + '44' },
  dividerTxt:  { fontSize: 8, color: colors.onSurfaceVariant, letterSpacing: 2, fontWeight: '700' },

  // Muscle list
  section:      { marginBottom: 20, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 3, marginBottom: 8, marginLeft: 2 },

  muscleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 5, gap: 12,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  muscleRowActive: { backgroundColor: colors.surfaceContainerHigh },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:       { fontSize: 14 },
  muscleName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  check: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: colors.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 11, color: colors.onPrimaryContainer, fontWeight: '900' },

  // CTA
  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surfaceContainerHigh,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant + '44',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, gap: 10,
  },
  ctaInner:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaCount:    { fontSize: 30, fontWeight: '900', color: colors.primaryContainer, lineHeight: 34 },
  ctaNames:    { flex: 1, gap: 2 },
  ctaLabel:    { fontSize: 8, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 2 },
  ctaNamesText:{ fontSize: 11, fontWeight: '700', color: colors.onSurface },
  ctaBtn:      { backgroundColor: colors.primaryContainer, borderRadius: 50, paddingHorizontal: 20, paddingVertical: 14 },
  ctaBtnText:  { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  clearBtn:    { alignItems: 'center' },
  clearBtnText:{ fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5 },
});
