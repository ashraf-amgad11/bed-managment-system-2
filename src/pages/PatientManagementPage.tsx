import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
  Eye,
  BedDouble,
  LogOut,
  X,
  AlertCircle,
  Phone,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  Patient,
  Admission,
  Gender,
  UserRole,
  CreatePatientInput,
  UpdatePatientInput,
} from '../types/models';
import {
  AdmissionStatusBadge,
  formatDateOnly,
  formatDateTime,
  calculateAge,
} from '../components/CommonUI';

interface PatientManagementPageProps {
  patients: Patient[];
  admissions: Admission[];
  userRole: UserRole;
  onCreatePatient: (input: CreatePatientInput) => Promise<void>;
  onUpdatePatient: (id: string, input: UpdatePatientInput) => Promise<void>;
  onAdmitPatientQuick: (patientId: string) => void;
  onDischargePatientQuick: (patientId: string) => void;
}

export const PatientManagementPage: React.FC<PatientManagementPageProps> = ({
  patients,
  admissions,
  userRole,
  onCreatePatient,
  onUpdatePatient,
  onAdmitPatientQuick,
  onDischargePatientQuick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [admissionFilter, setAdmissionFilter] = useState<'ALL' | 'ADMITTED' | 'UNASSIGNED'>('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');

  // Modals state
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('Female');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canRegisterPatients = userRole === 'Receptionist' || userRole === 'Administrator';
  const canEditDemographics = userRole === 'Receptionist' || userRole === 'Administrator';
  const canEditClinicalNotes =
    userRole === 'Receptionist' || userRole === 'Administrator' || userRole === 'Doctor';

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (admissionFilter === 'ADMITTED' && !p.current_bed_id) return false;
      if (admissionFilter === 'UNASSIGNED' && p.current_bed_id) return false;
      if (genderFilter !== 'ALL' && p.gender !== genderFilter) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.full_name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.emergency_contact.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        (p.current_bed_number && p.current_bed_number.toLowerCase().includes(q)) ||
        (p.current_ward && p.current_ward.toLowerCase().includes(q))
      );
    });
  }, [patients, searchQuery, admissionFilter, genderFilter]);

  const patientAdmissions = useMemo(() => {
    if (!viewingPatient) return [];
    return admissions.filter((a) => a.patient_id === viewingPatient.id);
  }, [viewingPatient, admissions]);

  const openAddModal = () => {
    setEditingPatient(null);
    setFullName('');
    setDateOfBirth('1982-05-15');
    setGender('Female');
    setPhone('+20 100 000 ');
    setEmergencyContact('');
    setNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setFullName(patient.full_name);
    setDateOfBirth(patient.date_of_birth);
    setGender(patient.gender);
    setPhone(patient.phone);
    setEmergencyContact(patient.emergency_contact);
    setNotes(patient.notes);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (canEditDemographics) {
      if (fullName.trim().length < 2) {
        setFormError('Patient full name is required (at least 2 characters).');
        return;
      }
      if (!dateOfBirth || isNaN(Date.parse(dateOfBirth))) {
        setFormError('Valid date of birth is required.');
        return;
      }
      if (new Date(dateOfBirth) > new Date()) {
        setFormError('Date of birth cannot be in the future.');
        return;
      }
      if (phone.trim().length < 6) {
        setFormError('Valid contact phone number is required.');
        return;
      }
      if (emergencyContact.trim().length < 4) {
        setFormError('Emergency contact name and phone number are required.');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingPatient) {
        await onUpdatePatient(editingPatient.id, {
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth,
          gender,
          phone: phone.trim(),
          emergency_contact: emergencyContact.trim(),
          notes: notes.trim(),
        });
      } else {
        await onCreatePatient({
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth,
          gender,
          phone: phone.trim(),
          emergency_contact: emergencyContact.trim(),
          notes: notes.trim(),
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save patient record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Patient Directory & Registration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synthetic patient demographic records, emergency contacts, clinical notes, and active
            bed assignments.
          </p>
        </div>

        {canRegisterPatients && (
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient ID, full name, phone, bed, or clinical notes..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'ALL', label: 'All Patients' },
              { id: 'ADMITTED', label: 'Currently Admitted' },
              { id: 'UNASSIGNED', label: 'Unassigned / Outpatient' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdmissionFilter(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  admissionFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Gender"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'ALL' | Gender)}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Genders</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Patient Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-mono">{filteredPatients.length}</strong>{' '}
            of <strong className="text-slate-900 font-mono">{patients.length}</strong> registered
            patients
          </span>
          {(searchQuery || admissionFilter !== 'ALL' || genderFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setAdmissionFilter('ALL');
                setGenderFilter('ALL');
              }}
              className="text-teal-700 hover:text-teal-800 font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching patient records</p>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your search terms or register a new patient record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">DOB / Age / Gender</th>
                  <th className="py-3 px-4">Contact & Emergency</th>
                  <th className="py-3 px-4">Current Bed Assignment</th>
                  <th className="py-3 px-4">Admission Notes</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPatients.map((pat) => (
                  <tr key={pat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-600 tabular-nums">
                      {pat.id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span dir="auto" className="inline-block">
                        {pat.full_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="font-mono tabular-nums">{pat.date_of_birth}</div>
                      <div className="text-slate-400">
                        {calculateAge(pat.date_of_birth)} yrs · {pat.gender}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      <div className="font-mono text-slate-800 tabular-nums">{pat.phone}</div>
                      <div
                        className="text-slate-500 truncate"
                        dir="auto"
                        title={pat.emergency_contact}
                      >
                        Emerg: {pat.emergency_contact}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {pat.current_bed_number ? (
                        <div>
                          <span className="font-mono font-semibold text-sky-700">
                            {pat.current_bed_number}
                          </span>
                          <span className="text-slate-500 block">
                            {pat.current_ward} · Rm {pat.current_room_number}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Not Admitted</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-600 truncate" title={pat.notes}>
                        {pat.notes || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateOnly(pat.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingPatient(pat)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>

                        {canEditClinicalNotes && (
                          <button
                            type="button"
                            onClick={() => openEditModal(pat)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{userRole === 'Doctor' ? 'Notes' : 'Edit'}</span>
                          </button>
                        )}

                        {canRegisterPatients && !pat.current_bed_id && (
                          <button
                            type="button"
                            onClick={() => onAdmitPatientQuick(pat.id)}
                            className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <BedDouble className="w-3.5 h-3.5" />
                            <span>Admit</span>
                          </button>
                        )}

                        {canRegisterPatients && pat.current_bed_id && (
                          <button
                            type="button"
                            onClick={() => onDischargePatientQuick(pat.id)}
                            className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Discharge</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Patient Details & Admission History Modal */}
      {viewingPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-slate-500">
                  {viewingPatient.id} · Registered {formatDateOnly(viewingPatient.created_at)}
                </span>
                <h3 dir="auto" className="text-lg font-bold text-slate-900 mt-0.5">
                  {viewingPatient.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b border-slate-100">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500 block">Date of Birth & Gender</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingPatient.date_of_birth} ({calculateAge(viewingPatient.date_of_birth)} yrs)
                  </span>
                  <span className="block text-slate-600">{viewingPatient.gender}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500 block">Primary Phone</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingPatient.phone}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block">Emergency Contact</span>
                <span dir="auto" className="font-medium text-slate-900 block">
                  {viewingPatient.emergency_contact}
                </span>
              </div>
            </div>

            <div className="py-4 border-b border-slate-100 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>Clinical & Admission Notes</span>
              </div>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                {viewingPatient.notes || 'No clinical notes recorded.'}
              </p>
            </div>

            {/* Patient Admission History */}
            <div className="pt-4">
              <h4 className="text-xs font-bold text-slate-900 mb-3">
                Patient Admission History ({patientAdmissions.length})
              </h4>
              {patientAdmissions.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  This patient has no active or historical hospital admissions.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3">Admission ID</th>
                        <th className="py-2 px-3">Bed & Ward</th>
                        <th className="py-2 px-3">Admitted</th>
                        <th className="py-2 px-3">Discharged</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientAdmissions.map((adm) => (
                        <tr key={adm.id}>
                          <td className="py-2 px-3 font-mono font-medium text-slate-900">
                            {adm.id}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className="font-mono font-semibold">{adm.bed_number}</span> ·{' '}
                            {adm.ward}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {formatDateTime(adm.admission_datetime)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {formatDateTime(adm.discharge_datetime)}
                          </td>
                          <td className="py-2 px-3">
                            <AdmissionStatusBadge status={adm.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              {canRegisterPatients && !viewingPatient.current_bed_id && (
                <button
                  type="button"
                  onClick={() => {
                    const id = viewingPatient.id;
                    setViewingPatient(null);
                    onAdmitPatientQuick(id);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Assign Bed to {viewingPatient.full_name}
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Patient Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingPatient
                  ? userRole === 'Doctor'
                    ? `Update Clinical Notes — ${editingPatient.full_name}`
                    : `Edit Patient — ${editingPatient.full_name}`
                  : 'Register New Patient (Synthetic Demo Record)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  dir="auto"
                  value={fullName}
                  disabled={!canEditDemographics}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. عمر خالد محمود"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    disabled={!canEditDemographics}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    disabled={!canEditDemographics}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    disabled={!canEditDemographics}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 100 000 0142"
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact *
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    value={emergencyContact}
                    disabled={!canEditDemographics}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="طارق خالد (Brother) - +20 100 000 0143"
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Relevant Admission & Clinical Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter synthetic admission observation notes..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingPatient
                    ? 'Save Patient Changes'
                    : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
