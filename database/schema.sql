-- ============================================================================
-- Hospital Bed Management System - PostgreSQL Relational Schema
-- Software Engineering Mini-Project Deliverable
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('Administrator', 'Receptionist', 'Doctor')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. PATIENTS TABLE
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(24) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    phone VARCHAR(40) NOT NULL,
    emergency_contact VARCHAR(160) NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. BEDS TABLE
CREATE TABLE IF NOT EXISTS beds (
    id VARCHAR(36) PRIMARY KEY,
    bed_number VARCHAR(32) NOT NULL UNIQUE,
    ward VARCHAR(80) NOT NULL,
    room_number VARCHAR(32) NOT NULL,
    bed_type VARCHAR(40) NOT NULL CHECK (bed_type IN ('Standard', 'ICU', 'Pediatric', 'Maternity', 'Isolation')),
    status VARCHAR(24) NOT NULL CHECK (status IN ('Available', 'Occupied', 'Maintenance')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ADMISSIONS TABLE
CREATE TABLE IF NOT EXISTS admissions (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    bed_id VARCHAR(36) NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    admission_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discharge_datetime TIMESTAMP WITH TIME ZONE NULL,
    status VARCHAR(24) NOT NULL CHECK (status IN ('Active', 'Discharged')),
    notes TEXT NOT NULL DEFAULT '',
    CONSTRAINT chk_discharge_datetime CHECK (
        (status = 'Active' AND discharge_datetime IS NULL) OR
        (status = 'Discharged' AND discharge_datetime IS NOT NULL)
    )
);

-- Enforce business invariant: A patient may have at most ONE active admission at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_patient_admission
    ON admissions (patient_id)
    WHERE status = 'Active';

-- Enforce business invariant: A bed may have at most ONE active admission at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_bed_admission
    ON admissions (bed_id)
    WHERE status = 'Active';

-- Supporting lookup indexes
CREATE INDEX IF NOT EXISTS idx_beds_status_ward ON beds (status, ward);
CREATE INDEX IF NOT EXISTS idx_admissions_datetime ON admissions (admission_datetime DESC);
