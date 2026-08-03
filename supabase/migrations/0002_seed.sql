-- ===========================================================================
-- Academic Nexus - demo seed data.
--
-- Every account below is fake. All of them share the password: password123
-- The UUIDs are hardcoded so the data is deterministic and the file can be
-- re-run safely (every insert uses on conflict).
--
-- DO NOT RUN THIS AGAINST PRODUCTION. These are throwaway demo logins with a
-- published password, and anyone who can reach the instance can sign in as
-- an admin.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- auth.users - profiles.id is a FK to auth.users(id), so these come first.
-- raw_user_meta_data carries full_name/role so the handle_new_user trigger
-- produces correct rows even before the explicit profile insert below runs.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  u.id::uuid,
  'authenticated',
  'authenticated',
  u.email,
  crypt('password123', gen_salt('bf')),
  now() - (u.age_days || ' days')::interval,
  now() - (u.age_days || ' days')::interval,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'role', u.user_role)
from (values
  -- experts
  ('11111111-1111-1111-1111-111111111101','miriam.okonkwo@example.com','Dr. Miriam Okonkwo','expert',420),
  ('11111111-1111-1111-1111-111111111102','daniel.reyes@example.com','Daniel Reyes','expert',390),
  ('11111111-1111-1111-1111-111111111103','priya.raman@example.com','Priya Raman','expert',365),
  ('11111111-1111-1111-1111-111111111104','tomer.aviram@example.com','Tomer Aviram','expert',300),
  ('11111111-1111-1111-1111-111111111105','sofia.lindqvist@example.com','Sofia Lindqvist','expert',280),
  ('11111111-1111-1111-1111-111111111106','marcus.bell@example.com','Marcus Bell','expert',240),
  ('11111111-1111-1111-1111-111111111107','hannah.weiss@example.com','Hannah Weiss','expert',60),
  ('11111111-1111-1111-1111-111111111108','kwame.asante@example.com','Kwame Asante','expert',45),
  -- admin
  ('11111111-1111-1111-1111-111111111199','elena.vargas@example.com','Elena Vargas','admin',500),
  -- students
  ('22222222-2222-2222-2222-222222222201','noa.barlev@example.com','Noa Bar-Lev','student',200),
  ('22222222-2222-2222-2222-222222222202','chris.donnelly@example.com','Chris Donnelly','student',190),
  ('22222222-2222-2222-2222-222222222203','aisha.rahman@example.com','Aisha Rahman','student',175),
  ('22222222-2222-2222-2222-222222222204','liam.sullivan@example.com','Liam Sullivan','student',160),
  ('22222222-2222-2222-2222-222222222205','yuki.tanaka@example.com','Yuki Tanaka','student',150),
  ('22222222-2222-2222-2222-222222222206','diego.morales@example.com','Diego Morales','student',140),
  ('22222222-2222-2222-2222-222222222207','priscilla.adeyemi@example.com','Priscilla Adeyemi','student',120),
  ('22222222-2222-2222-2222-222222222208','ben.kaufman@example.com','Ben Kaufman','student',100),
  ('22222222-2222-2222-2222-222222222209','mei.chen@example.com','Mei Chen','student',80),
  ('22222222-2222-2222-2222-222222222210','omar.haddad@example.com','Omar Haddad','student',55)
) as u(id, email, full_name, user_role, age_days)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- user_roles
-- do update rather than do nothing: the signup trigger may already have
-- written a default row when auth.users was inserted above.
-- ---------------------------------------------------------------------------
insert into user_roles (id, user_id, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000101','11111111-1111-1111-1111-111111111101','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000102','11111111-1111-1111-1111-111111111102','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000103','11111111-1111-1111-1111-111111111103','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000104','11111111-1111-1111-1111-111111111104','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000105','11111111-1111-1111-1111-111111111105','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000106','11111111-1111-1111-1111-111111111106','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000107','11111111-1111-1111-1111-111111111107','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000108','11111111-1111-1111-1111-111111111108','expert'),
  ('aaaaaaaa-0000-0000-0000-000000000199','11111111-1111-1111-1111-111111111199','admin'),
  ('aaaaaaaa-0000-0000-0000-000000000201','22222222-2222-2222-2222-222222222201','student'),
  ('aaaaaaaa-0000-0000-0000-000000000202','22222222-2222-2222-2222-222222222202','student'),
  ('aaaaaaaa-0000-0000-0000-000000000203','22222222-2222-2222-2222-222222222203','student'),
  ('aaaaaaaa-0000-0000-0000-000000000204','22222222-2222-2222-2222-222222222204','student'),
  ('aaaaaaaa-0000-0000-0000-000000000205','22222222-2222-2222-2222-222222222205','student'),
  ('aaaaaaaa-0000-0000-0000-000000000206','22222222-2222-2222-2222-222222222206','student'),
  ('aaaaaaaa-0000-0000-0000-000000000207','22222222-2222-2222-2222-222222222207','student'),
  ('aaaaaaaa-0000-0000-0000-000000000208','22222222-2222-2222-2222-222222222208','student'),
  ('aaaaaaaa-0000-0000-0000-000000000209','22222222-2222-2222-2222-222222222209','student'),
  ('aaaaaaaa-0000-0000-0000-000000000210','22222222-2222-2222-2222-222222222210','student')
on conflict (user_id) do update set role = excluded.role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
insert into profiles (id, full_name, role, bio, subjects, is_verified, is_suspended, created_at)
values
  ('11111111-1111-1111-1111-111111111101','Dr. Miriam Okonkwo','expert',
   'Fifteen years of teaching real analysis and I still think the epsilon-delta definition is where most students quietly give up. I walk people through proof techniques until they stop memorizing templates and start seeing the structure underneath. Bring me the problem set you have been avoiding.',
   array['Mathematics','Real Analysis','Linear Algebra'], true, false, now() - interval '420 days'),

  ('11111111-1111-1111-1111-111111111102','Daniel Reyes','expert',
   'I wrote backend systems for six years before I started tutoring, so I care less about clever one-liners and more about whether your code is debuggable at 2am. Most students arrive stuck on recursion or pointers and leave able to trace their own stack. I teach in Python, C, and Java.',
   array['Computer Science','Algorithms','Data Structures'], true, false, now() - interval '390 days'),

  ('11111111-1111-1111-1111-111111111103','Priya Raman','expert',
   'My students usually arrive with an R script that runs and no idea whether the output means anything. We fix that part first. I cover regression, ANOVA, and experimental design, and I will make you say your hypothesis out loud before we touch the data.',
   array['Statistics','R','Experimental Design'], true, false, now() - interval '365 days'),

  ('11111111-1111-1111-1111-111111111104','Tomer Aviram','expert',
   'I teach intermediate micro and econometrics, mostly to people who can do the algebra but cannot explain what the Lagrange multiplier is actually buying them. Expect a lot of graphs drawn badly by hand. I also help with Stata and R for empirical papers.',
   array['Economics','Econometrics','Microeconomics'], true, false, now() - interval '300 days'),

  ('11111111-1111-1111-1111-111111111105','Sofia Lindqvist','expert',
   'Mechanics and electromagnetism, first and second year. The fix is almost always drawing the free body diagram properly, and almost nobody does it. I also coach students through physics olympiad qualifiers.',
   array['Physics','Mechanics','Electromagnetism'], true, false, now() - interval '280 days'),

  ('11111111-1111-1111-1111-111111111106','Marcus Bell','expert',
   'I teach and edit academic writing, mostly thesis chapters and application essays. My rule is that if I cannot find your argument in the first paragraph, neither can your reader. I work in APA, MLA, and Chicago, and I will not write the thing for you.',
   array['Writing','Academic Writing','Editing'], true, false, now() - interval '240 days'),

  ('11111111-1111-1111-1111-111111111107','Hannah Weiss','expert',
   'Calculus and probability for students who describe themselves as bad at math, which is usually false. I go slowly through limits and series and I do not mind repeating things four times. Evenings and weekends work best for me.',
   array['Mathematics','Calculus','Probability'], false, false, now() - interval '60 days'),

  ('11111111-1111-1111-1111-111111111108','Kwame Asante','expert',
   'Databases and operating systems. I survived my own systems course by drawing every process on paper, so that is how I teach it. Happy to do SQL query optimization, indexing, and normalization down to BCNF.',
   array['Computer Science','Databases','Operating Systems'], false, false, now() - interval '45 days'),

  ('11111111-1111-1111-1111-111111111199','Elena Vargas','admin',
   'Platform operations, verification reviews, and disputes.',
   null, true, false, now() - interval '500 days'),

  ('22222222-2222-2222-2222-222222222201','Noa Bar-Lev','student','Second year economics. Mostly here because econometrics is going badly.', null, false, false, now() - interval '200 days'),
  ('22222222-2222-2222-2222-222222222202','Chris Donnelly','student','CS major, weak on algorithms, trying to fix that before internship interviews.', null, false, false, now() - interval '190 days'),
  ('22222222-2222-2222-2222-222222222203','Aisha Rahman','student','Pre-med. Taking statistics as a requirement and dreading it.', null, false, false, now() - interval '175 days'),
  ('22222222-2222-2222-2222-222222222204','Liam Sullivan','student','Physics undergrad. First year mechanics is not clicking yet.', null, false, false, now() - interval '160 days'),
  ('22222222-2222-2222-2222-222222222205','Yuki Tanaka','student','Exchange student writing a thesis in English for the first time.', null, false, false, now() - interval '150 days'),
  ('22222222-2222-2222-2222-222222222206','Diego Morales','student','Working full time and taking calculus at night.', null, false, false, now() - interval '140 days'),
  ('22222222-2222-2222-2222-222222222207','Priscilla Adeyemi','student','Third year math, prepping for a real analysis final.', null, false, false, now() - interval '120 days'),
  ('22222222-2222-2222-2222-222222222208','Ben Kaufman','student','MBA student who has not touched statistics since high school.', null, false, false, now() - interval '100 days'),
  ('22222222-2222-2222-2222-222222222209','Mei Chen','student','CS masters. Database internals are my weak spot.', null, false, false, now() - interval '80 days'),
  ('22222222-2222-2222-2222-222222222210','Omar Haddad','student','Studying for the GRE quant section on a short timeline.', null, false, false, now() - interval '55 days')
on conflict (id) do update set
  full_name   = excluded.full_name,
  role        = excluded.role,
  bio         = excluded.bio,
  subjects    = excluded.subjects,
  is_verified = excluded.is_verified,
  created_at  = excluded.created_at;

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
insert into listings (id, expert_id, subject, level, format, description, price, duration_min, is_active, created_at)
values
  ('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','Mathematics','Undergraduate Year 2','lesson','Vector spaces, bases, and change of basis, worked through on a shared whiteboard.',65,60,true, now() - interval '200 days'),
  ('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111101','Real Analysis','Undergraduate Year 3','exam_prep','Ninety minutes of proof drills: epsilon-delta, convergence, and the standard final exam traps.',90,90,true, now() - interval '198 days'),
  ('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111101','Linear Algebra','Undergraduate Year 1','review','Quick review session before a midterm. Bring your practice exam and we work backwards from it.',45,45,true, now() - interval '150 days'),

  ('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111102','Computer Science','Undergraduate Year 1','lesson','Intro programming: recursion, pointers, memory. Python or C, your choice.',55,60,true, now() - interval '190 days'),
  ('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111102','Algorithms','Undergraduate Year 2','exam_prep','Graphs, dynamic programming, and complexity analysis, aimed at exams and technical interviews.',85,90,true, now() - interval '185 days'),
  ('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111102','Computer Science','Graduate','project','Code review and architecture help on a capstone or research project. Send the repo ahead of time.',120,90,true, now() - interval '120 days'),

  ('33333333-3333-3333-3333-333333333307','11111111-1111-1111-1111-111111111103','Statistics','Undergraduate Year 1','lesson','Descriptive stats, sampling, confidence intervals, and hypothesis testing without the hand waving.',50,60,true, now() - interval '180 days'),
  ('33333333-3333-3333-3333-333333333308','11111111-1111-1111-1111-111111111103','Statistics','Graduate','project','Analysis planning for a thesis or dissertation. We pick the model together and I check your assumptions.',110,90,true, now() - interval '178 days'),
  ('33333333-3333-3333-3333-333333333309','11111111-1111-1111-1111-111111111103','Statistics','High School','review','Short review for AP Statistics. Focused on whatever you got wrong last week.',30,30,true, now() - interval '90 days'),

  ('33333333-3333-3333-3333-333333333310','11111111-1111-1111-1111-111111111104','Economics','Undergraduate Year 2','lesson','Intermediate microeconomics: utility, constrained optimization, and market structure.',60,60,true, now() - interval '170 days'),
  ('33333333-3333-3333-3333-333333333311','11111111-1111-1111-1111-111111111104','Econometrics','Graduate','exam_prep','OLS assumptions, instrumental variables, and panel data, with Stata output read line by line.',95,90,true, now() - interval '165 days'),
  ('33333333-3333-3333-3333-333333333312','11111111-1111-1111-1111-111111111104','Economics','High School','review','Intro econ review for IB and AP students. Supply, demand, elasticity, and the graphs that come up.',35,45,false, now() - interval '160 days'),

  ('33333333-3333-3333-3333-333333333313','11111111-1111-1111-1111-111111111105','Physics','Undergraduate Year 1','lesson','Newtonian mechanics from free body diagrams up. Forces, energy, momentum.',58,60,true, now() - interval '160 days'),
  ('33333333-3333-3333-3333-333333333314','11111111-1111-1111-1111-111111111105','Physics','High School','exam_prep','Kinematics and dynamics drilling before a school exam or olympiad qualifier.',40,45,true, now() - interval '155 days'),
  ('33333333-3333-3333-3333-333333333315','11111111-1111-1111-1111-111111111105','Physics','Undergraduate Year 2','review','Rotational dynamics and electromagnetism review, built around your own problem sets.',70,60,true, now() - interval '140 days'),

  ('33333333-3333-3333-3333-333333333316','11111111-1111-1111-1111-111111111106','Academic Writing','Graduate','review','Line by line read of a thesis chapter, with structural feedback before the language edits.',75,60,true, now() - interval '130 days'),
  ('33333333-3333-3333-3333-333333333317','11111111-1111-1111-1111-111111111106','Academic Writing','Undergraduate Year 1','lesson','Essay structure, thesis statements, and citation practice for people who were never taught either.',45,45,true, now() - interval '125 days'),

  ('33333333-3333-3333-3333-333333333318','11111111-1111-1111-1111-111111111107','Calculus','Undergraduate Year 1','lesson','Limits, derivatives, integrals. Slow pace, lots of repetition, no judgement.',35,60,true, now() - interval '50 days'),
  ('33333333-3333-3333-3333-333333333319','11111111-1111-1111-1111-111111111107','Probability','Undergraduate Year 2','review','Conditional probability, Bayes, and the distributions that show up on every exam.',42,45,false, now() - interval '48 days'),

  ('33333333-3333-3333-3333-333333333320','11111111-1111-1111-1111-111111111108','Databases','Undergraduate Year 3','lesson','Relational design, normalization, indexing, and reading a query plan without panic.',55,60,true, now() - interval '40 days'),
  ('33333333-3333-3333-3333-333333333321','11111111-1111-1111-1111-111111111108','Operating Systems','Graduate','exam_prep','Processes, scheduling, deadlock, and virtual memory, drawn out on paper until it makes sense.',80,90,true, now() - interval '38 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- availability (weekday 0 = Sunday)
-- ---------------------------------------------------------------------------
insert into availability (id, expert_id, weekday, start_time, end_time)
values
  ('44444444-4444-4444-4444-444444444401','11111111-1111-1111-1111-111111111101',1,'09:00','12:00'),
  ('44444444-4444-4444-4444-444444444402','11111111-1111-1111-1111-111111111101',3,'09:00','12:00'),
  ('44444444-4444-4444-4444-444444444403','11111111-1111-1111-1111-111111111101',4,'14:00','18:00'),
  ('44444444-4444-4444-4444-444444444404','11111111-1111-1111-1111-111111111101',6,'10:00','13:00'),

  ('44444444-4444-4444-4444-444444444405','11111111-1111-1111-1111-111111111102',1,'16:00','20:00'),
  ('44444444-4444-4444-4444-444444444406','11111111-1111-1111-1111-111111111102',2,'16:00','20:00'),
  ('44444444-4444-4444-4444-444444444407','11111111-1111-1111-1111-111111111102',4,'13:00','17:00'),
  ('44444444-4444-4444-4444-444444444408','11111111-1111-1111-1111-111111111102',0,'11:00','15:00'),

  ('44444444-4444-4444-4444-444444444409','11111111-1111-1111-1111-111111111103',2,'14:00','18:00'),
  ('44444444-4444-4444-4444-444444444410','11111111-1111-1111-1111-111111111103',3,'14:00','18:00'),
  ('44444444-4444-4444-4444-444444444411','11111111-1111-1111-1111-111111111103',5,'09:00','12:00'),
  ('44444444-4444-4444-4444-444444444412','11111111-1111-1111-1111-111111111103',0,'17:00','20:00'),

  ('44444444-4444-4444-4444-444444444413','11111111-1111-1111-1111-111111111104',1,'11:00','14:00'),
  ('44444444-4444-4444-4444-444444444414','11111111-1111-1111-1111-111111111104',2,'11:00','14:00'),
  ('44444444-4444-4444-4444-444444444415','11111111-1111-1111-1111-111111111104',4,'17:00','20:00'),
  ('44444444-4444-4444-4444-444444444416','11111111-1111-1111-1111-111111111104',6,'09:00','12:00'),

  ('44444444-4444-4444-4444-444444444417','11111111-1111-1111-1111-111111111105',0,'09:00','12:00'),
  ('44444444-4444-4444-4444-444444444418','11111111-1111-1111-1111-111111111105',2,'09:00','12:00'),
  ('44444444-4444-4444-4444-444444444419','11111111-1111-1111-1111-111111111105',3,'15:00','18:00'),
  ('44444444-4444-4444-4444-444444444420','11111111-1111-1111-1111-111111111105',5,'09:00','13:00'),

  ('44444444-4444-4444-4444-444444444421','11111111-1111-1111-1111-111111111106',1,'15:00','19:00'),
  ('44444444-4444-4444-4444-444444444422','11111111-1111-1111-1111-111111111106',3,'15:00','19:00'),
  ('44444444-4444-4444-4444-444444444423','11111111-1111-1111-1111-111111111106',5,'10:00','14:00'),

  ('44444444-4444-4444-4444-444444444424','11111111-1111-1111-1111-111111111107',1,'19:00','22:00'),
  ('44444444-4444-4444-4444-444444444425','11111111-1111-1111-1111-111111111107',2,'19:00','22:00'),
  ('44444444-4444-4444-4444-444444444426','11111111-1111-1111-1111-111111111107',4,'19:00','22:00'),
  ('44444444-4444-4444-4444-444444444427','11111111-1111-1111-1111-111111111107',6,'10:00','16:00'),
  ('44444444-4444-4444-4444-444444444428','11111111-1111-1111-1111-111111111107',0,'10:00','16:00'),

  ('44444444-4444-4444-4444-444444444429','11111111-1111-1111-1111-111111111108',2,'18:00','21:00'),
  ('44444444-4444-4444-4444-444444444430','11111111-1111-1111-1111-111111111108',3,'18:00','21:00'),
  ('44444444-4444-4444-4444-444444444431','11111111-1111-1111-1111-111111111108',5,'14:00','18:00'),
  ('44444444-4444-4444-4444-444444444432','11111111-1111-1111-1111-111111111108',6,'14:00','18:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- bookings - 31 rows across all eight statuses, anchored to now()
-- negative slot_offset_days = past session, positive = upcoming
-- ---------------------------------------------------------------------------
insert into bookings (id, listing_id, student_id, expert_id, slot_datetime, status, student_note, price, created_at)
select
  b.id::uuid,
  b.listing_id::uuid,
  b.student_id::uuid,
  b.expert_id::uuid,
  date_trunc('day', now())
    + (b.slot_offset_days || ' days')::interval
    + (b.slot_hour || ' hours')::interval,
  b.status,
  b.student_note,
  b.price::numeric,
  now() - (b.created_days_ago || ' days')::interval
from (values
  ('55555555-5555-5555-5555-555555555501','33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111101',  3,10,'requested','Stuck on the change of basis problems in chapter four.',65,1),
  ('55555555-5555-5555-5555-555555555502','33333333-3333-3333-3333-333333333307','22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111103',  5,14,'requested','Midterm is next week and I cannot tell the tests apart.',50,2),
  ('55555555-5555-5555-5555-555555555503','33333333-3333-3333-3333-333333333320','22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111108',  4,18,'requested','Would like to go over B-tree indexing and when it stops helping.',55,1),
  ('55555555-5555-5555-5555-555555555504','33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111102',  6,16,'accepted','Interview prep. Mostly graphs and dynamic programming.',85,3),
  ('55555555-5555-5555-5555-555555555505','33333333-3333-3333-3333-333333333313','22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105',  7, 9,'accepted','Blocks on inclines are ruining me.',58,2),
  ('55555555-5555-5555-5555-555555555506','33333333-3333-3333-3333-333333333311','22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111104',  2,11,'declined','Panel data assignment due Friday, short notice sorry.',95,4),
  ('55555555-5555-5555-5555-555555555507','33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222207','11111111-1111-1111-1111-111111111101',  8,10,'confirmed','Final in two weeks. I need proof practice, not lectures.',90,5),
  ('55555555-5555-5555-5555-555555555508','33333333-3333-3333-3333-333333333316','22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111106',  9,15,'confirmed','Thesis introduction chapter, about 4000 words. Draft attached.',75,6),
  ('55555555-5555-5555-5555-555555555509','33333333-3333-3333-3333-333333333308','22222222-2222-2222-2222-222222222208','11111111-1111-1111-1111-111111111103', 10,17,'confirmed','I have regression output that I genuinely do not understand.',110,4),
  ('55555555-5555-5555-5555-555555555510','33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111102',  0,13,'in_progress','Recursion, again.',55,3),
  ('55555555-5555-5555-5555-555555555511','33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222207','11111111-1111-1111-1111-111111111101',-27,10,'completed','Vector spaces and spanning sets.',65,29),
  ('55555555-5555-5555-5555-555555555512','33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222207','11111111-1111-1111-1111-111111111101',-24,11,'completed','Proof by contradiction drills.',90,26),
  ('55555555-5555-5555-5555-555555555513','33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111102',-26,16,'completed','Dijkstra and priority queues.',85,28),
  ('55555555-5555-5555-5555-555555555514','33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111102',-22,14,'completed','Pointers in C, from the beginning.',55,24),
  ('55555555-5555-5555-5555-555555555515','33333333-3333-3333-3333-333333333307','22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111103',-21,14,'completed','Confidence intervals and what they actually mean.',50,23),
  ('55555555-5555-5555-5555-555555555516','33333333-3333-3333-3333-333333333308','22222222-2222-2222-2222-222222222208','11111111-1111-1111-1111-111111111103',-19,17,'completed','ANOVA for my dissertation study.',110,21),
  ('55555555-5555-5555-5555-555555555517','33333333-3333-3333-3333-333333333310','22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111104',-18,11,'completed','Consumer choice and utility maximization.',60,20),
  ('55555555-5555-5555-5555-555555555518','33333333-3333-3333-3333-333333333311','22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111104',-15,12,'completed','Instrumental variables in Stata.',95,17),
  ('55555555-5555-5555-5555-555555555519','33333333-3333-3333-3333-333333333313','22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105',-17, 9,'completed','Newton second law problem set.',58,19),
  ('55555555-5555-5555-5555-555555555520','33333333-3333-3333-3333-333333333315','22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105',-12,10,'completed','Rotational dynamics, moment of inertia.',70,14),
  ('55555555-5555-5555-5555-555555555521','33333333-3333-3333-3333-333333333316','22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111106',-14,15,'completed','Literature review structure.',75,16),
  ('55555555-5555-5555-5555-555555555522','33333333-3333-3333-3333-333333333317','22222222-2222-2222-2222-222222222210','11111111-1111-1111-1111-111111111106',-11,16,'completed','Scholarship application essay, 800 words.',45,13),
  ('55555555-5555-5555-5555-555555555523','33333333-3333-3333-3333-333333333318','22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111107',-10,20,'completed','Limits and continuity.',35,12),
  ('55555555-5555-5555-5555-555555555524','33333333-3333-3333-3333-333333333319','22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111107', -8,20,'completed','Bayes theorem word problems.',42,10),
  ('55555555-5555-5555-5555-555555555525','33333333-3333-3333-3333-333333333320','22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111108', -7,18,'completed','Normalization up to BCNF on my course schema.',55,9),
  ('55555555-5555-5555-5555-555555555526','33333333-3333-3333-3333-333333333321','22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111108', -5,19,'completed','Deadlock detection and CPU scheduling.',80,7),
  ('55555555-5555-5555-5555-555555555527','33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222210','11111111-1111-1111-1111-111111111101', -6,13,'completed','Eigenvalue review before the midterm.',45,8),
  ('55555555-5555-5555-5555-555555555528','33333333-3333-3333-3333-333333333314','22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105', -4, 9,'completed','Kinematics, two days before the exam.',40,6),
  ('55555555-5555-5555-5555-555555555529','33333333-3333-3333-3333-333333333306','22222222-2222-2222-2222-222222222209','11111111-1111-1111-1111-111111111102', -9,15,'canceled','Had to withdraw from the module, family situation.',120,11),
  ('55555555-5555-5555-5555-555555555530','33333333-3333-3333-3333-333333333309','22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111103', -3,12,'canceled','I double booked myself, sorry.',30,5),
  ('55555555-5555-5555-5555-555555555531','33333333-3333-3333-3333-333333333312','22222222-2222-2222-2222-222222222210','11111111-1111-1111-1111-111111111104', -2,17,'failed','Nobody joined the call at the scheduled time.',35,4)
) as b(id, listing_id, student_id, expert_id, slot_offset_days, slot_hour, status, student_note, price, created_days_ago)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- payments - amount and timing derived from the parent booking
-- ---------------------------------------------------------------------------
insert into payments (id, booking_id, amount, status, stripe_ref, created_at)
select p.id::uuid, b.id, b.price, p.status, p.stripe_ref, b.created_at + interval '2 hours'
from (values
  ('66666666-6666-6666-6666-666666666601','55555555-5555-5555-5555-555555555507','paid','pi_demo_0f3a91c2'),
  ('66666666-6666-6666-6666-666666666602','55555555-5555-5555-5555-555555555508','paid','pi_demo_7b21d004'),
  ('66666666-6666-6666-6666-666666666603','55555555-5555-5555-5555-555555555509','paid','pi_demo_c48e2210'),
  ('66666666-6666-6666-6666-666666666604','55555555-5555-5555-5555-555555555511','paid','pi_demo_11a7fe83'),
  ('66666666-6666-6666-6666-666666666605','55555555-5555-5555-5555-555555555512','paid','pi_demo_92b41d67'),
  ('66666666-6666-6666-6666-666666666606','55555555-5555-5555-5555-555555555513','paid','pi_demo_5d0c7a19'),
  ('66666666-6666-6666-6666-666666666607','55555555-5555-5555-5555-555555555514','paid','pi_demo_e6f30b45'),
  ('66666666-6666-6666-6666-666666666608','55555555-5555-5555-5555-555555555515','paid','pi_demo_3ac9d182'),
  ('66666666-6666-6666-6666-666666666609','55555555-5555-5555-5555-555555555516','paid','pi_demo_88fe1c30'),
  ('66666666-6666-6666-6666-666666666610','55555555-5555-5555-5555-555555555517','paid','pi_demo_49b2ea77'),
  ('66666666-6666-6666-6666-666666666611','55555555-5555-5555-5555-555555555518','paid','pi_demo_0c8d5f21'),
  ('66666666-6666-6666-6666-666666666612','55555555-5555-5555-5555-555555555519','paid','pi_demo_b73e9048'),
  ('66666666-6666-6666-6666-666666666613','55555555-5555-5555-5555-555555555520','paid','pi_demo_2f6a4cd9'),
  ('66666666-6666-6666-6666-666666666614','55555555-5555-5555-5555-555555555521','paid','pi_demo_71c0be36'),
  ('66666666-6666-6666-6666-666666666615','55555555-5555-5555-5555-555555555522','paid','pi_demo_ad42f815'),
  ('66666666-6666-6666-6666-666666666616','55555555-5555-5555-5555-555555555523','paid','pi_demo_6e93027b'),
  ('66666666-6666-6666-6666-666666666617','55555555-5555-5555-5555-555555555524','paid','pi_demo_c105da84'),
  ('66666666-6666-6666-6666-666666666618','55555555-5555-5555-5555-555555555525','paid','pi_demo_38ba6712'),
  ('66666666-6666-6666-6666-666666666619','55555555-5555-5555-5555-555555555526','paid','pi_demo_f04e8b59'),
  ('66666666-6666-6666-6666-666666666620','55555555-5555-5555-5555-555555555527','paid','pi_demo_9d1c3067'),
  ('66666666-6666-6666-6666-666666666621','55555555-5555-5555-5555-555555555528','paid','pi_demo_4b7fa920'),
  ('66666666-6666-6666-6666-666666666622','55555555-5555-5555-5555-555555555529','refunded','pi_demo_e2408cd6'),
  ('66666666-6666-6666-6666-666666666623','55555555-5555-5555-5555-555555555530','failed','pi_demo_57ce1b93'),
  ('66666666-6666-6666-6666-666666666624','55555555-5555-5555-5555-555555555531','failed','pi_demo_1a6b40f8')
) as p(id, booking_id, status, stripe_ref)
join bookings b on b.id = p.booking_id::uuid
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- reviews - completed bookings only
-- ---------------------------------------------------------------------------
insert into reviews (id, booking_id, student_id, expert_id, rating, text, created_at)
select r.id::uuid, b.id, b.student_id, b.expert_id, r.rating, r.text, b.slot_datetime + interval '1 day'
from (values
  ('77777777-7777-7777-7777-777777777701','55555555-5555-5555-5555-555555555511',5,'She made me define a vector space from scratch three times before she would move on. Annoying for about twenty minutes and then basis and dimension suddenly made sense.'),
  ('77777777-7777-7777-7777-777777777702','55555555-5555-5555-5555-555555555512',5,'Second session on proof by contradiction. She had me write the negation of the statement first every single time, and that one habit fixed most of the mistakes I was making.'),
  ('77777777-7777-7777-7777-777777777703','55555555-5555-5555-5555-555555555513',5,'We traced Dijkstra by hand on a six node graph before touching any code. I had been running the algorithm for weeks without understanding why the priority queue was there.'),
  ('77777777-7777-7777-7777-777777777704','55555555-5555-5555-5555-555555555514',4,'Pointers in C. He drew the stack and the heap on the whiteboard and made me predict what each line would print before running it. Only gripe is that we ran out of time before linked lists.'),
  ('77777777-7777-7777-7777-777777777705','55555555-5555-5555-5555-555555555515',5,'I came in thinking a confidence interval was the probability that the mean sits inside it. She corrected that in the first ten minutes and the rest of the course finally made sense.'),
  ('77777777-7777-7777-7777-777777777706','55555555-5555-5555-5555-555555555516',5,'She looked at my study design and pointed out it was repeated measures, not between subjects. That would have wrecked the entire dissertation analysis and nobody else caught it.'),
  ('77777777-7777-7777-7777-777777777707','55555555-5555-5555-5555-555555555517',4,'Solid on utility maximization. He kept asking what the Lagrange multiplier meant in plain words until I could actually answer. Connection dropped twice, which cost us maybe five minutes.'),
  ('77777777-7777-7777-7777-777777777708','55555555-5555-5555-5555-555555555518',5,'Instrumental variables in Stata. He read the first stage output line by line and showed me the instrument was weak, which explained the nonsense coefficients I had been staring at.'),
  ('77777777-7777-7777-7777-777777777709','55555555-5555-5555-5555-555555555519',5,'Free body diagrams. I had been skipping them to save time and getting basically every question wrong. She refused to let me write a single equation until the diagram was done.'),
  ('77777777-7777-7777-7777-777777777710','55555555-5555-5555-5555-555555555520',4,'Rotational dynamics. Moment of inertia made sense by the end of the hour. I would have preferred more worked examples and fewer derivations, but that is a taste thing.'),
  ('77777777-7777-7777-7777-777777777711','55555555-5555-5555-5555-555555555521',5,'He read my literature review and told me it was a list, not an argument. Then he showed me how to group by claim instead of by author. Painful hour and completely correct.'),
  ('77777777-7777-7777-7777-777777777712','55555555-5555-5555-5555-555555555522',5,'Scholarship essay. He deleted my whole opening paragraph and said the real first line was buried on page two. He was right, and the essay got shortlisted.'),
  ('77777777-7777-7777-7777-777777777713','55555555-5555-5555-5555-555555555523',4,'Limits and continuity. Patient, never made me feel stupid for asking the same question twice. The pace was slightly slow for me but I would still book again.'),
  ('77777777-7777-7777-7777-777777777714','55555555-5555-5555-5555-555555555524',5,'Bayes theorem. She rewrote every problem as a table of counts instead of a formula, and I stopped flipping the conditionals around. Wish someone had shown me that in September.'),
  ('77777777-7777-7777-7777-777777777715','55555555-5555-5555-5555-555555555525',5,'We took my actual course project schema apart and rebuilt it to BCNF. He named the specific anomaly each step removed instead of just reciting the normal forms.'),
  ('77777777-7777-7777-7777-777777777716','55555555-5555-5555-5555-555555555526',4,'Deadlock and scheduling. The banker algorithm walkthrough on paper was clear. I asked for practice questions to take away and only got two, so I am hunting for more.'),
  ('77777777-7777-7777-7777-777777777717','55555555-5555-5555-5555-555555555527',3,'The eigenvalue explanation was fine but we spent most of the hour on material I already knew. Partly my fault for not sending the syllabus ahead of time.'),
  ('77777777-7777-7777-7777-777777777718','55555555-5555-5555-5555-555555555528',5,'Kinematics prep two days before the exam. She picked the three question types most likely to show up and drilled them until I stopped hesitating. Two of the three appeared.')
) as r(id, booking_id, rating, text)
join bookings b on b.id = r.booking_id::uuid
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- messages - short threads on confirmed and completed bookings
-- ---------------------------------------------------------------------------
insert into messages (id, booking_id, sender_id, body, created_at)
select m.id::uuid, b.id, m.sender_id::uuid, m.body, b.created_at + (m.minutes_after || ' minutes')::interval
from (values
  -- booking 07: Priscilla + Miriam (confirmed, real analysis final)
  ('88888888-8888-8888-8888-888888888801','55555555-5555-5555-5555-555555555507','22222222-2222-2222-2222-222222222207','Hi, I sent over the practice final. Question 3 and 5 are the ones I keep failing.',5),
  ('88888888-8888-8888-8888-888888888802','55555555-5555-5555-5555-555555555507','11111111-1111-1111-1111-111111111101','Got it. Both are uniform continuity in disguise. Do question 3 again before we meet and bring whatever you produce, even if it is wrong.',95),
  ('88888888-8888-8888-8888-888888888803','55555555-5555-5555-5555-555555555507','22222222-2222-2222-2222-222222222207','It is definitely going to be wrong but I will bring it.',140),
  ('88888888-8888-8888-8888-888888888804','55555555-5555-5555-5555-555555555507','11111111-1111-1111-1111-111111111101','That is the point. I want to see where it breaks, not a clean answer.',150),
  ('88888888-8888-8888-8888-888888888805','55555555-5555-5555-5555-555555555507','22222222-2222-2222-2222-222222222207','Understood. See you Thursday.',180),

  -- booking 08: Yuki + Marcus (confirmed, thesis chapter)
  ('88888888-8888-8888-8888-888888888806','55555555-5555-5555-5555-555555555508','22222222-2222-2222-2222-222222222205','Draft is attached. It is 4200 words, slightly over the limit.',10),
  ('88888888-8888-8888-8888-888888888807','55555555-5555-5555-5555-555555555508','11111111-1111-1111-1111-111111111106','Read the first four pages. Your research question shows up on page three. We are going to move it to the top and cut most of what comes before it.',220),
  ('88888888-8888-8888-8888-888888888808','55555555-5555-5555-5555-555555555508','22222222-2222-2222-2222-222222222205','My supervisor said the background section was important though.',280),
  ('88888888-8888-8888-8888-888888888809','55555555-5555-5555-5555-555555555508','11111111-1111-1111-1111-111111111106','It is. It just does not need to be first. We will talk it through on the call.',300),

  -- booking 12: Priscilla + Miriam (completed, proof drills)
  ('88888888-8888-8888-8888-888888888810','55555555-5555-5555-5555-555555555512','22222222-2222-2222-2222-222222222207','Can we do contradiction proofs this time instead of induction?',15),
  ('88888888-8888-8888-8888-888888888811','55555555-5555-5555-5555-555555555512','11111111-1111-1111-1111-111111111101','Yes. Bring three statements you want to prove and we will negate all of them first.',60),
  ('88888888-8888-8888-8888-888888888812','55555555-5555-5555-5555-555555555512','22222222-2222-2222-2222-222222222207','Negating is the part I get wrong, especially with two quantifiers.',90),
  ('88888888-8888-8888-8888-888888888813','55555555-5555-5555-5555-555555555512','11111111-1111-1111-1111-111111111101','Then that is the whole session. Everything else follows once the negation is right.',110),
  ('88888888-8888-8888-8888-888888888814','55555555-5555-5555-5555-555555555512','22222222-2222-2222-2222-222222222207','That was the most useful hour of the semester, thank you.',3000),
  ('88888888-8888-8888-8888-888888888815','55555555-5555-5555-5555-555555555512','11111111-1111-1111-1111-111111111101','Good. Keep writing the negation first, every time, even when it feels obvious.',3060),

  -- booking 15: Aisha + Priya (completed, confidence intervals)
  ('88888888-8888-8888-8888-888888888816','55555555-5555-5555-5555-555555555515','22222222-2222-2222-2222-222222222203','Quick warning, I am starting from almost nothing here.',20),
  ('88888888-8888-8888-8888-888888888817','55555555-5555-5555-5555-555555555515','11111111-1111-1111-1111-111111111103','That is fine. Send me one homework question you got back with red pen on it and we will start there.',75),
  ('88888888-8888-8888-8888-888888888818','55555555-5555-5555-5555-555555555515','22222222-2222-2222-2222-222222222203','Sent. It is the one about the mean commute time.',120),
  ('88888888-8888-8888-8888-888888888819','55555555-5555-5555-5555-555555555515','11111111-1111-1111-1111-111111111103','Perfect example. Your interpretation sentence is the problem, not the arithmetic.',160),

  -- booking 20: Liam + Sofia (completed, rotational dynamics)
  ('88888888-8888-8888-8888-888888888820','55555555-5555-5555-5555-555555555520','22222222-2222-2222-2222-222222222204','Problem set 7 is attached. I got through question 1 and stalled.',12),
  ('88888888-8888-8888-8888-888888888821','55555555-5555-5555-5555-555555555520','11111111-1111-1111-1111-111111111105','Question 2 needs the parallel axis theorem. Have you seen it yet?',70),
  ('88888888-8888-8888-8888-888888888822','55555555-5555-5555-5555-555555555520','22222222-2222-2222-2222-222222222204','Seen it, do not understand when to reach for it.',100),
  ('88888888-8888-8888-8888-888888888823','55555555-5555-5555-5555-555555555520','11111111-1111-1111-1111-111111111105','Whenever the rotation axis is not through the center of mass. We will do four of them until it is automatic.',130),
  ('88888888-8888-8888-8888-888888888824','55555555-5555-5555-5555-555555555520','22222222-2222-2222-2222-222222222204','Okay that already helps. See you then.',150),

  -- booking 26: Mei + Kwame (completed, OS exam prep)
  ('88888888-8888-8888-8888-888888888825','55555555-5555-5555-5555-555555555526','22222222-2222-2222-2222-222222222209','Exam covers scheduling, deadlock, and virtual memory. Two hours is not enough for all three, right?',18),
  ('88888888-8888-8888-8888-888888888826','55555555-5555-5555-5555-555555555526','11111111-1111-1111-1111-111111111108','Not properly. Which one do you feel worst about?',80),
  ('88888888-8888-8888-8888-888888888827','55555555-5555-5555-5555-555555555526','22222222-2222-2222-2222-222222222209','Deadlock. The banker algorithm makes no sense to me.',110),
  ('88888888-8888-8888-8888-888888888828','55555555-5555-5555-5555-555555555526','11111111-1111-1111-1111-111111111108','Then we spend the session on that and I will send you a one page summary for the other two.',140)
) as m(id, booking_id, sender_id, body, minutes_after)
join bookings b on b.id = m.booking_id::uuid
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- event_logs - derived transitions, one row per real state change.
-- Deterministic ids from md5(booking id + event type) so the file re-runs.
-- ---------------------------------------------------------------------------
insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_requested'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'booking_requested', 'booking', 'ok',
       'Student requested a session', b.created_at
from bookings b
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_accepted'), 1, 12))::uuid,
       b.expert_id, 'expert'::app_role, 'booking_accepted', 'booking', 'ok',
       'Expert accepted the request', b.created_at + interval '3 hours'
from bookings b
where b.status in ('accepted','confirmed','in_progress','completed')
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_declined'), 1, 12))::uuid,
       b.expert_id, 'expert'::app_role, 'booking_declined', 'booking', 'ok',
       'Expert declined the request', b.created_at + interval '5 hours'
from bookings b
where b.status = 'declined'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_completed'), 1, 12))::uuid,
       b.expert_id, 'expert'::app_role, 'booking_completed', 'booking', 'ok',
       'Session marked complete', b.slot_datetime + interval '90 minutes'
from bookings b
where b.status = 'completed'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_canceled'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'booking_canceled', 'booking', 'ok',
       'Booking canceled', b.created_at + interval '2 days'
from bookings b
where b.status = 'canceled'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(b.id::text || 'booking_failed'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'booking_failed', 'booking', 'error',
       'Session did not take place, neither party joined', b.slot_datetime + interval '30 minutes'
from bookings b
where b.status = 'failed'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(p.id::text || 'payment_succeeded'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'payment_succeeded', 'payment', 'ok',
       'Payment captured for booking', p.created_at
from payments p
join bookings b on b.id = p.booking_id
where p.status = 'paid'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(p.id::text || 'payment_failed'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'payment_failed', 'payment', 'error',
       'Card was declined', p.created_at
from payments p
join bookings b on b.id = p.booking_id
where p.status = 'failed'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(p.id::text || 'payment_refunded'), 1, 12))::uuid,
       b.student_id, 'student'::app_role, 'payment_refunded', 'payment', 'ok',
       'Refund issued after cancellation', p.created_at + interval '1 day'
from payments p
join bookings b on b.id = p.booking_id
where p.status = 'refunded'
on conflict (id) do nothing;

insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
select ('99999999-0000-0000-0000-' || substr(md5(r.id::text || 'review_submitted'), 1, 12))::uuid,
       r.student_id, 'student'::app_role, 'review_submitted', 'review', 'ok',
       'Student left a ' || r.rating || ' star review', r.created_at
from reviews r
on conflict (id) do nothing;

-- Product usage and dispute events (literal rows)
insert into event_logs (id, user_id, role, event_type, entity, status, message, created_at)
values
  ('99999999-1111-0000-0000-000000000001','22222222-2222-2222-2222-222222222202','student','ai_chat','assistant','ok','Asked the assistant to explain memoization before the algorithms session', now() - interval '26 days'),
  ('99999999-1111-0000-0000-000000000002','22222222-2222-2222-2222-222222222203','student','ai_chat','assistant','ok','Asked for a plain language definition of p value', now() - interval '22 days'),
  ('99999999-1111-0000-0000-000000000003','22222222-2222-2222-2222-222222222207','student','ai_chat','assistant','ok','Requested three practice statements to negate', now() - interval '19 days'),
  ('99999999-1111-0000-0000-000000000004','22222222-2222-2222-2222-222222222206','student','ai_chat','assistant','error','Assistant request timed out after 30 seconds', now() - interval '9 days'),
  ('99999999-1111-0000-0000-000000000005','22222222-2222-2222-2222-222222222209','student','ai_chat','assistant','ok','Asked the assistant to compare BCNF and third normal form', now() - interval '6 days'),

  ('99999999-1111-0000-0000-000000000006','22222222-2222-2222-2222-222222222205','student','tts_play','lesson_summary','ok','Played the session summary as audio', now() - interval '13 days'),
  ('99999999-1111-0000-0000-000000000007','22222222-2222-2222-2222-222222222204','student','tts_play','lesson_summary','ok','Played the mechanics recap on the train', now() - interval '11 days'),
  ('99999999-1111-0000-0000-000000000008','22222222-2222-2222-2222-222222222210','student','tts_play','listing','ok','Played an expert bio aloud', now() - interval '5 days'),

  ('99999999-1111-0000-0000-000000000009','22222222-2222-2222-2222-222222222206','student','stt_use','message','ok','Dictated a message to the tutor', now() - interval '10 days'),
  ('99999999-1111-0000-0000-000000000010','22222222-2222-2222-2222-222222222203','student','stt_use','search','ok','Spoke a search query instead of typing it', now() - interval '7 days'),
  ('99999999-1111-0000-0000-000000000011','22222222-2222-2222-2222-222222222208','student','stt_use','message','error','Microphone permission was denied by the browser', now() - interval '4 days'),

  ('99999999-1111-0000-0000-000000000012','22222222-2222-2222-2222-222222222201','student','match_score_run','search','ok','Ran expert matching for econometrics, 4 candidates scored', now() - interval '18 days'),
  ('99999999-1111-0000-0000-000000000013','22222222-2222-2222-2222-222222222204','student','match_score_run','search','ok','Ran expert matching for first year physics, 2 candidates scored', now() - interval '15 days'),
  ('99999999-1111-0000-0000-000000000014','22222222-2222-2222-2222-222222222208','student','match_score_run','search','ok','Ran expert matching for dissertation statistics, 3 candidates scored', now() - interval '8 days'),
  ('99999999-1111-0000-0000-000000000015','22222222-2222-2222-2222-222222222209','student','match_score_run','search','ok','Ran expert matching for operating systems, 2 candidates scored', now() - interval '3 days'),

  ('99999999-1111-0000-0000-000000000016','22222222-2222-2222-2222-222222222210','student','dispute','booking','open','Charged for a session where the tutor never joined the call. Requesting a full refund.', now() - interval '2 days'),
  ('99999999-1111-0000-0000-000000000017','22222222-2222-2222-2222-222222222209','student','dispute','payment','open','Booking was canceled inside the free window but the refund has not appeared after nine days.', now() - interval '6 days'),
  ('99999999-1111-0000-0000-000000000018','11111111-1111-1111-1111-111111111104','expert','dispute','booking','under_review','Student marked the session as failed, but I waited in the room for the full hour. Recording available.', now() - interval '1 day')
on conflict (id) do nothing;
