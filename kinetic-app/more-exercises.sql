-- Run this in Supabase SQL Editor to add more exercises
-- First, get muscle group IDs:
-- SELECT id, name FROM muscle_groups;
-- Then replace the UUIDs below with your actual muscle_group_id values.

-- ─── CHEST ────────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Incline Barbell Press',   id, 'intermediate', 'barbell',   4, '6-8',  'Upper chest emphasis on incline bench'    FROM muscle_groups WHERE name = 'Chest'
UNION ALL
SELECT 'Decline Push-Up',         id, 'beginner',     'bodyweight',3, '12-15','Feet elevated for lower chest'            FROM muscle_groups WHERE name = 'Chest'
UNION ALL
SELECT 'Cable Crossover',         id, 'intermediate', 'cable',     3, '12-15','Squeeze at the centre for chest isolation' FROM muscle_groups WHERE name = 'Chest'
UNION ALL
SELECT 'Chest Dip',               id, 'intermediate', 'bodyweight',3, '8-12', 'Lean forward to hit chest over triceps'   FROM muscle_groups WHERE name = 'Chest'
UNION ALL
SELECT 'Pec Deck Machine',        id, 'beginner',     'machine',   3, '12-15','Machine fly for chest isolation'          FROM muscle_groups WHERE name = 'Chest'
UNION ALL
SELECT 'Dumbbell Pullover',       id, 'intermediate', 'dumbbell',  3, '10-12','Stretches chest and engages lats'         FROM muscle_groups WHERE name = 'Chest';

-- ─── BACK ─────────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Barbell Row',             id, 'intermediate', 'barbell',   4, '6-8',  'Compound row for thickness'               FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'T-Bar Row',               id, 'intermediate', 'barbell',   3, '8-10', 'Great for mid-back and rhomboids'         FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Seated Cable Row',        id, 'beginner',     'cable',     3, '10-12','Neutral grip for full lat stretch'        FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Single-Arm Dumbbell Row', id, 'beginner',     'dumbbell',  3, '10-12','Unilateral for imbalance correction'      FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Pull-Up',                 id, 'intermediate', 'bodyweight',3, '6-10', 'Classic vertical pull compound lift'      FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Lat Pulldown',            id, 'beginner',     'cable',     3, '10-12','Machine lat isolation'                    FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Straight-Arm Pulldown',   id, 'intermediate', 'cable',     3, '12-15','Isolates lats through full range'         FROM muscle_groups WHERE name = 'Back'
UNION ALL
SELECT 'Face Pull',               id, 'beginner',     'cable',     3, '15-20','Rear delt and rotator cuff health'        FROM muscle_groups WHERE name = 'Back';

-- ─── SHOULDERS ────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Barbell Overhead Press',  id, 'intermediate', 'barbell',   4, '5-8',  'King of shoulder mass builders'           FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Arnold Press',            id, 'intermediate', 'dumbbell',  3, '10-12','Rotational press hits all 3 delt heads'   FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Lateral Raise',           id, 'beginner',     'dumbbell',  3, '12-15','Isolates medial deltoid for width'        FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Front Raise',             id, 'beginner',     'dumbbell',  3, '12-15','Targets anterior deltoid'                 FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Rear Delt Fly',           id, 'beginner',     'dumbbell',  3, '15-20','Posterior delt isolation'                 FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Cable Lateral Raise',     id, 'beginner',     'cable',     3, '15-20','Constant tension lateral raise'           FROM muscle_groups WHERE name = 'Shoulders'
UNION ALL
SELECT 'Machine Shoulder Press',  id, 'beginner',     'machine',   3, '10-12','Guided press for beginners'               FROM muscle_groups WHERE name = 'Shoulders';

-- ─── BICEPS ───────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Barbell Curl',            id, 'beginner',     'barbell',   3, '8-12', 'Classic mass-building bicep curl'         FROM muscle_groups WHERE name = 'Biceps'
UNION ALL
SELECT 'Incline Dumbbell Curl',   id, 'intermediate', 'dumbbell',  3, '10-12','Long head stretch for peak'               FROM muscle_groups WHERE name = 'Biceps'
UNION ALL
SELECT 'Hammer Curl',             id, 'beginner',     'dumbbell',  3, '10-12','Brachialis and brachioradialis focus'     FROM muscle_groups WHERE name = 'Biceps'
UNION ALL
SELECT 'Concentration Curl',      id, 'beginner',     'dumbbell',  3, '12-15','Peak contraction isolation'               FROM muscle_groups WHERE name = 'Biceps'
UNION ALL
SELECT 'Cable Curl',              id, 'beginner',     'cable',     3, '12-15','Constant tension throughout the rep'      FROM muscle_groups WHERE name = 'Biceps'
UNION ALL
SELECT 'Preacher Curl',           id, 'beginner',     'barbell',   3, '10-12','Prevents cheating, max bicep isolation'   FROM muscle_groups WHERE name = 'Biceps';

-- ─── TRICEPS ──────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Close-Grip Bench Press',  id, 'intermediate', 'barbell',   4, '6-10', 'Compound tricep builder'                  FROM muscle_groups WHERE name = 'Triceps'
UNION ALL
SELECT 'Skull Crusher',           id, 'intermediate', 'barbell',   3, '8-12', 'Long head tricep extension'               FROM muscle_groups WHERE name = 'Triceps'
UNION ALL
SELECT 'Tricep Dip',              id, 'beginner',     'bodyweight',3, '10-15','Bodyweight tricep compound'               FROM muscle_groups WHERE name = 'Triceps'
UNION ALL
SELECT 'Overhead Tricep Extension',id,'intermediate', 'dumbbell',  3, '10-12','Stretches long head under load'           FROM muscle_groups WHERE name = 'Triceps'
UNION ALL
SELECT 'Tricep Kickback',         id, 'beginner',     'dumbbell',  3, '12-15','Isolation for lateral head'               FROM muscle_groups WHERE name = 'Triceps'
UNION ALL
SELECT 'Cable Overhead Extension',id, 'beginner',     'cable',     3, '12-15','Constant tension overhead ext'            FROM muscle_groups WHERE name = 'Triceps';

-- ─── ABS / CORE ───────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Cable Crunch',            id, 'beginner',     'cable',     3, '15-20','Weighted crunch with constant tension'    FROM muscle_groups WHERE name = 'Abs'
UNION ALL
SELECT 'Hanging Leg Raise',       id, 'intermediate', 'bodyweight',3, '10-15','Full lower ab range of motion'            FROM muscle_groups WHERE name = 'Abs'
UNION ALL
SELECT 'Russian Twist',           id, 'beginner',     'bodyweight',3, '20',   'Oblique rotation exercise'                FROM muscle_groups WHERE name = 'Abs'
UNION ALL
SELECT 'Ab Wheel Rollout',        id, 'advanced',     'bodyweight',3, '8-12', 'Full core stability challenge'            FROM muscle_groups WHERE name = 'Abs'
UNION ALL
SELECT 'Dragon Flag',             id, 'advanced',     'bodyweight',3, '6-8',  'Full-body core control movement'          FROM muscle_groups WHERE name = 'Abs'
UNION ALL
SELECT 'Bicycle Crunch',          id, 'beginner',     'bodyweight',3, '20',   'Oblique and rectus abdominis'             FROM muscle_groups WHERE name = 'Abs';

-- ─── QUADS ────────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Barbell Back Squat',      id, 'intermediate', 'barbell',   4, '5-8',  'King of all lower body exercises'        FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Front Squat',             id, 'advanced',     'barbell',   4, '5-8',  'Quad-dominant squat variation'            FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Bulgarian Split Squat',   id, 'intermediate', 'dumbbell',  3, '10-12','Unilateral quad builder'                  FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Hack Squat',              id, 'intermediate', 'machine',   3, '10-12','Machine squat for quad isolation'         FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Leg Extension',           id, 'beginner',     'machine',   3, '12-15','Strict quad isolation machine'            FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Walking Lunge',           id, 'beginner',     'dumbbell',  3, '12',   'Dynamic unilateral leg exercise'          FROM muscle_groups WHERE name = 'Quads'
UNION ALL
SELECT 'Goblet Squat',            id, 'beginner',     'dumbbell',  3, '12-15','Beginner-friendly squat pattern'          FROM muscle_groups WHERE name = 'Quads';

-- ─── HAMSTRINGS ───────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Romanian Deadlift',       id, 'intermediate', 'barbell',   4, '8-10', 'Hip hinge for hamstring stretch'          FROM muscle_groups WHERE name = 'Hamstrings'
UNION ALL
SELECT 'Lying Leg Curl',          id, 'beginner',     'machine',   3, '10-12','Isolated hamstring flexion'               FROM muscle_groups WHERE name = 'Hamstrings'
UNION ALL
SELECT 'Seated Leg Curl',         id, 'beginner',     'machine',   3, '12-15','Greater stretch than lying variation'     FROM muscle_groups WHERE name = 'Hamstrings'
UNION ALL
SELECT 'Nordic Hamstring Curl',   id, 'advanced',     'bodyweight',3, '4-6',  'Eccentric hamstring strengthening'        FROM muscle_groups WHERE name = 'Hamstrings'
UNION ALL
SELECT 'Good Morning',            id, 'intermediate', 'barbell',   3, '10-12','Hamstring and lower back compound'        FROM muscle_groups WHERE name = 'Hamstrings'
UNION ALL
SELECT 'Dumbbell Romanian DL',    id, 'beginner',     'dumbbell',  3, '10-12','Hip hinge with dumbbells'                 FROM muscle_groups WHERE name = 'Hamstrings';

-- ─── GLUTES ───────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Hip Thrust',              id, 'beginner',     'barbell',   4, '10-12','Best glute activation exercise'           FROM muscle_groups WHERE name = 'Glutes'
UNION ALL
SELECT 'Cable Kickback',          id, 'beginner',     'cable',     3, '15-20','Glute isolation with cable'               FROM muscle_groups WHERE name = 'Glutes'
UNION ALL
SELECT 'Sumo Deadlift',           id, 'intermediate', 'barbell',   3, '5-8',  'Wide stance for glute emphasis'           FROM muscle_groups WHERE name = 'Glutes'
UNION ALL
SELECT 'Glute Bridge',            id, 'beginner',     'bodyweight',3, '15-20','Bodyweight glute activation'              FROM muscle_groups WHERE name = 'Glutes'
UNION ALL
SELECT 'Step-Up',                 id, 'beginner',     'dumbbell',  3, '12',   'Unilateral glute and quad exercise'       FROM muscle_groups WHERE name = 'Glutes';

-- ─── CALVES ───────────────────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group_id, difficulty, equipment, sets_suggestion, reps_suggestion, description)
SELECT 'Standing Calf Raise',     id, 'beginner',     'machine',   4, '15-20','Gastrocnemius emphasis'                   FROM muscle_groups WHERE name = 'Calves'
UNION ALL
SELECT 'Seated Calf Raise',       id, 'beginner',     'machine',   3, '15-20','Soleus emphasis when knee is bent'        FROM muscle_groups WHERE name = 'Calves'
UNION ALL
SELECT 'Donkey Calf Raise',       id, 'intermediate', 'bodyweight',3, '15-20','Greater gastrocnemius stretch'            FROM muscle_groups WHERE name = 'Calves'
UNION ALL
SELECT 'Single-Leg Calf Raise',   id, 'beginner',     'bodyweight',3, '15-20','Unilateral balance and strength'          FROM muscle_groups WHERE name = 'Calves';
