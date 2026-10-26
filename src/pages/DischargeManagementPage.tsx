import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  LogOut,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowRight,
  BedDouble,
} from 'lucide-react';
import { Admission, UserRole, DischargeAdmissionInput } from '../types/models';
import { ConfirmDialog, formatDateTime } from '../components/CommonUI';

interface DischargeManagementPageProps {
  admissions: Admission[];
  userRole: UserRole;
  preselectedPatientId?: string | null;
  onClearPreselection: () => void;
  onDischargePatient: (input: DischargeAdmissionInput) => Promise<Admission>;
  onNavigateToHistory: () => void;
}

export const DischargeManagementPage: React.FC<DischargeManagementPageProps> = ({
  admissions,
  userRole,
  preselectedPatientId,
  onClearPreselection,
  onDischargePatient,
  onNavigateToHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('');
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [nextBedStatus, setNextBedStatus] = useState<'Available' | 'Maintenance'>('Available');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedDischarge, setCompletedDischarge] = useState<Admission | null>(null);

  const canDischarge = userRole === 'Receptionist' || userRole === 'Administrator';

  const activeAdmissions = useMemo(
    () => admissions.filter((a) => a.status === 'Active'),
    [admissions]
  );

  useEffect(() => {
    if (preselectedPatientId) {
      const found = activeAdmissions.find((a) => a.patient_id === preselectedPatientId);
      if (found) {
        setSelectedAdmissionId(found.id);
        setCompletedDischarge(null);
      }
    }
  }, [preselectedPatientId, activeAdmissions]);

  const filteredActiveAdmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeAdmissions;
    return activeAdmissions.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.patient_id.toLowerCase().includes(q) ||
        (a.patient_name && a.patient_name.toLowerCase().includes(q)) ||
        (a.bed_number && a.bed_number.toLowerCase().includes(q)) ||
        (a.ward && a.ward.toLowerCase().includes(q))
    );
  }, [activeAdmissions, searchQuery]);

  const selectedAdmission = useMemo(
    () => activeAdmissions.find((a) => a.id === selectedAdmissionId) || null,
    [activeAdmissions, selectedAdmissionId]
  );

  const calculateStayDuration = (admissionDatetime: string): string => {
    const start = new Date(admissionDatetime).getTime();
    const now = Date.now();
    const diffHours = Math.max(1, Math.round((now - start) / (1000 * 60 * 60)));
    if (diffHours < 24) return `${diffHours} hour(s)`;
    const days = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    return `${days}d ${remHours}h`;
  };

  const handleConfirmDischarge = async () => {
    if (!selectedAdmission) return;
    setIsSubmitting(true);
    try {
      const discharged = await onDischargePatient({
        admission_id: selectedAdmission.id,
        discharge_notes: dischargeNotes.trim(),
        next_bed_status: nextBedStatus,
      });
      setCompletedDischarge(discharged);
      setIsConfirmOpen(false);
      setSelectedAdmissionId('');
      setDischargeNotes('');
      setNextBedStatus('Available');
      onClearPreselection();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canDischarge) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">
          Role Restriction: Receptionist or Administrator Required
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
          You are currently signed in as a <strong>{userRole}</strong>. Discharging patients and
          releasing hospital beds requires Receptionist or Administrator privileges.
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
            Patient Discharge & Bed Release Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search active admissions, inspect patient stay details, confirm discharge, and release
            the assigned bed to Available or Maintenance status.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600">
          Active Inpatient Admissions: <strong>{activeAdmissions.length}</strong>
        </div>
      </div>

      {/* Confirmation Receipt Banner after Discharge */}
      {completedDischarge && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h3 className="text-sm font-bold text-emerald-950">
                Patient Discharged & Bed Released ({completedDischarge.id})
              </h3>
              <p className="text-emerald-800">
                Patient <strong>{completedDischarge.patient_name}</strong> has been discharged from
                Bed <strong className="font-mono">{completedDischarge.bed_number}</strong> (
                {completedDischarge.ward}). The active admission record has been closed.
              </p>
              <p className="text-emerald-700 font-mono">
                Discharge Timestamp: {formatDateTime(completedDischarge.discharge_datetime)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToHistory}
            className="px-3.5 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>View in Admission History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step 1: Search for a Patient with an Active Admission */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              01. Select Active Inpatient Admission
            </h3>
            <span className="text-xs font-mono text-sky-700 font-semibold">
              {filteredActiveAdmissions.length} Active
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active patient by name, patient ID, bed number, or ward..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {filteredActiveAdmissions.length === 0 ? (
            <div className="p-8 text-center border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
              No active admissions match your search criteria.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredActiveAdmissions.map((adm) => {
                const isSelected = selectedAdmissionId === adm.id;
                return (
                  <div
                    key={adm.id}
                    onClick={() => {
                      setSelectedAdmissionId(adm.id);
                      setCompletedDischarge(null);
                    }}
                    className={`p-3.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span dir="auto" className="font-bold text-slate-900 inline-block">
                          {adm.patient_name}
                        </span>
                        <span className="ml-1.5 font-mono text-slate-500">({adm.patient_id})</span>
                      </div>
                      <span className="font-mono font-semibold text-sky-700">{adm.bed_number}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-slate-500">
                      <span>
                        {adm.ward} · Room {adm.room_number}
                      </span>
                      <span className="font-mono">
                        Admitted {formatDateTime(adm.admission_datetime)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2 & 3: Display Admission Details & Confirm Discharge */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-bold text-slate-900">
            02. Admission Details & Bed Release Options
          </h3>

          {!selectedAdmission ? (
            <div className="p-10 text-center border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
              <BedDouble className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              Select an active inpatient admission on the left to review their assigned bed and
              process discharge.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Detailed Admission Summary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Patient Name & ID</span>
                  <span dir="auto" className="font-bold text-slate-900 text-sm block mt-0.5">
                    {selectedAdmission.patient_name}
                  </span>
                  <span className="font-mono text-slate-500">{selectedAdmission.patient_id}</span>
                </div>

                <div>
                  <span className="text-slate-500 block">Assigned Hospital Bed</span>
                  <span className="font-mono font-bold text-sky-700 text-sm block mt-0.5">
                    {selectedAdmission.bed_number} (Room {selectedAdmission.room_number})
                  </span>
                  <span className="text-slate-600">
                    {selectedAdmission.ward} · {selectedAdmission.bed_type}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Admission Record & Intake Time</span>
                  <span className="font-mono font-medium text-slate-900 block mt-0.5">
                    {selectedAdmission.id}
                  </span>
                  <span className="font-mono text-slate-600">
                    {formatDateTime(selectedAdmission.admission_datetime)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Length of Stay</span>
                  <span className="font-mono font-semibold text-slate-900 block mt-0.5">
                    {calculateStayDuration(selectedAdmission.admission_datetime)}
                  </span>
                  <span className="text-emerald-700">Active Inpatient</span>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-200/80">
                  <span className="text-slate-500 block mb-1">Admission Notes</span>
                  <p className="text-slate-700">{selectedAdmission.notes || '—'}</p>
                </div>
              </div>

              {/* Post-Discharge Bed Status Option */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Post-Discharge Bed Status for {selectedAdmission.bed_number}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNextBedStatus('Available')}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      nextBedStatus === 'Available'
                        ? 'border-teal-600 bg-teal-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Release as Available (Default)</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      Bed is immediately ready for new patient assignments.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNextBedStatus('Maintenance')}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      nextBedStatus === 'Maintenance'
                        ? 'border-amber-600 bg-amber-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-amber-800">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>Place Under Maintenance</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      Hold bed offline for deep sanitization or equipment servicing.
                    </p>
                  </button>
                </div>
              </div>

              {/* Discharge Summary Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Discharge Summary Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={dischargeNotes}
                  onChange={(e) => setDischargeNotes(e.target.value)}
                  placeholder="Enter discharge condition or follow-up instructions..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  Discharge {selectedAdmission.patient_name} & Release Bed{' '}
                  {selectedAdmission.bed_number}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog before Irreversible Discharge Action */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm Patient Discharge & Bed Release"
        description={
          selectedAdmission
            ? `Are you sure you want to discharge ${selectedAdmission.patient_name} (${selectedAdmission.patient_id})? This action records the official discharge date/time, closes admission ${selectedAdmission.id}, and transitions bed ${selectedAdmission.bed_number} to ${nextBedStatus}.`
            : ''
        }
        confirmLabel="Confirm Discharge"
        variant={nextBedStatus === 'Maintenance' ? 'warning' : 'primary'}
        isLoading={isSubmitting}
        onConfirm={handleConfirmDischarge}
        onCancel={() => setIsConfirmOpen(false)}
      >
        {selectedAdmission && (
          <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Admission ID:</span>
              <span className="font-mono font-semibold text-slate-900">{selectedAdmission.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bed Transition:</span>
              <span className="font-mono font-semibold text-slate-900">
                {selectedAdmission.bed_number}: Occupied → {nextBedStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discharge Timestamp:</span>
              <span className="font-mono text-slate-700">Current System Timestamp</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
