import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  BedDouble,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  Patient,
  Bed,
  Admission,
  BedType,
  UserRole,
  CreateAdmissionInput,
} from '../types/models';
import { BedStatusBadge, ConfirmDialog, formatDateTime, calculateAge } from '../components/CommonUI';

interface AdmissionAssignmentPageProps {
  patients: Patient[];
  beds: Bed[];
  userRole: UserRole;
  preselectedPatientId?: string | null;
  preselectedBedId?: string | null;
  onClearPreselection: () => void;
  onAssignBedAndAdmit: (input: CreateAdmissionInput) => Promise<Admission>;
  onNavigateToHistory: () => void;
}

export const AdmissionAssignmentPage: React.FC<AdmissionAssignmentPageProps> = ({
  patients,
  beds,
  userRole,
  preselectedPatientId,
  preselectedBedId,
  onClearPreselection,
  onAssignBedAndAdmit,
  onNavigateToHistory,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || '');
  const [selectedBedId, setSelectedBedId] = useState<string>(preselectedBedId || '');
  const [admissionNotes, setAdmissionNotes] = useState<string>('');

  const [patientSearch, setPatientSearch] = useState('');
  const [showAlreadyAdmittedPatients, setShowAlreadyAdmittedPatients] = useState(true);
  const [showUnavailableBeds, setShowUnavailableBeds] = useState(false);
  const [wardFilter, setWardFilter] = useState('ALL');
  const [bedTypeFilter, setBedTypeFilter] = useState<'ALL' | BedType>('ALL');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedAdmission, setCompletedAdmission] = useState<Admission | null>(null);

  const canPerformAdmission = userRole === 'Receptionist' || userRole === 'Administrator';

  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
      setCompletedAdmission(null);
    }
    if (preselectedBedId) {
      setSelectedBedId(preselectedBedId);
      setCompletedAdmission(null);
    }
  }, [preselectedPatientId, preselectedBedId]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const selectedBed = useMemo(
    () => beds.find((b) => b.id === selectedBedId) || null,
    [beds, selectedBedId]
  );

  const uniqueWards = useMemo(() => {
    const s = new Set<string>();
    for (const b of beds) s.add(b.ward);
    return Array.from(s);
  }, [beds]);

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    return patients.filter((p) => {
      if (!showAlreadyAdmittedPatients && p.current_bed_id) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.full_name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q)
      );
    });
  }, [patients, patientSearch, showAlreadyAdmittedPatients]);

  // Step 2: Display Available Beds (with optional toggle to inspect Occupied/Maintenance lock)
  const displayedBeds = useMemo(() => {
    return beds.filter((b) => {
      if (!showUnavailableBeds && b.status !== 'Available') return false;
      if (wardFilter !== 'ALL' && b.ward !== wardFilter) return false;
      if (bedTypeFilter !== 'ALL' && b.bed_type !== bedTypeFilter) return false;
      return true;
    });
  }, [beds, showUnavailableBeds, wardFilter, bedTypeFilter]);

  const availableBedsCount = useMemo(
    () =>
      beds.filter(
        (b) =>
          b.status === 'Available' &&
          (wardFilter === 'ALL' || b.ward === wardFilter) &&
          (bedTypeFilter === 'ALL' || b.bed_type === bedTypeFilter)
      ).length,
    [beds, wardFilter, bedTypeFilter]
  );

  // Step 4: Live Validation Checks
  const patientHasActiveAdmission = Boolean(selectedPatient?.current_bed_id);
  const bedIsStrictlyAvailable = selectedBed?.status === 'Available';
  const isReadyToConfirm =
    canPerformAdmission &&
    Boolean(selectedPatient) &&
    !patientHasActiveAdmission &&
    Boolean(selectedBed) &&
    bedIsStrictlyAvailable;

  const handleInitiateConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!canPerformAdmission) {
      setValidationError('Your role does not have permission to create admissions.');
      return;
    }
    if (!selectedPatient) {
      setValidationError('Step 1 Incomplete: Please select a registered patient.');
      return;
    }
    if (selectedPatient.current_bed_id) {
      setValidationError(
        `Validation Failed: Patient ${selectedPatient.full_name} already has an active admission in bed ${selectedPatient.current_bed_number} (${selectedPatient.current_admission_id}). Duplicate active admissions are prohibited.`
      );
      return;
    }
    if (!selectedBed) {
      setValidationError('Step 3 Incomplete: Please select an available hospital bed.');
      return;
    }
    if (selectedBed.status !== 'Available') {
      setValidationError(
        `Validation Failed: Bed ${selectedBed.bed_number} is currently ${selectedBed.status} and cannot be assigned.`
      );
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedPatient || !selectedBed) return;
    setIsSubmitting(true);
    setValidationError(null);
    try {
      const created = await onAssignBedAndAdmit({
        patient_id: selectedPatient.id,
        bed_id: selectedBed.id,
        notes:
          admissionNotes.trim() ||
          `Admitted to ${selectedBed.bed_number} (${selectedBed.ward}, Room ${selectedBed.room_number}).`,
      });
      setCompletedAdmission(created);
      setIsConfirmOpen(false);
      setSelectedPatientId('');
      setSelectedBedId('');
      setAdmissionNotes('');
      onClearPreselection();
    } catch (err: any) {
      setIsConfirmOpen(false);
      setValidationError(err.message || 'Transaction failed while assigning bed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canPerformAdmission) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">
          Role Restriction: Receptionist or Administrator Required
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
          You are currently signed in as a <strong>{userRole}</strong>. Doctors have read-only
          access to bed availability and assigned patient records. Switch to the{' '}
          <strong>Receptionist</strong> or <strong>Administrator</strong> role in the top bar to
          execute the Admission & Bed Assignment workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Admission & Bed Assignment Workflow
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an unassigned registered patient, choose an available bed, verify eligibility,
            and commit an atomic admission transaction.
          </p>
        </div>

        {(selectedPatientId || selectedBedId || completedAdmission) && (
          <button
            type="button"
            onClick={() => {
              setSelectedPatientId('');
              setSelectedBedId('');
              setAdmissionNotes('');
              setValidationError(null);
              setCompletedAdmission(null);
              onClearPreselection();
            }}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Selection</span>
          </button>
        )}
      </div>

      {/* Step 8: Success Banner after completing workflow */}
      {completedAdmission && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h3 className="text-sm font-bold text-emerald-950">
                Admission & Bed Assignment Confirmed ({completedAdmission.id})
              </h3>
              <p className="text-emerald-800">
                Patient <strong>{completedAdmission.patient_name}</strong> (
                <span className="font-mono">{completedAdmission.patient_id}</span>) has been
                assigned to Bed{' '}
                <strong className="font-mono">{completedAdmission.bed_number}</strong> in{' '}
                <strong>{completedAdmission.ward}</strong> (Room {completedAdmission.room_number}).
                Bed status is now <strong>Occupied</strong>.
              </p>
              <p className="text-emerald-700 font-mono">
                Recorded Timestamp: {formatDateTime(completedAdmission.admission_datetime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="px-3.5 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Admission History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-red-700"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main 3-Column / Split Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step 1: Select Registered Patient */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              01. Select Registered Patient
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {patients.filter((p) => !p.current_bed_id).length} eligible
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              dir="auto"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search patient name or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAlreadyAdmittedPatients}
              onChange={(e) => setShowAlreadyAdmittedPatients(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            <span>Show already-admitted patients (to test duplicate check)</span>
          </label>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {filteredPatients.map((p) => {
              const isSelected = selectedPatientId === p.id;
              const isAlreadyAdmitted = Boolean(p.current_bed_id);
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPatientId(p.id);
                    setValidationError(null);
                  }}
                  className={`p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span dir="auto" className="font-semibold text-slate-900">
                      {p.full_name}
                    </span>
                    <span className="font-mono text-slate-500">{p.id}</span>
                  </div>
                  <div className="mt-1 text-slate-500 flex items-center justify-between">
                    <span>
                      {calculateAge(p.date_of_birth)} yrs · {p.gender}
                    </span>
                    {isAlreadyAdmitted ? (
                      <span className="text-amber-700 font-medium">
                        Admitted ({p.current_bed_number})
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">Eligible</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2 & 3: Display and Select an Available Bed */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              02. Select Available Hospital Bed
            </h3>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              {availableBedsCount} Available
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <select
              aria-label="Filter Available Beds by Ward"
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="ALL">All Wards</option>
              {uniqueWards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter Available Beds by Type"
              value={bedTypeFilter}
              onChange={(e) => setBedTypeFilter(e.target.value as 'ALL' | BedType)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="ALL">All Bed Types</option>
              <option value="Standard">Standard</option>
              <option value="ICU">ICU</option>
              <option value="Pediatric">Pediatric</option>
              <option value="Maternity">Maternity</option>
              <option value="Isolation">Isolation</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showUnavailableBeds}
              onChange={(e) => setShowUnavailableBeds(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            <span>Show Occupied & Maintenance beds (to verify lock protection)</span>
          </label>

          {displayedBeds.length === 0 ? (
            <div className="p-8 text-center border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
              No available beds match the selected ward/type filter. Occupied and Maintenance beds
              are automatically excluded from assignment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
              {displayedBeds.map((bed) => {
                const isSelected = selectedBedId === bed.id;
                const isUnavailable = bed.status !== 'Available';
                return (
                  <div
                    key={bed.id}
                    onClick={() => {
                      setSelectedBedId(bed.id);
                      setValidationError(null);
                    }}
                    className={`p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? isUnavailable
                          ? 'border-red-500 bg-red-50/40'
                          : 'border-teal-600 bg-teal-50/50'
                        : isUnavailable
                        ? 'border-slate-200 bg-slate-50/70 opacity-80'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{bed.bed_number}</span>
                      <BedStatusBadge status={bed.status} />
                    </div>
                    <div className="mt-1 font-medium text-slate-700">{bed.ward}</div>
                    <div className="mt-0.5 text-slate-500 font-mono">
                      Room {bed.room_number} · {bed.bed_type}
                    </div>
                    {bed.assigned_patient_name && (
                      <div className="mt-1 text-sky-700 font-medium truncate">
                        Occupied by: {bed.assigned_patient_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 4 & 5: Validation Summary & Assignment Confirmation */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            03. Validation & Confirmation
          </h3>

          {/* Pre-flight Invariant Verification Box */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div className="font-semibold text-slate-800">System Invariant Checks:</div>

            <div className="flex items-start gap-2">
              {selectedPatient && !patientHasActiveAdmission ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium text-slate-800 block">Patient Eligibility</span>
                {!selectedPatient ? (
                  <span className="text-slate-500">Select a patient from Step 01</span>
                ) : patientHasActiveAdmission ? (
                  <span className="text-red-600 font-medium">
                    {selectedPatient.full_name} already has active admission (
                    {selectedPatient.current_bed_number})
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    {selectedPatient.full_name} has no active admission
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              {selectedBed && bedIsStrictlyAvailable ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium text-slate-800 block">Bed Availability</span>
                {!selectedBed ? (
                  <span className="text-slate-500">Select an available bed from Step 02</span>
                ) : bedIsStrictlyAvailable ? (
                  <span className="text-emerald-700">
                    Bed {selectedBed.bed_number} ({selectedBed.ward}) is Available
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    Bed {selectedBed.bed_number} is {selectedBed.status} (Locked)
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleInitiateConfirmation} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Admission Reason / Intake Notes
              </label>
              <textarea
                rows={3}
                value={admissionNotes}
                onChange={(e) => setAdmissionNotes(e.target.value)}
                placeholder="Enter reason for admission, ward placement instructions, or observation notes..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                isReadyToConfirm
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-slate-700 hover:bg-slate-800'
              }`}
            >
              <BedDouble className="w-4 h-4" />
              <span>Review & Confirm Assignment</span>
            </button>
          </form>
        </div>
      </div>

      {/* Step 5 Confirmation Modal */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm Patient Admission & Bed Assignment"
        description="Please review the assignment details below. Confirming this operation will create an active Admission record and mark the assigned hospital bed as Occupied."
        confirmLabel="Confirm Admission & Assign Bed"
        isLoading={isSubmitting}
        onConfirm={handleConfirmAssignment}
        onCancel={() => setIsConfirmOpen(false)}
      >
        {selectedPatient && selectedBed && (
          <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-900">
                <span dir="auto">{selectedPatient.full_name}</span> ({selectedPatient.id})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Assigned Bed:</span>
              <span className="font-mono font-semibold text-teal-700">
                {selectedBed.bed_number} (Room {selectedBed.room_number})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ward & Type:</span>
              <span className="font-medium text-slate-900">
                {selectedBed.ward} · {selectedBed.bed_type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Resulting Bed Status:</span>
              <span className="font-semibold text-sky-700">Available → Occupied</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
