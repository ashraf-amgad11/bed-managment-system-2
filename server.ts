import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import {
  User,
  Patient,
  Bed,
  Admission,
  UserRole,
  BedStatus,
  BedType,
  Gender,
} from './src/types/models';
import {
  createInitialSeedData,
  DEMO_ACCOUNTS,
  migrateLegacyEnglishIdentitiesInPlace,
} from './src/data/seedData';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'hospital_db.json');

// ============================================================================
// Password Hashing Utilities (Node.js native crypto.scryptSync)
// ============================================================================
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

// ============================================================================
// Database Abstraction Layer (PostgreSQL if DATABASE_URL set, else Transactional File Store)
// ============================================================================
interface StoredDatabase {
  users: Array<User & { password_hash: string }>;
  patients: Patient[];
  beds: Bed[];
  admissions: Admission[];
}

let pgPool: pg.Pool | null = null;
let usePostgres = false;

async function initDatabase(): Promise<void> {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    try {
      pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await pgPool.query('SELECT 1');
      const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'database/schema.sql'), 'utf-8');
      await pgPool.query(schemaSql);
      usePostgres = true;
      await seedPostgresIfEmpty();
      console.log('[Database] Connected to PostgreSQL database successfully.');
      return;
    } catch (err) {
      console.warn('[Database] PostgreSQL connection failed, falling back to server persistent store:', err);
      pgPool = null;
      usePostgres = false;
    }
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE_PATH)) {
    resetFileStore();
  } else {
    // Reconcile relational invariants, check for future seed timestamps, and safely migrate English demo names to Egyptian Arabic names
    const current = readFileStore();
    const now = Date.now();
    const hasFutureTimestamps = current.admissions.some(
      (a) => new Date(a.admission_datetime).getTime() > now + 60_000
    );
    if (hasFutureTimestamps) {
      resetFileStore();
    } else {
      executeFileTransaction((db) => {
        migrateLegacyEnglishIdentitiesInPlace(db);
        const demoCodeByEmail = new Map(
          DEMO_ACCOUNTS.map((d) => [d.email.toLowerCase(), d.demoAccessCode])
        );
        for (const u of db.users) {
          if (!u.password_hash) {
            const pass = demoCodeByEmail.get(u.email.toLowerCase()) || 'StaffPass#2026';
            u.password_hash = hashPassword(pass);
          }
        }
        const activeBedIds = new Set(
          db.admissions.filter((a) => a.status === 'Active').map((a) => a.bed_id)
        );
        for (const bed of db.beds) {
          if (activeBedIds.has(bed.id)) {
            bed.status = 'Occupied';
          } else if (bed.status === 'Occupied') {
            bed.status = 'Available';
          }
        }
      });
    }
  }
}

function createInitialFileState(): StoredDatabase {
  const seed = createInitialSeedData();
  const demoCodeByEmail = new Map(
    DEMO_ACCOUNTS.map((d) => [d.email.toLowerCase(), d.demoAccessCode])
  );
  const usersWithHashes = seed.users.map((u) => {
    const defaultPass = demoCodeByEmail.get(u.email.toLowerCase()) || 'StaffPass#2026';
    return {
      ...u,
      password_hash: hashPassword(defaultPass),
    };
  });
  return {
    users: usersWithHashes,
    patients: seed.patients,
    beds: seed.beds,
    admissions: seed.admissions,
  };
}

function readFileStore(): StoredDatabase {
  if (!fs.existsSync(DB_FILE_PATH)) {
    const initial = createInitialFileState();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
  return JSON.parse(raw) as StoredDatabase;
}

function writeFileStore(data: StoredDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${DB_FILE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE_PATH);
}

function resetFileStore(): StoredDatabase {
  const initial = createInitialFileState();
  writeFileStore(initial);
  return initial;
}

/**
 * Executes a synchronous atomic transaction against the persistent file store.
 * If an error is thrown inside `fn`, no changes are written to disk.
 */
function executeFileTransaction<T>(fn: (db: StoredDatabase) => T): T {
  const snapshot = readFileStore();
  const workingCopy: StoredDatabase = JSON.parse(JSON.stringify(snapshot));
  const result = fn(workingCopy);
  writeFileStore(workingCopy);
  return result;
}

async function seedPostgresIfEmpty(): Promise<void> {
  if (!pgPool) return;
  const { rows } = await pgPool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const initial = createInitialFileState();
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    for (const u of initial.users) {
      await client.query(
        'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [u.id, u.name, u.email, u.password_hash, u.role, u.created_at]
      );
    }
    for (const p of initial.patients) {
      await client.query(
        'INSERT INTO patients (id, full_name, date_of_birth, gender, phone, emergency_contact, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [p.id, p.full_name, p.date_of_birth, p.gender, p.phone, p.emergency_contact, p.notes, p.created_at]
      );
    }
    for (const b of initial.beds) {
      await client.query(
        'INSERT INTO beds (id, bed_number, ward, room_number, bed_type, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [b.id, b.bed_number, b.ward, b.room_number, b.bed_type, b.status, b.created_at]
      );
    }
    for (const a of initial.admissions) {
      await client.query(
        'INSERT INTO admissions (id, patient_id, bed_id, admission_datetime, discharge_datetime, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [a.id, a.patient_id, a.bed_id, a.admission_datetime, a.discharge_datetime, a.status, a.notes]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// Relational Enrichment Helpers
// ============================================================================
function enrichState(db: StoredDatabase) {
  const activeAdmissionByBed = new Map<string, Admission>();
  const activeAdmissionByPatient = new Map<string, Admission>();
  const patientById = new Map<string, Patient>();
  const bedById = new Map<string, Bed>();

  for (const p of db.patients) patientById.set(p.id, p);
  for (const b of db.beds) bedById.set(b.id, b);

  for (const adm of db.admissions) {
    if (adm.status === 'Active') {
      activeAdmissionByBed.set(adm.bed_id, adm);
      activeAdmissionByPatient.set(adm.patient_id, adm);
    }
  }

  const enrichedBeds: Bed[] = db.beds.map((bed) => {
    const activeAdm = activeAdmissionByBed.get(bed.id);
    const assignedPatient = activeAdm ? patientById.get(activeAdm.patient_id) : undefined;
    return {
      ...bed,
      current_admission_id: activeAdm ? activeAdm.id : null,
      assigned_patient_id: assignedPatient ? assignedPatient.id : null,
      assigned_patient_name: assignedPatient ? assignedPatient.full_name : null,
      admission_datetime: activeAdm ? activeAdm.admission_datetime : null,
    };
  });

  const enrichedPatients: Patient[] = db.patients.map((pat) => {
    const activeAdm = activeAdmissionByPatient.get(pat.id);
    const assignedBed = activeAdm ? bedById.get(activeAdm.bed_id) : undefined;
    return {
      ...pat,
      current_admission_id: activeAdm ? activeAdm.id : null,
      current_bed_id: assignedBed ? assignedBed.id : null,
      current_bed_number: assignedBed ? assignedBed.bed_number : null,
      current_ward: assignedBed ? assignedBed.ward : null,
      current_room_number: assignedBed ? assignedBed.room_number : null,
    };
  });

  const enrichedAdmissions: Admission[] = db.admissions
    .map((adm) => {
      const pat = patientById.get(adm.patient_id);
      const bed = bedById.get(adm.bed_id);
      return {
        ...adm,
        patient_name: pat ? pat.full_name : 'Unknown Patient',
        patient_dob: pat ? pat.date_of_birth : undefined,
        patient_gender: pat ? pat.gender : undefined,
        patient_phone: pat ? pat.phone : undefined,
        bed_number: bed ? bed.bed_number : 'Unknown Bed',
        ward: bed ? bed.ward : 'Unknown Ward',
        room_number: bed ? bed.room_number : '',
        bed_type: bed ? bed.bed_type : undefined,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.admission_datetime).getTime() - new Date(a.admission_datetime).getTime()
    );

  const sanitizedUsers: User[] = db.users.map(({ password_hash, ...rest }) => rest);

  return {
    users: sanitizedUsers,
    patients: enrichedPatients,
    beds: enrichedBeds,
    admissions: enrichedAdmissions,
  };
}

// ============================================================================
// Session Token Management & RBAC Middleware
// ============================================================================
const activeSessions = new Map<string, { userId: string; createdAt: number }>();

interface AuthenticatedRequest extends Request {
  user?: User;
}

function getCurrentDatabaseState(): StoredDatabase {
  return readFileStore();
}

function authenticateMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.slice(7).trim();
  const session = activeSessions.get(token);

  // Also allow stateless demo token format `demo-token:<userId>` in case dev server restarts
  let userId = session?.userId;
  if (!userId && token.startsWith('hbms-session:')) {
    const parts = token.split(':');
    if (parts.length >= 2) {
      userId = parts[1];
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }

  const db = getCurrentDatabaseState();
  const foundUser = db.users.find((u) => u.id === userId);
  if (!foundUser) {
    return res.status(401).json({ error: 'User account no longer exists.' });
  }

  const { password_hash, ...cleanUser } = foundUser;
  req.user = cleanUser;
  next();
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to perform this action. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

// ============================================================================
// Express Server & API Routes
// ============================================================================
async function startServer() {
  await initDatabase();

  const app = express();
  app.use(express.json());

  // Health & Storage Info
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      storageMode: usePostgres ? 'backend-postgres' : 'backend-persistent',
    });
  });

  // --------------------------------------------------------------------------
  // Authentication Endpoints
  // --------------------------------------------------------------------------
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email address and password are required.' });
    }

    const db = getCurrentDatabaseState();
    const userRecord = db.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!userRecord || !verifyPassword(password, userRecord.password_hash)) {
      return res.status(401).json({
        error: 'Invalid email or password. For academic evaluation, you can also select a Demo Role card below.',
      });
    }

    const token = `hbms-session:${userRecord.id}:${crypto.randomBytes(16).toString('hex')}`;
    activeSessions.set(token, { userId: userRecord.id, createdAt: Date.now() });

    const { password_hash, ...cleanUser } = userRecord;
    return res.json({
      token,
      user: cleanUser,
      storageMode: usePostgres ? 'backend-postgres' : 'backend-persistent',
    });
  });

  app.post('/api/auth/demo-login', (req: Request, res: Response) => {
    const { role } = req.body || {};
    if (!role || !['Administrator', 'Receptionist', 'Doctor'].includes(role)) {
      return res.status(400).json({ error: 'Valid demo role is required.' });
    }

    const db = getCurrentDatabaseState();
    const userRecord = db.users.find((u) => u.role === role);
    if (!userRecord) {
      return res.status(404).json({ error: `No demo account found for role ${role}.` });
    }

    const token = `hbms-session:${userRecord.id}:${crypto.randomBytes(16).toString('hex')}`;
    activeSessions.set(token, { userId: userRecord.id, createdAt: Date.now() });

    const { password_hash, ...cleanUser } = userRecord;
    return res.json({
      token,
      user: cleanUser,
      storageMode: usePostgres ? 'backend-postgres' : 'backend-persistent',
    });
  });

  app.get('/api/auth/me', authenticateMiddleware, (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      user: req.user,
      storageMode: usePostgres ? 'backend-postgres' : 'backend-persistent',
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      activeSessions.delete(token);
    }
    return res.json({ success: true });
  });

  // --------------------------------------------------------------------------
  // Dashboard Statistics Endpoint
  // --------------------------------------------------------------------------
  app.get('/api/dashboard', authenticateMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const db = getCurrentDatabaseState();
    const enriched = enrichState(db);

    const totalBeds = enriched.beds.length;
    const availableBeds = enriched.beds.filter((b) => b.status === 'Available').length;
    const occupiedBeds = enriched.beds.filter((b) => b.status === 'Occupied').length;
    const maintenanceBeds = enriched.beds.filter((b) => b.status === 'Maintenance').length;
    const totalPatients = enriched.patients.length;
    const currentAdmissions = enriched.admissions.filter((a) => a.status === 'Active').length;
    const totalDischarges = enriched.admissions.filter((a) => a.status === 'Discharged').length;

    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
    const operationalBeds = totalBeds - maintenanceBeds;
    const operationalOccupancyRate =
      operationalBeds > 0 ? Math.round((occupiedBeds / operationalBeds) * 1000) / 10 : 0;

    const wardMap = new Map<
      string,
      { ward: string; total: number; available: number; occupied: number; maintenance: number }
    >();
    for (const bed of enriched.beds) {
      const entry = wardMap.get(bed.ward) || {
        ward: bed.ward,
        total: 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
      };
      entry.total += 1;
      if (bed.status === 'Available') entry.available += 1;
      if (bed.status === 'Occupied') entry.occupied += 1;
      if (bed.status === 'Maintenance') entry.maintenance += 1;
      wardMap.set(bed.ward, entry);
    }

    const recentAdmissions = enriched.admissions.slice(0, 6);
    const recentDischarges = enriched.admissions
      .filter((a) => a.status === 'Discharged' && a.discharge_datetime)
      .sort(
        (a, b) =>
          new Date(b.discharge_datetime!).getTime() - new Date(a.discharge_datetime!).getTime()
      )
      .slice(0, 6);

    return res.json({
      totalBeds,
      availableBeds,
      occupiedBeds,
      maintenanceBeds,
      totalPatients,
      currentAdmissions,
      totalDischarges,
      occupancyRate,
      operationalOccupancyRate,
      wardDistribution: Array.from(wardMap.values()),
      recentAdmissions,
      recentDischarges,
    });
  });

  // --------------------------------------------------------------------------
  // Bed Management Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/beds', authenticateMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const db = getCurrentDatabaseState();
    const { beds } = enrichState(db);
    return res.json(beds);
  });

  app.post(
    '/api/beds',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { bed_number, ward, room_number, bed_type, status } = req.body || {};

      if (!bed_number || typeof bed_number !== 'string' || !bed_number.trim()) {
        return res.status(400).json({ error: 'Bed number is required.' });
      }
      if (!ward || typeof ward !== 'string' || !ward.trim()) {
        return res.status(400).json({ error: 'Ward name is required.' });
      }
      if (!room_number || typeof room_number !== 'string' || !room_number.trim()) {
        return res.status(400).json({ error: 'Room number is required.' });
      }
      const validTypes: BedType[] = ['Standard', 'ICU', 'Pediatric', 'Maternity', 'Isolation'];
      if (!validTypes.includes(bed_type)) {
        return res.status(400).json({ error: 'Invalid bed type specified.' });
      }
      const validInitialStatuses: BedStatus[] = ['Available', 'Maintenance'];
      const targetStatus: BedStatus = status || 'Available';
      if (!validInitialStatuses.includes(targetStatus)) {
        return res.status(400).json({
          error:
            'A newly created bed must have status Available or Maintenance. Use the Admission workflow to mark a bed as Occupied.',
        });
      }

      try {
        const newBed = executeFileTransaction((db) => {
          const normalizedNumber = bed_number.trim().toUpperCase();
          const duplicate = db.beds.some(
            (b) => b.bed_number.toUpperCase() === normalizedNumber
          );
          if (duplicate) {
            throw new Error(`A bed with number '${normalizedNumber}' already exists.`);
          }

          const nextNumericId =
            db.beds.reduce((max, b) => {
              const num = parseInt(b.id.replace(/\D/g, ''), 10);
              return !isNaN(num) && num > max ? num : max;
            }, 600) + 1;

          const created: Bed = {
            id: `BED-${nextNumericId}`,
            bed_number: normalizedNumber,
            ward: ward.trim(),
            room_number: room_number.trim(),
            bed_type,
            status: targetStatus,
            created_at: new Date().toISOString(),
          };

          db.beds.push(created);
          return created;
        });

        return res.status(201).json(newBed);
      } catch (err: any) {
        return res.status(409).json({ error: err.message || 'Failed to add bed.' });
      }
    }
  );

  app.put(
    '/api/beds/:id',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { bed_number, ward, room_number, bed_type, status } = req.body || {};

      try {
        const updated = executeFileTransaction((db) => {
          const idx = db.beds.findIndex((b) => b.id === id);
          if (idx === -1) {
            throw new Error(`Bed '${id}' not found.`);
          }
          const existing = db.beds[idx];
          const activeAdmission = db.admissions.find(
            (a) => a.bed_id === id && a.status === 'Active'
          );

          if (bed_number !== undefined) {
            const normalized = String(bed_number).trim().toUpperCase();
            if (!normalized) throw new Error('Bed number cannot be empty.');
            const duplicate = db.beds.some(
              (b) => b.id !== id && b.bed_number.toUpperCase() === normalized
            );
            if (duplicate) {
              throw new Error(`Another bed with number '${normalized}' already exists.`);
            }
            existing.bed_number = normalized;
          }

          if (ward !== undefined) {
            if (!String(ward).trim()) throw new Error('Ward cannot be empty.');
            existing.ward = String(ward).trim();
          }

          if (room_number !== undefined) {
            if (!String(room_number).trim()) throw new Error('Room number cannot be empty.');
            existing.room_number = String(room_number).trim();
          }

          if (bed_type !== undefined) {
            const validTypes: BedType[] = ['Standard', 'ICU', 'Pediatric', 'Maternity', 'Isolation'];
            if (!validTypes.includes(bed_type)) throw new Error('Invalid bed type.');
            existing.bed_type = bed_type;
          }

          if (status !== undefined && status !== existing.status) {
            if (activeAdmission && status !== 'Occupied') {
              throw new Error(
                `Cannot change bed '${existing.bed_number}' status to '${status}' while it has an active patient admission (${activeAdmission.id}). Please discharge the patient first.`
              );
            }
            if (!activeAdmission && status === 'Occupied') {
              throw new Error(
                `Cannot manually set bed '${existing.bed_number}' to Occupied without assigning a patient. Please use the Admission & Bed Assignment page.`
              );
            }
            existing.status = status;
          }

          db.beds[idx] = existing;
          return enrichState(db).beds.find((b) => b.id === id)!;
        });

        return res.json(updated);
      } catch (err: any) {
        const statusCode = err.message?.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ error: err.message || 'Failed to update bed.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Patient Management Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/patients', authenticateMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const db = getCurrentDatabaseState();
    const { patients } = enrichState(db);
    return res.json(patients);
  });

  app.get(
    '/api/patients/:id',
    authenticateMiddleware,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getCurrentDatabaseState();
      const enriched = enrichState(db);
      const patient = enriched.patients.find((p) => p.id === req.params.id);
      if (!patient) {
        return res.status(404).json({ error: 'Patient record not found.' });
      }
      const admissions = enriched.admissions.filter((a) => a.patient_id === patient.id);
      return res.json({ patient, admissions });
    }
  );

  app.post(
    '/api/patients',
    authenticateMiddleware,
    requireRole(['Receptionist', 'Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { full_name, date_of_birth, gender, phone, emergency_contact, notes } = req.body || {};

      if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
        return res.status(400).json({ error: 'Patient full name is required (min 2 characters).' });
      }
      if (!date_of_birth || typeof date_of_birth !== 'string' || isNaN(Date.parse(date_of_birth))) {
        return res.status(400).json({ error: 'Valid date of birth is required.' });
      }
      if (new Date(date_of_birth) > new Date()) {
        return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
      }
      const validGenders: Gender[] = ['Male', 'Female', 'Other'];
      if (!validGenders.includes(gender)) {
        return res.status(400).json({ error: 'Valid gender (Male, Female, Other) is required.' });
      }
      if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
        return res.status(400).json({ error: 'Valid contact phone number is required.' });
      }
      if (!emergency_contact || typeof emergency_contact !== 'string' || emergency_contact.trim().length < 4) {
        return res.status(400).json({ error: 'Emergency contact details are required.' });
      }

      try {
        const created = executeFileTransaction((db) => {
          const nextNumericId =
            db.patients.reduce((max, p) => {
              const num = parseInt(p.id.replace(/\D/g, ''), 10);
              return !isNaN(num) && num > max ? num : max;
            }, 1000) + 1;

          const newPatient: Patient = {
            id: `PAT-${nextNumericId}`,
            full_name: full_name.trim(),
            date_of_birth: date_of_birth.trim(),
            gender,
            phone: phone.trim(),
            emergency_contact: emergency_contact.trim(),
            notes: typeof notes === 'string' ? notes.trim() : '',
            created_at: new Date().toISOString(),
          };

          db.patients.push(newPatient);
          return enrichState(db).patients.find((p) => p.id === newPatient.id)!;
        });

        return res.status(201).json(created);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Failed to register patient.' });
      }
    }
  );

  app.put(
    '/api/patients/:id',
    authenticateMiddleware,
    requireRole(['Receptionist', 'Administrator', 'Doctor']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { full_name, date_of_birth, gender, phone, emergency_contact, notes } = req.body || {};

      try {
        const updated = executeFileTransaction((db) => {
          const idx = db.patients.findIndex((p) => p.id === id);
          if (idx === -1) {
            throw new Error(`Patient '${id}' not found.`);
          }
          const existing = db.patients[idx];

          // Doctors may update clinical notes; Receptionist & Administrator can update demographic fields too
          if (req.user?.role === 'Doctor') {
            if (notes !== undefined) {
              existing.notes = String(notes).trim();
            }
          } else {
            if (full_name !== undefined) {
              if (String(full_name).trim().length < 2) {
                throw new Error('Full name must be at least 2 characters.');
              }
              existing.full_name = String(full_name).trim();
            }
            if (date_of_birth !== undefined) {
              if (isNaN(Date.parse(date_of_birth)) || new Date(date_of_birth) > new Date()) {
                throw new Error('Invalid date of birth.');
              }
              existing.date_of_birth = String(date_of_birth).trim();
            }
            if (gender !== undefined) {
              if (!['Male', 'Female', 'Other'].includes(gender)) {
                throw new Error('Invalid gender.');
              }
              existing.gender = gender;
            }
            if (phone !== undefined) {
              if (String(phone).trim().length < 6) {
                throw new Error('Valid contact phone number is required.');
              }
              existing.phone = String(phone).trim();
            }
            if (emergency_contact !== undefined) {
              if (String(emergency_contact).trim().length < 4) {
                throw new Error('Emergency contact is required.');
              }
              existing.emergency_contact = String(emergency_contact).trim();
            }
            if (notes !== undefined) {
              existing.notes = String(notes).trim();
            }
          }

          db.patients[idx] = existing;
          return enrichState(db).patients.find((p) => p.id === id)!;
        });

        return res.json(updated);
      } catch (err: any) {
        const code = err.message?.includes('not found') ? 404 : 400;
        return res.status(code).json({ error: err.message || 'Failed to update patient.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Admission & Bed Assignment Workflow Endpoints (Transactional)
  // --------------------------------------------------------------------------
  app.get('/api/admissions', authenticateMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const db = getCurrentDatabaseState();
    const { admissions } = enrichState(db);
    return res.json(admissions);
  });

  app.post(
    '/api/admissions',
    authenticateMiddleware,
    requireRole(['Receptionist', 'Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { patient_id, bed_id, notes } = req.body || {};

      if (!patient_id || typeof patient_id !== 'string') {
        return res.status(400).json({ error: 'A registered patient must be selected.' });
      }
      if (!bed_id || typeof bed_id !== 'string') {
        return res.status(400).json({ error: 'An available hospital bed must be selected.' });
      }

      try {
        const createdAdmission = executeFileTransaction((db) => {
          // 1. Verify patient exists
          const patient = db.patients.find((p) => p.id === patient_id);
          if (!patient) {
            throw new Error(`Patient '${patient_id}' does not exist.`);
          }

          // 2. Verify patient does not already have an active admission
          const existingPatientAdmission = db.admissions.find(
            (a) => a.patient_id === patient_id && a.status === 'Active'
          );
          if (existingPatientAdmission) {
            throw new Error(
              `Patient '${patient.full_name}' already has an active admission (${existingPatientAdmission.id}). Duplicate active admissions are not permitted.`
            );
          }

          // 3. Verify bed exists
          const bedIdx = db.beds.findIndex((b) => b.id === bed_id);
          if (bedIdx === -1) {
            throw new Error(`Bed '${bed_id}' does not exist.`);
          }
          const bed = db.beds[bedIdx];

          // 4. Verify bed status is strictly Available (never Occupied or Maintenance)
          if (bed.status === 'Occupied') {
            throw new Error(
              `Bed '${bed.bed_number}' is currently Occupied and cannot be assigned to another patient.`
            );
          }
          if (bed.status === 'Maintenance') {
            throw new Error(
              `Bed '${bed.bed_number}' is currently under Maintenance and cannot be assigned.`
            );
          }

          // 5. Double-check no active admission references this bed
          const existingBedAdmission = db.admissions.find(
            (a) => a.bed_id === bed_id && a.status === 'Active'
          );
          if (existingBedAdmission) {
            throw new Error(
              `Bed '${bed.bed_number}' already has an active admission record (${existingBedAdmission.id}).`
            );
          }

          // 6. Create Admission record
          const nextAdmNum =
            db.admissions.reduce((max, a) => {
              const num = parseInt(a.id.replace(/\D/g, ''), 10);
              return !isNaN(num) && num > max ? num : max;
            }, 3000) + 1;

          const newAdmission: Admission = {
            id: `ADM-${nextAdmNum}`,
            patient_id: patient.id,
            bed_id: bed.id,
            admission_datetime: new Date().toISOString(),
            discharge_datetime: null,
            status: 'Active',
            notes: typeof notes === 'string' && notes.trim()
              ? notes.trim()
              : `Admitted to ${bed.bed_number} (${bed.ward}, Room ${bed.room_number}).`,
          };

          db.admissions.push(newAdmission);

          // 7. Atomically update Bed status to Occupied
          db.beds[bedIdx] = {
            ...bed,
            status: 'Occupied',
          };

          return enrichState(db).admissions.find((a) => a.id === newAdmission.id)!;
        });

        return res.status(201).json(createdAdmission);
      } catch (err: any) {
        return res.status(409).json({ error: err.message || 'Failed to complete admission and bed assignment.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Discharge Management Workflow Endpoint (Transactional)
  // --------------------------------------------------------------------------
  app.post(
    '/api/admissions/:id/discharge',
    authenticateMiddleware,
    requireRole(['Receptionist', 'Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { discharge_notes, next_bed_status } = req.body || {};

      const targetBedStatus: BedStatus =
        next_bed_status === 'Maintenance' ? 'Maintenance' : 'Available';

      try {
        const dischargedRecord = executeFileTransaction((db) => {
          const admIdx = db.admissions.findIndex((a) => a.id === id);
          if (admIdx === -1) {
            throw new Error(`Admission record '${id}' not found.`);
          }

          const admission = db.admissions[admIdx];
          if (admission.status !== 'Active') {
            throw new Error(`Admission '${id}' has already been discharged.`);
          }

          const bedIdx = db.beds.findIndex((b) => b.id === admission.bed_id);
          if (bedIdx === -1) {
            throw new Error(`Assigned bed '${admission.bed_id}' not found.`);
          }

          const dischargeTime = new Date().toISOString();
          const combinedNotes =
            typeof discharge_notes === 'string' && discharge_notes.trim()
              ? `${admission.notes ? admission.notes + ' | ' : ''}Discharge Summary: ${discharge_notes.trim()}`
              : admission.notes;

          // 1. Close active admission & record discharge_datetime
          db.admissions[admIdx] = {
            ...admission,
            discharge_datetime: dischargeTime,
            status: 'Discharged',
            notes: combinedNotes,
          };

          // 2. Release assigned bed to Available (or Maintenance if explicitly requested)
          db.beds[bedIdx] = {
            ...db.beds[bedIdx],
            status: targetBedStatus,
          };

          return enrichState(db).admissions.find((a) => a.id === id)!;
        });

        return res.json(dischargedRecord);
      } catch (err: any) {
        const code = err.message?.includes('not found') ? 404 : 400;
        return res.status(code).json({ error: err.message || 'Failed to discharge patient.' });
      }
    }
  );

  app.put(
    '/api/admissions/:id/notes',
    authenticateMiddleware,
    requireRole(['Administrator', 'Receptionist', 'Doctor']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { notes } = req.body || {};

      if (typeof notes !== 'string') {
        return res.status(400).json({ error: 'Valid admission notes string is required.' });
      }

      try {
        const updatedAdmission = executeFileTransaction((db) => {
          const idx = db.admissions.findIndex((a) => a.id === id);
          if (idx === -1) {
            throw new Error(`Admission record '${id}' not found.`);
          }
          db.admissions[idx] = {
            ...db.admissions[idx],
            notes: notes.trim(),
          };
          return enrichState(db).admissions.find((a) => a.id === id)!;
        });
        return res.json(updatedAdmission);
      } catch (err: any) {
        const code = err.message?.includes('not found') ? 404 : 400;
        return res.status(code).json({ error: err.message || 'Failed to update admission notes.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // User Account & Role Management Endpoints (Administrator Only)
  // --------------------------------------------------------------------------
  app.get(
    '/api/users',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (_req: AuthenticatedRequest, res: Response) => {
      const db = getCurrentDatabaseState();
      const { users } = enrichState(db);
      return res.json(users);
    }
  );

  app.post(
    '/api/users',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { name, email, password, role } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Staff member name is required.' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid staff email address is required.' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!['Administrator', 'Receptionist', 'Doctor'].includes(role)) {
        return res.status(400).json({ error: 'Valid role (Administrator, Receptionist, Doctor) is required.' });
      }

      try {
        const createdUser = executeFileTransaction((db) => {
          const normalizedEmail = email.trim().toLowerCase();
          if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
            throw new Error(`A user account with email '${normalizedEmail}' already exists.`);
          }

          const nextUserNum =
            db.users.reduce((max, u) => {
              const num = parseInt(u.id.replace(/\D/g, ''), 10);
              return !isNaN(num) && num > max ? num : max;
            }, 0) + 1;

          const newUser = {
            id: `USR-${String(nextUserNum).padStart(3, '0')}`,
            name: name.trim(),
            email: normalizedEmail,
            password_hash: hashPassword(password),
            role: role as UserRole,
            created_at: new Date().toISOString(),
          };

          db.users.push(newUser);
          const { password_hash, ...clean } = newUser;
          return clean;
        });

        return res.status(201).json(createdUser);
      } catch (err: any) {
        return res.status(409).json({ error: err.message || 'Failed to create user account.' });
      }
    }
  );

  app.put(
    '/api/users/:id/role',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { role } = req.body || {};

      if (!['Administrator', 'Receptionist', 'Doctor'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
      }

      try {
        const updatedUser = executeFileTransaction((db) => {
          const idx = db.users.findIndex((u) => u.id === id);
          if (idx === -1) throw new Error('User account not found.');

          const target = db.users[idx];
          if (target.role === 'Administrator' && role !== 'Administrator') {
            const adminCount = db.users.filter((u) => u.role === 'Administrator').length;
            if (adminCount <= 1) {
              throw new Error('Cannot demote the last remaining Administrator account.');
            }
          }

          db.users[idx] = { ...target, role };
          const { password_hash, ...clean } = db.users[idx];
          return clean;
        });

        return res.json(updatedUser);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Failed to update user role.' });
      }
    }
  );

  app.delete(
    '/api/users/:id',
    authenticateMiddleware,
    requireRole(['Administrator']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      if (req.user?.id === id) {
        return res.status(400).json({ error: 'You cannot delete your own active account.' });
      }

      try {
        executeFileTransaction((db) => {
          const idx = db.users.findIndex((u) => u.id === id);
          if (idx === -1) throw new Error('User account not found.');
          if (db.users[idx].role === 'Administrator') {
            const adminCount = db.users.filter((u) => u.role === 'Administrator').length;
            if (adminCount <= 1) {
              throw new Error('Cannot delete the last Administrator account.');
            }
          }
          db.users.splice(idx, 1);
        });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Failed to delete user account.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Reset Demonstration Data Endpoint
  // --------------------------------------------------------------------------
  app.post(
    '/api/system/reset-demo',
    authenticateMiddleware,
    (_req: AuthenticatedRequest, res: Response) => {
      const fresh = resetFileStore();
      return res.json({
        message: 'Demonstration dataset has been reset to initial 24 beds, 12 patients, and 11 admissions.',
        state: enrichState(fresh),
      });
    }
  );

  // --------------------------------------------------------------------------
  // Mount Vite Dev Server or Static Production Bundle
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hospital Bed Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
