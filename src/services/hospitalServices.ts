/**
 * Hospital Bed Management System - Service Layer
 * Implements the Software Engineering Deliverable Services:
 * - AuthenticationService
 * - BedService
 * - PatientService
 * - AdmissionService
 * - UserService
 * - SystemService
 *
 * Architecture:
 * 1. Primary: Communicates with the Node.js + Express REST API (`/api/*`).
 * 2. Fallback: Clearly separated `LocalStorageFallbackEngine` used ONLY if the backend API
 *    is unreachable (e.g., if opened as a static bundle without the Node server).
 */

import {
  User,
  Patient,
  Bed,
  Admission,
  UserRole,
  BedStatus,
  DashboardStats,
  CreateBedInput,
  UpdateBedInput,
  CreatePatientInput,
  UpdatePatientInput,
  CreateAdmissionInput,
  DischargeAdmissionInput,
  CreateUserInput,
  AuthSession,
} from '../types/models';
import {
  createInitialSeedData,
  DEMO_ACCOUNTS,
  SeedDatabaseState,
  migrateLegacyEnglishIdentitiesInPlace,
} from '../data/seedData';

const SESSION_STORAGE_KEY = 'hbms_active_session_v1';
const LOCAL_DB_STORAGE_KEY = 'hbms_local_fallback_db_v1';

// ============================================================================
// Separated LocalStorage Fallback Repository (Only used if /api is unreachable)
// ============================================================================
class LocalStorageFallbackRepository {
  private getRawState(): SeedDatabaseState {
    const raw = localStorage.getItem(LOCAL_DB_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialSeedData();
      localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw) as SeedDatabaseState;
      if (migrateLegacyEnglishIdentitiesInPlace(parsed)) {
        localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      const initial = createInitialSeedData();
      localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
  }

  public saveRawState(state: SeedDatabaseState): void {
    localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(state));
  }

  public resetToSeed(): SeedDatabaseState {
    const initial = createInitialSeedData();
    this.saveRawState(initial);
    return initial;
  }

  public transaction<T>(fn: (db: SeedDatabaseState) => T): T {
    const snapshot = this.getRawState();
    const copy: SeedDatabaseState = JSON.parse(JSON.stringify(snapshot));
    const result = fn(copy);
    this.saveRawState(copy);
    return result;
  }

  public getEnrichedState() {
    const db = this.getRawState();
    const activeByBed = new Map<string, Admission>();
    const activeByPatient = new Map<string, Admission>();
    const patientMap = new Map<string, Patient>();
    const bedMap = new Map<string, Bed>();

    for (const p of db.patients) patientMap.set(p.id, p);
    for (const b of db.beds) bedMap.set(b.id, b);
    for (const a of db.admissions) {
      if (a.status === 'Active') {
        activeByBed.set(a.bed_id, a);
        activeByPatient.set(a.patient_id, a);
      }
    }

    const beds: Bed[] = db.beds.map((bed) => {
      const adm = activeByBed.get(bed.id);
      const pat = adm ? patientMap.get(adm.patient_id) : undefined;
      return {
        ...bed,
        current_admission_id: adm ? adm.id : null,
        assigned_patient_id: pat ? pat.id : null,
        assigned_patient_name: pat ? pat.full_name : null,
        admission_datetime: adm ? adm.admission_datetime : null,
      };
    });

    const patients: Patient[] = db.patients.map((pat) => {
      const adm = activeByPatient.get(pat.id);
      const bed = adm ? bedMap.get(adm.bed_id) : undefined;
      return {
        ...pat,
        current_admission_id: adm ? adm.id : null,
        current_bed_id: bed ? bed.id : null,
        current_bed_number: bed ? bed.bed_number : null,
        current_ward: bed ? bed.ward : null,
        current_room_number: bed ? bed.room_number : null,
      };
    });

    const admissions: Admission[] = db.admissions
      .map((adm) => {
        const pat = patientMap.get(adm.patient_id);
        const bed = bedMap.get(adm.bed_id);
        return {
          ...adm,
          patient_name: pat ? pat.full_name : 'Unknown Patient',
          patient_dob: pat?.date_of_birth,
          patient_gender: pat?.gender,
          patient_phone: pat?.phone,
          bed_number: bed ? bed.bed_number : 'Unknown Bed',
          ward: bed ? bed.ward : 'Unknown Ward',
          room_number: bed ? bed.room_number : '',
          bed_type: bed?.bed_type,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.admission_datetime).getTime() - new Date(a.admission_datetime).getTime()
      );

    return { users: db.users, patients, beds, admissions };
  }
}

const fallbackRepo = new LocalStorageFallbackRepository();

// ============================================================================
// HTTP Client Helper with Auth Bearer Token
// ============================================================================
function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed?.user) {
      const seedUser = createInitialSeedData().users.find((u) => u.id === parsed.user.id);
      if (seedUser && (parsed.user.email.endsWith('@stjude-demo.edu') || parsed.user.name !== seedUser.name)) {
        parsed.user = {
          ...parsed.user,
          name: seedUser.name,
          email: seedUser.email,
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

function assertRole(allowed: UserRole[]): User {
  const session = getStoredSession();
  if (!session || !session.user) {
    throw new Error('Authentication required. Please log in.');
  }
  if (!allowed.includes(session.user.role)) {
    throw new Error(
      `Permission denied: Your role (${session.user.role}) is not authorized for this operation.`
    );
  }
  return session.user;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  fallbackFn?: () => T
): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (fallbackFn) return fallbackFn();
      throw new Error('Unexpected non-JSON response from server.');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data as T;
  } catch (err: any) {
    // Only invoke fallback if network/fetch itself failed (not when server returned a 4xx business rule error)
    const isNetworkError =
      err instanceof TypeError ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('non-JSON');

    if (isNetworkError && fallbackFn) {
      return fallbackFn();
    }
    throw err;
  }
}

// ============================================================================
// 1. AuthenticationService
// ============================================================================
export class AuthenticationService {
  static getCurrentSession(): AuthSession | null {
    return getStoredSession();
  }

  static async login(email: string, password: string): Promise<AuthSession> {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }

    const session = await apiRequest<AuthSession>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail, password }),
      },
      () => {
        // LocalStorage fallback authentication
        const { users } = fallbackRepo.getEnrichedState();
        const demoMatch = DEMO_ACCOUNTS.find(
          (d) => d.email.toLowerCase() === trimmedEmail && d.demoAccessCode === password
        );
        const user = users.find((u) => u.email.toLowerCase() === trimmedEmail);
        if (!user || (!demoMatch && password.length < 6)) {
          throw new Error('Invalid email or password.');
        }
        return {
          token: `hbms-session:${user.id}:local`,
          user,
          storageMode: 'localstorage-fallback',
        };
      }
    );

    saveStoredSession(session);
    return session;
  }

  static async loginWithDemoRole(role: UserRole): Promise<AuthSession> {
    const session = await apiRequest<AuthSession>(
      '/api/auth/demo-login',
      {
        method: 'POST',
        body: JSON.stringify({ role }),
      },
      () => {
        const { users } = fallbackRepo.getEnrichedState();
        const user = users.find((u) => u.role === role);
        if (!user) throw new Error(`Demo user for role ${role} not found.`);
        return {
          token: `hbms-session:${user.id}:local`,
          user,
          storageMode: 'localstorage-fallback',
        };
      }
    );

    saveStoredSession(session);
    return session;
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    saveStoredSession(null);
  }
}

// ============================================================================
// 2. BedService
// ============================================================================
export class BedService {
  static async getAllBeds(): Promise<Bed[]> {
    return apiRequest<Bed[]>('/api/beds', { method: 'GET' }, () => {
      return fallbackRepo.getEnrichedState().beds;
    });
  }

  static async getAvailableBeds(): Promise<Bed[]> {
    const allBeds = await this.getAllBeds();
    return allBeds.filter((b) => b.status === 'Available');
  }

  static async createBed(input: CreateBedInput): Promise<Bed> {
    assertRole(['Administrator']);
    return apiRequest<Bed>(
      '/api/beds',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const normalized = input.bed_number.trim().toUpperCase();
          if (!normalized || !input.ward.trim() || !input.room_number.trim()) {
            throw new Error('Bed number, ward, and room number are required.');
          }
          if (db.beds.some((b) => b.bed_number.toUpperCase() === normalized)) {
            throw new Error(`A bed with number '${normalized}' already exists.`);
          }
          if (input.status === 'Occupied') {
            throw new Error('Cannot create a bed with Occupied status directly.');
          }
          const nextNum =
            db.beds.reduce((max, b) => {
              const n = parseInt(b.id.replace(/\D/g, ''), 10);
              return !isNaN(n) && n > max ? n : max;
            }, 600) + 1;

          const newBed: Bed = {
            id: `BED-${nextNum}`,
            bed_number: normalized,
            ward: input.ward.trim(),
            room_number: input.room_number.trim(),
            bed_type: input.bed_type,
            status: input.status || 'Available',
            created_at: new Date().toISOString(),
          };
          db.beds.push(newBed);
          return newBed;
        });
      }
    );
  }

  static async updateBed(id: string, input: UpdateBedInput): Promise<Bed> {
    assertRole(['Administrator']);
    return apiRequest<Bed>(
      `/api/beds/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const idx = db.beds.findIndex((b) => b.id === id);
          if (idx === -1) throw new Error('Bed not found.');
          const existing = db.beds[idx];
          const activeAdm = db.admissions.find(
            (a) => a.bed_id === id && a.status === 'Active'
          );

          if (input.status && input.status !== existing.status) {
            if (activeAdm && input.status !== 'Occupied') {
              throw new Error(
                `Cannot change status of occupied bed '${existing.bed_number}' while an active admission exists. Discharge the patient first.`
              );
            }
            if (!activeAdm && input.status === 'Occupied') {
              throw new Error(
                'Cannot set bed to Occupied directly. Use the Admission & Bed Assignment workflow.'
              );
            }
          }

          db.beds[idx] = {
            ...existing,
            bed_number: input.bed_number ? input.bed_number.trim().toUpperCase() : existing.bed_number,
            ward: input.ward ? input.ward.trim() : existing.ward,
            room_number: input.room_number ? input.room_number.trim() : existing.room_number,
            bed_type: input.bed_type || existing.bed_type,
            status: input.status || existing.status,
          };
          return db.beds[idx];
        });
      }
    );
  }
}

// ============================================================================
// 3. PatientService
// ============================================================================
export class PatientService {
  static async getAllPatients(): Promise<Patient[]> {
    return apiRequest<Patient[]>('/api/patients', { method: 'GET' }, () => {
      return fallbackRepo.getEnrichedState().patients;
    });
  }

  static async getPatientDetails(id: string): Promise<{ patient: Patient; admissions: Admission[] }> {
    return apiRequest<{ patient: Patient; admissions: Admission[] }>(
      `/api/patients/${id}`,
      { method: 'GET' },
      () => {
        const enriched = fallbackRepo.getEnrichedState();
        const patient = enriched.patients.find((p) => p.id === id);
        if (!patient) throw new Error('Patient not found.');
        const admissions = enriched.admissions.filter((a) => a.patient_id === id);
        return { patient, admissions };
      }
    );
  }

  static async registerPatient(input: CreatePatientInput): Promise<Patient> {
    assertRole(['Receptionist', 'Administrator']);
    return apiRequest<Patient>(
      '/api/patients',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const nextNum =
            db.patients.reduce((max, p) => {
              const n = parseInt(p.id.replace(/\D/g, ''), 10);
              return !isNaN(n) && n > max ? n : max;
            }, 1000) + 1;

          const created: Patient = {
            id: `PAT-${nextNum}`,
            full_name: input.full_name.trim(),
            date_of_birth: input.date_of_birth,
            gender: input.gender,
            phone: input.phone.trim(),
            emergency_contact: input.emergency_contact.trim(),
            notes: input.notes.trim(),
            created_at: new Date().toISOString(),
          };
          db.patients.push(created);
          return created;
        });
      }
    );
  }

  static async updatePatient(id: string, input: UpdatePatientInput): Promise<Patient> {
    assertRole(['Receptionist', 'Administrator', 'Doctor']);
    return apiRequest<Patient>(
      `/api/patients/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const idx = db.patients.findIndex((p) => p.id === id);
          if (idx === -1) throw new Error('Patient not found.');
          db.patients[idx] = {
            ...db.patients[idx],
            ...input,
          };
          return db.patients[idx];
        });
      }
    );
  }
}

// ============================================================================
// 4. AdmissionService
// ============================================================================
export class AdmissionService {
  static async getAllAdmissions(): Promise<Admission[]> {
    return apiRequest<Admission[]>('/api/admissions', { method: 'GET' }, () => {
      return fallbackRepo.getEnrichedState().admissions;
    });
  }

  static async assignBedAndAdmit(input: CreateAdmissionInput): Promise<Admission> {
    assertRole(['Receptionist', 'Administrator']);
    return apiRequest<Admission>(
      '/api/admissions',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      () => {
        const createdId = fallbackRepo.transaction((db) => {
          const patient = db.patients.find((p) => p.id === input.patient_id);
          if (!patient) throw new Error('Selected patient does not exist.');

          const activePatAdm = db.admissions.find(
            (a) => a.patient_id === input.patient_id && a.status === 'Active'
          );
          if (activePatAdm) {
            throw new Error(
              `Patient '${patient.full_name}' already has an active admission (${activePatAdm.id}).`
            );
          }

          const bedIdx = db.beds.findIndex((b) => b.id === input.bed_id);
          if (bedIdx === -1) throw new Error('Selected bed does not exist.');
          const bed = db.beds[bedIdx];

          if (bed.status !== 'Available') {
            throw new Error(
              `Bed '${bed.bed_number}' is currently ${bed.status} and cannot be assigned.`
            );
          }

          const nextAdmNum =
            db.admissions.reduce((max, a) => {
              const n = parseInt(a.id.replace(/\D/g, ''), 10);
              return !isNaN(n) && n > max ? n : max;
            }, 3000) + 1;

          const newAdmission: Admission = {
            id: `ADM-${nextAdmNum}`,
            patient_id: patient.id,
            bed_id: bed.id,
            admission_datetime: new Date().toISOString(),
            discharge_datetime: null,
            status: 'Active',
            notes: input.notes.trim() || `Admitted to ${bed.bed_number} (${bed.ward})`,
          };

          db.admissions.push(newAdmission);
          db.beds[bedIdx] = { ...bed, status: 'Occupied' };
          return newAdmission.id;
        });

        return fallbackRepo.getEnrichedState().admissions.find((a) => a.id === createdId)!;
      }
    );
  }

  static async dischargePatient(input: DischargeAdmissionInput): Promise<Admission> {
    assertRole(['Receptionist', 'Administrator']);
    return apiRequest<Admission>(
      `/api/admissions/${input.admission_id}/discharge`,
      {
        method: 'POST',
        body: JSON.stringify({
          discharge_notes: input.discharge_notes,
          next_bed_status: input.next_bed_status,
        }),
      },
      () => {
        fallbackRepo.transaction((db) => {
          const admIdx = db.admissions.findIndex((a) => a.id === input.admission_id);
          if (admIdx === -1) throw new Error('Admission record not found.');
          const adm = db.admissions[admIdx];
          if (adm.status !== 'Active') throw new Error('Admission is already discharged.');

          const bedIdx = db.beds.findIndex((b) => b.id === adm.bed_id);
          const nextStatus: BedStatus =
            input.next_bed_status === 'Maintenance' ? 'Maintenance' : 'Available';

          db.admissions[admIdx] = {
            ...adm,
            status: 'Discharged',
            discharge_datetime: new Date().toISOString(),
            notes: input.discharge_notes?.trim()
              ? `${adm.notes} | Discharge Summary: ${input.discharge_notes.trim()}`
              : adm.notes,
          };

          if (bedIdx !== -1) {
            db.beds[bedIdx] = { ...db.beds[bedIdx], status: nextStatus };
          }
        });

        return fallbackRepo
          .getEnrichedState()
          .admissions.find((a) => a.id === input.admission_id)!;
      }
    );
  }

  static async updateAdmissionNotes(admissionId: string, notes: string): Promise<Admission> {
    assertRole(['Administrator', 'Receptionist', 'Doctor']);
    return apiRequest<Admission>(
      `/api/admissions/${admissionId}/notes`,
      {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      },
      () => {
        fallbackRepo.transaction((db) => {
          const idx = db.admissions.findIndex((a) => a.id === admissionId);
          if (idx === -1) throw new Error('Admission record not found.');
          db.admissions[idx] = {
            ...db.admissions[idx],
            notes: notes.trim(),
          };
        });
        return fallbackRepo
          .getEnrichedState()
          .admissions.find((a) => a.id === admissionId)!;
      }
    );
  }
}

// ============================================================================
// 5. Dashboard & Report Service
// ============================================================================
export class DashboardService {
  static async getDashboardStats(): Promise<DashboardStats> {
    return apiRequest<DashboardStats>('/api/dashboard', { method: 'GET' }, () => {
      const enriched = fallbackRepo.getEnrichedState();
      const totalBeds = enriched.beds.length;
      const availableBeds = enriched.beds.filter((b) => b.status === 'Available').length;
      const occupiedBeds = enriched.beds.filter((b) => b.status === 'Occupied').length;
      const maintenanceBeds = enriched.beds.filter((b) => b.status === 'Maintenance').length;
      const totalPatients = enriched.patients.length;
      const currentAdmissions = enriched.admissions.filter((a) => a.status === 'Active').length;
      const totalDischarges = enriched.admissions.filter((a) => a.status === 'Discharged').length;

      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
      const operational = totalBeds - maintenanceBeds;
      const operationalOccupancyRate =
        operational > 0 ? Math.round((occupiedBeds / operational) * 1000) / 10 : 0;

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

      return {
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
        recentAdmissions: enriched.admissions.slice(0, 6),
        recentDischarges: enriched.admissions
          .filter((a) => a.status === 'Discharged' && a.discharge_datetime)
          .sort(
            (a, b) =>
              new Date(b.discharge_datetime!).getTime() -
              new Date(a.discharge_datetime!).getTime()
          )
          .slice(0, 6),
      };
    });
  }
}

// ============================================================================
// 6. UserService (Administrator Only) & SystemService
// ============================================================================
export class UserService {
  static async getAllUsers(): Promise<User[]> {
    assertRole(['Administrator']);
    return apiRequest<User[]>('/api/users', { method: 'GET' }, () => {
      return fallbackRepo.getEnrichedState().users;
    });
  }

  static async createUser(input: CreateUserInput): Promise<User> {
    assertRole(['Administrator']);
    return apiRequest<User>(
      '/api/users',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const email = input.email.trim().toLowerCase();
          if (db.users.some((u) => u.email.toLowerCase() === email)) {
            throw new Error(`Email '${email}' is already registered.`);
          }
          const nextNum = db.users.length + 1;
          const created: User = {
            id: `USR-${String(nextNum).padStart(3, '0')}`,
            name: input.name.trim(),
            email,
            role: input.role,
            created_at: new Date().toISOString(),
          };
          db.users.push(created);
          return created;
        });
      }
    );
  }

  static async updateUserRole(userId: string, role: UserRole): Promise<User> {
    assertRole(['Administrator']);
    return apiRequest<User>(
      `/api/users/${userId}/role`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      },
      () => {
        return fallbackRepo.transaction((db) => {
          const idx = db.users.findIndex((u) => u.id === userId);
          if (idx === -1) throw new Error('User not found.');
          db.users[idx] = { ...db.users[idx], role };
          return db.users[idx];
        });
      }
    );
  }

  static async deleteUser(userId: string): Promise<void> {
    assertRole(['Administrator']);
    await apiRequest<{ success: boolean }>(
      `/api/users/${userId}`,
      { method: 'DELETE' },
      () => {
        fallbackRepo.transaction((db) => {
          const idx = db.users.findIndex((u) => u.id === userId);
          if (idx !== -1) db.users.splice(idx, 1);
        });
        return { success: true };
      }
    );
  }
}

export class SystemService {
  static async resetDemoDatabase(): Promise<string> {
    const res = await apiRequest<{ message: string }>(
      '/api/system/reset-demo',
      { method: 'POST' },
      () => {
        fallbackRepo.resetToSeed();
        return {
          message:
            'Demonstration data reset to initial 24 beds, 12 patients, and 11 admissions.',
        };
      }
    );
    fallbackRepo.resetToSeed();
    return res.message;
  }
}
