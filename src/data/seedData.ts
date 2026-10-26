import { User, Patient, Bed, Admission } from '../types/models';

export interface SeedDatabaseState {
  users: User[];
  patients: Patient[];
  beds: Bed[];
  admissions: Admission[];
}

export const DEMO_ACCOUNTS = [
  {
    role: 'Administrator' as const,
    name: 'خالد حسن',
    email: 'admin@cairo-med-demo.edu',
    demoAccessCode: 'AdminDemo#2026',
    description:
      'Full access: Dashboard, Bed CRUD & Maintenance, User Account Management, Reports, and Audit History.',
  },
  {
    role: 'Receptionist' as const,
    name: 'محمد السيد',
    email: 'reception@cairo-med-demo.edu',
    demoAccessCode: 'FrontDesk#2026',
    description:
      'Front-desk workflow: Patient Registration, Bed Availability Search, Patient Admission & Assignment, and Discharge.',
  },
  {
    role: 'Doctor' as const,
    name: 'د. أحمد عبد الله',
    email: 'doctor@cairo-med-demo.edu',
    demoAccessCode: 'Clinical#2026',
    description:
      'Clinical view: Assigned Patients, Clinical Notes, Ward Occupancy, and Bed Availability.',
  },
];

function isoAgo(days: number, hours = 0, minutes = 0): string {
  const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

export function createInitialSeedData(): SeedDatabaseState {
  const users: User[] = [
    {
      id: 'USR-001',
      name: 'خالد حسن',
      email: 'admin@cairo-med-demo.edu',
      role: 'Administrator',
      created_at: isoAgo(60, 2),
    },
    {
      id: 'USR-002',
      name: 'محمد السيد',
      email: 'reception@cairo-med-demo.edu',
      role: 'Receptionist',
      created_at: isoAgo(55, 4),
    },
    {
      id: 'USR-003',
      name: 'د. أحمد عبد الله',
      email: 'doctor@cairo-med-demo.edu',
      role: 'Doctor',
      created_at: isoAgo(50, 1),
    },
    {
      id: 'USR-004',
      name: 'آية أحمد',
      email: 'aya.ahmed@cairo-med-demo.edu',
      role: 'Receptionist',
      created_at: isoAgo(42, 3),
    },
    {
      id: 'USR-005',
      name: 'د. منى حسن',
      email: 'mona.hassan@cairo-med-demo.edu',
      role: 'Doctor',
      created_at: isoAgo(36, 5),
    },
    {
      id: 'USR-006',
      name: 'د. محمد مصطفى',
      email: 'mohamed.mostafa@cairo-med-demo.edu',
      role: 'Doctor',
      created_at: isoAgo(28, 2),
    },
    {
      id: 'USR-007',
      name: 'مصطفى محمود',
      email: 'mostafa.mahmoud@cairo-med-demo.edu',
      role: 'Receptionist',
      created_at: isoAgo(21, 4),
    },
    {
      id: 'USR-008',
      name: 'د. محمود إبراهيم',
      email: 'mahmoud.ibrahim@cairo-med-demo.edu',
      role: 'Doctor',
      created_at: isoAgo(16, 1),
    },
    {
      id: 'USR-009',
      name: 'د. سارة محمد',
      email: 'sara.mohamed@cairo-med-demo.edu',
      role: 'Doctor',
      created_at: isoAgo(12, 6),
    },
    {
      id: 'USR-010',
      name: 'إسراء محمد',
      email: 'esraa.mohamed@cairo-med-demo.edu',
      role: 'Receptionist',
      created_at: isoAgo(8, 3),
    },
  ];

  const beds: Bed[] = [
    // General Medicine (5 beds: 2 Occupied, 2 Available, 1 Maintenance)
    {
      id: 'BED-101',
      bed_number: 'GM-101A',
      ward: 'General Medicine',
      room_number: '101',
      bed_type: 'Standard',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-102',
      bed_number: 'GM-101B',
      ward: 'General Medicine',
      room_number: '101',
      bed_type: 'Standard',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-103',
      bed_number: 'GM-102A',
      ward: 'General Medicine',
      room_number: '102',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-104',
      bed_number: 'GM-102B',
      ward: 'General Medicine',
      room_number: '102',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-105',
      bed_number: 'GM-103A',
      ward: 'General Medicine',
      room_number: '103',
      bed_type: 'Isolation',
      status: 'Maintenance',
      created_at: isoAgo(60),
    },

    // Intensive Care Unit (5 beds: 2 Occupied, 2 Available, 1 Maintenance)
    {
      id: 'BED-201',
      bed_number: 'ICU-201',
      ward: 'Intensive Care Unit',
      room_number: '201',
      bed_type: 'ICU',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-202',
      bed_number: 'ICU-202',
      ward: 'Intensive Care Unit',
      room_number: '202',
      bed_type: 'ICU',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-203',
      bed_number: 'ICU-203',
      ward: 'Intensive Care Unit',
      room_number: '203',
      bed_type: 'ICU',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-204',
      bed_number: 'ICU-204',
      ward: 'Intensive Care Unit',
      room_number: '204',
      bed_type: 'Isolation',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-205',
      bed_number: 'ICU-205',
      ward: 'Intensive Care Unit',
      room_number: '205',
      bed_type: 'ICU',
      status: 'Maintenance',
      created_at: isoAgo(60),
    },

    // Surgical Ward (4 beds: 1 Occupied, 3 Available)
    {
      id: 'BED-301',
      bed_number: 'SUR-301A',
      ward: 'Surgical Ward',
      room_number: '301',
      bed_type: 'Standard',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-302',
      bed_number: 'SUR-301B',
      ward: 'Surgical Ward',
      room_number: '301',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-303',
      bed_number: 'SUR-302A',
      ward: 'Surgical Ward',
      room_number: '302',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-304',
      bed_number: 'SUR-302B',
      ward: 'Surgical Ward',
      room_number: '302',
      bed_type: 'Isolation',
      status: 'Available',
      created_at: isoAgo(60),
    },

    // Cardiology (4 beds: 1 Occupied, 3 Available)
    {
      id: 'BED-401',
      bed_number: 'CAR-401A',
      ward: 'Cardiology',
      room_number: '401',
      bed_type: 'ICU',
      status: 'Occupied',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-402',
      bed_number: 'CAR-401B',
      ward: 'Cardiology',
      room_number: '401',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-403',
      bed_number: 'CAR-402A',
      ward: 'Cardiology',
      room_number: '402',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-404',
      bed_number: 'CAR-402B',
      ward: 'Cardiology',
      room_number: '402',
      bed_type: 'Standard',
      status: 'Available',
      created_at: isoAgo(60),
    },

    // Pediatrics (3 beds: 2 Available, 1 Maintenance)
    {
      id: 'BED-501',
      bed_number: 'PED-501A',
      ward: 'Pediatrics',
      room_number: '501',
      bed_type: 'Pediatric',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-502',
      bed_number: 'PED-501B',
      ward: 'Pediatrics',
      room_number: '501',
      bed_type: 'Pediatric',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-503',
      bed_number: 'PED-502A',
      ward: 'Pediatrics',
      room_number: '502',
      bed_type: 'Pediatric',
      status: 'Maintenance',
      created_at: isoAgo(60),
    },

    // Maternity (3 beds: 3 Available)
    {
      id: 'BED-601',
      bed_number: 'MAT-601A',
      ward: 'Maternity',
      room_number: '601',
      bed_type: 'Maternity',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-602',
      bed_number: 'MAT-601B',
      ward: 'Maternity',
      room_number: '601',
      bed_type: 'Maternity',
      status: 'Available',
      created_at: isoAgo(60),
    },
    {
      id: 'BED-603',
      bed_number: 'MAT-602A',
      ward: 'Maternity',
      room_number: '602',
      bed_type: 'Maternity',
      status: 'Available',
      created_at: isoAgo(60),
    },
  ];

  // 12 Synthetic Fictional Patients with realistic Egyptian Arabic names & fictional demo phone numbers
  const patients: Patient[] = [
    {
      id: 'PAT-1001',
      full_name: 'أحمد محمد حسن',
      date_of_birth: '1958-04-14',
      gender: 'Male',
      phone: '+20 100 000 0101',
      emergency_contact: 'فاطمة حسن (Spouse) - +20 100 000 0102',
      notes: 'Admitted for inpatient observation and IV hydration monitoring. Fictional demo record.',
      created_at: isoAgo(14, 3),
    },
    {
      id: 'PAT-1002',
      full_name: 'منى أحمد محمود',
      date_of_birth: '1972-11-03',
      gender: 'Female',
      phone: '+20 111 000 0203',
      emergency_contact: 'طارق أحمد محمود (Brother) - +20 111 000 0204',
      notes: 'Scheduled inpatient respiratory monitoring in General Medicine. Fictional demo record.',
      created_at: isoAgo(11, 5),
    },
    {
      id: 'PAT-1003',
      full_name: 'محمود إبراهيم علي',
      date_of_birth: '1964-07-22',
      gender: 'Male',
      phone: '+20 122 000 0305',
      emergency_contact: 'هدى محمود إبراهيم (Daughter) - +20 122 000 0306',
      notes: 'Post-operative intensive care telemetry and vital signs tracking. Fictional demo record.',
      created_at: isoAgo(8, 2),
    },
    {
      id: 'PAT-1004',
      full_name: 'مريم محمد علي',
      date_of_birth: '1985-02-19',
      gender: 'Female',
      phone: '+20 155 000 0407',
      emergency_contact: 'كريم عادل علي (Spouse) - +20 155 000 0408',
      notes: 'High-dependency ICU continuous hemodynamic observation. Fictional demo record.',
      created_at: isoAgo(6, 4),
    },
    {
      id: 'PAT-1005',
      full_name: 'محمد أحمد عبد الرحمن',
      date_of_birth: '1991-09-08',
      gender: 'Male',
      phone: '+20 100 000 0109',
      emergency_contact: 'سميرة عبد الرحمن (Mother) - +20 100 000 0110',
      notes: 'Orthopedic surgical recovery ward placement. Mobility physical therapy scheduled. Fictional demo record.',
      created_at: isoAgo(5, 1),
    },
    {
      id: 'PAT-1006',
      full_name: 'فاطمة إبراهيم حسن',
      date_of_birth: '1953-12-30',
      gender: 'Female',
      phone: '+20 111 000 0211',
      emergency_contact: 'حسن محمود حسن (Son) - +20 111 000 0212',
      notes: 'Cardiology inpatient arrhythmia telemetry observation. Fictional demo record.',
      created_at: isoAgo(4, 6),
    },
    {
      id: 'PAT-1007',
      full_name: 'عمر خالد محمود',
      date_of_birth: '1980-06-17',
      gender: 'Male',
      phone: '+20 122 000 0313',
      emergency_contact: 'سلمى خالد محمود (Spouse) - +20 122 000 0314',
      notes: 'Registered outpatient awaiting elective surgical bed assignment. Fictional demo record.',
      created_at: isoAgo(18, 2),
    },
    {
      id: 'PAT-1008',
      full_name: 'نورهان محمود السيد',
      date_of_birth: '1994-03-25',
      gender: 'Female',
      phone: '+20 155 000 0415',
      emergency_contact: 'زياد محمود السيد (Spouse) - +20 155 000 0416',
      notes: 'Pre-registered for Maternity ward admission. Fictional demo record.',
      created_at: isoAgo(9, 4),
    },
    {
      id: 'PAT-1009',
      full_name: 'يوسف مصطفى حسن',
      date_of_birth: '1949-08-11',
      gender: 'Male',
      phone: '+20 100 000 0117',
      emergency_contact: 'مي يوسف حسن (Daughter) - +20 100 000 0118',
      notes: 'Previously discharged after general medicine evaluation; eligible for readmission if needed. Fictional demo record.',
      created_at: isoAgo(24, 3),
    },
    {
      id: 'PAT-1010',
      full_name: 'سارة خالد عبد الله',
      date_of_birth: '1968-01-29',
      gender: 'Female',
      phone: '+20 111 000 0219',
      emergency_contact: 'وليد خالد عبد الله (Brother) - +20 111 000 0220',
      notes: 'Completed post-surgical recovery earlier this month. Fictional demo record.',
      created_at: isoAgo(21, 5),
    },
    {
      id: 'PAT-1011',
      full_name: 'ياسين طارق الشافعي',
      date_of_birth: '2016-05-12',
      gender: 'Male',
      phone: '+20 122 000 0321',
      emergency_contact: 'دينا الشافعي (Mother) - +20 122 000 0322',
      notes: 'Pediatric patient registered for overnight observation. Fictional demo record.',
      created_at: isoAgo(10, 2),
    },
    {
      id: 'PAT-1012',
      full_name: 'هبة الله عبد العزيز',
      date_of_birth: '1988-10-05',
      gender: 'Female',
      phone: '+20 155 000 0423',
      emergency_contact: 'عادل عبد العزيز (Father) - +20 155 000 0424',
      notes: 'Registered for general medicine diagnostic workup. Fictional demo record.',
      created_at: isoAgo(1, 5),
    },
  ];

  // 11 Admissions: 6 Active (matching the 6 Occupied beds) + 5 Discharged historical records
  const admissions: Admission[] = [
    // 6 Active Admissions
    {
      id: 'ADM-3001',
      patient_id: 'PAT-1001',
      bed_id: 'BED-101',
      admission_datetime: isoAgo(3, 18, 30),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Admitted to GM-101A for fluid balance monitoring and routine lab checks.',
    },
    {
      id: 'ADM-3002',
      patient_id: 'PAT-1002',
      bed_id: 'BED-102',
      admission_datetime: isoAgo(2, 14, 15),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Assigned to GM-101B for inpatient respiratory care and observation.',
    },
    {
      id: 'ADM-3003',
      patient_id: 'PAT-1003',
      bed_id: 'BED-201',
      admission_datetime: isoAgo(2, 4, 45),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Direct ICU transfer following thoracic procedure; continuous telemetry.',
    },
    {
      id: 'ADM-3004',
      patient_id: 'PAT-1004',
      bed_id: 'BED-202',
      admission_datetime: isoAgo(1, 16, 10),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Admitted to ICU-202 for close metabolic and vital sign stabilization.',
    },
    {
      id: 'ADM-3005',
      patient_id: 'PAT-1005',
      bed_id: 'BED-301',
      admission_datetime: isoAgo(1, 6, 20),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Post-op admission to Surgical Ward SUR-301A; vitals stable.',
    },
    {
      id: 'ADM-3006',
      patient_id: 'PAT-1006',
      bed_id: 'BED-401',
      admission_datetime: isoAgo(0, 14, 5),
      discharge_datetime: null,
      status: 'Active',
      notes: 'Cardiology step-down unit placement in CAR-401A for 48-hour monitoring.',
    },

    // 5 Historical Discharged Admissions (spanning 1 day ago to 18 days ago)
    {
      id: 'ADM-2001',
      patient_id: 'PAT-1009',
      bed_id: 'BED-103',
      admission_datetime: isoAgo(22, 10),
      discharge_datetime: isoAgo(18, 8, 30),
      status: 'Discharged',
      notes: '4-day inpatient stay in GM-102A. Discharged in stable condition with follow-up plan.',
    },
    {
      id: 'ADM-2002',
      patient_id: 'PAT-1010',
      bed_id: 'BED-302',
      admission_datetime: isoAgo(17, 15),
      discharge_datetime: isoAgo(13, 9, 20),
      status: 'Discharged',
      notes: 'Post-surgical recovery in SUR-301B completed without complications.',
    },
    {
      id: 'ADM-2003',
      patient_id: 'PAT-1007',
      bed_id: 'BED-402',
      admission_datetime: isoAgo(9, 11),
      discharge_datetime: isoAgo(6, 13, 45),
      status: 'Discharged',
      notes: 'Diagnostic cardiac monitoring completed in CAR-401B; bed sanitized and released.',
    },
    {
      id: 'ADM-2004',
      patient_id: 'PAT-1011',
      bed_id: 'BED-501',
      admission_datetime: isoAgo(5, 18),
      discharge_datetime: isoAgo(3, 10, 30),
      status: 'Discharged',
      notes: '48-hour pediatric observation in PED-501A. Discharged home with parents.',
    },
    {
      id: 'ADM-2005',
      patient_id: 'PAT-1008',
      bed_id: 'BED-601',
      admission_datetime: isoAgo(3, 9),
      discharge_datetime: isoAgo(1, 15, 20),
      status: 'Discharged',
      notes: 'Routine prenatal observation stay in MAT-601A; discharged in good health.',
    },
  ];

  return { users, patients, beds, admissions };
}

const LEGACY_ENGLISH_PATIENT_NAMES = new Set([
  'Arthur Pendelton',
  'Beatrice Holloway',
  'Victor Kowski',
  'Nadia Al-Mansoor',
  'Desmond Okafor',
  'Sylvia Lindqvist',
  'Gabriel Morales',
  'Hannah Gallagher',
  'Kenneth Takahashi',
  'Fiona MacAllister',
  'fiona MacAllister',
  'Leo Vance-Novak',
  'Leo Vance-novak',
  'Rowan Castellano',
]);

const LEGACY_ENGLISH_USER_NAMES = new Set([
  'Dr. Eleanor Vance',
  'Marcus Sterling',
  'Dr. Aris Thorne',
  'Clara Chen',
  'Dr. Julian Mercer',
]);

/**
 * Safely migrates any legacy English demo identities in an existing database state
 * to the Egyptian Arabic demo identities in-place, preserving all user-created records
 * and foreign key relationships.
 */
export function migrateLegacyEnglishIdentitiesInPlace(db: {
  users: Array<User & { password_hash?: string }>;
  patients: Patient[];
}): boolean {
  const freshSeed = createInitialSeedData();
  const seedPatientsById = new Map(freshSeed.patients.map((p) => [p.id, p]));
  const seedUsersById = new Map(freshSeed.users.map((u) => [u.id, u]));

  let mutated = false;

  for (let i = 0; i < db.patients.length; i++) {
    const pat = db.patients[i];
    const replacement = seedPatientsById.get(pat.id);
    if (
      replacement &&
      (LEGACY_ENGLISH_PATIENT_NAMES.has(pat.full_name) || pat.phone.startsWith('(555)'))
    ) {
      db.patients[i] = {
        ...pat,
        full_name: replacement.full_name,
        gender: replacement.gender,
        phone: replacement.phone,
        emergency_contact: replacement.emergency_contact,
      };
      mutated = true;
    }
  }

  for (let i = 0; i < db.users.length; i++) {
    const usr = db.users[i];
    const replacement = seedUsersById.get(usr.id);
    if (
      replacement &&
      (LEGACY_ENGLISH_USER_NAMES.has(usr.name) || usr.email.endsWith('@stjude-demo.edu'))
    ) {
      db.users[i] = {
        ...usr,
        name: replacement.name,
        email: replacement.email,
      };
      mutated = true;
    }
  }

  // Also add the additional Egyptian staff users (USR-006..USR-010) if they are not present yet
  const existingUserIds = new Set(db.users.map((u) => u.id));
  for (const seedUser of freshSeed.users) {
    if (!existingUserIds.has(seedUser.id)) {
      db.users.push({ ...seedUser });
      mutated = true;
    }
  }

  return mutated;
}
