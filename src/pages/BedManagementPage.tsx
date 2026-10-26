import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Eye,
  Wrench,
  CheckCircle2,
  X,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import {
  Bed,
  BedStatus,
  BedType,
  UserRole,
  CreateBedInput,
  UpdateBedInput,
} from '../types/models';
import { BedStatusBadge, ConfirmDialog, formatDateTime } from '../components/CommonUI';

interface BedManagementPageProps {
  beds: Bed[];
  userRole: UserRole;
  onCreateBed: (input: CreateBedInput) => Promise<void>;
  onUpdateBed: (id: string, input: UpdateBedInput) => Promise<void>;
  onAssignBedQuick: (bedId: string) => void;
}

const BED_TYPES: BedType[] = ['Standard', 'ICU', 'Pediatric', 'Maternity', 'Isolation'];
const DEFAULT_WARDS = [
  'General Medicine',
  'Intensive Care Unit',
  'Surgical Ward',
  'Cardiology',
  'Pediatrics',
  'Maternity',
];

export const BedManagementPage: React.FC<BedManagementPageProps> = ({
  beds,
  userRole,
  onCreateBed,
  onUpdateBed,
  onAssignBedQuick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BedStatus>('ALL');
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | BedType>('ALL');

  // Modals state
  const [viewingBed, setViewingBed] = useState<Bed | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [maintenanceTarget, setMaintenanceTarget] = useState<Bed | null>(null);

  // Form fields
  const [bedNumber, setBedNumber] = useState('');
  const [ward, setWard] = useState(DEFAULT_WARDS[0]);
  const [roomNumber, setRoomNumber] = useState('');
  const [bedType, setBedType] = useState<BedType>('Standard');
  const [status, setStatus] = useState<BedStatus>('Available');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canManageBeds = userRole === 'Administrator';
  const canAssignBeds = userRole === 'Receptionist' || userRole === 'Administrator';

  const uniqueWards = useMemo(() => {
    const s = new Set<string>(DEFAULT_WARDS);
    for (const b of beds) s.add(b.ward);
    return Array.from(s);
  }, [beds]);

  const filteredBeds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return beds.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (wardFilter !== 'ALL' && b.ward !== wardFilter) return false;
      if (typeFilter !== 'ALL' && b.bed_type !== typeFilter) return false;
      if (!q) return true;
      return (
        b.id.toLowerCase().includes(q) ||
        b.bed_number.toLowerCase().includes(q) ||
        b.ward.toLowerCase().includes(q) ||
        b.room_number.toLowerCase().includes(q) ||
        b.bed_type.toLowerCase().includes(q) ||
        (b.assigned_patient_name && b.assigned_patient_name.toLowerCase().includes(q))
      );
    });
  }, [beds, searchQuery, statusFilter, wardFilter, typeFilter]);

  const openAddModal = () => {
    setEditingBed(null);
    setBedNumber('');
    setWard(DEFAULT_WARDS[0]);
    setRoomNumber('');
    setBedType('Standard');
    setStatus('Available');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (bed: Bed) => {
    setEditingBed(bed);
    setBedNumber(bed.bed_number);
    setWard(bed.ward);
    setRoomNumber(bed.room_number);
    setBedType(bed.bed_type);
    setStatus(bed.status);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bedNumber.trim()) {
      setFormError('Bed Number is required (e.g., GM-104A).');
      return;
    }
    if (!ward.trim()) {
      setFormError('Ward name is required.');
      return;
    }
    if (!roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingBed) {
        await onUpdateBed(editingBed.id, {
          bed_number: bedNumber.trim().toUpperCase(),
          ward: ward.trim(),
          room_number: roomNumber.trim(),
          bed_type: bedType,
          status,
        });
      } else {
        await onCreateBed({
          bed_number: bedNumber.trim().toUpperCase(),
          ward: ward.trim(),
          room_number: roomNumber.trim(),
          bed_type: bedType,
          status: status === 'Occupied' ? 'Available' : status,
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save bed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmMaintenanceToggle = async () => {
    if (!maintenanceTarget) return;
    setIsSaving(true);
    try {
      const nextStatus: BedStatus =
        maintenanceTarget.status === 'Maintenance' ? 'Available' : 'Maintenance';
      await onUpdateBed(maintenanceTarget.id, { status: nextStatus });
      setMaintenanceTarget(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hospital Bed Directory & Control</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, and manage hospital bed inventory across all wards and rooms.
            {!canManageBeds && (
              <span className="ml-1 text-slate-600 font-medium">
                (Note: Adding, editing, or deactivating beds requires Administrator privileges.)
              </span>
            )}
          </p>
        </div>

        {canManageBeds && (
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hospital Bed</span>
          </button>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by bed ID, bed number, room, ward, or patient..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {/* Status Segmented Control & Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'Available', 'Occupied', 'Maintenance'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Statuses' : st}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Ward"
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
            aria-label="Filter by Bed Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | BedType)}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Bed Types</option>
            {BED_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bed Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-mono">{filteredBeds.length}</strong> of{' '}
            <strong className="text-slate-900 font-mono">{beds.length}</strong> hospital beds
          </span>
          {(searchQuery || statusFilter !== 'ALL' || wardFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setWardFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="text-teal-700 hover:text-teal-800 font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredBeds.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching beds found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or clearing the ward and status filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Bed ID</th>
                  <th className="py-3 px-4">Bed Number</th>
                  <th className="py-3 px-4">Ward</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Bed Type</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Assigned Patient</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBeds.map((bed) => (
                  <tr key={bed.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">{bed.id}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                      {bed.bed_number}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{bed.ward}</td>
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                      Rm {bed.room_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{bed.bed_type}</td>
                    <td className="py-3 px-4">
                      <BedStatusBadge status={bed.status} />
                    </td>
                    <td className="py-3 px-4">
                      {bed.assigned_patient_name ? (
                        <div>
                          <span dir="auto" className="font-medium text-slate-900 inline-block">
                            {bed.assigned_patient_name}
                          </span>
                          <span className="ml-1.5 font-mono text-slate-400">
                            ({bed.assigned_patient_id})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingBed(bed)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {canAssignBeds && bed.status === 'Available' && (
                          <button
                            type="button"
                            onClick={() => onAssignBedQuick(bed.id)}
                            className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Assign</span>
                          </button>
                        )}

                        {canManageBeds && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(bed)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {bed.status !== 'Occupied' && (
                              <button
                                type="button"
                                onClick={() => setMaintenanceTarget(bed)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                                  bed.status === 'Maintenance'
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                }`}
                              >
                                {bed.status === 'Maintenance' ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Activate</span>
                                  </>
                                ) : (
                                  <>
                                    <Wrench className="w-3.5 h-3.5" />
                                    <span>Deactivate</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
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

      {/* View Bed Details Modal */}
      {viewingBed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-slate-500">{viewingBed.id}</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Bed {viewingBed.bed_number} — {viewingBed.ward}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingBed(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Room Number</span>
                <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                  Room {viewingBed.room_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Bed Classification</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {viewingBed.bed_type}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Operational Status</span>
                <BedStatusBadge status={viewingBed.status} />
              </div>
              <div>
                <span className="text-slate-500 block">Created On</span>
                <span className="font-mono text-slate-800 mt-0.5 block">
                  {formatDateTime(viewingBed.created_at)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              {viewingBed.status === 'Occupied' && viewingBed.assigned_patient_name ? (
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-900">
                    Active Patient Assignment ({viewingBed.current_admission_id})
                  </div>
                  <div className="text-slate-700">
                    Patient: <strong dir="auto">{viewingBed.assigned_patient_name}</strong> (
                    <span className="font-mono">{viewingBed.assigned_patient_id}</span>)
                  </div>
                  <div className="text-slate-500 font-mono">
                    Admitted at: {formatDateTime(viewingBed.admission_datetime)}
                  </div>
                </div>
              ) : viewingBed.status === 'Maintenance' ? (
                <div className="text-amber-800">
                  This bed is currently marked under <strong>Maintenance</strong> and is locked
                  against patient assignments until reactivated by an Administrator.
                </div>
              ) : (
                <div className="text-emerald-800">
                  This bed is <strong>Available</strong> and ready for immediate patient admission.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {canAssignBeds && viewingBed.status === 'Available' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = viewingBed.id;
                    setViewingBed(null);
                    onAssignBedQuick(id);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Assign Patient to {viewingBed.bed_number}
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingBed(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Bed Modal (Administrator) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingBed ? `Edit Bed ${editingBed.bed_number}` : 'Add New Hospital Bed'}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bed Number *
                  </label>
                  <input
                    type="text"
                    value={bedNumber}
                    onChange={(e) => setBedNumber(e.target.value)}
                    placeholder="e.g. GM-104A"
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 104"
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hospital Ward *
                </label>
                <input
                  type="text"
                  list="ward-options"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  placeholder="Select or type ward name"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <datalist id="ward-options">
                  {uniqueWards.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bed Type *
                  </label>
                  <select
                    value={bedType}
                    onChange={(e) => setBedType(e.target.value as BedType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {BED_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Operational Status *
                  </label>
                  <select
                    value={status}
                    disabled={editingBed?.status === 'Occupied'}
                    onChange={(e) => setStatus(e.target.value as BedStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                    {editingBed?.status === 'Occupied' && (
                      <option value="Occupied">Occupied (Active Admission)</option>
                    )}
                  </select>
                </div>
              </div>

              {editingBed?.status === 'Occupied' && (
                <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Status is locked to <strong>Occupied</strong> because patient{' '}
                  <strong>{editingBed.assigned_patient_name}</strong> is currently admitted to this
                  bed. Use Discharge Management to release this bed.
                </p>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5">
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
                  {isSaving ? 'Saving...' : editingBed ? 'Save Bed Changes' : 'Create Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deactivating / Reactivating a Bed */}
      <ConfirmDialog
        isOpen={Boolean(maintenanceTarget)}
        title={
          maintenanceTarget?.status === 'Maintenance'
            ? `Reactivate Bed ${maintenanceTarget.bed_number}?`
            : `Place Bed ${maintenanceTarget?.bed_number} Under Maintenance?`
        }
        description={
          maintenanceTarget?.status === 'Maintenance'
            ? `This will change bed ${maintenanceTarget.bed_number} (${maintenanceTarget.ward}, Room ${maintenanceTarget.room_number}) back to Available so receptionists can assign patients to it.`
            : `Deactivating bed ${maintenanceTarget?.bed_number} (${maintenanceTarget?.ward}, Room ${maintenanceTarget?.room_number}) will mark it as Under Maintenance and prevent any new patient assignments until reactivated.`
        }
        confirmLabel={
          maintenanceTarget?.status === 'Maintenance'
            ? 'Mark as Available'
            : 'Place Under Maintenance'
        }
        variant={maintenanceTarget?.status === 'Maintenance' ? 'primary' : 'warning'}
        isLoading={isSaving}
        onConfirm={handleConfirmMaintenanceToggle}
        onCancel={() => setMaintenanceTarget(null)}
      />
    </div>
  );
};
