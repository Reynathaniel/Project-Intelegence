export type UserRole = 'Admin' | 'Logistics' | 'Supervisor' | 'HSE' | 'QC' | 'HR' | 'Procurement' | 'Document Control' | 'Mechanic & Electrical' | 'Project Control' | 'CC' | 'CM' | 'Project Manager' | 'General Manpower' | 'Engineering' | 'campbos' | 'Permit Officer' | 'Paramedic' | 'Super Admin' | 'Subcontractor Super Admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: UserRole; // Legacy single role (deprecated)
  roles: UserRole[]; // Multiple roles support
  projects: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in meters
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'On Hold';
  managerId: string;
  contractNo?: string;
  client?: string;
  contractorName?: string;
  clientLogo?: string; // Base64 or URL
  contractorLogo?: string; // Base64 or URL
  assignedUserEmail?: string;
  dashboardConfig?: {
    visibleWidgets: string[];
  };
  approvalConfig?: {
    qcMaterialRequestRoles: UserRole[];
  };
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  date: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  photo: string; // Base64
  type: 'Check-in' | 'Check-out';
  locationId?: string; // ID of the specific AttendanceLocation used
  locationName?: string;
  deviceId?: string; // Simple browser fingerprint or similar
  manpowerDetails?: {
    position: string;
    email: string;
    classification: string;
  };
}

export interface AttendanceLocation {
  id: string;
  projectId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  allowedManpowerIds: string[]; // List of manpowerIds allowed here. Empty means all.
  createdAt: any;
}

export interface DailyReport {
  id: string;
  projectId: string;
  discipline: UserRole;
  date: string;
  authorId: string;
  authorName: string;
  data: string; // JSON string
  hse?: {
    safetyInduction: number;
    toolboxMeeting: number;
    safetyPatrol: number;
    safetyMeeting: number;
    unsafeAction: number;
    unsafeCondition: number;
    nearMiss: number;
    accident: number;
    p3k: number;
    apd: number;
    rambu: number;
    others: number;
  };
  status: 'Draft' | 'Submitted';
  createdAt: any;
  weather?: WeatherData;
  manpower?: ManpowerSummary;
}

export interface WeatherData {
  rainy: number;
  drizzle: number;
  cloudy: number;
  sunny: number;
  workingTime: string;
}

export interface ManpowerSummary {
  indirect: number;
  direct: number;
  total: number;
}

export interface LogisticsData {
  materialRequests: MaterialRequest[];
  materialReceipts: MaterialReceipt[];
  materialUsages: MaterialUsage[];
  fuelIn: FuelIn[];
  fuelOut: FuelOut[];
  fuelConsumption?: string; // Legacy field
  notes: string;
}

export interface FuelIn {
  date: string;
  volume: number;
  source: string;
  photoUrl?: string;
}

export interface FuelOut {
  date: string;
  vehicleName: string;
  volume: number;
  driverName?: string;
  photoUrl?: string;
}

export interface MaterialRequest {
  id?: string;
  projectId: string;
  date: string;
  spbNo: string;
  spbName: string;
  itemName: string;
  unit: string;
  volumeSPB: number;
  vendor?: string;
  purchases?: PurchaseDetail[];
  totalVolume: number;
  totalPrice: number;
  used: number;
  remaining: number;
  location: 'Sorong' | 'Jakarta';
  status: 'Proses' | 'Done';
  pic: string;
  requestedBy?: string;
  discipline?: string;
  remarks: string;
  photoUrl?: string; // Photo of item to be purchased
  approval: {
    cm: boolean;
    cc: boolean;
    pm: boolean;
  };
  approvalDate?: string;
  workItem?: string; // Item pekerjaan
  area?: string; // Area lokasi
  usedWorkItem?: string; // Item pekerjaan saat digunakan
  usedArea?: string; // Area lokasi saat digunakan
  usedDiscipline?: string; // Disiplin yang menggunakan
  usedPhotoUrl?: string; // Foto material saat digunakan
  usages?: UsageDetail[];
}

export interface MaterialReceipt {
  id?: string;
  projectId: string;
  date: string;
  spbNo?: string; // Linked SPB
  spbId?: string; // Linked SPB ID
  itemName: string;
  volume: number;
  unit: string;
  receivedBy: string;
  location: string;
  photoUrl?: string;
  remarks?: string;
}

export interface MaterialUsage {
  id?: string;
  projectId: string;
  date: string;
  spbNo?: string; // Linked SPB
  spbId?: string; // Linked SPB ID
  itemName: string;
  volume: number;
  unit: string;
  usedFor: string; // Work item / purpose
  location: string;
  photoUrl?: string;
  remarks?: string;
}

export interface PurchaseDetail {
  volume: number;
  price: number;
  total: number;
  photoUrl?: string; // Invoice/Receipt photo
}

export interface UsageDetail {
  date: string;
  volume: number;
  workItem: string;
  area: string;
  discipline: string;
  photoUrl?: string;
  remarks?: string;
}

export interface HSEData {
  permits: {
    number: string;
    status: 'Open' | 'Close';
  }[];
  manhours: {
    direct: number;
    indirect: number;
    overtime: number;
    total: number;
    totalManDay?: number;
    avgMenPerMonth?: number;
    assumedWorkingHours?: number;
  };
  safetyInduction: number;
  toolboxMeeting: number;
  safetyPatrol: number;
  safetyMeeting: number;
  unsafeAction: number;
  unsafeCondition: number;
  nearMiss: number;
  accident: number;
  p3k: number;
  apd: number;
  rambu: number;
  others: number;
  safetyStats?: {
    noOfInjury: number;
    daysCharged: number;
    frequencyRate: number;
    severityRate: number;
  };
  incidentTypes?: {
    fallingFromHeight: number;
    fallingObjects: number;
    hitByObject: number;
    collapseOfStack: number;
    electricalHazards: number;
    otherIncidents: number;
  };
  complianceStats?: {
    momSummons: number;
    momNonCompliance: number;
    demeritPoints: number;
    momWarningLetter: number;
    momStopWorkOrderVerbal: number;
  };
  weatherConditions: {
    time: string;
    condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Drizzle';
  }[];
  stopWorkOrders: {
    type: 'Verbal' | 'Non-Verbal';
    number: string;
    cause: string;
    impact: string; // Sipil/Mechanical/Piping/Electrical/Fire Safety/Instrument
    momPdfUrl?: string;
  }[];
  healthStatus: {
    directSick: number;
    directHealthy: number;
    indirectSick: number;
    indirectHealthy: number;
  };
  notes: string;
}

export interface ReportPhoto {
  url: string;
  location: string;
  description: string;
}

export interface SupervisorActivity {
  workItem?: string;
  area: string;
  location: string;
  discipline: 'Mechanical' | 'Piping' | 'Electrical' | 'Instrument' | 'Civil';
  progress: number;
  unit: string;
  manpowerDirect: number;
  manpowerList?: { name: string; manpowerId: string; position: string }[];
  heavyEquipment?: { name: string; count: number }[];
  equipment: string;
  brokenEquipment?: { name: string; count: number }[];
  overtime?: {
    hours: number;
    manpower: number;
    manpowerList?: { name: string; manpowerId: string; position: string }[];
    heavyEquipment?: { name: string; count: number }[];
    photos: ReportPhoto[]; // Max 4
  };
  photos: ReportPhoto[]; // Regular hours, Max 4
  notes: string;
  assistanceNeeded: string;
}

export interface SupervisorData {
  supervisorName: string;
  activities: SupervisorActivity[];
  notes: string;
}

export interface QCData {
  inspections: string;
  nonConformity: string;
  testResults: string;
  punchList: string;
  notes: string;
}

export interface HRPersonnel {
  id: string;
  manpowerId: string; // Unique ID (NIK/Employee ID)
  name: string;
  email: string;
  position: string;
  mcuStatus: string;
  mcuExpiry: string;
  siteStatus: 'On Site' | 'Off Site';
  pointOfHire: string;
  entryPermitStatus: string;
  entryPermitExpiry: string;
  classification: 'Direct' | 'Indirect';
  photoUrl?: string;
  activeStatus: 'Active' | 'Resign';
  contractStart: string;
  contractEnd: string;
  certificate: string;
  leaveStart?: string;
  leaveEnd?: string;
}

export interface HRData {
  personnelList: HRPersonnel[];
  notes: string;
}

export interface ProcurementData {
  poIssued: string;
  vendorStatus: string;
  deliveryTracking: string;
  notes: string;
}

export interface DocumentControlData {
  drawingStatus: string;
  rfiStatus: string;
  technicalQueries: string;
  notes: string;
}

export interface MechanicElectricalData {
  workProgress: string;
  manpowerDirect: string;
  equipmentStatus: string;
  siteIssues: string;
  notes: string;
}

export interface ProjectControlSignature {
  company: string;
  name: string;
  title: string;
}

export interface OtherNote {
  workItem: 'Civil' | 'Structure' | 'Piping' | 'Electrical' | 'Instrument' | 'Mechanical';
  discipline: 'Mechanic & Electrical' | 'HR' | 'HSE' | 'QC' | 'SPV';
  note: string;
  status: 'Open' | 'Close';
}

export interface RemarksDrawing {
  workItem: string;
  area: string;
  remarks: string;
  photoUrl?: string;
}

export interface ProjectControlData {
  todaysActual: string;
  tomorrowsPlan: string;
  scheduleVariance: string;
  costStatus: string;
  narrative: string;
  notes: string;
  remarksDrawing?: string; // Legacy
  remarksDrawings?: RemarksDrawing[];
  otherNotes?: OtherNote[];
  signatures?: ProjectControlSignature[];
  technicalDetails?: string[];
  includedReports?: string[]; // IDs of reports from other roles to include in the summary
}

export interface ApprovalStep {
  role: UserRole;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvalDate?: string;
  signature?: string; // Base64 signature
  remarks?: string;
}

export interface QCMaterialRequest {
  id: string;
  projectId: string;
  date: string;
  itemName: string;
  unit: string;
  volume: number;
  requestedBy: string; // User ID
  requestedByName: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Approved by CC' | 'Approved by CM'; // Overall status
  approvals: ApprovalStep[];
  createdAt: any;
  spbNo?: string;
  workItem?: string;
  area?: string;
  discipline?: string;
  remarks?: string;
  photoUrl?: string;
  pdfUrl?: string;
  budgetCode?: string;
}

export interface QCFolder {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdBy: string;
  createdAt: any;
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  deleteRequestedByName?: string;
  deleteRequestedAt?: any;
}

export interface QCFile {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: any;
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  deleteRequestedByName?: string;
  deleteRequestedAt?: any;
}

export interface QCNotification {
  id: string;
  projectId: string;
  userId: string; // Target user
  title: string;
  message: string;
  type: 'DeletionRequest' | 'Approval' | 'Rejection' | 'MaterialRequest';
  link?: string;
  read: boolean;
  createdAt: any;
}
