import React, { useState } from 'react';
import {
  UserPlus,
  Trash2,
  ShieldAlert,
  X,
  AlertCircle,
  CheckCircle2,
  Database,
  Layers,
} from 'lucide-react';
import { User, UserRole, CreateUserInput } from '../types/models';
import { RoleIndicator, ConfirmDialog, formatDateOnly } from '../components/CommonUI';

interface UserManagementPageProps {
  users: User[];
  currentUser: User;
  onCreateUser: (input: CreateUserInput) => Promise<void>;
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  users,
  currentUser,
  onCreateUser,
  onUpdateRole,
  onDeleteUser,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Receptionist');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  if (currentUser.role !== 'Administrator') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">
          Administrator Authorization Required
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
          User account management and role assignment are restricted strictly to the{' '}
          <strong>Administrator</strong> role. Doctors and Receptionists are blocked on both the UI
          and backend API.
        </p>
      </div>
    );
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (name.trim().length < 2) {
      setFormError('Staff full name is required.');
      return;
    }
    if (!email.includes('@')) {
      setFormError('Valid staff email address is required.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      await onCreateUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      setIsAddOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('Receptionist');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create staff user.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await onDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Staff User Accounts & Role-Based Access Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage hospital staff credentials, assign role permissions, and review Software
            Engineering module architecture.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsAddOpen(true);
          }}
          className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {/* Staff Accounts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-xs font-semibold text-slate-700">
          Registered Staff Accounts ({users.length})
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Staff Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Change Role</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">{u.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span dir="auto" className="inline-block">
                        {u.name}
                      </span>{' '}
                      {isSelf && (
                        <span className="ml-1.5 text-teal-700 font-normal">(Current Session)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <RoleIndicator role={u.role} />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Change role for ${u.name}`}
                        value={u.role}
                        onChange={(e) => onUpdateRole(u.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Receptionist">Receptionist</option>
                        <option value="Doctor">Doctor</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                      {formatDateOnly(u.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setDeleteTarget(u)}
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-30 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title={
                          isSelf ? 'Cannot delete your own active account' : 'Delete staff account'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Matrix & Software Engineering Architecture Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Enforced Role-Based Access Control (RBAC) Matrix
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 pr-3">System Capability</th>
                  <th className="py-2 px-2 text-center">Admin</th>
                  <th className="py-2 px-2 text-center">Receptionist</th>
                  <th className="py-2 px-2 text-center">Doctor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  { cap: 'View Dashboard, Beds & Reports', a: true, r: true, d: true },
                  { cap: 'Add, Edit & Deactivate Beds', a: true, r: false, d: false },
                  { cap: 'Register & Edit Patient Demographics', a: true, r: true, d: false },
                  { cap: 'Update Patient Clinical Notes', a: true, r: true, d: true },
                  { cap: 'Assign Bed & Create Admission', a: true, r: true, d: false },
                  { cap: 'Discharge Patient & Release Bed', a: true, r: true, d: false },
                  { cap: 'Manage User Accounts & Roles', a: true, r: false, d: false },
                ].map((row) => (
                  <tr key={row.cap}>
                    <td className="py-2 pr-3 font-medium">{row.cap}</td>
                    <td className="py-2 px-2 text-center">
                      {row.a ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {row.r ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {row.d ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Software Engineering Domain Entities & Service Layer
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            This implementation maps 1-to-1 with the university UML Class, Sequence, Activity, and
            Use Case diagrams:
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">Core Domain Entities</div>
              <div className="font-mono text-slate-600">
                User · Patient · Bed · Admission
              </div>
              <div className="text-slate-500">
                Defined in <span className="font-mono">database/schema.sql</span> &{' '}
                <span className="font-mono">src/types/models.ts</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">Domain Service Classes</div>
              <div className="font-mono text-slate-600">
                AuthenticationService · BedService · PatientService · AdmissionService
              </div>
              <div className="text-slate-500">
                Defined in <span className="font-mono">src/services/hospitalServices.ts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Staff User Modal */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Staff User Account</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
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

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Staff Full Name *
                </label>
                <input
                  type="text"
                  dir="auto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. د. سارة محمد"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sara.mohamed@cairo-med-demo.edu"
                  required
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial Password (Hashed via scrypt) *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assigned Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="Receptionist">Receptionist</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSaving ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete User Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={`Remove Staff Account (${deleteTarget?.name})?`}
        description={`Are you sure you want to remove ${deleteTarget?.name} (${deleteTarget?.email}) from the system? They will no longer be able to sign in.`}
        confirmLabel="Remove Account"
        variant="danger"
        isLoading={isSaving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
