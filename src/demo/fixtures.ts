/**
 * Academic Nexus - in-memory demo dataset.
 *
 * This is a straight port of supabase/migrations/0002_seed.sql to TypeScript.
 * Same people, same UUIDs, same bios, listings, reviews and message threads, so
 * the demo dataset and the SQL seed line up row for row.
 *
 * Everything is built fresh inside buildFixtures(), and every date is computed
 * relative to the moment the function is called, so the dataset always looks
 * current and the demo client can reset to a clean copy at any time.
 */

import type {
  AppRole,
  Availability,
  Booking,
  BookingStatus,
  EventLog,
  Listing,
  ListingFormat,
  Message,
  Payment,
  PaymentStatus,
  Profile,
  Review,
} from '@/types/db'

/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------ */

const MS_MINUTE = 60_000
const MS_DAY = 86_400_000

/** ISO timestamp for `days` before `nowMs` (fractional days allowed). */
function daysAgo(nowMs: number, days: number): string {
  return new Date(nowMs - days * MS_DAY).toISOString()
}

/** ISO timestamp for `days` after `nowMs`. */
function daysFromNow(nowMs: number, days: number): string {
  return new Date(nowMs + days * MS_DAY).toISOString()
}

/**
 * Session slot: midnight local time, shifted by `offsetDays`, at `hour`.
 * Mirrors `date_trunc('day', now()) + interval` from the SQL seed.
 * Negative offsets are past sessions, positive ones are upcoming.
 */
function slotAt(nowMs: number, offsetDays: number, hour: number): string {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** ISO timestamp `minutes` after another ISO timestamp. */
function plusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * MS_MINUTE).toISOString()
}

/** Small deterministic generator so the synthetic traffic spread is stable. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* ---------------------------------------------------------------------------
 * Identity constants - same literal UUIDs as the SQL seed
 * ------------------------------------------------------------------------ */

const EXPERT_MIRIAM = '11111111-1111-1111-1111-111111111101'
const EXPERT_DANIEL = '11111111-1111-1111-1111-111111111102'
const EXPERT_PRIYA = '11111111-1111-1111-1111-111111111103'
const EXPERT_TOMER = '11111111-1111-1111-1111-111111111104'
const EXPERT_SOFIA = '11111111-1111-1111-1111-111111111105'
const EXPERT_MARCUS = '11111111-1111-1111-1111-111111111106'
const EXPERT_HANNAH = '11111111-1111-1111-1111-111111111107'
const EXPERT_KWAME = '11111111-1111-1111-1111-111111111108'
const ADMIN_ELENA = '11111111-1111-1111-1111-111111111199'

const STUDENT_NOA = '22222222-2222-2222-2222-222222222201'
const STUDENT_CHRIS = '22222222-2222-2222-2222-222222222202'
const STUDENT_AISHA = '22222222-2222-2222-2222-222222222203'
const STUDENT_LIAM = '22222222-2222-2222-2222-222222222204'
const STUDENT_YUKI = '22222222-2222-2222-2222-222222222205'
const STUDENT_DIEGO = '22222222-2222-2222-2222-222222222206'
const STUDENT_PRISCILLA = '22222222-2222-2222-2222-222222222207'
const STUDENT_BEN = '22222222-2222-2222-2222-222222222208'
const STUDENT_MEI = '22222222-2222-2222-2222-222222222209'
const STUDENT_OMAR = '22222222-2222-2222-2222-222222222210'

/* ---------------------------------------------------------------------------
 * Raw tuple tables - compact source rows, expanded into typed objects below
 * ------------------------------------------------------------------------ */

/** id, full_name, role, bio, subjects, is_verified, created days ago */
type ProfileRow = [string, string, AppRole, string, string[] | null, boolean, number]

const PROFILE_ROWS: ProfileRow[] = [
  [
    EXPERT_MIRIAM,
    'Dr. Miriam Okonkwo',
    'expert',
    'Fifteen years of teaching real analysis and I still think the epsilon-delta definition is where most students quietly give up. I walk people through proof techniques until they stop memorizing templates and start seeing the structure underneath. Bring me the problem set you have been avoiding.',
    ['Mathematics', 'Real Analysis', 'Linear Algebra'],
    true,
    420,
  ],
  [
    EXPERT_DANIEL,
    'Daniel Reyes',
    'expert',
    'I wrote backend systems for six years before I started tutoring, so I care less about clever one-liners and more about whether your code is debuggable at 2am. Most students arrive stuck on recursion or pointers and leave able to trace their own stack. I teach in Python, C, and Java.',
    ['Computer Science', 'Algorithms', 'Data Structures'],
    true,
    390,
  ],
  [
    EXPERT_PRIYA,
    'Priya Raman',
    'expert',
    'My students usually arrive with an R script that runs and no idea whether the output means anything. We fix that part first. I cover regression, ANOVA, and experimental design, and I will make you say your hypothesis out loud before we touch the data.',
    ['Statistics', 'R', 'Experimental Design'],
    true,
    365,
  ],
  [
    EXPERT_TOMER,
    'Tomer Aviram',
    'expert',
    'I teach intermediate micro and econometrics, mostly to people who can do the algebra but cannot explain what the Lagrange multiplier is actually buying them. Expect a lot of graphs drawn badly by hand. I also help with Stata and R for empirical papers.',
    ['Economics', 'Econometrics', 'Microeconomics'],
    true,
    300,
  ],
  [
    EXPERT_SOFIA,
    'Sofia Lindqvist',
    'expert',
    'Mechanics and electromagnetism, first and second year. The fix is almost always drawing the free body diagram properly, and almost nobody does it. I also coach students through physics olympiad qualifiers.',
    ['Physics', 'Mechanics', 'Electromagnetism'],
    true,
    280,
  ],
  [
    EXPERT_MARCUS,
    'Marcus Bell',
    'expert',
    'I teach and edit academic writing, mostly thesis chapters and application essays. My rule is that if I cannot find your argument in the first paragraph, neither can your reader. I work in APA, MLA, and Chicago, and I will not write the thing for you.',
    ['Writing', 'Academic Writing', 'Editing'],
    true,
    240,
  ],
  [
    EXPERT_HANNAH,
    'Hannah Weiss',
    'expert',
    'Calculus and probability for students who describe themselves as bad at math, which is usually false. I go slowly through limits and series and I do not mind repeating things four times. Evenings and weekends work best for me.',
    ['Mathematics', 'Calculus', 'Probability'],
    false,
    60,
  ],
  [
    EXPERT_KWAME,
    'Kwame Asante',
    'expert',
    'Databases and operating systems. I survived my own systems course by drawing every process on paper, so that is how I teach it. Happy to do SQL query optimization, indexing, and normalization down to BCNF.',
    ['Computer Science', 'Databases', 'Operating Systems'],
    false,
    45,
  ],
  [
    ADMIN_ELENA,
    'Elena Vargas',
    'admin',
    'Platform operations, verification reviews, and disputes.',
    null,
    true,
    500,
  ],
  [
    STUDENT_NOA,
    'Noa Bar-Lev',
    'student',
    'Second year economics. Mostly here because econometrics is going badly.',
    null,
    false,
    200,
  ],
  [
    STUDENT_CHRIS,
    'Chris Donnelly',
    'student',
    'CS major, weak on algorithms, trying to fix that before internship interviews.',
    null,
    false,
    190,
  ],
  [
    STUDENT_AISHA,
    'Aisha Rahman',
    'student',
    'Pre-med. Taking statistics as a requirement and dreading it.',
    null,
    false,
    175,
  ],
  [
    STUDENT_LIAM,
    'Liam Sullivan',
    'student',
    'Physics undergrad. First year mechanics is not clicking yet.',
    null,
    false,
    160,
  ],
  [
    STUDENT_YUKI,
    'Yuki Tanaka',
    'student',
    'Exchange student writing a thesis in English for the first time.',
    null,
    false,
    150,
  ],
  [
    STUDENT_DIEGO,
    'Diego Morales',
    'student',
    'Working full time and taking calculus at night.',
    null,
    false,
    140,
  ],
  [
    STUDENT_PRISCILLA,
    'Priscilla Adeyemi',
    'student',
    'Third year math, prepping for a real analysis final.',
    null,
    false,
    120,
  ],
  [
    STUDENT_BEN,
    'Ben Kaufman',
    'student',
    'MBA student who has not touched statistics since high school.',
    null,
    false,
    100,
  ],
  [
    STUDENT_MEI,
    'Mei Chen',
    'student',
    'CS masters. Database internals are my weak spot.',
    null,
    false,
    80,
  ],
  [
    STUDENT_OMAR,
    'Omar Haddad',
    'student',
    'Studying for the GRE quant section on a short timeline.',
    null,
    false,
    55,
  ],
]

/** user_roles row id suffix pairs: role row id, user id, role */
const USER_ROLE_ROWS: [string, string, AppRole][] = [
  ['aaaaaaaa-0000-0000-0000-000000000101', EXPERT_MIRIAM, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000102', EXPERT_DANIEL, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000103', EXPERT_PRIYA, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000104', EXPERT_TOMER, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000105', EXPERT_SOFIA, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000106', EXPERT_MARCUS, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000107', EXPERT_HANNAH, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000108', EXPERT_KWAME, 'expert'],
  ['aaaaaaaa-0000-0000-0000-000000000199', ADMIN_ELENA, 'admin'],
  ['aaaaaaaa-0000-0000-0000-000000000201', STUDENT_NOA, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000202', STUDENT_CHRIS, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000203', STUDENT_AISHA, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000204', STUDENT_LIAM, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000205', STUDENT_YUKI, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000206', STUDENT_DIEGO, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000207', STUDENT_PRISCILLA, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000208', STUDENT_BEN, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000209', STUDENT_MEI, 'student'],
  ['aaaaaaaa-0000-0000-0000-000000000210', STUDENT_OMAR, 'student'],
]

/** id, expert_id, subject, level, format, description, price, duration, active, created days ago */
type ListingRow = [
  string,
  string,
  string,
  string,
  ListingFormat,
  string,
  number,
  number,
  boolean,
  number,
]

const LISTING_ROWS: ListingRow[] = [
  ['33333333-3333-3333-3333-333333333301', EXPERT_MIRIAM, 'Mathematics', 'Undergraduate Year 2', 'lesson', 'Vector spaces, bases, and change of basis, worked through on a shared whiteboard.', 65, 60, true, 200],
  ['33333333-3333-3333-3333-333333333302', EXPERT_MIRIAM, 'Real Analysis', 'Undergraduate Year 3', 'exam_prep', 'Ninety minutes of proof drills: epsilon-delta, convergence, and the standard final exam traps.', 90, 90, true, 198],
  ['33333333-3333-3333-3333-333333333303', EXPERT_MIRIAM, 'Linear Algebra', 'Undergraduate Year 1', 'review', 'Quick review session before a midterm. Bring your practice exam and we work backwards from it.', 45, 45, true, 150],

  ['33333333-3333-3333-3333-333333333304', EXPERT_DANIEL, 'Computer Science', 'Undergraduate Year 1', 'lesson', 'Intro programming: recursion, pointers, memory. Python or C, your choice.', 55, 60, true, 190],
  ['33333333-3333-3333-3333-333333333305', EXPERT_DANIEL, 'Algorithms', 'Undergraduate Year 2', 'exam_prep', 'Graphs, dynamic programming, and complexity analysis, aimed at exams and technical interviews.', 85, 90, true, 185],
  ['33333333-3333-3333-3333-333333333306', EXPERT_DANIEL, 'Computer Science', 'Graduate', 'project', 'Code review and architecture help on a capstone or research project. Send the repo ahead of time.', 120, 90, true, 120],

  ['33333333-3333-3333-3333-333333333307', EXPERT_PRIYA, 'Statistics', 'Undergraduate Year 1', 'lesson', 'Descriptive stats, sampling, confidence intervals, and hypothesis testing without the hand waving.', 50, 60, true, 180],
  ['33333333-3333-3333-3333-333333333308', EXPERT_PRIYA, 'Statistics', 'Graduate', 'project', 'Analysis planning for a thesis or dissertation. We pick the model together and I check your assumptions.', 110, 90, true, 178],
  ['33333333-3333-3333-3333-333333333309', EXPERT_PRIYA, 'Statistics', 'High School', 'review', 'Short review for AP Statistics. Focused on whatever you got wrong last week.', 30, 30, true, 90],

  ['33333333-3333-3333-3333-333333333310', EXPERT_TOMER, 'Economics', 'Undergraduate Year 2', 'lesson', 'Intermediate microeconomics: utility, constrained optimization, and market structure.', 60, 60, true, 170],
  ['33333333-3333-3333-3333-333333333311', EXPERT_TOMER, 'Econometrics', 'Graduate', 'exam_prep', 'OLS assumptions, instrumental variables, and panel data, with Stata output read line by line.', 95, 90, true, 165],
  ['33333333-3333-3333-3333-333333333312', EXPERT_TOMER, 'Economics', 'High School', 'review', 'Intro econ review for IB and AP students. Supply, demand, elasticity, and the graphs that come up.', 35, 45, false, 160],

  ['33333333-3333-3333-3333-333333333313', EXPERT_SOFIA, 'Physics', 'Undergraduate Year 1', 'lesson', 'Newtonian mechanics from free body diagrams up. Forces, energy, momentum.', 58, 60, true, 160],
  ['33333333-3333-3333-3333-333333333314', EXPERT_SOFIA, 'Physics', 'High School', 'exam_prep', 'Kinematics and dynamics drilling before a school exam or olympiad qualifier.', 40, 45, true, 155],
  ['33333333-3333-3333-3333-333333333315', EXPERT_SOFIA, 'Physics', 'Undergraduate Year 2', 'review', 'Rotational dynamics and electromagnetism review, built around your own problem sets.', 70, 60, true, 140],

  ['33333333-3333-3333-3333-333333333316', EXPERT_MARCUS, 'Academic Writing', 'Graduate', 'review', 'Line by line read of a thesis chapter, with structural feedback before the language edits.', 75, 60, true, 130],
  ['33333333-3333-3333-3333-333333333317', EXPERT_MARCUS, 'Academic Writing', 'Undergraduate Year 1', 'lesson', 'Essay structure, thesis statements, and citation practice for people who were never taught either.', 45, 45, true, 125],

  ['33333333-3333-3333-3333-333333333318', EXPERT_HANNAH, 'Calculus', 'Undergraduate Year 1', 'lesson', 'Limits, derivatives, integrals. Slow pace, lots of repetition, no judgement.', 35, 60, true, 50],
  ['33333333-3333-3333-3333-333333333319', EXPERT_HANNAH, 'Probability', 'Undergraduate Year 2', 'review', 'Conditional probability, Bayes, and the distributions that show up on every exam.', 42, 45, false, 48],

  ['33333333-3333-3333-3333-333333333320', EXPERT_KWAME, 'Databases', 'Undergraduate Year 3', 'lesson', 'Relational design, normalization, indexing, and reading a query plan without panic.', 55, 60, true, 40],
  ['33333333-3333-3333-3333-333333333321', EXPERT_KWAME, 'Operating Systems', 'Graduate', 'exam_prep', 'Processes, scheduling, deadlock, and virtual memory, drawn out on paper until it makes sense.', 80, 90, true, 38],
]

/** id, expert_id, weekday (0 = Sunday), start_time, end_time */
const AVAILABILITY_ROWS: [string, string, number, string, string][] = [
  ['44444444-4444-4444-4444-444444444401', EXPERT_MIRIAM, 1, '09:00', '12:00'],
  ['44444444-4444-4444-4444-444444444402', EXPERT_MIRIAM, 3, '09:00', '12:00'],
  ['44444444-4444-4444-4444-444444444403', EXPERT_MIRIAM, 4, '14:00', '18:00'],
  ['44444444-4444-4444-4444-444444444404', EXPERT_MIRIAM, 6, '10:00', '13:00'],

  ['44444444-4444-4444-4444-444444444405', EXPERT_DANIEL, 1, '16:00', '20:00'],
  ['44444444-4444-4444-4444-444444444406', EXPERT_DANIEL, 2, '16:00', '20:00'],
  ['44444444-4444-4444-4444-444444444407', EXPERT_DANIEL, 4, '13:00', '17:00'],
  ['44444444-4444-4444-4444-444444444408', EXPERT_DANIEL, 0, '11:00', '15:00'],

  ['44444444-4444-4444-4444-444444444409', EXPERT_PRIYA, 2, '14:00', '18:00'],
  ['44444444-4444-4444-4444-444444444410', EXPERT_PRIYA, 3, '14:00', '18:00'],
  ['44444444-4444-4444-4444-444444444411', EXPERT_PRIYA, 5, '09:00', '12:00'],
  ['44444444-4444-4444-4444-444444444412', EXPERT_PRIYA, 0, '17:00', '20:00'],

  ['44444444-4444-4444-4444-444444444413', EXPERT_TOMER, 1, '11:00', '14:00'],
  ['44444444-4444-4444-4444-444444444414', EXPERT_TOMER, 2, '11:00', '14:00'],
  ['44444444-4444-4444-4444-444444444415', EXPERT_TOMER, 4, '17:00', '20:00'],
  ['44444444-4444-4444-4444-444444444416', EXPERT_TOMER, 6, '09:00', '12:00'],

  ['44444444-4444-4444-4444-444444444417', EXPERT_SOFIA, 0, '09:00', '12:00'],
  ['44444444-4444-4444-4444-444444444418', EXPERT_SOFIA, 2, '09:00', '12:00'],
  ['44444444-4444-4444-4444-444444444419', EXPERT_SOFIA, 3, '15:00', '18:00'],
  ['44444444-4444-4444-4444-444444444420', EXPERT_SOFIA, 5, '09:00', '13:00'],

  ['44444444-4444-4444-4444-444444444421', EXPERT_MARCUS, 1, '15:00', '19:00'],
  ['44444444-4444-4444-4444-444444444422', EXPERT_MARCUS, 3, '15:00', '19:00'],
  ['44444444-4444-4444-4444-444444444423', EXPERT_MARCUS, 5, '10:00', '14:00'],

  ['44444444-4444-4444-4444-444444444424', EXPERT_HANNAH, 1, '19:00', '22:00'],
  ['44444444-4444-4444-4444-444444444425', EXPERT_HANNAH, 2, '19:00', '22:00'],
  ['44444444-4444-4444-4444-444444444426', EXPERT_HANNAH, 4, '19:00', '22:00'],
  ['44444444-4444-4444-4444-444444444427', EXPERT_HANNAH, 6, '10:00', '16:00'],
  ['44444444-4444-4444-4444-444444444428', EXPERT_HANNAH, 0, '10:00', '16:00'],

  ['44444444-4444-4444-4444-444444444429', EXPERT_KWAME, 2, '18:00', '21:00'],
  ['44444444-4444-4444-4444-444444444430', EXPERT_KWAME, 3, '18:00', '21:00'],
  ['44444444-4444-4444-4444-444444444431', EXPERT_KWAME, 5, '14:00', '18:00'],
  ['44444444-4444-4444-4444-444444444432', EXPERT_KWAME, 6, '14:00', '18:00'],
]

/**
 * id, listing_id, student_id, expert_id, slot offset days, slot hour, status,
 * student note, price, created days ago.
 * Negative slot offset = past session, positive = upcoming.
 */
type BookingRow = [
  string,
  string,
  string,
  string,
  number,
  number,
  BookingStatus,
  string,
  number,
  number,
]

const BOOKING_ROWS: BookingRow[] = [
  ['55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', STUDENT_NOA, EXPERT_MIRIAM, 3, 10, 'requested', 'Stuck on the change of basis problems in chapter four.', 65, 1],
  ['55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333307', STUDENT_AISHA, EXPERT_PRIYA, 5, 14, 'requested', 'Midterm is next week and I cannot tell the tests apart.', 50, 2],
  ['55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333320', STUDENT_MEI, EXPERT_KWAME, 4, 18, 'requested', 'Would like to go over B-tree indexing and when it stops helping.', 55, 1],
  ['55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333305', STUDENT_CHRIS, EXPERT_DANIEL, 6, 16, 'accepted', 'Interview prep. Mostly graphs and dynamic programming.', 85, 3],
  ['55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333313', STUDENT_LIAM, EXPERT_SOFIA, 7, 9, 'accepted', 'Blocks on inclines are ruining me.', 58, 2],
  ['55555555-5555-5555-5555-555555555506', '33333333-3333-3333-3333-333333333311', STUDENT_NOA, EXPERT_TOMER, 2, 11, 'declined', 'Panel data assignment due Friday, short notice sorry.', 95, 4],
  ['55555555-5555-5555-5555-555555555507', '33333333-3333-3333-3333-333333333302', STUDENT_PRISCILLA, EXPERT_MIRIAM, 8, 10, 'confirmed', 'Final in two weeks. I need proof practice, not lectures.', 90, 5],
  ['55555555-5555-5555-5555-555555555508', '33333333-3333-3333-3333-333333333316', STUDENT_YUKI, EXPERT_MARCUS, 9, 15, 'confirmed', 'Thesis introduction chapter, about 4000 words. Draft attached.', 75, 6],
  ['55555555-5555-5555-5555-555555555509', '33333333-3333-3333-3333-333333333308', STUDENT_BEN, EXPERT_PRIYA, 10, 17, 'confirmed', 'I have regression output that I genuinely do not understand.', 110, 4],
  ['55555555-5555-5555-5555-555555555510', '33333333-3333-3333-3333-333333333304', STUDENT_CHRIS, EXPERT_DANIEL, 0, 13, 'in_progress', 'Recursion, again.', 55, 3],
  ['55555555-5555-5555-5555-555555555511', '33333333-3333-3333-3333-333333333301', STUDENT_PRISCILLA, EXPERT_MIRIAM, -27, 10, 'completed', 'Vector spaces and spanning sets.', 65, 29],
  ['55555555-5555-5555-5555-555555555512', '33333333-3333-3333-3333-333333333302', STUDENT_PRISCILLA, EXPERT_MIRIAM, -24, 11, 'completed', 'Proof by contradiction drills.', 90, 26],
  ['55555555-5555-5555-5555-555555555513', '33333333-3333-3333-3333-333333333305', STUDENT_CHRIS, EXPERT_DANIEL, -26, 16, 'completed', 'Dijkstra and priority queues.', 85, 28],
  ['55555555-5555-5555-5555-555555555514', '33333333-3333-3333-3333-333333333304', STUDENT_MEI, EXPERT_DANIEL, -22, 14, 'completed', 'Pointers in C, from the beginning.', 55, 24],
  ['55555555-5555-5555-5555-555555555515', '33333333-3333-3333-3333-333333333307', STUDENT_AISHA, EXPERT_PRIYA, -21, 14, 'completed', 'Confidence intervals and what they actually mean.', 50, 23],
  ['55555555-5555-5555-5555-555555555516', '33333333-3333-3333-3333-333333333308', STUDENT_BEN, EXPERT_PRIYA, -19, 17, 'completed', 'ANOVA for my dissertation study.', 110, 21],
  ['55555555-5555-5555-5555-555555555517', '33333333-3333-3333-3333-333333333310', STUDENT_NOA, EXPERT_TOMER, -18, 11, 'completed', 'Consumer choice and utility maximization.', 60, 20],
  ['55555555-5555-5555-5555-555555555518', '33333333-3333-3333-3333-333333333311', STUDENT_NOA, EXPERT_TOMER, -15, 12, 'completed', 'Instrumental variables in Stata.', 95, 17],
  ['55555555-5555-5555-5555-555555555519', '33333333-3333-3333-3333-333333333313', STUDENT_LIAM, EXPERT_SOFIA, -17, 9, 'completed', 'Newton second law problem set.', 58, 19],
  ['55555555-5555-5555-5555-555555555520', '33333333-3333-3333-3333-333333333315', STUDENT_LIAM, EXPERT_SOFIA, -12, 10, 'completed', 'Rotational dynamics, moment of inertia.', 70, 14],
  ['55555555-5555-5555-5555-555555555521', '33333333-3333-3333-3333-333333333316', STUDENT_YUKI, EXPERT_MARCUS, -14, 15, 'completed', 'Literature review structure.', 75, 16],
  ['55555555-5555-5555-5555-555555555522', '33333333-3333-3333-3333-333333333317', STUDENT_OMAR, EXPERT_MARCUS, -11, 16, 'completed', 'Scholarship application essay, 800 words.', 45, 13],
  ['55555555-5555-5555-5555-555555555523', '33333333-3333-3333-3333-333333333318', STUDENT_DIEGO, EXPERT_HANNAH, -10, 20, 'completed', 'Limits and continuity.', 35, 12],
  ['55555555-5555-5555-5555-555555555524', '33333333-3333-3333-3333-333333333319', STUDENT_DIEGO, EXPERT_HANNAH, -8, 20, 'completed', 'Bayes theorem word problems.', 42, 10],
  ['55555555-5555-5555-5555-555555555525', '33333333-3333-3333-3333-333333333320', STUDENT_MEI, EXPERT_KWAME, -7, 18, 'completed', 'Normalization up to BCNF on my course schema.', 55, 9],
  ['55555555-5555-5555-5555-555555555526', '33333333-3333-3333-3333-333333333321', STUDENT_MEI, EXPERT_KWAME, -5, 19, 'completed', 'Deadlock detection and CPU scheduling.', 80, 7],
  ['55555555-5555-5555-5555-555555555527', '33333333-3333-3333-3333-333333333303', STUDENT_OMAR, EXPERT_MIRIAM, -6, 13, 'completed', 'Eigenvalue review before the midterm.', 45, 8],
  ['55555555-5555-5555-5555-555555555528', '33333333-3333-3333-3333-333333333314', STUDENT_LIAM, EXPERT_SOFIA, -4, 9, 'completed', 'Kinematics, two days before the exam.', 40, 6],
  ['55555555-5555-5555-5555-555555555529', '33333333-3333-3333-3333-333333333306', STUDENT_MEI, EXPERT_DANIEL, -9, 15, 'canceled', 'Had to withdraw from the module, family situation.', 120, 11],
  ['55555555-5555-5555-5555-555555555530', '33333333-3333-3333-3333-333333333309', STUDENT_AISHA, EXPERT_PRIYA, -3, 12, 'canceled', 'I double booked myself, sorry.', 30, 5],
  ['55555555-5555-5555-5555-555555555531', '33333333-3333-3333-3333-333333333312', STUDENT_OMAR, EXPERT_TOMER, -2, 17, 'failed', 'Nobody joined the call at the scheduled time.', 35, 4],
]

/** id, booking_id, status, stripe_ref */
const PAYMENT_ROWS: [string, string, PaymentStatus, string][] = [
  ['66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555507', 'paid', 'pi_demo_0f3a91c2'],
  ['66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555508', 'paid', 'pi_demo_7b21d004'],
  ['66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555509', 'paid', 'pi_demo_c48e2210'],
  ['66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555511', 'paid', 'pi_demo_11a7fe83'],
  ['66666666-6666-6666-6666-666666666605', '55555555-5555-5555-5555-555555555512', 'paid', 'pi_demo_92b41d67'],
  ['66666666-6666-6666-6666-666666666606', '55555555-5555-5555-5555-555555555513', 'paid', 'pi_demo_5d0c7a19'],
  ['66666666-6666-6666-6666-666666666607', '55555555-5555-5555-5555-555555555514', 'paid', 'pi_demo_e6f30b45'],
  ['66666666-6666-6666-6666-666666666608', '55555555-5555-5555-5555-555555555515', 'paid', 'pi_demo_3ac9d182'],
  ['66666666-6666-6666-6666-666666666609', '55555555-5555-5555-5555-555555555516', 'paid', 'pi_demo_88fe1c30'],
  ['66666666-6666-6666-6666-666666666610', '55555555-5555-5555-5555-555555555517', 'paid', 'pi_demo_49b2ea77'],
  ['66666666-6666-6666-6666-666666666611', '55555555-5555-5555-5555-555555555518', 'paid', 'pi_demo_0c8d5f21'],
  ['66666666-6666-6666-6666-666666666612', '55555555-5555-5555-5555-555555555519', 'paid', 'pi_demo_b73e9048'],
  ['66666666-6666-6666-6666-666666666613', '55555555-5555-5555-5555-555555555520', 'paid', 'pi_demo_2f6a4cd9'],
  ['66666666-6666-6666-6666-666666666614', '55555555-5555-5555-5555-555555555521', 'paid', 'pi_demo_71c0be36'],
  ['66666666-6666-6666-6666-666666666615', '55555555-5555-5555-5555-555555555522', 'paid', 'pi_demo_ad42f815'],
  ['66666666-6666-6666-6666-666666666616', '55555555-5555-5555-5555-555555555523', 'paid', 'pi_demo_6e93027b'],
  ['66666666-6666-6666-6666-666666666617', '55555555-5555-5555-5555-555555555524', 'paid', 'pi_demo_c105da84'],
  ['66666666-6666-6666-6666-666666666618', '55555555-5555-5555-5555-555555555525', 'paid', 'pi_demo_38ba6712'],
  ['66666666-6666-6666-6666-666666666619', '55555555-5555-5555-5555-555555555526', 'paid', 'pi_demo_f04e8b59'],
  ['66666666-6666-6666-6666-666666666620', '55555555-5555-5555-5555-555555555527', 'paid', 'pi_demo_9d1c3067'],
  ['66666666-6666-6666-6666-666666666621', '55555555-5555-5555-5555-555555555528', 'paid', 'pi_demo_4b7fa920'],
  ['66666666-6666-6666-6666-666666666622', '55555555-5555-5555-5555-555555555529', 'refunded', 'pi_demo_e2408cd6'],
  ['66666666-6666-6666-6666-666666666623', '55555555-5555-5555-5555-555555555530', 'failed', 'pi_demo_57ce1b93'],
  ['66666666-6666-6666-6666-666666666624', '55555555-5555-5555-5555-555555555531', 'failed', 'pi_demo_1a6b40f8'],
]

/** id, booking_id, rating, text */
const REVIEW_ROWS: [string, string, number, string][] = [
  ['77777777-7777-7777-7777-777777777701', '55555555-5555-5555-5555-555555555511', 5, 'She made me define a vector space from scratch three times before she would move on. Annoying for about twenty minutes and then basis and dimension suddenly made sense.'],
  ['77777777-7777-7777-7777-777777777702', '55555555-5555-5555-5555-555555555512', 5, 'Second session on proof by contradiction. She had me write the negation of the statement first every single time, and that one habit fixed most of the mistakes I was making.'],
  ['77777777-7777-7777-7777-777777777703', '55555555-5555-5555-5555-555555555513', 5, 'We traced Dijkstra by hand on a six node graph before touching any code. I had been running the algorithm for weeks without understanding why the priority queue was there.'],
  ['77777777-7777-7777-7777-777777777704', '55555555-5555-5555-5555-555555555514', 4, 'Pointers in C. He drew the stack and the heap on the whiteboard and made me predict what each line would print before running it. Only gripe is that we ran out of time before linked lists.'],
  ['77777777-7777-7777-7777-777777777705', '55555555-5555-5555-5555-555555555515', 5, 'I came in thinking a confidence interval was the probability that the mean sits inside it. She corrected that in the first ten minutes and the rest of the course finally made sense.'],
  ['77777777-7777-7777-7777-777777777706', '55555555-5555-5555-5555-555555555516', 5, 'She looked at my study design and pointed out it was repeated measures, not between subjects. That would have wrecked the entire dissertation analysis and nobody else caught it.'],
  ['77777777-7777-7777-7777-777777777707', '55555555-5555-5555-5555-555555555517', 4, 'Solid on utility maximization. He kept asking what the Lagrange multiplier meant in plain words until I could actually answer. Connection dropped twice, which cost us maybe five minutes.'],
  ['77777777-7777-7777-7777-777777777708', '55555555-5555-5555-5555-555555555518', 5, 'Instrumental variables in Stata. He read the first stage output line by line and showed me the instrument was weak, which explained the nonsense coefficients I had been staring at.'],
  ['77777777-7777-7777-7777-777777777709', '55555555-5555-5555-5555-555555555519', 5, 'Free body diagrams. I had been skipping them to save time and getting basically every question wrong. She refused to let me write a single equation until the diagram was done.'],
  ['77777777-7777-7777-7777-777777777710', '55555555-5555-5555-5555-555555555520', 4, 'Rotational dynamics. Moment of inertia made sense by the end of the hour. I would have preferred more worked examples and fewer derivations, but that is a taste thing.'],
  ['77777777-7777-7777-7777-777777777711', '55555555-5555-5555-5555-555555555521', 5, 'He read my literature review and told me it was a list, not an argument. Then he showed me how to group by claim instead of by author. Painful hour and completely correct.'],
  ['77777777-7777-7777-7777-777777777712', '55555555-5555-5555-5555-555555555522', 5, 'Scholarship essay. He deleted my whole opening paragraph and said the real first line was buried on page two. He was right, and the essay got shortlisted.'],
  ['77777777-7777-7777-7777-777777777713', '55555555-5555-5555-5555-555555555523', 4, 'Limits and continuity. Patient, never made me feel stupid for asking the same question twice. The pace was slightly slow for me but I would still book again.'],
  ['77777777-7777-7777-7777-777777777714', '55555555-5555-5555-5555-555555555524', 5, 'Bayes theorem. She rewrote every problem as a table of counts instead of a formula, and I stopped flipping the conditionals around. Wish someone had shown me that in September.'],
  ['77777777-7777-7777-7777-777777777715', '55555555-5555-5555-5555-555555555525', 5, 'We took my actual course project schema apart and rebuilt it to BCNF. He named the specific anomaly each step removed instead of just reciting the normal forms.'],
  ['77777777-7777-7777-7777-777777777716', '55555555-5555-5555-5555-555555555526', 4, 'Deadlock and scheduling. The banker algorithm walkthrough on paper was clear. I asked for practice questions to take away and only got two, so I am hunting for more.'],
  ['77777777-7777-7777-7777-777777777717', '55555555-5555-5555-5555-555555555527', 3, 'The eigenvalue explanation was fine but we spent most of the hour on material I already knew. Partly my fault for not sending the syllabus ahead of time.'],
  ['77777777-7777-7777-7777-777777777718', '55555555-5555-5555-5555-555555555528', 5, 'Kinematics prep two days before the exam. She picked the three question types most likely to show up and drilled them until I stopped hesitating. Two of the three appeared.'],
]

/** id, booking_id, sender_id, body, minutes after the booking was created */
const MESSAGE_ROWS: [string, string, string, string, number][] = [
  // booking 07: Priscilla + Miriam (confirmed, real analysis final)
  ['88888888-8888-8888-8888-888888888801', '55555555-5555-5555-5555-555555555507', STUDENT_PRISCILLA, 'Hi, I sent over the practice final. Question 3 and 5 are the ones I keep failing.', 5],
  ['88888888-8888-8888-8888-888888888802', '55555555-5555-5555-5555-555555555507', EXPERT_MIRIAM, 'Got it. Both are uniform continuity in disguise. Do question 3 again before we meet and bring whatever you produce, even if it is wrong.', 95],
  ['88888888-8888-8888-8888-888888888803', '55555555-5555-5555-5555-555555555507', STUDENT_PRISCILLA, 'It is definitely going to be wrong but I will bring it.', 140],
  ['88888888-8888-8888-8888-888888888804', '55555555-5555-5555-5555-555555555507', EXPERT_MIRIAM, 'That is the point. I want to see where it breaks, not a clean answer.', 150],
  ['88888888-8888-8888-8888-888888888805', '55555555-5555-5555-5555-555555555507', STUDENT_PRISCILLA, 'Understood. See you Thursday.', 180],

  // booking 08: Yuki + Marcus (confirmed, thesis chapter)
  ['88888888-8888-8888-8888-888888888806', '55555555-5555-5555-5555-555555555508', STUDENT_YUKI, 'Draft is attached. It is 4200 words, slightly over the limit.', 10],
  ['88888888-8888-8888-8888-888888888807', '55555555-5555-5555-5555-555555555508', EXPERT_MARCUS, 'Read the first four pages. Your research question shows up on page three. We are going to move it to the top and cut most of what comes before it.', 220],
  ['88888888-8888-8888-8888-888888888808', '55555555-5555-5555-5555-555555555508', STUDENT_YUKI, 'My supervisor said the background section was important though.', 280],
  ['88888888-8888-8888-8888-888888888809', '55555555-5555-5555-5555-555555555508', EXPERT_MARCUS, 'It is. It just does not need to be first. We will talk it through on the call.', 300],

  // booking 12: Priscilla + Miriam (completed, proof drills)
  ['88888888-8888-8888-8888-888888888810', '55555555-5555-5555-5555-555555555512', STUDENT_PRISCILLA, 'Can we do contradiction proofs this time instead of induction?', 15],
  ['88888888-8888-8888-8888-888888888811', '55555555-5555-5555-5555-555555555512', EXPERT_MIRIAM, 'Yes. Bring three statements you want to prove and we will negate all of them first.', 60],
  ['88888888-8888-8888-8888-888888888812', '55555555-5555-5555-5555-555555555512', STUDENT_PRISCILLA, 'Negating is the part I get wrong, especially with two quantifiers.', 90],
  ['88888888-8888-8888-8888-888888888813', '55555555-5555-5555-5555-555555555512', EXPERT_MIRIAM, 'Then that is the whole session. Everything else follows once the negation is right.', 110],
  ['88888888-8888-8888-8888-888888888814', '55555555-5555-5555-5555-555555555512', STUDENT_PRISCILLA, 'That was the most useful hour of the semester, thank you.', 3000],
  ['88888888-8888-8888-8888-888888888815', '55555555-5555-5555-5555-555555555512', EXPERT_MIRIAM, 'Good. Keep writing the negation first, every time, even when it feels obvious.', 3060],

  // booking 15: Aisha + Priya (completed, confidence intervals)
  ['88888888-8888-8888-8888-888888888816', '55555555-5555-5555-5555-555555555515', STUDENT_AISHA, 'Quick warning, I am starting from almost nothing here.', 20],
  ['88888888-8888-8888-8888-888888888817', '55555555-5555-5555-5555-555555555515', EXPERT_PRIYA, 'That is fine. Send me one homework question you got back with red pen on it and we will start there.', 75],
  ['88888888-8888-8888-8888-888888888818', '55555555-5555-5555-5555-555555555515', STUDENT_AISHA, 'Sent. It is the one about the mean commute time.', 120],
  ['88888888-8888-8888-8888-888888888819', '55555555-5555-5555-5555-555555555515', EXPERT_PRIYA, 'Perfect example. Your interpretation sentence is the problem, not the arithmetic.', 160],

  // booking 20: Liam + Sofia (completed, rotational dynamics)
  ['88888888-8888-8888-8888-888888888820', '55555555-5555-5555-5555-555555555520', STUDENT_LIAM, 'Problem set 7 is attached. I got through question 1 and stalled.', 12],
  ['88888888-8888-8888-8888-888888888821', '55555555-5555-5555-5555-555555555520', EXPERT_SOFIA, 'Question 2 needs the parallel axis theorem. Have you seen it yet?', 70],
  ['88888888-8888-8888-8888-888888888822', '55555555-5555-5555-5555-555555555520', STUDENT_LIAM, 'Seen it, do not understand when to reach for it.', 100],
  ['88888888-8888-8888-8888-888888888823', '55555555-5555-5555-5555-555555555520', EXPERT_SOFIA, 'Whenever the rotation axis is not through the center of mass. We will do four of them until it is automatic.', 130],
  ['88888888-8888-8888-8888-888888888824', '55555555-5555-5555-5555-555555555520', STUDENT_LIAM, 'Okay that already helps. See you then.', 150],

  // booking 26: Mei + Kwame (completed, OS exam prep)
  ['88888888-8888-8888-8888-888888888825', '55555555-5555-5555-5555-555555555526', STUDENT_MEI, 'Exam covers scheduling, deadlock, and virtual memory. Two hours is not enough for all three, right?', 18],
  ['88888888-8888-8888-8888-888888888826', '55555555-5555-5555-5555-555555555526', EXPERT_KWAME, 'Not properly. Which one do you feel worst about?', 80],
  ['88888888-8888-8888-8888-888888888827', '55555555-5555-5555-5555-555555555526', STUDENT_MEI, 'Deadlock. The banker algorithm makes no sense to me.', 110],
  ['88888888-8888-8888-8888-888888888828', '55555555-5555-5555-5555-555555555526', EXPERT_KWAME, 'Then we spend the session on that and I will send you a one page summary for the other two.', 140],
]

/** id, user_id, role, event_type, entity, status, message, days ago */
const USAGE_EVENT_ROWS: [string, string, AppRole, string, string, string, string, number][] = [
  ['99999999-1111-0000-0000-000000000001', STUDENT_CHRIS, 'student', 'ai_chat', 'assistant', 'ok', 'Asked the assistant to explain memoization before the algorithms session', 26],
  ['99999999-1111-0000-0000-000000000002', STUDENT_AISHA, 'student', 'ai_chat', 'assistant', 'ok', 'Asked for a plain language definition of p value', 22],
  ['99999999-1111-0000-0000-000000000003', STUDENT_PRISCILLA, 'student', 'ai_chat', 'assistant', 'ok', 'Requested three practice statements to negate', 19],
  ['99999999-1111-0000-0000-000000000004', STUDENT_DIEGO, 'student', 'ai_chat', 'assistant', 'error', 'Assistant request timed out after 30 seconds', 9],
  ['99999999-1111-0000-0000-000000000005', STUDENT_MEI, 'student', 'ai_chat', 'assistant', 'ok', 'Asked the assistant to compare BCNF and third normal form', 6],

  ['99999999-1111-0000-0000-000000000006', STUDENT_YUKI, 'student', 'tts_play', 'lesson_summary', 'ok', 'Played the session summary as audio', 13],
  ['99999999-1111-0000-0000-000000000007', STUDENT_LIAM, 'student', 'tts_play', 'lesson_summary', 'ok', 'Played the mechanics recap on the train', 11],
  ['99999999-1111-0000-0000-000000000008', STUDENT_OMAR, 'student', 'tts_play', 'listing', 'ok', 'Played an expert bio aloud', 5],

  ['99999999-1111-0000-0000-000000000009', STUDENT_DIEGO, 'student', 'stt_use', 'message', 'ok', 'Dictated a message to the tutor', 10],
  ['99999999-1111-0000-0000-000000000010', STUDENT_AISHA, 'student', 'stt_use', 'search', 'ok', 'Spoke a search query instead of typing it', 7],
  ['99999999-1111-0000-0000-000000000011', STUDENT_BEN, 'student', 'stt_use', 'message', 'error', 'Microphone permission was denied by the browser', 4],

  ['99999999-1111-0000-0000-000000000012', STUDENT_NOA, 'student', 'match_score_run', 'search', 'ok', 'Ran expert matching for econometrics, 4 candidates scored', 18],
  ['99999999-1111-0000-0000-000000000013', STUDENT_LIAM, 'student', 'match_score_run', 'search', 'ok', 'Ran expert matching for first year physics, 2 candidates scored', 15],
  ['99999999-1111-0000-0000-000000000014', STUDENT_BEN, 'student', 'match_score_run', 'search', 'ok', 'Ran expert matching for dissertation statistics, 3 candidates scored', 8],
  ['99999999-1111-0000-0000-000000000015', STUDENT_MEI, 'student', 'match_score_run', 'search', 'ok', 'Ran expert matching for operating systems, 2 candidates scored', 3],

  ['99999999-1111-0000-0000-000000000016', STUDENT_OMAR, 'student', 'dispute', 'booking', 'open', 'Charged for a session where the tutor never joined the call. Requesting a full refund.', 2],
  ['99999999-1111-0000-0000-000000000017', STUDENT_MEI, 'student', 'dispute', 'payment', 'open', 'Booking was canceled inside the free window but the refund has not appeared after nine days.', 6],
  ['99999999-1111-0000-0000-000000000018', EXPERT_TOMER, 'expert', 'dispute', 'booking', 'under_review', 'Student marked the session as failed, but I waited in the room for the full hour. Recording available.', 1],
]

/** Landing page entry points, cycled through for the synthetic traffic events. */
const LANDING_PATHS = [
  'Landing page opened from organic search',
  'Landing page opened from a shared expert link',
  'Landing page opened from the university newsletter',
  'Pricing section viewed from the landing page',
  'How it works section viewed from the landing page',
  'Landing page opened on mobile',
]

const SIGNUP_MESSAGES = [
  'New student account created',
  'New student account created after browsing experts',
  'New expert account created, awaiting verification',
  'New student account created from a shared listing link',
]

/* ---------------------------------------------------------------------------
 * Fixture builder
 * ------------------------------------------------------------------------ */

export interface Fixtures {
  profiles: Profile[]
  user_roles: { id: string; user_id: string; role: AppRole }[]
  listings: Listing[]
  availability: Availability[]
  bookings: Booking[]
  payments: Payment[]
  reviews: Review[]
  messages: Message[]
  event_logs: EventLog[]
}

/**
 * Build a fresh, fully independent copy of the demo dataset.
 * Nothing is shared between calls, so the demo client can hand out a clean
 * dataset on reset even after the user has written to the previous one.
 */
export function buildFixtures(): Fixtures {
  const nowMs = Date.now()

  const profiles: Profile[] = PROFILE_ROWS.map(
    ([id, fullName, role, bio, subjects, isVerified, createdDaysAgo]) => ({
      id,
      full_name: fullName,
      role,
      bio,
      avatar_url: null,
      subjects: subjects === null ? null : [...subjects],
      is_verified: isVerified,
      is_suspended: false,
      created_at: daysAgo(nowMs, createdDaysAgo),
    }),
  )

  const user_roles = USER_ROLE_ROWS.map(([id, userId, role]) => ({
    id,
    user_id: userId,
    role,
  }))

  const listings: Listing[] = LISTING_ROWS.map(
    ([id, expertId, subject, level, format, description, price, durationMin, isActive, createdDaysAgo]) => ({
      id,
      expert_id: expertId,
      subject,
      level,
      format,
      description,
      price,
      duration_min: durationMin,
      is_active: isActive,
      created_at: daysAgo(nowMs, createdDaysAgo),
    }),
  )

  const availability: Availability[] = AVAILABILITY_ROWS.map(
    ([id, expertId, weekday, startTime, endTime]) => ({
      id,
      expert_id: expertId,
      weekday,
      start_time: startTime,
      end_time: endTime,
    }),
  )

  const bookings: Booking[] = BOOKING_ROWS.map(
    ([id, listingId, studentId, expertId, slotOffsetDays, slotHour, status, note, price, createdDaysAgo]) => ({
      id,
      listing_id: listingId,
      student_id: studentId,
      expert_id: expertId,
      slot_datetime: slotAt(nowMs, slotOffsetDays, slotHour),
      status,
      student_note: note,
      price,
      created_at: daysAgo(nowMs, createdDaysAgo),
    }),
  )

  const bookingById = new Map<string, Booking>(bookings.map((b) => [b.id, b]))

  /** Parent booking lookup - every child row above references a real booking. */
  const parent = (bookingId: string): Booking => {
    const b = bookingById.get(bookingId)
    if (!b) throw new Error(`demo fixtures: unknown booking ${bookingId}`)
    return b
  }

  const payments: Payment[] = PAYMENT_ROWS.map(([id, bookingId, status, stripeRef]) => {
    const b = parent(bookingId)
    return {
      id,
      booking_id: bookingId,
      amount: b.price,
      status,
      stripe_ref: stripeRef,
      created_at: plusMinutes(b.created_at, 120),
    }
  })

  const reviews: Review[] = REVIEW_ROWS.map(([id, bookingId, rating, text]) => {
    const b = parent(bookingId)
    return {
      id,
      booking_id: bookingId,
      student_id: b.student_id,
      expert_id: b.expert_id,
      rating,
      text,
      created_at: plusMinutes(b.slot_datetime, 1440),
    }
  })

  const messages: Message[] = MESSAGE_ROWS.map(([id, bookingId, senderId, body, minutesAfter]) => {
    const b = parent(bookingId)
    return {
      id,
      booking_id: bookingId,
      sender_id: senderId,
      body,
      created_at: plusMinutes(b.created_at, minutesAfter),
    }
  })

  /* ----- event_logs ----- */

  const event_logs: EventLog[] = []
  let eventSeq = 0
  const eventId = (): string => {
    eventSeq += 1
    return `99999999-0000-0000-0000-${String(eventSeq).padStart(12, '0')}`
  }

  const logEvent = (
    userId: string | null,
    role: AppRole | null,
    eventType: string,
    entity: string | null,
    status: string | null,
    message: string | null,
    createdAt: string,
  ): void => {
    event_logs.push({
      id: eventId(),
      user_id: userId,
      role,
      event_type: eventType,
      entity,
      status,
      message,
      created_at: createdAt,
    })
  }

  // One event per real booking state change, mirroring the SQL seed.
  for (const b of bookings) {
    logEvent(b.student_id, 'student', 'booking_requested', 'booking', 'ok', 'Student requested a session', b.created_at)

    if (b.status === 'accepted' || b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed') {
      logEvent(b.expert_id, 'expert', 'booking_accepted', 'booking', 'ok', 'Expert accepted the request', plusMinutes(b.created_at, 180))
    }
    if (b.status === 'declined') {
      logEvent(b.expert_id, 'expert', 'booking_declined', 'booking', 'ok', 'Expert declined the request', plusMinutes(b.created_at, 300))
    }
    if (b.status === 'completed') {
      logEvent(b.expert_id, 'expert', 'booking_completed', 'booking', 'ok', 'Session marked complete', plusMinutes(b.slot_datetime, 90))
    }
    if (b.status === 'canceled') {
      logEvent(b.student_id, 'student', 'booking_canceled', 'booking', 'ok', 'Booking canceled', plusMinutes(b.created_at, 2880))
    }
    if (b.status === 'failed') {
      logEvent(b.student_id, 'student', 'booking_failed', 'booking', 'error', 'Session did not take place, neither party joined', plusMinutes(b.slot_datetime, 30))
    }
  }

  for (const p of payments) {
    const b = parent(p.booking_id)
    if (p.status === 'paid') {
      logEvent(b.student_id, 'student', 'payment_succeeded', 'payment', 'ok', 'Payment captured for booking', p.created_at)
    } else if (p.status === 'failed') {
      logEvent(b.student_id, 'student', 'payment_failed', 'payment', 'error', 'Card was declined', p.created_at)
    } else if (p.status === 'refunded') {
      logEvent(b.student_id, 'student', 'payment_refunded', 'payment', 'ok', 'Refund issued after cancellation', plusMinutes(p.created_at, 1440))
    }
  }

  for (const r of reviews) {
    logEvent(r.student_id, 'student', 'review_submitted', 'review', 'ok', `Student left a ${r.rating} star review`, r.created_at)
  }

  // Product usage and disputes.
  for (const [id, userId, role, eventType, entity, status, message, ago] of USAGE_EVENT_ROWS) {
    event_logs.push({
      id,
      user_id: userId,
      role,
      event_type: eventType,
      entity,
      status,
      message,
      created_at: daysAgo(nowMs, ago),
    })
  }

  // Top of funnel traffic. More landing views than signups, more signups than
  // bookings, so the admin funnel chart narrows the way a real one would.
  const rng = makeRng(20260721)

  for (let i = 0; i < 62; i += 1) {
    const ago = rng() * 30
    logEvent(null, null, 'landing_view', 'landing', 'ok', LANDING_PATHS[i % LANDING_PATHS.length], daysAgo(nowMs, ago))
  }

  for (let i = 0; i < 40; i += 1) {
    const ago = rng() * 30
    const isExpert = i % 8 === 0
    logEvent(null, isExpert ? 'expert' : 'student', 'signup', 'account', 'ok', isExpert ? 'New expert account created, awaiting verification' : SIGNUP_MESSAGES[i % SIGNUP_MESSAGES.length], daysAgo(nowMs, ago))
  }

  event_logs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  return {
    profiles,
    user_roles,
    listings,
    availability,
    bookings,
    payments,
    reviews,
    messages,
    event_logs,
  }
}

/* ---------------------------------------------------------------------------
 * One-click demo logins
 * ------------------------------------------------------------------------ */

export interface DemoAccount {
  role: AppRole
  email: string
  password: string
  name: string
  blurb: string
  userId: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'student',
    email: 'noa.barlev@example.com',
    password: 'password123',
    name: 'Noa Bar-Lev',
    blurb: 'Search experts, book a session, pay, message your tutor, and leave a review.',
    userId: STUDENT_NOA,
  },
  {
    role: 'expert',
    email: 'miriam.okonkwo@example.com',
    password: 'password123',
    name: 'Dr. Miriam Okonkwo',
    blurb: 'Manage your listings and hours, accept or decline requests, and read your reviews.',
    userId: EXPERT_MIRIAM,
  },
  {
    role: 'admin',
    email: 'elena.vargas@example.com',
    password: 'password123',
    name: 'Elena Vargas',
    blurb: 'See platform metrics, verify experts, suspend accounts, and work through disputes.',
    userId: ADMIN_ELENA,
  },
]

/** Exported for the demo client, which needs the same relative clock. */
export { daysAgo, daysFromNow, slotAt, plusMinutes }
