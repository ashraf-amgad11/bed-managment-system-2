import React, { useState, useMemo } from 'react';
import {
  Download,
  Calendar,
  BedDouble,
  CheckCircle2,
  Clock,
  Wrench,
  FileBarChart,
} from 'lucide-react';
import { Bed, Admission, Patient, BedType } from '../types/models';
import { formatDateTime } from '../components/CommonUI';

interface ReportsPageProps {
  beds: Bed[];
  patients: Patient[];
  admissions: Admission[];
  onNotify: (title: string, message: string, type?: 'success' | 'info') => void;
}

type DateRangePreset = 'ALL' | '7D' | '30D' | 'CUSTOM';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  beds,
  patients,
  admissions,
  onNotify,
}) => {
  const [periodPreset, setPeriodPreset] = useState<DateRangePreset>('30D');
  const [customStartDate, setCustomStartDate] = useState(() =>
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Overall Bed Statistics
  const totalBeds = beds.length;
  const availableBeds = beds.filter((b) => b.status === 'Available').length;
  const occupiedBeds = beds.filter((b) => b.status === 'Occupied').length;
  const maintenanceBeds = beds.filter((b) => b.status === 'Maintenance').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
  const operationalCapacity = totalBeds - maintenanceBeds;
  const operationalOccupancyRate =
    operationalCapacity > 0 ? Math.round((occupiedBeds / operationalCapacity) * 1000) / 10 : 0;
  const activeAdmissionsCount = admissions.filter((a) => a.status === 'Active').length;

  // Discharges during selected period
  const periodDischarges = useMemo(() => {
    const discharged = admissions.filter(
      (a) => a.status === 'Discharged' && a.discharge_datetime
    );
    if (periodPreset === 'ALL') return discharged;

    const now = Date.now();
    if (periodPreset === '7D') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      return discharged.filter((a) => new Date(a.discharge_datetime!).getTime() >= cutoff);
    }
    if (periodPreset === '30D') {
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      return discharged.filter((a) => new Date(a.discharge_datetime!).getTime() >= cutoff);
    }

    const startMs = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
    const endMs = customEndDate
      ? new Date(`${customEndDate}T23:59:59`).getTime()
      : Number.MAX_SAFE_INTEGER;
    return discharged.filter((a) => {
      const t = new Date(a.discharge_datetime!).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [admissions, periodPreset, customStartDate, customEndDate]);

  // Ward Utilization Summary
  const wardUtilization = useMemo(() => {
    const map = new Map<
      string,
      {
        ward: string;
        total: number;
        available: number;
        occupied: number;
        maintenance: number;
        totalAdmissionsCount: number;
      }
    >();

    for (const b of beds) {
      const row = map.get(b.ward) || {
        ward: b.ward,
        total: 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
        totalAdmissionsCount: 0,
      };
      row.total += 1;
      if (b.status === 'Available') row.available += 1;
      if (b.status === 'Occupied') row.occupied += 1;
      if (b.status === 'Maintenance') row.maintenance += 1;
      map.set(b.ward, row);
    }

    for (const adm of admissions) {
      if (adm.ward && map.has(adm.ward)) {
        map.get(adm.ward)!.totalAdmissionsCount += 1;
      }
    }

    return Array.from(map.values());
  }, [beds, admissions]);

  // Bed Type Utilization Summary
  const bedTypeUtilization = useMemo(() => {
    const types: BedType[] = ['Standard', 'ICU', 'Pediatric', 'Maternity', 'Isolation'];
    return types.map((type) => {
      const matching = beds.filter((b) => b.bed_type === type);
      const total = matching.length;
      const occupied = matching.filter((b) => b.status === 'Occupied').length;
      const available = matching.filter((b) => b.status === 'Available').length;
      const maintenance = matching.filter((b) => b.status === 'Maintenance').length;
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
      return { type, total, occupied, available, maintenance, rate };
    });
  }, [beds]);

  // CSV Export Handler
  const handleExportCsv = () => {
    const lines: string[] = [];
    const escapeCsv = (val: string | number | null | undefined) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    lines.push('HOSPITAL BED MANAGEMENT SYSTEM - UTILIZATION & OPERATIONS REPORT');
    lines.push(`Generated At,${escapeCsv(new Date().toISOString())}`);
    lines.push('');

    lines.push('1. EXECUTIVE SUMMARY METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Hospital Beds,${totalBeds}`);
    lines.push(`Available Beds,${availableBeds}`);
    lines.push(`Occupied Beds,${occupiedBeds}`);
    lines.push(`Beds Under Maintenance,${maintenanceBeds}`);
    lines.push(`Overall Occupancy Rate (%),${occupancyRate}%`);
    lines.push(`Operational Occupancy Rate (%),${operationalOccupancyRate}%`);
    lines.push(`Total Registered Patients,${patients.length}`);
    lines.push(`Active Admissions,${activeAdmissionsCount}`);
    lines.push(`Discharges in Selected Period,${periodDischarges.length}`);
    lines.push('');

    lines.push('2. WARD BED UTILIZATION SUMMARY');
    lines.push('Ward,Total Beds,Occupied,Available,Maintenance,Occupancy Rate (%),Total Historical & Active Admissions');
    for (const w of wardUtilization) {
      const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
      lines.push(
        [
          escapeCsv(w.ward),
          w.total,
          w.occupied,
          w.available,
          w.maintenance,
          `${pct}%`,
          w.totalAdmissionsCount,
        ].join(',')
      );
    }
    lines.push('');

    lines.push('3. DISCHARGES DURING SELECTED PERIOD');
    lines.push('Admission ID,Patient ID,Patient Name,Bed Number,Ward,Admitted At,Discharged At,Notes');
    for (const d of periodDischarges) {
      lines.push(
        [
          escapeCsv(d.id),
          escapeCsv(d.patient_id),
          escapeCsv(d.patient_name),
          escapeCsv(d.bed_number),
          escapeCsv(d.ward),
          escapeCsv(d.admission_datetime),
          escapeCsv(d.discharge_datetime),
          escapeCsv(d.notes),
        ].join(',')
      );
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `hospital_bed_utilization_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onNotify(
      'CSV Report Exported',
      'Downloaded hospital bed utilization and discharge summary report as CSV.',
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Hospital Occupancy & Utilization Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive analytics on bed capacity, occupancy rates, ward utilization, and period
            discharges.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Report to CSV</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Beds</span>
            <BedDouble className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalBeds}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Available Beds</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {availableBeds}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Occupied Beds</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-700 font-mono tabular-nums">
            {occupiedBeds}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {maintenanceBeds}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Occupancy Rate</span>
            <FileBarChart className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {occupancyRate}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Admissions</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {activeAdmissionsCount}
          </div>
        </div>
      </div>

      {/* Ward Utilization Summary & Bed Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ward Utilization Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Bed Utilization Summary by Hospital Ward
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Departmental capacity, active occupancy, and cumulative admission volume
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Ward</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Occupied</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4 text-right">Maint.</th>
                  <th className="py-3 px-4 text-right">Utilization</th>
                  <th className="py-3 px-4 text-right">Total Stays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wardUtilization.map((w) => {
                  const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                  return (
                    <tr key={w.ward} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900">{w.ward}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{w.total}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-sky-700 tabular-nums">
                        {w.occupied}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                        {w.available}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700 tabular-nums">
                        {w.maintenance}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {pct}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {w.totalAdmissionsCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bed Classification Utilization */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Utilization by Bed Type</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution across Standard, ICU, Pediatric, Maternity, and Isolation beds
            </p>
          </div>
          <div className="p-5 space-y-4">
            {bedTypeUtilization.map((item) => (
              <div key={item.type} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{item.type} Beds</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {item.occupied}/{item.total} Occupied ({item.rate}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-md overflow-hidden">
                  <div
                    style={{ width: `${item.rate}%` }}
                    className="bg-teal-600 h-full transition-transform"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Discharges During Selected Period Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Discharges During Selected Period ({periodDischarges.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter completed inpatient discharges by time window
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: '7D', label: 'Last 7 Days' },
                { id: '30D', label: 'Last 30 Days' },
                { id: 'ALL', label: 'All Time' },
                { id: 'CUSTOM', label: 'Custom Range' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setPeriodPreset(btn.id as DateRangePreset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    periodPreset === btn.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {periodPreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {periodDischarges.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No discharged admissions recorded within the selected time period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Admission ID</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Bed & Ward</th>
                  <th className="py-3 px-4">Admitted At</th>
                  <th className="py-3 px-4">Discharged At</th>
                  <th className="py-3 px-4">Summary Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodDischarges.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{adm.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <span dir="auto" className="inline-block">
                        {adm.patient_name}
                      </span>{' '}
                      <span className="font-mono text-slate-400">({adm.patient_id})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-mono font-semibold">{adm.bed_number}</span> · {adm.ward}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                      {formatDateTime(adm.admission_datetime)}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700 font-medium tabular-nums">
                      {formatDateTime(adm.discharge_datetime)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm truncate" title={adm.notes}>
                      {adm.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
