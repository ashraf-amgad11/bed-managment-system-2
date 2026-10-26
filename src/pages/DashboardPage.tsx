import React from 'react';
import {
  BedDouble,
  CheckCircle2,
  Clock,
  Wrench,
  Users,
  ClipboardList,
  PlusCircle,
  UserPlus,
  LogOut,
  FileBarChart,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { DashboardStats, UserRole } from '../types/models';
import { BedStatusBadge, AdmissionStatusBadge, formatDateTime } from '../components/CommonUI';

export type NavTab =
  | 'dashboard'
  | 'beds'
  | 'patients'
  | 'admit'
  | 'discharge'
  | 'history'
  | 'reports'
  | 'users';

interface DashboardPageProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  userRole: UserRole;
  onNavigate: (tab: NavTab) => void;
  onRefresh: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  isLoading,
  error,
  userRole,
  onNavigate,
  onRefresh,
}) => {
  if (isLoading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 h-28 animate-pulse"
            >
              <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
              <div className="h-7 w-12 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 h-72" />
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 h-72" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
        <p className="text-sm font-semibold text-red-700">
          {error || 'Unable to load dashboard statistics.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          Retry Loading Dashboard
        </button>
      </div>
    );
  }

  const availPct =
    stats.totalBeds > 0 ? Math.round((stats.availableBeds / stats.totalBeds) * 100) : 0;
  const occPct =
    stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0;
  const maintPct =
    stats.totalBeds > 0 ? Math.round((stats.maintenanceBeds / stats.totalBeds) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Role-Aware Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hospital Operations Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live metrics calculated dynamically from current bed inventory, patient directory, and
            active admissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(userRole === 'Receptionist' || userRole === 'Administrator') && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('admit')}
                className="px-3.5 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Assign Bed / Admit</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('discharge')}
                className="px-3.5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Discharge Patient</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('patients')}
                className="px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Patient</span>
              </button>
            </>
          )}
          {userRole === 'Doctor' && (
            <button
              type="button"
              onClick={() => onNavigate('patients')}
              className="px-3.5 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Review Patients & Clinical Notes</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            <span>Reports & CSV</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Refresh statistics"
            aria-label="Refresh statistics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div
          onClick={() => onNavigate('beds')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Beds</span>
            <BedDouble className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.totalBeds}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {stats.wardDistribution.length} wards
          </div>
        </div>

        <div
          onClick={() => onNavigate('beds')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Available Beds</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {stats.availableBeds}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {availPct}% of capacity
          </div>
        </div>

        <div
          onClick={() => onNavigate('beds')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Occupied Beds</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-sky-700 font-mono tabular-nums">
            {stats.occupiedBeds}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {stats.occupancyRate}% occupancy rate
          </div>
        </div>

        <div
          onClick={() => onNavigate('beds')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Under Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {stats.maintenanceBeds}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {maintPct}% offline for service
          </div>
        </div>

        <div
          onClick={() => onNavigate('patients')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Registered Patients</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.totalPatients}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {stats.totalPatients - stats.currentAdmissions} unassigned
          </div>
        </div>

        <div
          onClick={() => onNavigate('history')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Current Admissions</span>
            <ClipboardList className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.currentAdmissions}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {stats.totalDischarges} historical discharges
          </div>
        </div>
      </div>

      {/* Middle Row: Bed Status Distribution & Ward Breakdown Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Overall Bed Status Distribution & Occupancy Gauge */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Bed Status Distribution</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time capacity allocation across {stats.totalBeds} hospital beds
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {stats.occupancyRate}%
                </span>
                <p className="text-xs text-slate-500">Total Occupancy</p>
              </div>
            </div>

            {/* Stacked Horizontal Distribution Bar */}
            <div className="mt-5">
              <div className="h-4 w-full rounded-lg bg-slate-100 overflow-hidden flex">
                {stats.availableBeds > 0 && (
                  <div
                    style={{ width: `${(stats.availableBeds / stats.totalBeds) * 100}%` }}
                    className="bg-emerald-500 h-full transition-transform"
                    title={`Available: ${stats.availableBeds}`}
                  />
                )}
                {stats.occupiedBeds > 0 && (
                  <div
                    style={{ width: `${(stats.occupiedBeds / stats.totalBeds) * 100}%` }}
                    className="bg-sky-600 h-full transition-transform"
                    title={`Occupied: ${stats.occupiedBeds}`}
                  />
                )}
                {stats.maintenanceBeds > 0 && (
                  <div
                    style={{ width: `${(stats.maintenanceBeds / stats.totalBeds) * 100}%` }}
                    className="bg-amber-500 h-full transition-transform"
                    title={`Maintenance: ${stats.maintenanceBeds}`}
                  />
                )}
              </div>

              {/* Breakdown Rows */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <BedStatusBadge status="Available" />
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">{stats.availableBeds} beds</span>
                    <span className="text-slate-500 w-10 text-right">{availPct}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <BedStatusBadge status="Occupied" />
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">{stats.occupiedBeds} beds</span>
                    <span className="text-slate-500 w-10 text-right">{occPct}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <BedStatusBadge status="Maintenance" />
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {stats.maintenanceBeds} beds
                    </span>
                    <span className="text-slate-500 w-10 text-right">{maintPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Operational Occupancy (Excl. Maintenance):</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {stats.operationalOccupancyRate}% ({stats.occupiedBeds}/
              {stats.totalBeds - stats.maintenanceBeds} operational beds)
            </span>
          </div>
        </div>

        {/* Right: Ward-by-Ward Capacity & Utilization Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ward Capacity & Occupancy</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bed availability breakdown across clinical departments
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('beds')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Manage All Beds</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {stats.wardDistribution.map((w) => {
                const wOccPct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                return (
                  <div key={w.ward} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{w.ward}</span>
                      <div className="flex items-center gap-3 text-slate-500 font-mono tabular-nums">
                        <span className="text-emerald-700">{w.available} Avail</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-700">{w.occupied} Occ</span>
                        {w.maintenance > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700">{w.maintenance} Maint</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-900 w-9 text-right">
                          {wOccPct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-md overflow-hidden flex">
                      {w.occupied > 0 && (
                        <div
                          style={{ width: `${(w.occupied / w.total) * 100}%` }}
                          className="bg-sky-600 h-full"
                        />
                      )}
                      {w.available > 0 && (
                        <div
                          style={{ width: `${(w.available / w.total) * 100}%` }}
                          className="bg-emerald-500 h-full"
                        />
                      )}
                      {w.maintenance > 0 && (
                        <div
                          style={{ width: `${(w.maintenance / w.total) * 100}%` }}
                          className="bg-amber-500 h-full"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
              <span>Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Admissions & Recent Discharges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admissions */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Admissions</h3>
                <p className="text-xs text-slate-500">Latest inpatient bed assignments</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.recentAdmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No admissions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Admission</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4">Bed / Ward</th>
                      <th className="py-2.5 px-4">Admitted</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {stats.recentAdmissions.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900 tabular-nums">
                          {adm.id}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <span dir="auto" className="inline-block">
                            {adm.patient_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <span className="font-mono font-medium text-slate-800">
                            {adm.bed_number}
                          </span>{' '}
                          · {adm.ward}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono tabular-nums">
                          {formatDateTime(adm.admission_datetime)}
                        </td>
                        <td className="py-2.5 px-4">
                          <AdmissionStatusBadge status={adm.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Discharges */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Discharges</h3>
                <p className="text-xs text-slate-500">Completed stays & released beds</p>
              </div>
              {(userRole === 'Receptionist' || userRole === 'Administrator') && (
                <button
                  type="button"
                  onClick={() => onNavigate('discharge')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Discharge Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {stats.recentDischarges.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No discharged admissions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Admission</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4">Released Bed</th>
                      <th className="py-2.5 px-4">Discharged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {stats.recentDischarges.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900 tabular-nums">
                          {adm.id}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <span dir="auto" className="inline-block">
                            {adm.patient_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <span className="font-mono font-medium text-slate-800">
                            {adm.bed_number}
                          </span>{' '}
                          · {adm.ward}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono tabular-nums">
                          {formatDateTime(adm.discharge_datetime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
