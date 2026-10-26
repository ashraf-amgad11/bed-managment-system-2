import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  FileText,
  Eye,
  X,
} from 'lucide-react';
import { Admission, AdmissionStatus, UserRole } from '../types/models';
import { AdmissionStatusBadge, formatDateTime } from '../components/CommonUI';

interface AdmissionHistoryPageProps {
  admissions: Admission[];
  userRole: UserRole;
  onDischargeQuick: (patientId: string) => void;
  onUpdateAdmissionNotes?: (admissionId: string, notes: string) => Promise<void>;
}

type SortField = 'admission_datetime' | 'discharge_datetime' | 'patient_name' | 'id';
type SortOrder = 'asc' | 'desc';

export const AdmissionHistoryPage: React.FC<AdmissionHistoryPageProps> = ({
  admissions,
  userRole,
  onDischargeQuick,
  onUpdateAdmissionNotes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdmissionStatus>('ALL');
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('admission_datetime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Detail & Notes Modal state
  const [viewingAdmission, setViewingAdmission] = useState<Admission | null>(null);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const canDischarge = userRole === 'Receptionist' || userRole === 'Administrator';

  const uniqueWards = useMemo(() => {
    const s = new Set<string>();
    for (const a of admissions) {
      if (a.ward) s.add(a.ward);
    }
    return Array.from(s);
  }, [admissions]);

  const filteredAndSortedAdmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = admissions.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (wardFilter !== 'ALL' && a.ward !== wardFilter) return false;
      if (!q) return true;
      return (
        a.id.toLowerCase().includes(q) ||
        a.patient_id.toLowerCase().includes(q) ||
        (a.patient_name && a.patient_name.toLowerCase().includes(q)) ||
        (a.bed_number && a.bed_number.toLowerCase().includes(q)) ||
        (a.ward && a.ward.toLowerCase().includes(q)) ||
        a.notes.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'admission_datetime') {
        cmp =
          new Date(a.admission_datetime).getTime() -
          new Date(b.admission_datetime).getTime();
      } else if (sortField === 'discharge_datetime') {
        const tA = a.discharge_datetime ? new Date(a.discharge_datetime).getTime() : 0;
        const tB = b.discharge_datetime ? new Date(b.discharge_datetime).getTime() : 0;
        cmp = tA - tB;
      } else if (sortField === 'patient_name') {
        cmp = (a.patient_name || '').localeCompare(b.patient_name || '');
      } else {
        cmp = a.id.localeCompare(b.id);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [admissions, searchQuery, statusFilter, wardFilter, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAdmissions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedAdmissions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedAdmissions.slice(start, start + pageSize);
  }, [filteredAndSortedAdmissions, safePage, pageSize]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const openAdmissionModal = (adm: Admission) => {
    setViewingAdmission(adm);
    setEditedNotes(adm.notes || '');
  };

  const handleSaveAdmissionNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingAdmission || !onUpdateAdmissionNotes) return;
    setIsSavingNotes(true);
    try {
      await onUpdateAdmissionNotes(viewingAdmission.id, editedNotes);
      setViewingAdmission(null);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const formatDuration = (startIso: string, endIso: string | null) => {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const hours = Math.max(1, Math.round((end - start) / (1000 * 60 * 60)));
    if (hours < 24) return `${hours} hr(s)`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Admission & Discharge Audit History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete chronological log of all active inpatient stays and historical discharged
            admissions.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-sky-700 font-semibold">
            Active: {admissions.filter((a) => a.status === 'Active').length}
          </span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-600 font-semibold">
            Discharged: {admissions.filter((a) => a.status === 'Discharged').length}
          </span>
        </div>
      </div>

      {/* Search, Filters & Sort Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Admission ID, Patient, Bed, Ward, or Notes..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'Active', 'Discharged'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Records' : st}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Ward"
            value={wardFilter}
            onChange={(e) => {
              setWardFilter(e.target.value);
              setCurrentPage(1);
            }}
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
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value={5}>5 / page</option>
            <option value={8}>8 / page</option>
            <option value={15}>15 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredAndSortedAdmissions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No admission records found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing your search query or changing the status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortToggle('id')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Admission ID</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortToggle('patient_name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Patient</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Bed & Ward</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortToggle('admission_datetime')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Admission Date & Time</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortToggle('discharge_datetime')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Discharge Date & Time</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Admission Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedAdmissions.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {adm.id}
                    </td>
                    <td className="py-3 px-4">
                      <div dir="auto" className="font-semibold text-slate-900">
                        {adm.patient_name}
                      </div>
                      <div className="font-mono text-slate-500">{adm.patient_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">
                        {adm.bed_number}{' '}
                        <span className="font-normal text-slate-500">(Rm {adm.room_number})</span>
                      </div>
                      <div className="text-slate-500">{adm.ward}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {formatDateTime(adm.admission_datetime)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {adm.discharge_datetime ? (
                        formatDateTime(adm.discharge_datetime)
                      ) : (
                        <span className="text-slate-400">
                          Active ({formatDuration(adm.admission_datetime, null)})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <AdmissionStatusBadge status={adm.status} />
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-600 line-clamp-2" title={adm.notes}>
                        {adm.notes || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdmissionModal(adm)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>

                        {canDischarge && adm.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => onDischargeQuick(adm.patient_id)}
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

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/40 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            Showing{' '}
            <strong className="font-mono text-slate-900">
              {filteredAndSortedAdmissions.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="font-mono text-slate-900">
              {Math.min(safePage * pageSize, filteredAndSortedAdmissions.length)}
            </strong>{' '}
            of{' '}
            <strong className="font-mono text-slate-900">
              {filteredAndSortedAdmissions.length}
            </strong>{' '}
            admissions
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-2">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Admission Details & Edit Notes Modal */}
      {viewingAdmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-slate-500">{viewingAdmission.id}</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Admission Record — {viewingAdmission.patient_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAdmission(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 grid grid-cols-2 gap-4 text-xs border-b border-slate-100">
              <div>
                <span className="text-slate-500 block">Patient</span>
                <span className="font-semibold text-slate-900 block mt-0.5">
                  <span dir="auto">{viewingAdmission.patient_name}</span> (
                  {viewingAdmission.patient_id})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Bed & Ward</span>
                <span className="font-mono font-semibold text-slate-900 block mt-0.5">
                  {viewingAdmission.bed_number} · {viewingAdmission.ward} (Rm{' '}
                  {viewingAdmission.room_number})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Admitted At</span>
                <span className="font-mono text-slate-800 block mt-0.5">
                  {formatDateTime(viewingAdmission.admission_datetime)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Discharged At / Stay Duration</span>
                <span className="font-mono text-slate-800 block mt-0.5">
                  {viewingAdmission.discharge_datetime
                    ? formatDateTime(viewingAdmission.discharge_datetime)
                    : 'Currently Admitted'}{' '}
                  (
                  {formatDuration(
                    viewingAdmission.admission_datetime,
                    viewingAdmission.discharge_datetime
                  )}
                  )
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAdmissionNotes} className="pt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinical & Admission Notes
                </label>
                <textarea
                  rows={3}
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {canDischarge && viewingAdmission.status === 'Active' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const patId = viewingAdmission.patient_id;
                      setViewingAdmission(null);
                      onDischargeQuick(patId);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Proceed to Discharge
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingAdmission(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  {onUpdateAdmissionNotes && (
                    <button
                      type="submit"
                      disabled={isSavingNotes}
                      className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                    >
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
