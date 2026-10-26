/**
 * Domain Models & Service Contracts for Hospital Bed Management System
 * Aligned with Software Engineering Class, Sequence, Use Case, and Activity UML Diagrams.
 */

export type UserRole = 'Administrator' | 'Receptionist' | 'Doctor';

export type BedStatus = 'Available' | 'Occupied' | 'Maintenance';

export type BedType = 'Standard' | 'ICU' | 'Pediatric' | 'Maternity' | 'Isolation';

export type Gender = 'Male' | 'Female' | 'Other';

export type AdmissionStatus = 'Active' | 'Discharged';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  created_at: string;
}

export interface Patient {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  phone: string;
  emergency_contact: string;
  notes: string;
  created_at: string;
  // Computed / joined relational properties
  current_admission_id?: string | null;
  current_bed_id?: string | null;
  current_bed_number?: string | null;
  current_ward?: string | null;
  current_room_number?: string | null;
}

export interface Bed {
  id: string;
  bed_number: string;
  ward: string;
  room_number: string;
  bed_type: BedType;
  status: BedStatus;
  created_at: string;
  // Computed / joined relational properties
  current_admission_id?: string | null;
  assigned_patient_id?: string | null;
  assigned_patient_name?: string | null;
  admission_datetime?: string | null;
}

export interface Admission {
  id: string;
  patient_id: string;
  bed_id: string;
  admission_datetime: string;
  discharge_datetime: string | null;
  status: AdmissionStatus;
  notes: string;
  // Computed / joined relational properties
  patient_name?: string;
  patient_dob?: string;
  patient_gender?: Gender;
  patient_phone?: string;
  bed_number?: string;
  ward?: string;
  room_number?: string;
  bed_type?: BedType;
}

export interface DashboardStats {
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  maintenanceBeds: number;
  totalPatients: number;
  currentAdmissions: number;
  totalDischarges: number;
  occupancyRate: number; // Percentage 0 - 100
  operationalOccupancyRate: number; // Occupied / (Total - Maintenance)
  wardDistribution: Array<{
    ward: string;
    total: number;
    available: number;
    occupied: number;
    maintenance: number;
  }>;
  recentAdmissions: Admission[];
  recentDischarges: Admission[];
}

export interface CreateBedInput {
  bed_number: string;
  ward: string;
  room_number: string;
  bed_type: BedType;
  status: BedStatus;
}

export interface UpdateBedInput {
  bed_number?: string;
  ward?: string;
  room_number?: string;
  bed_type?: BedType;
  status?: BedStatus;
}

export interface CreatePatientInput {
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  phone: string;
  emergency_contact: string;
  notes: string;
}

export interface UpdatePatientInput {
  full_name?: string;
  date_of_birth?: string;
  gender?: Gender;
  phone?: string;
  emergency_contact?: string;
  notes?: string;
}

export interface CreateAdmissionInput {
  patient_id: string;
  bed_id: string;
  notes: string;
}

export interface DischargeAdmissionInput {
  admission_id: string;
  discharge_notes?: string;
  next_bed_status?: 'Available' | 'Maintenance';
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: User;
  storageMode: 'backend-postgres' | 'backend-persistent' | 'localstorage-fallback';
}
