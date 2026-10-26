import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  LayoutDashboard,
  BedDouble,
  Users,
  PlusCircle,
  LogOut as LogOutIcon,
  History,
  FileBarChart,
  ShieldCheck,
  Menu,
  X,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import {
  User,
  Patient,
  Bed,
  Admission,
  DashboardStats,
  UserRole,
  CreateBedInput,
  UpdateBedInput,
  CreatePatientInput,
  UpdatePatientInput,
  CreateAdmissionInput,
  DischargeAdmissionInput,
  CreateUserInput,
} from './types/models';
import {
  AuthenticationService,
  BedService,
  PatientService,
  AdmissionService,
  DashboardService,
  UserService,
  SystemService,
} from './services/hospitalServices';
import {
  ToastMessage,
  ToastContainer,
  ConfirmDialog,
  RoleIndicator,
} from './components/CommonUI';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage, NavTab } from './pages/DashboardPage';
import { BedManagementPage } from './pages/BedManagementPage';
import { PatientManagementPage } from './pages/PatientManagementPage';
import { AdmissionAssignmentPage } from './pages/AdmissionAssignmentPage';
import { DischargeManagementPage } from './pages/DischargeManagementPage';
import { AdmissionHistoryPage } from './pages/AdmissionHistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { UserManagementPage } from './pages/UserManagementPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [storageMode, setStorageMode] = useState<string>('backend-persistent');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Shared Domain Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pre-selected cross-page workflow parameters
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null);
  const [preselectedBedId, setPreselectedBedId] = useState<string | null>(null);

  // Reset Demo Confirmation Dialog
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Synchronize all data from backend / repository
  const refreshAllData = useCallback(async (userOverride?: User | null) => {
    const activeUser = userOverride !== undefined ? userOverride : currentUser;
    if (!activeUser) return;

    setIsLoadingData(true);
    setLoadError(null);
    try {
      const [dashboardData, bedsData, patientsData, admissionsData] = await Promise.all([
        DashboardService.getDashboardStats(),
        BedService.getAllBeds(),
        PatientService.getAllPatients(),
        AdmissionService.getAllAdmissions(),
      ]);

      setStats(dashboardData);
      setBeds(bedsData);
      setPatients(patientsData);
      setAdmissions(admissionsData);

      if (activeUser.role === 'Administrator') {
        const staffUsers = await UserService.getAllUsers();
        setUsers(staffUsers);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to synchronize hospital data.');
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser]);

  // Restore session on mount
  useEffect(() => {
    const existing = AuthenticationService.getCurrentSession();
    if (existing?.user) {
      setCurrentUser(existing.user);
      setStorageMode(existing.storageMode);
      refreshAllData(existing.user);
    }
  }, []);

  // Auth Handlers
  const handleLogin = async (email: string, password: string) => {
    const session = await AuthenticationService.login(email, password);
    setCurrentUser(session.user);
    setStorageMode(session.storageMode);
    setActiveTab('dashboard');
    await refreshAllData(session.user);
    addToast(
      `Welcome, ${session.user.name}`,
      `Signed in with ${session.user.role} privileges.`,
      'success'
    );
  };

  const handleDemoLogin = async (role: UserRole) => {
    const session = await AuthenticationService.loginWithDemoRole(role);
    setCurrentUser(session.user);
    setStorageMode(session.storageMode);
    if (role !== 'Administrator' && activeTab === 'users') {
      setActiveTab('dashboard');
    }
    await refreshAllData(session.user);
    addToast(
      `Switched to ${session.user.role} Workspace`,
      `Active user: ${session.user.name} (${session.user.email})`,
      'info'
    );
  };

  const handleLogout = async () => {
    await AuthenticationService.logout();
    setCurrentUser(null);
    setStats(null);
    setBeds([]);
    setPatients([]);
    setAdmissions([]);
    setUsers([]);
    setActiveTab('dashboard');
  };

  // Bed CRUD Handlers
  const handleCreateBed = async (input: CreateBedInput) => {
    const created = await BedService.createBed(input);
    await refreshAllData();
    addToast(
      'Hospital Bed Added',
      `Bed ${created.bed_number} (${created.ward}, Room ${created.room_number}) created as ${created.status}.`,
      'success'
    );
  };

  const handleUpdateBed = async (id: string, input: UpdateBedInput) => {
    const updated = await BedService.updateBed(id, input);
    await refreshAllData();
    addToast(
      'Bed Record Updated',
      `Bed ${updated.bed_number} updated (${updated.ward}, Status: ${updated.status}).`,
      'success'
    );
  };

  // Patient CRUD Handlers
  const handleCreatePatient = async (input: CreatePatientInput) => {
    const created = await PatientService.registerPatient(input);
    await refreshAllData();
    addToast(
      'Patient Registered',
      `${created.full_name} (${created.id}) has been added to the patient directory.`,
      'success'
    );
  };

  const handleUpdatePatient = async (id: string, input: UpdatePatientInput) => {
    const updated = await PatientService.updatePatient(id, input);
    await refreshAllData();
    addToast(
      'Patient Record Updated',
      `Saved changes for ${updated.full_name} (${updated.id}).`,
      'success'
    );
  };

  // Admission & Discharge Workflow Handlers
  const handleAssignBedAndAdmit = async (input: CreateAdmissionInput): Promise<Admission> => {
    const created = await AdmissionService.assignBedAndAdmit(input);
    await refreshAllData();
    addToast(
      'Admission & Bed Assignment Complete',
      `Assigned ${created.patient_name} to Bed ${created.bed_number} (${created.id}).`,
      'success'
    );
    return created;
  };

  const handleDischargePatient = async (input: DischargeAdmissionInput): Promise<Admission> => {
    try {
      const discharged = await AdmissionService.dischargePatient(input);
      await refreshAllData();
      addToast(
        'Patient Discharged',
        `Closed admission ${discharged.id} for ${discharged.patient_name} and released bed ${discharged.bed_number}.`,
        'success'
      );
      return discharged;
    } catch (err: any) {
      addToast('Discharge Failed', err.message || 'Could not discharge patient.', 'error');
      throw err;
    }
  };

  const handleUpdateAdmissionNotes = async (admissionId: string, notes: string) => {
    try {
      const updated = await AdmissionService.updateAdmissionNotes(admissionId, notes);
      await refreshAllData();
      addToast(
        'Admission Notes Updated',
        `Saved clinical notes for admission ${updated.id} (${updated.patient_name}).`,
        'success'
      );
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not update admission notes.', 'error');
      throw err;
    }
  };

  // User Management Handlers
  const handleCreateUser = async (input: CreateUserInput) => {
    const created = await UserService.createUser(input);
    await refreshAllData();
    addToast(
      'Staff Account Created',
      `Added ${created.name} as ${created.role}.`,
      'success'
    );
  };

  const handleUpdateUserRole = async (userId: string, role: UserRole) => {
    try {
      const updated = await UserService.updateUserRole(userId, role);
      await refreshAllData();
      addToast(
        'Staff Role Updated',
        `${updated.name} is now assigned the ${updated.role} role.`,
        'success'
      );
    } catch (err: any) {
      addToast('Role Update Failed', err.message || 'Failed to update role.', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await UserService.deleteUser(userId);
      await refreshAllData();
      addToast('Staff Account Removed', 'User account was deleted.', 'info');
    } catch (err: any) {
      addToast('Delete Failed', err.message || 'Failed to delete user.', 'error');
    }
  };

  const handleResetDemoDatabase = async () => {
    setIsResetting(true);
    try {
      const msg = await SystemService.resetDemoDatabase();
      await refreshAllData();
      setIsResetConfirmOpen(false);
      addToast('Demo Dataset Restored', msg, 'info');
    } catch (err: any) {
      addToast('Reset Failed', err.message || 'Could not reset demo data.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // If not authenticated, render Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={handleLogin} onDemoLogin={handleDemoLogin} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Navigation items filtered or annotated by Role
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    roles: UserRole[];
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist', 'Doctor'],
    },
    {
      id: 'beds',
      label: 'Bed Management',
      icon: <BedDouble className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist', 'Doctor'],
      badge: beds.filter((b) => b.status === 'Available').length,
    },
    {
      id: 'patients',
      label: 'Patient Management',
      icon: <Users className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist', 'Doctor'],
      badge: patients.length,
    },
    {
      id: 'admit',
      label: 'Admission & Assignment',
      icon: <PlusCircle className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist'],
    },
    {
      id: 'discharge',
      label: 'Discharge Management',
      icon: <LogOutIcon className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist'],
      badge: admissions.filter((a) => a.status === 'Active').length,
    },
    {
      id: 'history',
      label: 'Admission History',
      icon: <History className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist', 'Doctor'],
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: <FileBarChart className="w-4 h-4" />,
      roles: ['Administrator', 'Receptionist', 'Doctor'],
    },
    {
      id: 'users',
      label: 'User Accounts & RBAC',
      icon: <ShieldCheck className="w-4 h-4" />,
      roles: ['Administrator'],
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.roles.includes(currentUser.role));

  const currentTabTitle =
    navItems.find((n) => n.id === activeTab)?.label || 'Hospital Operations';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 justify-between">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-display font-bold text-sm text-slate-900 truncate">
                Al-Kasr Teaching Hospital
              </div>
              <div className="text-xs text-slate-500 truncate">Bed Management System</div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1" aria-label="Main Navigation">
            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={isActive ? 'text-teal-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Active User & Demo Role Switcher */}
        <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/60">
          <div className="space-y-1">
            <div dir="auto" className="text-xs font-semibold text-slate-900 truncate">
              {currentUser.name}
            </div>
            <div className="text-xs text-slate-500 font-mono truncate">{currentUser.email}</div>
            <div className="pt-1">
              <RoleIndicator role={currentUser.role} />
            </div>
          </div>

          {/* Demo Role Switcher for University Presentation */}
          <div className="pt-2 border-t border-slate-200/80">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Academic Demo Role Switch:
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['Administrator', 'Receptionist', 'Doctor'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleDemoLogin(r)}
                  className={`py-1 px-1.5 text-xs font-medium rounded border transition-colors truncate cursor-pointer ${
                    currentUser.role === r
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={`Switch to ${r} demo role`}
                >
                  {r === 'Administrator' ? 'Admin' : r === 'Receptionist' ? 'Recept.' : 'Doctor'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
            <span>
              {storageMode === 'backend-postgres'
                ? 'DB: PostgreSQL'
                : storageMode === 'backend-persistent'
                ? 'API: Express Store'
                : 'Mode: LocalStorage'}
            </span>
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-slate-600 hover:text-teal-700 font-medium inline-flex items-center gap-1 cursor-pointer"
              title="Reset sample data to initial state"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Mobile Menu Button + Breadcrumb Trail */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">Hospital Operations</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-slate-900 truncate">{currentTabTitle}</h1>
            </div>
          </div>

          {/* Right: Primary Action & Sign Out */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span dir="auto" className="font-medium text-slate-900">
                {currentUser.name}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentUser.role}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-white h-full flex flex-col justify-between p-4 z-10">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                      <Activity className="w-4 h-4" />
                    </div>
                    <span className="font-display font-bold text-sm text-slate-900">
                      Al-Kasr Teaching Hospital
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    aria-label="Close navigation menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1">
                  {visibleNavItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium ${
                          isActive
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className="font-mono text-xs text-slate-500">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="text-xs">
                  <div dir="auto" className="font-semibold text-slate-900">
                    {currentUser.name}
                  </div>
                  <div className="text-slate-500">{currentUser.role}</div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['Administrator', 'Receptionist', 'Doctor'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        handleDemoLogin(r);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`py-1.5 px-2 text-xs font-medium rounded border ${
                        currentUser.role === r
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {r === 'Administrator' ? 'Admin' : r === 'Receptionist' ? 'Recept.' : 'Doctor'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Page Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              stats={stats}
              isLoading={isLoadingData}
              error={loadError}
              userRole={currentUser.role}
              onNavigate={(tab) => setActiveTab(tab)}
              onRefresh={() => refreshAllData()}
            />
          )}

          {activeTab === 'beds' && (
            <BedManagementPage
              beds={beds}
              userRole={currentUser.role}
              onCreateBed={handleCreateBed}
              onUpdateBed={handleUpdateBed}
              onAssignBedQuick={(bedId) => {
                setPreselectedBedId(bedId);
                setActiveTab('admit');
              }}
            />
          )}

          {activeTab === 'patients' && (
            <PatientManagementPage
              patients={patients}
              admissions={admissions}
              userRole={currentUser.role}
              onCreatePatient={handleCreatePatient}
              onUpdatePatient={handleUpdatePatient}
              onAdmitPatientQuick={(patientId) => {
                setPreselectedPatientId(patientId);
                setActiveTab('admit');
              }}
              onDischargePatientQuick={(patientId) => {
                setPreselectedPatientId(patientId);
                setActiveTab('discharge');
              }}
            />
          )}

          {activeTab === 'admit' && (
            <AdmissionAssignmentPage
              patients={patients}
              beds={beds}
              userRole={currentUser.role}
              preselectedPatientId={preselectedPatientId}
              preselectedBedId={preselectedBedId}
              onClearPreselection={() => {
                setPreselectedPatientId(null);
                setPreselectedBedId(null);
              }}
              onAssignBedAndAdmit={handleAssignBedAndAdmit}
              onNavigateToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'discharge' && (
            <DischargeManagementPage
              admissions={admissions}
              userRole={currentUser.role}
              preselectedPatientId={preselectedPatientId}
              onClearPreselection={() => setPreselectedPatientId(null)}
              onDischargePatient={handleDischargePatient}
              onNavigateToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'history' && (
            <AdmissionHistoryPage
              admissions={admissions}
              userRole={currentUser.role}
              onDischargeQuick={(patientId) => {
                setPreselectedPatientId(patientId);
                setActiveTab('discharge');
              }}
              onUpdateAdmissionNotes={handleUpdateAdmissionNotes}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsPage
              beds={beds}
              patients={patients}
              admissions={admissions}
              onNotify={addToast}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementPage
              users={users}
              currentUser={currentUser}
              onCreateUser={handleCreateUser}
              onUpdateRole={handleUpdateUserRole}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>

      {/* Reset Demo Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Reset Demonstration Dataset?"
        description="This will restore all hospital beds (24 beds across 6 wards), synthetic patients (12 records), and admissions (6 active, 5 discharged) back to their clean initial state."
        confirmLabel="Reset Demo Data"
        variant="warning"
        isLoading={isResetting}
        onConfirm={handleResetDemoDatabase}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
