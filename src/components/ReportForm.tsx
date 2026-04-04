import React, { useState, useEffect } from 'react';
import { Project, UserProfile, UserRole, DailyReport, MaterialRequest } from '../types';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, handleFirestoreError, OperationType, query, where, onSnapshot, getDocs, increment, arrayUnion } from '../firebase';
import { compressImage } from '../services/imageService';
import { motion } from 'framer-motion';
import { X, Send, Save, AlertCircle, Plus, Fuel, Truck, ArrowDownCircle, ArrowUpCircle, Eye, FileText, Settings, ClipboardCheck, UserCheck, Camera, Repeat, Users, Search, Shield, ShieldAlert } from 'lucide-react';
import { generateProjectReport } from '../services/pdfService';
import { AnimatePresence } from 'framer-motion';

interface ReportFormProps {
  project: Project;
  profile: UserProfile;
  onClose: () => void;
  initialReport?: DailyReport;
  defaultDiscipline?: UserRole;
}

const CollapsibleSection = ({ title, icon: Icon, children, isOpen, onToggle }: { title: string, icon: any, children: React.ReactNode, isOpen: boolean, onToggle: () => void }) => (
  <div className="space-y-4">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 hover:bg-neutral-800/50 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-all">
          <Icon className="w-5 h-5 text-emerald-500" />
        </div>
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
      </div>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <ArrowDownCircle className="w-5 h-5 text-neutral-600" />
      </motion.div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-6">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function ReportForm({ project, profile, onClose, initialReport, defaultDiscipline }: ReportFormProps) {
  const [discipline, setDiscipline] = useState<UserRole>(() => {
    if (initialReport) return initialReport.discipline;
    if (defaultDiscipline) return defaultDiscipline;
    return profile.roles[0] || (profile.role as UserRole) || 'Supervisor';
  });
  const reportDate = initialReport?.date || new Date().toISOString().split('T')[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [allManpower, setAllManpower] = useState<any[]>([]);
  const [submittedReports, setSubmittedReports] = useState<DailyReport[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(() => {
    let baseData = {};
    switch (discipline) {
      case 'Logistics': baseData = { 
        spbUpdates: [],
        fuelIn: [],
        fuelOut: [],
        fuelConsumption: [], 
        template: 'Standard',
        notes: '' 
      }; break;
      case 'Supervisor': baseData = { 
        supervisorName: profile.name,
        materialRequests: [], 
        activities: [],
        template: 'Standard',
        notes: '' 
      }; break;
      case 'HSE': baseData = { 
        materialRequests: [], 
        permits: [{ number: '', status: 'Open' }],
        manhours: { direct: 0, indirect: 0, overtime: 0, total: 0, totalManDay: 0, avgMenPerMonth: 0, assumedWorkingHours: 8 },
        safetyInduction: { entries: [] },
        toolboxMeeting: { entries: [] },
        safetyPatrol: { entries: [] },
        safetyMeeting: { entries: [] },
        unsafeAction: { entries: [] },
        unsafeCondition: { entries: [] },
        nearMiss: { entries: [] },
        accident: { entries: [] },
        p3k: { entries: [] },
        apd: { entries: [] },
        rambu: { entries: [] },
        others: { entries: [] },
        safetyStats: { noOfInjury: 0, daysCharged: 0, frequencyRate: 0, severityRate: 0 },
        incidentTypes: { fallingFromHeight: 0, fallingObjects: 0, hitByObject: 0, collapseOfStack: 0, electricalHazards: 0, otherIncidents: 0 },
        complianceStats: { momSummons: 0, momNonCompliance: 0, demeritPoints: 0, momWarningLetter: 0, momStopWorkOrderVerbal: 0 },
        weatherConditions: Array.from({ length: 24 }, (_, i) => ({ time: `${String(i).padStart(2, '0')}:00`, condition: 'Sunny' })),
        stopWorkOrders: [{ type: 'Verbal', number: '', cause: '', impact: '' }],
        healthStatus: { directSick: 0, directHealthy: 0, indirectSick: 0, indirectHealthy: 0 },
        template: 'Standard',
        notes: '' 
      }; break;
      case 'QC': baseData = { 
        materialRequests: [], 
        inspections: [], 
        nonConformity: [], 
        testResults: [], 
        punchList: [], 
        template: 'Standard', 
        notes: '' 
      }; break;
      case 'HR': baseData = { 
        personnelList: [], 
        visibleColumns: ['manpowerId', 'name', 'position', 'classification', 'siteStatus', 'activeStatus'],
        template: 'Standard',
        notes: '' 
      }; break;
      case 'Project Control': baseData = { 
        todaysActual: '', 
        tomorrowsPlan: '', 
        includedReports: [],
        remarksDrawings: [],
        otherNotes: [],
        signatures: [],
        technicalDetails: [],
        template: 'Standard',
        colorStyle: 'Color',
        notes: '' 
      }; break;
      case 'Engineering': baseData = {
        shopDrawings: [],
        rfis: [],
        materialSubmittals: [],
        methodStatements: [],
        template: 'Standard',
        notes: ''
      }; break;
      case 'campbos': baseData = {
        occupancy: { direct: 0, indirect: 0, total: 0, capacity: 0 },
        facilityIssues: [],
        mealCounts: { breakfast: 0, lunch: 0, dinner: 0, supper: 0 },
        residents: [],
        template: 'Standard',
        notes: ''
      }; break;
      case 'Permit Officer': baseData = {
        permitsIssued: [],
        permitViolations: [],
        dailyPermitLog: [],
        template: 'Standard',
        notes: ''
      }; break;
      case 'Paramedic': baseData = {
        medicalRecords: [],
        firstAidTreatments: [],
        sickLeaveRecords: [],
        referrals: [],
        healthStats: { totalCheckups: 0, healthy: 0, sick: 0 },
        template: 'Standard',
        notes: ''
      }; break;
      default: baseData = { template: 'Standard', notes: '' };
    }

    if (initialReport) {
      try {
        const parsed = JSON.parse(initialReport.data);
        const merged = { ...baseData, ...parsed };
        
        if (discipline === 'Supervisor' && merged.activities) {
          merged.activities = merged.activities.map((act: any) => ({
            ...act,
            workItem: act.workItem || '',
            manpowerList: act.manpowerList || [],
            heavyEquipment: act.heavyEquipment || [{ name: '', count: 0 }],
            brokenEquipment: act.brokenEquipment || [{ name: '', count: 0 }],
            overtime: {
              hours: act.overtime?.hours || 0,
              manpower: act.overtime?.manpower || 0,
              manpowerList: act.overtime?.manpowerList || [],
              heavyEquipment: act.overtime?.heavyEquipment || [{ name: '', count: 0 }],
              photos: (act.overtime?.photos || []).map((p: any) => typeof p === 'string' ? { url: p, location: '', description: '' } : p)
            },
            photos: (act.photos || []).map((p: any) => typeof p === 'string' ? { url: p, location: '', description: '' } : p)
          }));
        }

        // Migrate HSE metrics if they are numbers or old object format
        if (discipline === 'HSE') {
          [
            'safetyInduction', 'toolboxMeeting', 'safetyPatrol', 'safetyMeeting',
            'unsafeAction', 'unsafeCondition', 'nearMiss', 'accident',
            'p3k', 'apd', 'rambu', 'others'
          ].forEach(key => {
            if (typeof merged[key] === 'number') {
              const count = merged[key];
              merged[key] = { 
                entries: Array(count).fill(null).map(() => ({ 
                  description: '', 
                  photos: [], 
                  files: [], 
                  manpowerId: '', 
                  manpowerName: '' 
                })) 
              };
            } else if (merged[key] && !merged[key].entries) {
              merged[key] = { 
                entries: [{ 
                  description: merged[key].description || '', 
                  photos: merged[key].photos || [], 
                  files: merged[key].files || [], 
                  manpowerId: '', 
                  manpowerName: '' 
                }] 
              };
            }
          });
        }
        return merged;
      } catch (e) {
        console.error('Failed to parse initial report data:', e);
      }
    }
    return baseData;
  });

  const [weather, setWeather] = useState(() => {
    if (initialReport?.weather) return initialReport.weather;
    return {
      rainy: 0,
      drizzle: 0,
      cloudy: 0,
      sunny: 0,
      workingTime: '06:00 - 18:00'
    };
  });

  const [manpower, setManpower] = useState(() => {
    if (initialReport?.manpower) return initialReport.manpower;
    return {
      indirect: 0,
      direct: 0,
      total: 0
    };
  });

  const [projectMaterialRequests, setProjectMaterialRequests] = useState<MaterialRequest[]>([]);
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [manpowerSearch, setManpowerSearch] = useState<Record<number, string>>({});
  const [overtimeManpowerSearch, setOvertimeManpowerSearch] = useState<Record<number, string>>({});
  const [hrEntryType, setHrEntryType] = useState<'add' | 'update' | null>(null);
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [metricSearchQuery, setMetricSearchQuery] = useState('');

  useEffect(() => {
    if (!project.id) return;
    const q = query(collection(db, 'materialRequests'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialRequest));
      setProjectMaterialRequests(requests);
    });
    return () => unsubscribe();
  }, [project.id]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Logistics_SPB_Update': true,
    'Logistics_Fuel': false,
    'Supervisor_Info': true,
    'Supervisor_Activities': true,
    'HSE_Permits': true,
    'HSE_Manhours': true,
    'HSE_Weather': false,
    'HSE_SWO': false,
    'HSE_Health': false,
    'QC_SPB': true,
    'QC_Inspections': true,
    'QC_NCR': false,
    'QC_Tests': false,
    'QC_PunchList': false,
    'HR_Config': true,
    'HR_Personnel': true,
    'ProjectControl_General': true,
    'ProjectControl_Consolidated': true,
    'ProjectControl_Technical': true,
    'ProjectControl_OtherNotes': false,
    'ProjectControl_RemarksDrawings': false,
    'ProjectControl_Signatures': false,
    'General': true
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Removed useEffect that fetches last report to pre-fill new reports
  // as per user request: "ketika ingin memasukkan data baru maka di kolom jangan ada data lama"

  useEffect(() => {
    if (discipline === 'Project Control') {
      const today = initialReport?.date || new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'reports'),
        where('projectId', '==', project.id),
        where('date', '==', today),
        where('status', '==', 'Submitted')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
        setSubmittedReports(reports);
      });

      return () => unsubscribe();
    }
  }, [project.id, discipline, initialReport?.date]);

  useEffect(() => {
    if (discipline !== 'HR' && discipline !== 'HSE' && discipline !== 'Supervisor') return;
    const q = query(collection(db, 'manpower'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllManpower(mp);
    });
    return () => unsubscribe();
  }, [project.id, discipline]);

  useEffect(() => {
    if (discipline !== 'HSE' || !project.id || !reportDate) return;

    const q = query(
      collection(db, 'reports'),
      where('projectId', '==', project.id),
      where('date', '==', reportDate),
      where('discipline', '==', 'Supervisor'),
      where('status', '==', 'Submitted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let overtimeManhours = 0;
      snapshot.docs.forEach(doc => {
        const report = doc.data() as DailyReport;
        try {
          const data = JSON.parse(report.data);
          if (data.activities) {
            data.activities.forEach((act: any) => {
              if (act.overtime) {
                overtimeManhours += (act.overtime.hours || 0) * (act.overtime.manpower || 0);
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse supervisor report data:', e);
        }
      });

      if (formData.manhours?.overtime !== overtimeManhours) {
        setFormData(prev => ({
          ...prev,
          manhours: {
            ...prev.manhours,
            overtime: overtimeManhours
          }
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reports');
    });

    return () => unsubscribe();
  }, [project.id, reportDate, discipline]);

  useEffect(() => {
    if (discipline !== 'HSE') return;
    
    const onsiteManpower = allManpower.filter(m => m.siteStatus === 'On Site' && m.activeStatus === 'Active');
    const directOnSite = onsiteManpower.filter(m => m.classification === 'Direct').length;
    const indirectOnSite = onsiteManpower.filter(m => m.classification === 'Indirect').length;

    const directSick = formData.healthStatus?.directSick || 0;
    const indirectSick = formData.healthStatus?.indirectSick || 0;

    const directHealthy = Math.max(0, directOnSite - directSick);
    const indirectHealthy = Math.max(0, indirectOnSite - indirectSick);

    const assumedHours = formData.manhours?.assumedWorkingHours || 8;
    const overtime = formData.manhours?.overtime || 0;
    
    const totalManDay = directHealthy + indirectHealthy;
    const totalMH = (totalManDay * assumedHours) + overtime;

    const currentHS = formData.healthStatus || {};
    const currentMH = formData.manhours || {};

    if (
      currentHS.directHealthy !== directHealthy || 
      currentHS.indirectHealthy !== indirectHealthy ||
      currentMH.direct !== directHealthy ||
      currentMH.indirect !== indirectHealthy ||
      currentMH.total !== totalMH ||
      currentMH.totalManDay !== totalManDay
    ) {
      setFormData(prev => ({
        ...prev,
        healthStatus: {
          ...prev.healthStatus,
          directHealthy,
          indirectHealthy
        },
        manhours: {
          ...prev.manhours,
          direct: directHealthy,
          indirect: indirectHealthy,
          total: totalMH,
          totalManDay: totalManDay
        }
      }));
    }
  }, [allManpower, formData.healthStatus?.directSick, formData.healthStatus?.indirectSick, formData.manhours?.assumedWorkingHours, formData.manhours?.overtime, discipline]);

  const handleManpowerSelect = (index: number, manpowerId: string) => {
    const selected = allManpower.find(m => m.manpowerId === manpowerId);
    if (selected) {
      const newList = [...formData.personnelList];
      newList[index] = {
        ...newList[index],
        ...selected,
        id: newList[index].id // Keep local ID for React key
      };
      setFormData({ ...formData, personnelList: newList });
    } else {
      const newList = [...formData.personnelList];
      newList[index].manpowerId = manpowerId;
      setFormData({ ...formData, personnelList: newList });
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      // Fetch all reports for consolidation if Project Control
      let reportsToPreview = [];
      if (discipline === 'Project Control' && (formData.includedReports?.length > 0 || formData.technicalDetails?.length > 0)) {
        const q = query(
          collection(db, 'reports'),
          where('projectId', '==', project.id),
          where('status', '==', 'Submitted')
        );
        const snapshot = await getDocs(q);
        const allFetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
        
        // Filter for the selected date and included reports for the main list
        const today = new Date().toISOString().split('T')[0];
        reportsToPreview = allFetchedReports.filter(r => 
          r.date === today && 
          formData.includedReports?.includes(r.discipline)
        );
        
        // Also pass the full list of reports to generateProjectReport if needed
        // For now, we'll just pass all reports if it's Project Control
        const currentReport: DailyReport = {
          id: 'preview',
          projectId: project.id,
          discipline: discipline,
          date: today,
          authorId: profile.id,
          authorName: profile.name,
          data: JSON.stringify(formData),
          status: 'Draft',
          createdAt: serverTimestamp(),
          weather: weather,
          manpower: manpower
        };
        
        const allReports = [...allFetchedReports, currentReport];
        generateProjectReport(project, allReports, undefined, formData.template || 'Standard', true, formData.colorStyle || 'Color');
        setLoading(false);
        return;
      }

      // Add current report to the list
      const currentReport: DailyReport = {
        id: 'preview',
        projectId: project.id,
        discipline: discipline,
        date: new Date().toISOString().split('T')[0],
        authorId: profile.id,
        authorName: profile.name,
        data: JSON.stringify(formData),
        status: 'Draft',
        createdAt: serverTimestamp(),
        weather: weather,
        manpower: manpower
      };

      const allReports = [...reportsToPreview, currentReport];
      generateProjectReport(project, allReports, undefined, formData.template || 'Standard', true, formData.colorStyle || 'Color');
    } catch (err) {
      console.error('Preview failed:', err);
      setError('Failed to generate preview.');
    } finally {
      setLoading(false);
    }
  };

  const calculateManhours = async () => {
    if (!project.id || !reportDate) {
      setError('Project ID or Report Date is missing.');
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reports'),
        where('projectId', '==', project.id),
        where('date', '==', reportDate),
        where('status', '==', 'Submitted')
      );
      
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({ ...doc.data() } as DailyReport));
      
      let overtimeManhours = 0;
      
      // Get Supervisor data for overtime
      reports.filter(r => r.discipline === 'Supervisor').forEach(r => {
        const data = JSON.parse(r.data);
        if (data.activities) {
          data.activities.forEach((act: any) => {
            if (act.overtime) {
              overtimeManhours += (act.overtime.hours || 0) * (act.overtime.manpower || 0);
            }
          });
        }
      });
      
      setFormData(prev => ({
        ...prev,
        manhours: {
          ...prev.manhours,
          overtime: overtimeManhours
        }
      }));
    } catch (err) {
      console.error('Failed to calculate manhours:', err);
      setError('Failed to fetch data for calculation. Ensure Supervisor and HR reports are submitted.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (status: 'Draft' | 'Submitted') => {
    if (status === 'Submitted') {
      // Check for duplicate SPB numbers in material requests
      if (formData.materialRequests?.length > 0) {
        const spbNos = formData.materialRequests
          .map((r: any) => r.spbNo?.trim())
          .filter((no: string) => no && no !== '');
        
        const uniqueSpbNos = new Set(spbNos);
        if (spbNos.length !== uniqueSpbNos.size) {
          setError('Duplicate SPB numbers found in material requests. Each SPB number must be unique.');
          setLoading(false);
          return;
        }

        // Check against database for new reports
        if (!initialReport) {
          for (const req of formData.materialRequests) {
            if (req.spbNo && projectMaterialRequests.some(r => r.spbNo === req.spbNo)) {
              setError(`SPB Number "${req.spbNo}" already exists in the system. Please use a different number.`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Check for duplicate SPB updates
      if (formData.spbUpdates?.length > 0) {
        const spbIds = formData.spbUpdates
          .map((u: any) => u.spbId)
          .filter((id: string) => id && id !== '');
        
        const uniqueSpbIds = new Set(spbIds);
        if (spbIds.length !== uniqueSpbIds.size) {
          setError('Duplicate SPB updates found. Each SPB can only be updated once in a single report.');
          setLoading(false);
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    // Permission check for editing
    if (initialReport) {
      const canModify = profile.roles.includes('Admin') || profile.roles.includes(initialReport.discipline);
      if (!canModify) {
        setError(`You do not have permission to edit reports for the ${initialReport.discipline} discipline.`);
        setLoading(false);
        return;
      }
    }

    try {
      const report: any = {
        projectId: project.id,
        discipline: discipline,
        date: initialReport ? initialReport.date : new Date().toISOString().split('T')[0],
        authorId: profile.id,
        authorName: profile.name,
        data: JSON.stringify(formData),
        status,
        createdAt: initialReport ? initialReport.createdAt : serverTimestamp(),
      };

      if (discipline === 'HSE') {
        const hseData: any = {};
        [
          'safetyInduction', 'toolboxMeeting', 'safetyPatrol', 'safetyMeeting',
          'unsafeAction', 'unsafeCondition', 'nearMiss', 'accident',
          'p3k', 'apd', 'rambu', 'others'
        ].forEach(key => {
          const metric = formData[key] || { entries: [] };
          hseData[key] = metric.entries?.length || 0;
        });
        report.hse = hseData;
      }

      if (discipline === 'Admin' || discipline === 'Project Control') {
        report.weather = weather;
        report.manpower = manpower;
      }

      if (initialReport) {
        const { db, updateDoc, doc } = await import('../firebase');
        await updateDoc(doc(db, 'reports', initialReport.id), report);
      } else {
        await addDoc(collection(db, 'reports'), report);
      }

      // Sync manpower data if HR
      if (discipline === 'HR' && status === 'Submitted') {
        const { setDoc, doc: firestoreDoc } = await import('../firebase');
        for (const person of formData.personnelList) {
          if (person.manpowerId) {
            // Find if this manpower already exists in the collection
            const existing = allManpower.find(m => m.manpowerId === person.manpowerId);
            const manpowerData = {
              manpowerId: person.manpowerId,
              name: person.name,
              email: person.email || '',
              position: person.position,
              classification: person.classification,
              siteStatus: person.siteStatus,
              activeStatus: person.activeStatus,
              mcuStatus: person.mcuStatus,
              mcuExpiry: person.mcuExpiry,
              pointOfHire: person.pointOfHire,
              entryPermitStatus: person.entryPermitStatus,
              entryPermitExpiry: person.entryPermitExpiry,
              contractStart: person.contractStart,
              contractEnd: person.contractEnd,
              certificate: person.certificate,
              leaveStart: person.leaveStart || '',
              leaveEnd: person.leaveEnd || '',
              photoUrl: person.photoUrl || '',
              projectId: project.id,
              updatedAt: serverTimestamp()
            };

            if (existing) {
              await updateDoc(firestoreDoc(db, 'manpower', existing.id), manpowerData);
            } else {
              await addDoc(collection(db, 'manpower'), {
                ...manpowerData,
                createdAt: serverTimestamp()
              });
            }
          }
        }
      }

      // Sync material requests to monitoring collection
      if (status === 'Submitted' && !initialReport) {
        const { increment } = await import('../firebase');

        if (formData.materialRequests?.length > 0) {
          for (const req of formData.materialRequests) {
            await addDoc(collection(db, 'materialRequests'), {
              ...req,
              projectId: project.id,
              date: report.date,
              totalVolume: req.volumeSPB, // Initial total volume is what was requested
              remaining: req.volumeSPB,
              used: 0,
              status: 'Proses',
              approval: { 
                cm: false, 
                cc: false, 
                pm: false 
              },
              requestedBy: req.requestedBy || profile.name,
              requestedByName: profile.name,
              discipline: req.discipline || discipline
            });
          }
        }

        if (discipline === 'Logistics') {
          if (formData.spbUpdates?.length > 0) {
            for (const update of formData.spbUpdates) {
              if (!update.spbId) continue;

              const spbRef = doc(db, 'materialRequests', update.spbId);
              const spbDoc = projectMaterialRequests.find(r => r.id === update.spbId);
              if (!spbDoc) continue;

              // Update SPB status
              await updateDoc(spbRef, {
                status: update.status || 'Proses'
              });

              // Process Receipts
              if (update.receipts?.length > 0) {
                for (const rec of update.receipts) {
                  await addDoc(collection(db, 'materialReceipts'), {
                    ...rec,
                    spbId: update.spbId,
                    spbNo: update.spbNo,
                    itemName: update.itemName,
                    unit: update.unit,
                    projectId: project.id,
                    date: report.date,
                    receivedBy: profile.name,
                    location: spbDoc.location || 'Sorong'
                  });

                  // Update SPB
                  await updateDoc(spbRef, {
                    totalVolume: increment(rec.volume),
                    totalPrice: increment(rec.total || 0),
                    remaining: increment(rec.volume),
                    purchases: arrayUnion({
                      date: report.date,
                      volume: rec.volume,
                      price: rec.price || 0,
                      total: rec.total || 0,
                      supplier: rec.supplier,
                      mrnNo: rec.mrnNo,
                      photoUrl: rec.photoUrl || ''
                    })
                  });
                }
              }

              // Process Usages
              if (update.usages?.length > 0) {
                for (const use of update.usages) {
                  await addDoc(collection(db, 'materialUsages'), {
                    ...use,
                    spbId: update.spbId,
                    spbNo: update.spbNo,
                    itemName: update.itemName,
                    unit: update.unit,
                    projectId: project.id,
                    date: report.date,
                    usedFor: use.workItem,
                    location: use.area
                  });

                  // Update SPB
                  await updateDoc(spbRef, {
                    used: increment(use.volume),
                    remaining: increment(-use.volume),
                    usages: arrayUnion({
                      date: report.date,
                      volume: use.volume,
                      workItem: use.workItem,
                      area: use.area,
                      discipline: use.discipline || 'Logistics',
                      remarks: use.remarks || '',
                      photoUrl: use.photoUrl || ''
                    })
                  });
                }
              }
            }
          }
        }
      }

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
      setError('Failed to save report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 600, 600, 0.5);
        callback(compressedBase64);
      } catch (err) {
        console.error('Failed to compress image:', err);
        setError('Failed to process image. It might be too large or an invalid format.');
      }
    }
  };

  const renderSPBSection = () => {
    if (discipline === 'HR' || discipline === 'Project Control') return null;
    return (
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Material Requests (SPB)</label>
        {discipline !== 'Supervisor' && (
          <button 
            type="button"
            onClick={() => {
              const newReq = {
                spbNo: '',
                spbName: '',
                itemName: '',
                unit: 'bh',
                volumeSPB: 0,
                workItem: '',
                area: '',
                location: 'Sorong',
                status: 'Proses',
                requestedBy: profile.name,
                discipline: discipline,
                photoUrl: ''
              };
              setFormData({ ...formData, materialRequests: [...(formData.materialRequests || []), newReq] });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            ADD SPB ITEM
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        {formData.materialRequests?.map((req: any, index: number) => (
          <div key={index} className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-2xl space-y-4 relative group">
            <button 
              type="button"
              onClick={() => {
                const newList = [...formData.materialRequests];
                newList.splice(index, 1);
                setFormData({ ...formData, materialRequests: newList });
              }}
              className="absolute top-2 right-2 p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="text-[9px] text-neutral-500 uppercase block mb-1">Photo Barang (SPB)</label>
                <div className="relative group/photo aspect-square bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
                  {req.photoUrl ? (
                    <img src={req.photoUrl} alt="SPB Item" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                      <Plus className="w-6 h-6" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (base64) => {
                      const newList = [...formData.materialRequests];
                      newList[index].photoUrl = base64;
                      setFormData({ ...formData, materialRequests: newList });
                    })}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              <div className="md:col-span-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Requested By</label>
                    <input 
                      value={req.requestedBy || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].requestedBy = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Discipline</label>
                    <select 
                      value={req.discipline || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].discipline = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">Select Discipline</option>
                      <option value="Procurement">Procurement</option>
                      <option value="Document Control">Document Control</option>
                      <option value="Mechanic & Electrical">Mechanic & Electrical</option>
                      <option value="QC">QC</option>
                      <option value="HR">HR</option>
                      <option value="Project Control">Project Control</option>
                      <option value="HSE">HSE</option>
                      <option value="Logistics">Logistics</option>
                      <option value="Supervisor">Supervisor</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">SPB No</label>
                    <input 
                      value={req.spbNo || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].spbNo = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className={`w-full bg-neutral-900 border rounded-lg px-3 py-2 text-xs text-white transition-colors ${
                        (req.spbNo && (formData.materialRequests?.some((r: any, i: number) => i !== index && r.spbNo === req.spbNo) || 
                         (!initialReport && projectMaterialRequests.some(r => r.spbNo === req.spbNo))))
                        ? 'border-red-500 focus:border-red-500' : 'border-neutral-700 focus:border-emerald-500'
                      }`}
                      placeholder="001/SPB/..."
                    />
                    {req.spbNo && (formData.materialRequests?.some((r: any, i: number) => i !== index && r.spbNo === req.spbNo) || 
                      (!initialReport && projectMaterialRequests.some(r => r.spbNo === req.spbNo))) && (
                      <p className="text-[8px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-2 h-2" />
                        Duplicate or existing SPB Number
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Item Name</label>
                    <input 
                      value={req.itemName || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].itemName = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="Material name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Vol</label>
                    <input 
                      type="number"
                      value={req.volumeSPB}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].volumeSPB = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Unit</label>
                    <input 
                      value={req.unit || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].unit = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Location</label>
                    <select 
                      value={req.location}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].location = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="Sorong">Sorong</option>
                      <option value="Jakarta">Jakarta</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Work Item</label>
                    <input 
                      value={req.workItem || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].workItem = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="Item pekerjaan"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Area</label>
                    <input 
                      value={req.area || ''}
                      onChange={(e) => {
                        const newList = [...formData.materialRequests];
                        newList[index].area = e.target.value;
                        setFormData({ ...formData, materialRequests: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="Lokasi area"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Remarks / Notes</label>
                  <textarea 
                    value={req.remarks || ''}
                    onChange={(e) => {
                      const newList = [...formData.materialRequests];
                      newList[index].remarks = e.target.value;
                      setFormData({ ...formData, materialRequests: newList });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-16 resize-none"
                    placeholder="Catatan tambahan..."
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    );
  };

  const renderUpdateSPBSection = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Update existing SPB requests with today's receipts and usages</p>
          <button 
            type="button"
            onClick={() => {
              const newUpdate = { 
                spbId: '', 
                spbNo: '', 
                itemName: '', 
                unit: '',
                status: 'Proses',
                receipts: [], 
                usages: [] 
              };
              setFormData({ ...formData, spbUpdates: [...(formData.spbUpdates || []), newUpdate] });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            ADD SPB UPDATE
          </button>
        </div>
        
        <div className="space-y-8">
          {formData.spbUpdates?.map((update: any, updateIdx: number) => (
            <div key={updateIdx} className="p-6 bg-neutral-900 border border-neutral-700 rounded-2xl relative group space-y-6">
              <button 
                type="button"
                onClick={() => {
                  const newList = [...formData.spbUpdates];
                  newList.splice(updateIdx, 1);
                  setFormData({ ...formData, spbUpdates: newList });
                }}
                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* SPB Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase font-bold">Select SPB Request</label>
                    <select 
                      value={update.spbId || ''} 
                      onChange={(e) => { 
                        const newList = [...formData.spbUpdates]; 
                        const selectedSpb = projectMaterialRequests.find(r => r.id === e.target.value);
                        newList[updateIdx].spbId = e.target.value;
                        if (selectedSpb) {
                          newList[updateIdx].spbNo = selectedSpb.spbNo;
                          newList[updateIdx].itemName = selectedSpb.itemName;
                          newList[updateIdx].unit = selectedSpb.unit;
                          newList[updateIdx].status = selectedSpb.status || 'Proses';
                        }
                        setFormData({ ...formData, spbUpdates: newList }); 
                      }} 
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-all"
                    >
                      <option value="">-- Select SPB --</option>
                      {projectMaterialRequests
                        .filter(r => r.approval?.cm && r.approval?.cc && r.approval?.pm)
                        .filter(r => !formData.spbUpdates?.some((u: any, i: number) => i !== updateIdx && u.spbId === r.id))
                        .map(r => (
                        <option key={r.id} value={r.id}>{r.spbNo} - {r.itemName}</option>
                      ))}
                    </select>
                  {projectMaterialRequests.length > 0 && projectMaterialRequests.filter(r => r.approval?.cm && r.approval?.cc && r.approval?.pm).length === 0 && (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      No fully approved SPBs available.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase font-bold">Item Name</label>
                  <input readOnly value={update.itemName} className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-neutral-400 cursor-not-allowed" />
                </div>
              </div>

              {/* 2. STOK YANG DITERIMA (INVENTORY SITE) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  <h5 className="text-[10px] font-bold text-white uppercase tracking-widest">2. STOK YANG DITERIMA (INVENTORY SITE)</h5>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-bold">Total Received (Stock In Site)</label>
                    <div className="relative">
                      <input 
                        readOnly 
                        value={update.receipts?.reduce((sum: number, r: any) => sum + (parseFloat(r.volume) || 0), 0) || 0} 
                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-lg font-bold text-white cursor-not-allowed" 
                      />
                      <p className="text-[8px] text-neutral-600 mt-1 italic">Auto-calculated from receipt history</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-bold">Status SPB</label>
                    <select 
                      value={update.status || 'Proses'} 
                      onChange={(e) => {
                        const newList = [...formData.spbUpdates];
                        newList[updateIdx].status = e.target.value;
                        setFormData({ ...formData, spbUpdates: newList });
                      }}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 transition-all"
                    >
                      <option value="Proses">Proses</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <h6 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Purchase / Receipt History</h6>
                  <button 
                    type="button"
                    onClick={() => {
                      const newList = [...formData.spbUpdates];
                      newList[updateIdx].receipts = [...(newList[updateIdx].receipts || []), { mrnNo: '', volume: 0, price: 0, total: 0, supplier: '', photoUrl: '' }];
                      setFormData({ ...formData, spbUpdates: newList });
                    }}
                    className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Plus className="w-3 h-3" />
                    Add Receipt
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {update.receipts?.map((rec: any, recIdx: number) => (
                    <div key={recIdx} className="p-4 bg-neutral-800/20 border border-neutral-800 rounded-xl relative group/item space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase">Receipt {recIdx + 1}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const newList = [...formData.spbUpdates];
                            newList[updateIdx].receipts.splice(recIdx, 1);
                            setFormData({ ...formData, spbUpdates: newList });
                          }}
                          className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] text-neutral-500 uppercase font-bold">Volume</label>
                          <input 
                            type="number" 
                            placeholder="Volume"
                            value={rec.volume} 
                            onChange={(e) => { 
                              const newList = [...formData.spbUpdates]; 
                              const val = parseFloat(e.target.value) || 0;
                              newList[updateIdx].receipts[recIdx].volume = val; 
                              newList[updateIdx].receipts[recIdx].total = val * (newList[updateIdx].receipts[recIdx].price || 0);
                              setFormData({ ...formData, spbUpdates: newList }); 
                            }} 
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-neutral-500 uppercase font-bold">Price</label>
                          <input 
                            type="number" 
                            placeholder="Price"
                            value={rec.price || 0} 
                            onChange={(e) => { 
                              const newList = [...formData.spbUpdates]; 
                              const val = parseFloat(e.target.value) || 0;
                              newList[updateIdx].receipts[recIdx].price = val; 
                              newList[updateIdx].receipts[recIdx].total = val * (newList[updateIdx].receipts[recIdx].volume || 0);
                              setFormData({ ...formData, spbUpdates: newList }); 
                            }} 
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-neutral-500 uppercase font-bold">Total</label>
                          <div className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-bold text-emerald-500">
                            {rec.total || 0}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] text-neutral-500 uppercase font-bold">Invoice/Receipt</label>
                          <div className="flex items-center gap-2">
                            {rec.photoUrl ? (
                              <div className="relative w-full h-9 rounded-lg overflow-hidden border border-neutral-700 group/img">
                                <img src={rec.photoUrl} alt="Receipt" className="w-full h-full object-cover" />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newList = [...formData.spbUpdates];
                                    newList[updateIdx].receipts[recIdx].photoUrl = '';
                                    setFormData({ ...formData, spbUpdates: newList });
                                  }}
                                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-full flex items-center justify-center gap-2 h-9 bg-neutral-800 border border-dashed border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-700 transition-all">
                                <Camera className="w-3 h-3 text-neutral-500" />
                                <span className="text-[9px] text-neutral-500">Upload</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => handleImageUpload(e, (base64) => {
                                    const newList = [...formData.spbUpdates];
                                    newList[updateIdx].receipts[recIdx].photoUrl = base64;
                                    setFormData({ ...formData, spbUpdates: newList });
                                  })} 
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[8px] text-neutral-500 uppercase font-bold">Supplier / MRN No</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            placeholder="Supplier"
                            value={rec.supplier} 
                            onChange={(e) => { const newList = [...formData.spbUpdates]; newList[updateIdx].receipts[recIdx].supplier = e.target.value; setFormData({ ...formData, spbUpdates: newList }); }} 
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-[11px] text-white" 
                          />
                          <input 
                            placeholder="MRN No"
                            value={rec.mrnNo} 
                            onChange={(e) => { const newList = [...formData.spbUpdates]; newList[updateIdx].receipts[recIdx].mrnNo = e.target.value; setFormData({ ...formData, spbUpdates: newList }); }} 
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-[11px] text-white" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. MATERIAL YANG DIGUNAKAN */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                  <Repeat className="w-4 h-4 text-orange-500" />
                  <h5 className="text-[10px] font-bold text-white uppercase tracking-widest">3. MATERIAL YANG DIGUNAKAN</h5>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-bold">Total Volume Used</label>
                    <div className="relative">
                      <input 
                        readOnly 
                        value={update.usages?.reduce((sum: number, u: any) => sum + (parseFloat(u.volume) || 0), 0) || 0} 
                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-lg font-bold text-white cursor-not-allowed" 
                      />
                      <p className="text-[8px] text-neutral-600 mt-1 italic">Auto-calculated from usage history</p>
                    </div>
                  </div>
                  <div className="p-4 bg-neutral-800/20 border border-neutral-800 rounded-xl flex flex-col justify-center">
                    <label className="text-[9px] text-neutral-500 uppercase font-bold mb-2">Remaining Stock</label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-emerald-500">
                        {(projectMaterialRequests.find(r => r.id === update.spbId)?.remaining || 0) - (update.usages?.reduce((sum: number, u: any) => sum + (parseFloat(u.volume) || 0), 0) || 0)}
                      </span>
                      <span className="text-xs text-neutral-400">{update.unit || 'unit'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <h6 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Usage History (Gradual Usage)</h6>
                  <button 
                    type="button"
                    onClick={() => {
                      const newList = [...formData.spbUpdates];
                      newList[updateIdx].usages = [...(newList[updateIdx].usages || []), { 
                        date: new Date().toISOString().split('T')[0],
                        volume: 0, 
                        workItem: '', 
                        area: '', 
                        discipline: 'Logistics', 
                        remarks: '', 
                        photoUrl: '' 
                      }];
                      setFormData({ ...formData, spbUpdates: newList });
                    }}
                    className="text-[9px] font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Plus className="w-3 h-3" />
                    Add Usage Record
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {update.usages?.map((use: any, useIdx: number) => {
                    // Calculate balance after this specific usage
                    const spb = projectMaterialRequests.find(r => r.id === update.spbId);
                    const initialRemaining = spb?.remaining || 0;
                    const previousUsagesSum = update.usages.slice(0, useIdx).reduce((sum: number, u: any) => sum + (parseFloat(u.volume) || 0), 0);
                    const balanceAfter = initialRemaining - previousUsagesSum - (parseFloat(use.volume) || 0);

                    return (
                      <div key={useIdx} className="p-4 bg-neutral-800/20 border border-neutral-800 rounded-xl relative group/item space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase">Usage {useIdx + 1}</span>
                            <input 
                              type="date" 
                              value={use.date} 
                              onChange={(e) => {
                                const newList = [...formData.spbUpdates];
                                newList[updateIdx].usages[useIdx].date = e.target.value;
                                setFormData({ ...formData, spbUpdates: newList });
                              }}
                              className="bg-transparent border-none text-[10px] text-neutral-400 focus:ring-0 p-0 cursor-pointer hover:text-white transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[8px] text-neutral-600 uppercase">Balance After</p>
                              <p className="text-[10px] font-bold text-emerald-500">{balanceAfter} {update.unit || 'unit'}</p>
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                const newList = [...formData.spbUpdates];
                                newList[updateIdx].usages.splice(useIdx, 1);
                                setFormData({ ...formData, spbUpdates: newList });
                              }}
                              className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[8px] text-neutral-500 uppercase font-bold">Volume Used</label>
                            <input 
                              type="number" 
                              value={use.volume} 
                              onChange={(e) => { 
                                const newList = [...formData.spbUpdates]; 
                                newList[updateIdx].usages[useIdx].volume = parseFloat(e.target.value) || 0; 
                                setFormData({ ...formData, spbUpdates: newList }); 
                              }} 
                              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] text-neutral-500 uppercase font-bold">Work Item</label>
                            <input 
                              placeholder="e.g. Pengecoran..."
                              value={use.workItem} 
                              onChange={(e) => { 
                                const newList = [...formData.spbUpdates]; 
                                newList[updateIdx].usages[useIdx].workItem = e.target.value; 
                                setFormData({ ...formData, spbUpdates: newList }); 
                              }} 
                              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] text-neutral-500 uppercase font-bold">Area</label>
                            <input 
                              placeholder="e.g. Zone A..."
                              value={use.area} 
                              onChange={(e) => { 
                                const newList = [...formData.spbUpdates]; 
                                newList[updateIdx].usages[useIdx].area = e.target.value; 
                                setFormData({ ...formData, spbUpdates: newList }); 
                              }} 
                              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[8px] text-neutral-500 uppercase font-bold">Discipline</label>
                            <select 
                              value={use.discipline || 'Logistics'} 
                              onChange={(e) => { 
                                const newList = [...formData.spbUpdates]; 
                                newList[updateIdx].usages[useIdx].discipline = e.target.value; 
                                setFormData({ ...formData, spbUpdates: newList }); 
                              }} 
                              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                            >
                              <option value="Mechanical">Mechanical</option>
                              <option value="Piping">Piping</option>
                              <option value="Electrical">Electrical</option>
                              <option value="Civil">Civil</option>
                              <option value="Structure">Structure</option>
                              <option value="Instrument">Instrument</option>
                              <option value="Logistics">Logistics</option>
                              <option value="Procurement">Procurement</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] text-neutral-500 uppercase font-bold">Usage Photo</label>
                            <div className="flex items-center gap-2">
                              {use.photoUrl ? (
                                <div className="relative w-full h-9 rounded-lg overflow-hidden border border-neutral-700 group/img">
                                  <img src={use.photoUrl} alt="Usage" className="w-full h-full object-cover" />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newList = [...formData.spbUpdates];
                                      newList[updateIdx].usages[useIdx].photoUrl = '';
                                      setFormData({ ...formData, spbUpdates: newList });
                                    }}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              ) : (
                                <label className="w-full flex items-center justify-center gap-2 h-9 bg-neutral-800 border border-dashed border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-700 transition-all">
                                  <Camera className="w-3 h-3 text-neutral-500" />
                                  <span className="text-[9px] text-neutral-500">Upload Photo</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageUpload(e, (base64) => {
                                      const newList = [...formData.spbUpdates];
                                      newList[updateIdx].usages[useIdx].photoUrl = base64;
                                      setFormData({ ...formData, spbUpdates: newList });
                                    })} 
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] text-neutral-500 uppercase font-bold">Remarks / Notes</label>
                          <textarea 
                            placeholder="Add specific notes for this usage event..."
                            value={use.remarks} 
                            onChange={(e) => { 
                              const newList = [...formData.spbUpdates]; 
                              newList[updateIdx].usages[useIdx].remarks = e.target.value; 
                              setFormData({ ...formData, spbUpdates: newList }); 
                            }} 
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white min-h-[60px]" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLogisticsFields = () => {
    return (
      <div className="col-span-full space-y-6">
        <CollapsibleSection 
          title="Update SPB Request" 
          icon={Truck} 
          isOpen={openSections['Logistics_SPB_Update']} 
          onToggle={() => toggleSection('Logistics_SPB_Update')}
        >
          {renderUpdateSPBSection()}
        </CollapsibleSection>

        <CollapsibleSection 
          title="Fuel Management" 
          icon={Fuel} 
          isOpen={openSections['Logistics_Fuel']} 
          onToggle={() => toggleSection('Logistics_Fuel')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Fuel In (Receipts)</h4>
                  <p className="text-[9px] text-neutral-500">Record incoming fuel from suppliers</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, fuelIn: [...(formData.fuelIn || []), { date: new Date().toISOString().split('T')[0], volume: 0, source: '', photoUrl: '' }] })}
                  className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20"
                >
                  <Plus className="w-3 h-3" />
                  ADD FUEL IN
                </button>
              </div>
              <div className="space-y-3">
                {formData.fuelIn?.map((f: any, i: number) => (
                  <div key={i} className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-3 relative group">
                    <button 
                      type="button"
                      onClick={() => {
                        const newList = [...formData.fuelIn];
                        newList.splice(i, 1);
                        setFormData({ ...formData, fuelIn: newList });
                      }}
                      className="absolute top-2 right-2 p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] text-neutral-500 uppercase">Volume (L)</label>
                        <input type="number" value={f.volume || 0} onChange={(e) => { const newList = [...formData.fuelIn]; newList[i].volume = parseFloat(e.target.value) || 0; setFormData({ ...formData, fuelIn: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-neutral-500 uppercase">Source / Supplier</label>
                        <input value={f.source || ''} onChange={(e) => { const newList = [...formData.fuelIn]; newList[i].source = e.target.value; setFormData({ ...formData, fuelIn: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Fuel Out (Usage)</h4>
                  <p className="text-[9px] text-neutral-500">Record fuel consumption for vehicles/equipment</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, fuelOut: [...(formData.fuelOut || []), { date: new Date().toISOString().split('T')[0], vehicleName: '', volume: 0, driverName: '', photoUrl: '' }] })}
                  className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20"
                >
                  <Plus className="w-3 h-3" />
                  ADD FUEL OUT
                </button>
              </div>
              <div className="space-y-3">
                {formData.fuelOut?.map((f: any, i: number) => (
                  <div key={i} className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-3 relative group">
                    <button 
                      type="button"
                      onClick={() => {
                        const newList = [...formData.fuelOut];
                        newList.splice(i, 1);
                        setFormData({ ...formData, fuelOut: newList });
                      }}
                      className="absolute top-2 right-2 p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] text-neutral-500 uppercase">Vehicle / Equipment</label>
                        <input value={f.vehicleName || ''} onChange={(e) => { const newList = [...formData.fuelOut]; newList[i].vehicleName = e.target.value; setFormData({ ...formData, fuelOut: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-neutral-500 uppercase">Volume (L)</label>
                        <input type="number" value={f.volume || 0} onChange={(e) => { const newList = [...formData.fuelOut]; newList[i].volume = parseFloat(e.target.value) || 0; setFormData({ ...formData, fuelOut: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-neutral-500 uppercase">Driver Name</label>
                      <input value={f.driverName || ''} onChange={(e) => { const newList = [...formData.fuelOut]; newList[i].driverName = e.target.value; setFormData({ ...formData, fuelOut: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    );
  };

  const renderQCFields = () => {
    return (
      <div className="col-span-full space-y-6">
        <CollapsibleSection 
          title="Inspections & RFI Management" 
          icon={ClipboardCheck} 
          isOpen={openSections['QC_Inspections']} 
          onToggle={() => toggleSection('QC_Inspections')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Record daily inspection activities & RFI tracking</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-[9px] text-neutral-400 uppercase">Pass</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-[9px] text-neutral-400 uppercase">Fail</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <span className="text-[9px] text-neutral-400 uppercase">Pending</span>
                </div>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => {
                const newInsp = { 
                  item: '', 
                  discipline: 'Civil',
                  rfiNumber: '',
                  inspectionType: 'Initial',
                  area: '', 
                  status: 'Pending', 
                  photoUrl: '', 
                  remarks: '',
                  updatedAt: new Date().toISOString()
                };
                setFormData({ ...formData, inspections: [...(formData.inspections || []), newInsp] });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <Plus className="w-3 h-3" />
              ADD INSPECTION / RFI
            </button>
          </div>
          <div className="space-y-4">
            {formData.inspections?.map((insp: any, idx: number) => (
              <div key={idx} className="p-6 bg-neutral-900 border border-neutral-700 rounded-2xl relative group space-y-6">
                <button 
                  type="button"
                  onClick={() => {
                    const newList = [...formData.inspections];
                    newList.splice(idx, 1);
                    setFormData({ ...formData, inspections: newList });
                  }}
                  className="absolute top-4 right-4 p-1.5 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Discipline</label>
                    <select 
                      value={insp.discipline} 
                      onChange={(e) => { 
                        const newList = [...formData.inspections]; 
                        newList[idx].discipline = e.target.value; 
                        setFormData({ ...formData, inspections: newList }); 
                      }} 
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="Civil">Civil</option>
                      <option value="Structure">Structure</option>
                      <option value="Architectural">Architectural</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Piping">Piping</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Instrument">Instrument</option>
                      <option value="Telecommunication">Telecommunication</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">RFI Number</label>
                    <input 
                      value={insp.rfiNumber} 
                      onChange={(e) => { 
                        const newList = [...formData.inspections]; 
                        newList[idx].rfiNumber = e.target.value; 
                        setFormData({ ...formData, inspections: newList }); 
                      }} 
                      placeholder="e.g. RFI-CIV-001"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Inspection Type</label>
                    <select 
                      value={insp.inspectionType} 
                      onChange={(e) => { 
                        const newList = [...formData.inspections]; 
                        newList[idx].inspectionType = e.target.value; 
                        setFormData({ ...formData, inspections: newList }); 
                      }} 
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="Initial">Initial Inspection</option>
                      <option value="Re-inspection">Re-inspection</option>
                      <option value="Final">Final Inspection</option>
                      <option value="Material">Material Inspection</option>
                      <option value="Witness">Witness Test</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Area / Location</label>
                    <input 
                      value={insp.area} 
                      onChange={(e) => { 
                        const newList = [...formData.inspections]; 
                        newList[idx].area = e.target.value; 
                        setFormData({ ...formData, inspections: newList }); 
                      }} 
                      placeholder="e.g. Zone A, Level 2"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Inspection Item / Description</label>
                    <input 
                      value={insp.item} 
                      onChange={(e) => { 
                        const newList = [...formData.inspections]; 
                        newList[idx].item = e.target.value; 
                        setFormData({ ...formData, inspections: newList }); 
                      }} 
                      placeholder="Describe the work being inspected"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Status</label>
                    <div className="flex gap-2">
                      <select 
                        value={insp.status} 
                        onChange={(e) => { 
                          const newList = [...formData.inspections]; 
                          newList[idx].status = e.target.value; 
                          newList[idx].updatedAt = new Date().toISOString();
                          setFormData({ ...formData, inspections: newList }); 
                        }} 
                        className={`flex-1 border rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all ${
                          insp.status === 'Pass' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          insp.status === 'Fail' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                          'bg-orange-500/10 border-orange-500/20 text-orange-500'
                        }`}
                      >
                        <option value="Pass">PASS</option>
                        <option value="Fail">FAIL</option>
                        <option value="Pending">PENDING</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Remarks / RFI Update</label>
                  <textarea 
                    value={insp.remarks} 
                    onChange={(e) => { 
                      const newList = [...formData.inspections]; 
                      newList[idx].remarks = e.target.value; 
                      setFormData({ ...formData, inspections: newList }); 
                    }} 
                    placeholder="Enter inspection findings or RFI status updates..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white h-20 resize-none focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group/upload">
                      <div className="p-2 bg-neutral-800 rounded-lg group-hover/upload:bg-neutral-700 transition-all">
                        <Plus className="w-3 h-3 text-neutral-400" />
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase font-bold group-hover/upload:text-neutral-300">Upload Evidence</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (base64) => {
                          const newList = [...formData.inspections];
                          newList[idx].photoUrl = base64;
                          setFormData({ ...formData, inspections: newList });
                        })}
                        className="hidden"
                      />
                    </label>
                    {insp.photoUrl && (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-700">
                        <img src={insp.photoUrl} alt="Evidence" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => {
                            const newList = [...formData.inspections];
                            newList[idx].photoUrl = '';
                            setFormData({ ...formData, inspections: newList });
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-all"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-neutral-600 font-mono uppercase">
                    Last Updated: {insp.updatedAt ? new Date(insp.updatedAt).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="NCR Reports" 
          icon={AlertCircle} 
          isOpen={openSections['QC_NCR']} 
          onToggle={() => toggleSection('QC_NCR')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Manage non-conformity issues</p>
            <button 
              type="button"
              onClick={() => {
                const newNcr = { ncrNo: '', description: '', rootCause: '', correctiveAction: '', status: 'Open' };
                setFormData({ ...formData, nonConformity: [...(formData.nonConformity || []), newNcr] });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <Plus className="w-3 h-3" />
              ADD NCR
            </button>
          </div>
          <div className="space-y-4">
            {formData.nonConformity?.map((ncr: any, idx: number) => (
              <div key={idx} className="p-4 bg-neutral-900 border border-neutral-700 rounded-xl relative group space-y-4">
                <button 
                  type="button"
                  onClick={() => {
                    const newList = [...formData.nonConformity];
                    newList.splice(idx, 1);
                    setFormData({ ...formData, nonConformity: newList });
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">NCR No</label>
                    <input value={ncr.ncrNo || ''} onChange={(e) => { const newList = [...formData.nonConformity]; newList[idx].ncrNo = e.target.value; setFormData({ ...formData, nonConformity: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Status</label>
                    <select value={ncr.status || 'Open'} onChange={(e) => { const newList = [...formData.nonConformity]; newList[idx].status = e.target.value; setFormData({ ...formData, nonConformity: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Description</label>
                  <textarea value={ncr.description} onChange={(e) => { const newList = [...formData.nonConformity]; newList[idx].description = e.target.value; setFormData({ ...formData, nonConformity: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-16 resize-none" />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Test Results" 
          icon={FileText} 
          isOpen={openSections['QC_Tests']} 
          onToggle={() => toggleSection('QC_Tests')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Record material or field test results</p>
            <button 
              type="button"
              onClick={() => {
                const newTest = { testName: '', result: '', unit: '', standard: '', status: 'Pass' };
                setFormData({ ...formData, testResults: [...(formData.testResults || []), newTest] });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <Plus className="w-3 h-3" />
              ADD TEST
            </button>
          </div>
          <div className="space-y-4">
            {formData.testResults?.map((test: any, idx: number) => (
              <div key={idx} className="p-4 bg-neutral-900 border border-neutral-700 rounded-xl relative group grid grid-cols-1 md:grid-cols-4 gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    const newList = [...formData.testResults];
                    newList.splice(idx, 1);
                    setFormData({ ...formData, testResults: newList });
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Test Name</label>
                  <input value={test.testName || ''} onChange={(e) => { const newList = [...formData.testResults]; newList[idx].testName = e.target.value; setFormData({ ...formData, testResults: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Result</label>
                  <input value={test.result || ''} onChange={(e) => { const newList = [...formData.testResults]; newList[idx].result = e.target.value; setFormData({ ...formData, testResults: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Standard</label>
                  <input value={test.standard || ''} onChange={(e) => { const newList = [...formData.testResults]; newList[idx].standard = e.target.value; setFormData({ ...formData, testResults: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Status</label>
                  <select value={test.status || 'Pass'} onChange={(e) => { const newList = [...formData.testResults]; newList[idx].status = e.target.value; setFormData({ ...formData, testResults: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Punch List" 
          icon={ClipboardCheck} 
          isOpen={openSections['QC_PunchList']} 
          onToggle={() => toggleSection('QC_PunchList')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Track outstanding items for completion</p>
            <button 
              type="button"
              onClick={() => {
                const newPunch = { item: '', area: '', priority: 'Medium', status: 'Open' };
                setFormData({ ...formData, punchList: [...(formData.punchList || []), newPunch] });
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <Plus className="w-3 h-3" />
              ADD PUNCH ITEM
            </button>
          </div>
          <div className="space-y-4">
            {formData.punchList?.map((punch: any, idx: number) => (
              <div key={idx} className="p-4 bg-neutral-900 border border-neutral-700 rounded-xl relative group grid grid-cols-1 md:grid-cols-4 gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    const newList = [...formData.punchList];
                    newList.splice(idx, 1);
                    setFormData({ ...formData, punchList: newList });
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] text-neutral-500 uppercase">Item Description</label>
                  <input value={punch.item || ''} onChange={(e) => { const newList = [...formData.punchList]; newList[idx].item = e.target.value; setFormData({ ...formData, punchList: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Area / Location</label>
                  <input value={punch.area || ''} onChange={(e) => { const newList = [...formData.punchList]; newList[idx].area = e.target.value; setFormData({ ...formData, punchList: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Priority</label>
                  <select value={punch.priority || 'Medium'} onChange={(e) => { const newList = [...formData.punchList]; newList[idx].priority = e.target.value; setFormData({ ...formData, punchList: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Status</label>
                  <select value={punch.status} onChange={(e) => { const newList = [...formData.punchList]; newList[idx].status = e.target.value; setFormData({ ...formData, punchList: newList }); }} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    );
  };

  const renderFields = () => {
    if (discipline === 'Logistics') {
      return renderLogisticsFields();
    }

    if (discipline === 'QC') {
      return renderQCFields();
    }

    if (discipline === 'HSE') {
      return (
        <div className="col-span-full space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Permit Management</h3>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, permits: [...(formData.permits || []), { number: '', status: 'Open' }] })}
                  className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-4">
                {formData.permits?.map((permit: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-2 gap-4 relative group">
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Permit No</label>
                      <input 
                        value={permit.number}
                        onChange={(e) => {
                          const newList = [...formData.permits];
                          newList[idx].number = e.target.value;
                          setFormData({ ...formData, permits: newList });
                        }}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder="Permit number"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Status</label>
                      <div className="flex gap-2">
                        <select 
                          value={permit.status || 'Open'}
                          onChange={(e) => {
                            const newList = [...formData.permits];
                            newList[idx].status = e.target.value;
                            setFormData({ ...formData, permits: newList });
                          }}
                          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="Open">Open</option>
                          <option value="Close">Close</option>
                        </select>
                        {formData.permits.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newList = [...formData.permits];
                              newList.splice(idx, 1);
                              setFormData({ ...formData, permits: newList });
                            }}
                            className="p-2 text-neutral-600 hover:text-red-400 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Manhours Calculation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Assumed Working Hours</label>
                  <input 
                    type="number" 
                    value={formData.manhours?.assumedWorkingHours || 8} 
                    onChange={(e) => setFormData({ ...formData, manhours: { ...formData.manhours, assumedWorkingHours: parseFloat(e.target.value) || 0 } })} 
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Overtime</label>
                  <input type="number" value={formData.manhours?.overtime || 0} onChange={(e) => setFormData({ ...formData, manhours: { ...formData.manhours, overtime: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Direct (Calculated)</label>
                  <input type="number" value={formData.manhours?.direct || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Indirect (Calculated)</label>
                  <input type="number" value={formData.manhours?.indirect || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Total Man-hours</label>
                  <input type="number" value={formData.manhours?.total || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Total Man-day</label>
                  <input type="number" value={formData.manhours?.totalManDay || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Avg Men / Month</label>
                  <input type="number" value={formData.manhours?.avgMenPerMonth || 0} onChange={(e) => setFormData({ ...formData, manhours: { ...formData.manhours, avgMenPerMonth: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
              <button 
                type="button"
                onClick={calculateManhours}
                className="w-full py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                {loading ? 'CALCULATING...' : 'AUTO CALCULATE MANHOURS'}
              </button>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Safety Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">No. of Injury</label>
                  <input type="number" value={formData.safetyStats?.noOfInjury || 0} onChange={(e) => setFormData({ ...formData, safetyStats: { ...formData.safetyStats, noOfInjury: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Days Charged</label>
                  <input type="number" value={formData.safetyStats?.daysCharged || 0} onChange={(e) => setFormData({ ...formData, safetyStats: { ...formData.safetyStats, daysCharged: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Frequency Rate</label>
                  <input type="number" value={formData.safetyStats?.frequencyRate || 0} onChange={(e) => setFormData({ ...formData, safetyStats: { ...formData.safetyStats, frequencyRate: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Severity Rate</label>
                  <input type="number" value={formData.safetyStats?.severityRate || 0} onChange={(e) => setFormData({ ...formData, safetyStats: { ...formData.safetyStats, severityRate: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Incident Types</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Falling from height</label>
                  <input type="number" value={formData.incidentTypes?.fallingFromHeight || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, fallingFromHeight: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Falling objects</label>
                  <input type="number" value={formData.incidentTypes?.fallingObjects || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, fallingObjects: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Hit by object</label>
                  <input type="number" value={formData.incidentTypes?.hitByObject || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, hitByObject: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Collapse of stack</label>
                  <input type="number" value={formData.incidentTypes?.collapseOfStack || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, collapseOfStack: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Electrical hazards</label>
                  <input type="number" value={formData.incidentTypes?.electricalHazards || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, electricalHazards: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Other incidents</label>
                  <input type="number" value={formData.incidentTypes?.otherIncidents || 0} onChange={(e) => setFormData({ ...formData, incidentTypes: { ...formData.incidentTypes, otherIncidents: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Compliance Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">MOM Summons</label>
                  <input type="number" value={formData.complianceStats?.momSummons || 0} onChange={(e) => setFormData({ ...formData, complianceStats: { ...formData.complianceStats, momSummons: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">MOM Non-Compliance</label>
                  <input type="number" value={formData.complianceStats?.momNonCompliance || 0} onChange={(e) => setFormData({ ...formData, complianceStats: { ...formData.complianceStats, momNonCompliance: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Demerit Points</label>
                  <input type="number" value={formData.complianceStats?.demeritPoints || 0} onChange={(e) => setFormData({ ...formData, complianceStats: { ...formData.complianceStats, demeritPoints: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">MOM Warning Letter</label>
                  <input type="number" value={formData.complianceStats?.momWarningLetter || 0} onChange={(e) => setFormData({ ...formData, complianceStats: { ...formData.complianceStats, momWarningLetter: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">MOM Stop Work Order (Verbal)</label>
                  <input type="number" value={formData.complianceStats?.momStopWorkOrderVerbal || 0} onChange={(e) => setFormData({ ...formData, complianceStats: { ...formData.complianceStats, momStopWorkOrderVerbal: parseFloat(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>

            <div className="col-span-full space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Safety Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[
                  { label: 'Safety Induction', key: 'safetyInduction' },
                  { label: 'Toolbox Meeting', key: 'toolboxMeeting' },
                  { label: 'Safety Patrol', key: 'safetyPatrol' },
                  { label: 'Safety Meeting', key: 'safetyMeeting' },
                  { label: 'Unsafe Action', key: 'unsafeAction' },
                  { label: 'Unsafe Condition', key: 'unsafeCondition' },
                  { label: 'Near Miss', key: 'nearMiss' },
                  { label: 'Accident', key: 'accident' },
                  { label: 'P3K', key: 'p3k' },
                  { label: 'APD', key: 'apd' },
                  { label: 'Rambu', key: 'rambu' },
                  { label: 'Others', key: 'others' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-neutral-500 uppercase">{item.label}</label>
                      <button 
                        type="button"
                        onClick={() => setEditingMetric(item.key)}
                        className="text-[8px] text-emerald-500 hover:text-emerald-400 uppercase font-bold"
                      >
                        Details
                      </button>
                    </div>
                    <input 
                      type="number" 
                      value={formData[item.key]?.entries?.length || 0} 
                      readOnly
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-full space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Weather Condition (24 Hours)</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {formData.weatherConditions?.map((wc: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-[8px] text-neutral-600 uppercase block text-center">{wc.time}</label>
                    <select 
                      value={wc.condition || 'Sunny'}
                      onChange={(e) => {
                        const newList = [...formData.weatherConditions];
                        newList[idx].condition = e.target.value;
                        setFormData({ ...formData, weatherConditions: newList });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-[9px] text-white"
                    >
                      <option value="Sunny">Sunny</option>
                      <option value="Cloudy">Cloudy</option>
                      <option value="Rainy">Rainy</option>
                      <option value="Drizzle">Drizzle</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Stop Work Order</h3>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, stopWorkOrders: [...(formData.stopWorkOrders || []), { type: 'Verbal', number: '', cause: '', impact: '' }] })}
                  className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-6">
                {formData.stopWorkOrders?.map((swo: any, idx: number) => (
                  <div key={idx} className="space-y-3 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800 relative group">
                    {formData.stopWorkOrders.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => {
                          const newList = [...formData.stopWorkOrders];
                          newList.splice(idx, 1);
                          setFormData({ ...formData, stopWorkOrders: newList });
                        }}
                        className="absolute top-2 right-2 p-1.5 text-neutral-600 hover:text-red-400 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Type</label>
                        <select 
                          value={swo.type || 'Verbal'} 
                          onChange={(e) => {
                            const newList = [...formData.stopWorkOrders];
                            newList[idx].type = e.target.value;
                            setFormData({ ...formData, stopWorkOrders: newList });
                          }} 
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="Verbal">Verbal</option>
                          <option value="Non-Verbal">Non-Verbal</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Number</label>
                        <input 
                          value={swo.number || ''} 
                          onChange={(e) => {
                            const newList = [...formData.stopWorkOrders];
                            newList[idx].number = e.target.value;
                            setFormData({ ...formData, stopWorkOrders: newList });
                          }} 
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Cause</label>
                      <textarea 
                        value={swo.cause || ''} 
                        onChange={(e) => {
                          const newList = [...formData.stopWorkOrders];
                          newList[idx].cause = e.target.value;
                          setFormData({ ...formData, stopWorkOrders: newList });
                        }} 
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-16 resize-none" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Impact (Discipline)</label>
                      <select 
                        value={swo.impact || ''} 
                        onChange={(e) => {
                          const newList = [...formData.stopWorkOrders];
                          newList[idx].impact = e.target.value;
                          setFormData({ ...formData, stopWorkOrders: newList });
                        }} 
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="">Select Impact</option>
                        <option value="Sipil">Sipil</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Piping">Piping</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Fire Safety">Fire Safety</option>
                        <option value="Instrument">Instrument</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Health Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Direct Sick</label>
                  <input type="number" value={formData.healthStatus?.directSick || 0} onChange={(e) => setFormData({ ...formData, healthStatus: { ...formData.healthStatus, directSick: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Direct Healthy (Auto)</label>
                  <input type="number" value={formData.healthStatus?.directHealthy || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Indirect Sick</label>
                  <input type="number" value={formData.healthStatus?.indirectSick || 0} onChange={(e) => setFormData({ ...formData, healthStatus: { ...formData.healthStatus, indirectSick: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Indirect Healthy (Auto)</label>
                  <input type="number" value={formData.healthStatus?.indirectHealthy || 0} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400" />
                </div>
              </div>
            </div>

            {/* Safety Metrics Detail Modal */}
            <AnimatePresence>
              {editingMetric && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                  >
                    <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
                      <div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                          {editingMetric.replace(/([A-Z])/g, ' $1').trim()} Details
                        </h3>
                        <p className="text-xs text-neutral-500">Manage multiple entries for this safety metric.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          type="button"
                          onClick={() => {
                            const currentEntries = formData[editingMetric]?.entries || [];
                            setFormData({
                              ...formData,
                              [editingMetric]: {
                                ...formData[editingMetric],
                                entries: [...currentEntries, { 
                                  manpowerId: '', 
                                  manpowerName: '', 
                                  position: '',
                                  classification: '',
                                  description: '', 
                                  photos: [], 
                                  files: [] 
                                }]
                              }
                            });
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <Plus className="w-3 h-3" />
                          Add Entry
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingMetric(null);
                            setMetricSearchQuery('');
                          }}
                          className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
                        >
                          <X className="w-6 h-6 text-neutral-400" />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                      {(formData[editingMetric]?.entries || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-4">
                          <Shield className="w-12 h-12 opacity-20" />
                          <p className="text-sm font-mono uppercase tracking-widest">No entries yet</p>
                          <button 
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                [editingMetric]: {
                                  ...formData[editingMetric],
                                  entries: [{ 
                                    manpowerId: '', 
                                    manpowerName: '', 
                                    position: '',
                                    classification: '',
                                    description: '', 
                                    photos: [], 
                                    files: [] 
                                  }]
                                }
                              });
                            }}
                            className="text-xs text-emerald-500 hover:underline"
                          >
                            Click here to add the first entry
                          </button>
                        </div>
                      ) : (
                        (formData[editingMetric].entries).map((entry: any, entryIdx: number) => (
                          <div key={entryIdx} className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 space-y-6 relative group/entry">
                            <button 
                              type="button"
                              onClick={() => {
                                const newEntries = [...formData[editingMetric].entries];
                                newEntries.splice(entryIdx, 1);
                                setFormData({ ...formData, [editingMetric]: { ...formData[editingMetric], entries: newEntries } });
                              }}
                              className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 rounded-lg opacity-40 group-hover/entry:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                              title="Remove Entry"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Manpower Search */}
                              <div className="space-y-2 relative">
                                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Manpower (ID or Name)</label>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                  <input 
                                    type="text" 
                                    placeholder="Search manpower..."
                                    value={entry.manpowerName ? `${entry.manpowerName} (${entry.manpowerId})` : metricSearchQuery}
                                    onChange={(e) => {
                                      if (entry.manpowerId) {
                                        // Clear selection if user starts typing
                                        const newEntries = [...formData[editingMetric].entries];
                                        newEntries[entryIdx].manpowerId = '';
                                        newEntries[entryIdx].manpowerName = '';
                                        setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                      }
                                      setMetricSearchQuery(e.target.value);
                                    }}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:border-emerald-500 transition-all outline-none"
                                  />
                                  {entry.manpowerId && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const newEntries = [...formData[editingMetric].entries];
                                        newEntries[entryIdx].manpowerId = '';
                                        newEntries[entryIdx].manpowerName = '';
                                        setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                        setMetricSearchQuery('');
                                      }}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-800 rounded-full"
                                    >
                                      <X className="w-3 h-3 text-neutral-500" />
                                    </button>
                                  )}
                                </div>
                                
                                {/* Search Results Dropdown */}
                                {!entry.manpowerId && metricSearchQuery.length >= 2 && (
                                  <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
                                    {allManpower
                                      .filter(m => 
                                        m.name.toLowerCase().includes(metricSearchQuery.toLowerCase()) || 
                                        m.manpowerId.toLowerCase().includes(metricSearchQuery.toLowerCase())
                                      )
                                      .slice(0, 5)
                                      .map((m) => (
                                        <button
                                          key={m.manpowerId}
                                          type="button"
                                          onClick={() => {
                                            const newEntries = [...formData[editingMetric].entries];
                                            newEntries[entryIdx].manpowerId = m.manpowerId;
                                            newEntries[entryIdx].manpowerName = m.name;
                                            newEntries[entryIdx].position = m.position;
                                            newEntries[entryIdx].classification = m.classification;
                                            setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                            setMetricSearchQuery('');
                                          }}
                                          className="w-full px-4 py-3 text-left hover:bg-neutral-800 flex items-center justify-between border-b border-neutral-800 last:border-0"
                                        >
                                          <div className="flex flex-col">
                                            <span className="text-xs text-white font-bold">{m.name}</span>
                                            <span className="text-[10px] text-neutral-500">{m.manpowerId} - {m.position} ({m.classification})</span>
                                          </div>
                                          <Plus className="w-3 h-3 text-emerald-500" />
                                        </button>
                                      ))}
                                    {allManpower.filter(m => 
                                      m.name.toLowerCase().includes(metricSearchQuery.toLowerCase()) || 
                                      m.manpowerId.toLowerCase().includes(metricSearchQuery.toLowerCase())
                                    ).length === 0 && (
                                      <div className="px-4 py-3 text-xs text-neutral-500 text-center">No manpower found</div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Position & Classification (Auto-filled) */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Position</label>
                                  <input 
                                    type="text" 
                                    readOnly 
                                    value={entry.position || ''} 
                                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-500 cursor-not-allowed" 
                                    placeholder="Position..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Classification</label>
                                  <input 
                                    type="text" 
                                    readOnly 
                                    value={entry.classification || ''} 
                                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-500 cursor-not-allowed" 
                                    placeholder="Classification..."
                                  />
                                </div>
                              </div>

                              {/* Description */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Description</label>
                                <textarea 
                                  value={entry.description || ''} 
                                  onChange={(e) => {
                                    const newEntries = [...formData[editingMetric].entries];
                                    newEntries[entryIdx].description = e.target.value;
                                    setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                  }} 
                                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[45px] resize-none" 
                                  placeholder="Enter details..."
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Photos */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Photos</label>
                                  <div className="relative">
                                    <button type="button" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-500/20 transition-all">
                                      <Camera className="w-3 h-3" />
                                      Add Photo
                                    </button>
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      multiple
                                      onChange={async (e) => {
                                        const files = Array.from(e.target.files || []);
                                        const newPhotos: string[] = [];
                                        for (const file of files) {
                                          const base64 = await compressImage(file, 800, 800, 0.6);
                                          newPhotos.push(base64);
                                        }
                                        const newEntries = [...formData[editingMetric].entries];
                                        newEntries[entryIdx].photos = [...(newEntries[entryIdx].photos || []), ...newPhotos];
                                        setFormData({ 
                                          ...formData, 
                                          [editingMetric]: { 
                                            ...formData[editingMetric], 
                                            entries: newEntries 
                                          } 
                                        });
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer" 
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {(entry.photos || []).map((photo: string, photoIdx: number) => (
                                    <div key={photoIdx} className="relative aspect-square rounded-lg overflow-hidden group/photo">
                                      <img src={photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newEntries = [...formData[editingMetric].entries];
                                          newEntries[entryIdx].photos.splice(photoIdx, 1);
                                          setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                        }}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Files */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Files</label>
                                  <div className="relative">
                                    <button type="button" className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-500/20 transition-all">
                                      <Plus className="w-3 h-3" />
                                      Upload
                                    </button>
                                    <input 
                                      type="file" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const base64 = event.target?.result as string;
                                            const newEntries = [...formData[editingMetric].entries];
                                            newEntries[entryIdx].files = [...(newEntries[entryIdx].files || []), { name: file.name, data: base64 }];
                                            setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer" 
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {(entry.files || []).map((file: any, fileIdx: number) => (
                                    <div key={fileIdx} className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                                      <div className="flex items-center gap-2 truncate">
                                        <FileText className="w-3 h-3 text-neutral-500" />
                                        <span className="text-[10px] text-neutral-300 truncate">{file.name}</span>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newEntries = [...formData[editingMetric].entries];
                                          newEntries[entryIdx].files.splice(fileIdx, 1);
                                          setFormData({ ...formData, [editingMetric]: { entries: newEntries } });
                                        }}
                                        className="p-1 text-neutral-500 hover:text-red-500 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingMetric(null);
                          setMetricSearchQuery('');
                        }}
                        className="px-8 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      );
    }

    if (discipline === 'Engineering') {
      return (
        <div className="col-span-full space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Shop Drawings</label>
              <textarea
                value={formData.shopDrawings?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, shopDrawings: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter shop drawing status (one per line)..."
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">RFIs (Technical Queries)</label>
              <textarea
                value={formData.rfis?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, rfis: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter RFI status (one per line)..."
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Material Submittals</label>
              <textarea
                value={formData.materialSubmittals?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, materialSubmittals: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter material submittal status (one per line)..."
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Method Statements</label>
              <textarea
                value={formData.methodStatements?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, methodStatements: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter method statement status (one per line)..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Engineering Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter any additional engineering notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'campbos') {
      return (
        <div className="col-span-full space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Camp Occupancy
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Direct Manpower</label>
                  <input type="number" value={formData.occupancy?.direct || 0} onChange={(e) => setFormData({ ...formData, occupancy: { ...formData.occupancy, direct: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Indirect Manpower</label>
                  <input type="number" value={formData.occupancy?.indirect || 0} onChange={(e) => setFormData({ ...formData, occupancy: { ...formData.occupancy, indirect: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Total Occupancy</label>
                  <input type="number" value={(formData.occupancy?.direct || 0) + (formData.occupancy?.indirect || 0)} readOnly className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Total Capacity</label>
                  <input type="number" value={formData.occupancy?.capacity || 0} onChange={(e) => setFormData({ ...formData, occupancy: { ...formData.occupancy, capacity: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                Meal Counts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Breakfast</label>
                  <input type="number" value={formData.mealCounts?.breakfast || 0} onChange={(e) => setFormData({ ...formData, mealCounts: { ...formData.mealCounts, breakfast: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Lunch</label>
                  <input type="number" value={formData.mealCounts?.lunch || 0} onChange={(e) => setFormData({ ...formData, mealCounts: { ...formData.mealCounts, lunch: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Dinner</label>
                  <input type="number" value={formData.mealCounts?.dinner || 0} onChange={(e) => setFormData({ ...formData, mealCounts: { ...formData.mealCounts, dinner: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-neutral-500 uppercase">Supper</label>
                  <input type="number" value={formData.mealCounts?.supper || 0} onChange={(e) => setFormData({ ...formData, mealCounts: { ...formData.mealCounts, supper: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Facility Issues & Maintenance</label>
            <textarea
              value={formData.facilityIssues?.join('\n') || ''}
              onChange={(e) => setFormData({ ...formData, facilityIssues: e.target.value.split('\n') })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter facility issues (one per line)..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Camp Boss Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter any additional camp notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'Permit Officer') {
      return (
        <div className="col-span-full space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Permits Issued (PTW)</label>
              <textarea
                value={formData.permitsIssued?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, permitsIssued: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter permit numbers and types (one per line)..."
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Permit Violations</label>
              <textarea
                value={formData.permitViolations?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, permitViolations: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter any permit violations observed..."
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Daily Permit Log Summary</label>
            <textarea
              value={formData.dailyPermitLog?.join('\n') || ''}
              onChange={(e) => setFormData({ ...formData, dailyPermitLog: e.target.value.split('\n') })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[150px]"
              placeholder="Enter daily permit log summary..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Permit Officer Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter any additional permit notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'Paramedic') {
      return (
        <div className="col-span-full space-y-10">
          <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Daily Health Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 uppercase">Total Checkups</label>
                <input type="number" value={formData.healthStats?.totalCheckups || 0} onChange={(e) => setFormData({ ...formData, healthStats: { ...formData.healthStats, totalCheckups: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 uppercase">Healthy Personnel</label>
                <input type="number" value={formData.healthStats?.healthy || 0} onChange={(e) => setFormData({ ...formData, healthStats: { ...formData.healthStats, healthy: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 uppercase">Sick Personnel</label>
                <input type="number" value={formData.healthStats?.sick || 0} onChange={(e) => setFormData({ ...formData, healthStats: { ...formData.healthStats, sick: parseInt(e.target.value) || 0 } })} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">First Aid Treatments</label>
              <textarea
                value={formData.firstAidTreatments?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, firstAidTreatments: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter first aid treatments (one per line)..."
              />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Sick Leave Records</label>
              <textarea
                value={formData.sickLeaveRecords?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, sickLeaveRecords: e.target.value.split('\n') })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                placeholder="Enter sick leave records (one per line)..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Medical Referrals</label>
            <textarea
              value={formData.referrals?.join('\n') || ''}
              onChange={(e) => setFormData({ ...formData, referrals: e.target.value.split('\n') })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-xs text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter medical referrals (one per line)..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Paramedic Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Enter any additional medical notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'HR') {
      const allColumns = [
        { id: 'manpowerId', label: 'Manpower ID' },
        { id: 'name', label: 'Name' },
        { id: 'email', label: 'Email' },
        { id: 'position', label: 'Position' },
        { id: 'classification', label: 'Classification' },
        { id: 'mcuStatus', label: 'MCU Status' },
        { id: 'mcuExpiry', label: 'MCU Expiry' },
        { id: 'siteStatus', label: 'Site Status' },
        { id: 'pointOfHire', label: 'Point of Hire' },
        { id: 'entryPermitStatus', label: 'Entry Permit Status' },
        { id: 'entryPermitExpiry', label: 'Entry Permit Expiry' },
        { id: 'activeStatus', label: 'Active Status' },
        { id: 'contractStart', label: 'Contract Start' },
        { id: 'contractEnd', label: 'Contract End' },
        { id: 'certificate', label: 'Certificate' },
        { id: 'leaveStart', label: 'Leave Start' },
        { id: 'leaveEnd', label: 'Leave End' },
      ];

      const toggleColumn = (colId: string) => {
        const current = formData.visibleColumns || [];
        const next = current.includes(colId)
          ? current.filter((c: string) => c !== colId)
          : [...current, colId];
        setFormData({ ...formData, visibleColumns: next });
      };

      return (
        <div className="col-span-full space-y-10">
          <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-500" />
              Column Visibility
            </h3>
            <div className="flex flex-wrap gap-2">
              {allColumns.map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleColumn(col.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    (formData.visibleColumns || []).includes(col.id)
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-neutral-900 text-neutral-600 border-neutral-800'
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Personnel Management</label>
                <p className="text-[10px] text-neutral-600 uppercase">Select action to manage report entries</p>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setHrEntryType(hrEntryType === 'update' ? null : 'update')}
                  className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold rounded-xl border transition-all ${
                    hrEntryType === 'update' 
                      ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/20' 
                      : 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  UPDATE EXISTING MANPOWER
                </button>
                <button 
                  type="button"
                  onClick={() => setHrEntryType(hrEntryType === 'add' ? null : 'add')}
                  className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold rounded-xl border transition-all ${
                    hrEntryType === 'add' 
                      ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20' 
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  ADD NEW MANPOWER
                </button>
              </div>
            </div>

            {hrEntryType === 'update' && (
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Search & Add Existing Personnel</h4>
                  <span className="text-[9px] text-neutral-500 uppercase">{allManpower.length} Total in Database</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input 
                    type="text"
                    placeholder="SEARCH BY NAME, ID, OR POSITION..."
                    value={hrSearchQuery}
                    onChange={(e) => setHrSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none"
                  />
                </div>
                {hrSearchQuery && (
                  <div className="max-h-60 overflow-y-auto border border-neutral-700 rounded-xl bg-neutral-900 divide-y divide-neutral-800 custom-scrollbar">
                    {allManpower
                      .filter(m => 
                        !formData.personnelList?.some((p: any) => p.manpowerId === m.manpowerId) &&
                        (m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()) || 
                         m.manpowerId.toLowerCase().includes(hrSearchQuery.toLowerCase()) ||
                         m.position.toLowerCase().includes(hrSearchQuery.toLowerCase()))
                      )
                      .map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const newPerson = {
                              ...m,
                              id: Math.random().toString(36).substr(2, 9),
                            };
                            setFormData({ ...formData, personnelList: [...(formData.personnelList || []), newPerson] });
                            setHrSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-left text-xs text-neutral-300 hover:bg-neutral-800 transition-colors flex justify-between items-center group"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{m.name}</span>
                            <span className="text-[10px] text-neutral-500 uppercase">{m.manpowerId} • {m.position}</span>
                          </div>
                          <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Plus className="w-3 h-3" />
                          </div>
                        </button>
                      ))
                    }
                    {allManpower.filter(m => 
                      !formData.personnelList?.some((p: any) => p.manpowerId === m.manpowerId) &&
                      (m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()) || 
                       m.manpowerId.toLowerCase().includes(hrSearchQuery.toLowerCase()) ||
                       m.position.toLowerCase().includes(hrSearchQuery.toLowerCase()))
                    ).length === 0 && (
                      <div className="p-8 text-center text-neutral-600 text-[10px] uppercase tracking-widest">
                        No matching personnel found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {hrEntryType === 'add' && (
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Create New Personnel Entry</h4>
                  <p className="text-[9px] text-neutral-500 uppercase">This will add a new person to the master database upon submission</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const newPerson = {
                      id: Math.random().toString(36).substr(2, 9),
                      manpowerId: '',
                      name: '',
                      email: '',
                      position: '',
                      mcuStatus: 'Fit',
                      mcuExpiry: '',
                      siteStatus: 'On Site',
                      pointOfHire: '',
                      entryPermitStatus: 'Active',
                      entryPermitExpiry: '',
                      classification: 'Direct',
                      photoUrl: '',
                      activeStatus: 'Active',
                      contractStart: '',
                      contractEnd: '',
                      certificate: '',
                      leaveStart: '',
                      leaveEnd: ''
                    };
                    setFormData({ ...formData, personnelList: [...(formData.personnelList || []), newPerson] });
                    setHrEntryType(null); // Close after adding
                  }}
                  className="w-full py-4 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-3"
                >
                  <Plus className="w-4 h-4" />
                  INITIALIZE BLANK PERSONNEL FORM
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            {formData.personnelList?.length === 0 ? (
              <div className="p-12 text-center bg-neutral-800/20 border border-dashed border-neutral-800 rounded-3xl">
                <Users className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                <p className="text-xs text-neutral-500 uppercase tracking-widest">No personnel added to today's report</p>
                <p className="text-[10px] text-neutral-600 mt-2">Use the buttons above to add or update manpower</p>
              </div>
            ) : (
              formData.personnelList?.map((person: any, index: number) => (
              <div key={person.id || index} className="p-6 bg-neutral-800/30 border border-neutral-700 rounded-3xl space-y-6 relative group">
                <button 
                  type="button"
                  onClick={() => {
                    const newList = [...formData.personnelList];
                    newList.splice(index, 1);
                    setFormData({ ...formData, personnelList: newList });
                  }}
                  className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-1">
                    <label className="text-[9px] text-neutral-500 uppercase block mb-1">Photo</label>
                    <div className="relative aspect-square bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden group/photo">
                      {person.photoUrl ? (
                        <img src={person.photoUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700">
                          <Plus className="w-6 h-6" />
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (base64) => {
                          const newList = [...formData.personnelList];
                          newList[index].photoUrl = base64;
                          setFormData({ ...formData, personnelList: newList });
                        })}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(formData.visibleColumns || []).includes('manpowerId') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Manpower ID</label>
                        <div className="relative">
                          <input 
                            list="manpower-list"
                            value={person.manpowerId || ''} 
                            onChange={(e) => handleManpowerSelect(index, e.target.value)} 
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            placeholder="ID-001" 
                          />
                          <datalist id="manpower-list">
                            {allManpower.map(m => (
                              <option key={m.id} value={m.manpowerId}>{m.name} - {m.position}</option>
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('name') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Name</label>
                        <input value={person.name || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].name = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('email') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Email</label>
                        <input 
                          type="email"
                          value={person.email || ''} 
                          onChange={(e) => { 
                            const newList = [...formData.personnelList]; 
                            newList[index].email = e.target.value; 
                            setFormData({ ...formData, personnelList: newList }); 
                          }} 
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                          placeholder="email@example.com"
                        />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('position') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Position</label>
                        <input value={person.position || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].position = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('classification') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Classification</label>
                        <select value={person.classification || 'Direct'} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].classification = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                          <option value="Direct">Direct</option>
                          <option value="Indirect">Indirect</option>
                        </select>
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('mcuStatus') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">MCU Status</label>
                        <input value={person.mcuStatus || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].mcuStatus = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('mcuExpiry') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">MCU Expiry</label>
                        <input type="date" value={person.mcuExpiry || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].mcuExpiry = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('siteStatus') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Site Status</label>
                        <select value={person.siteStatus || 'On Site'} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].siteStatus = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                          <option value="On Site">On Site</option>
                          <option value="Off Site">Off Site</option>
                        </select>
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('pointOfHire') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Point of Hire</label>
                        <input value={person.pointOfHire || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].pointOfHire = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('entryPermitStatus') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Entry Permit Status</label>
                        <input value={person.entryPermitStatus || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].entryPermitStatus = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('entryPermitExpiry') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Entry Permit Expiry</label>
                        <input type="date" value={person.entryPermitExpiry || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].entryPermitExpiry = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('activeStatus') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Active Status</label>
                        <select value={person.activeStatus || 'Active'} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].activeStatus = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                          <option value="Active">Active</option>
                          <option value="Resign">Resign</option>
                        </select>
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('contractStart') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Contract Start</label>
                        <input type="date" value={person.contractStart || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].contractStart = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('contractEnd') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Contract End</label>
                        <input type="date" value={person.contractEnd || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].contractEnd = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('certificate') && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[9px] text-neutral-500 uppercase">Certificate</label>
                        <input value={person.certificate || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].certificate = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" placeholder="e.g. SIO, Welder Cert" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('leaveStart') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Leave Start</label>
                        <input type="date" value={person.leaveStart || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].leaveStart = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                    {(formData.visibleColumns || []).includes('leaveEnd') && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Leave End</label>
                        <input type="date" value={person.leaveEnd || ''} onChange={(e) => { const newList = [...formData.personnelList]; newList[index].leaveEnd = e.target.value; setFormData({ ...formData, personnelList: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Additional Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none min-h-[100px] resize-none"
              placeholder="Enter any additional HR notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'Project Control') {
      const availableReports = [
        { 
          id: 'Logistics', 
          label: 'Logistics',
          subOptions: [
            { id: 'materialRequests', label: 'Material Requests' },
            { id: 'materialReceipts', label: 'Material Receipts' },
            { id: 'materialUsages', label: 'Material Usages' },
            { id: 'fuelIn', label: 'Fuel In' },
            { id: 'fuelOut', label: 'Fuel Out' },
            { id: 'fuelConsumption', label: 'Fuel Consumption' }
          ]
        },
        { 
          id: 'Supervisor', 
          label: 'Supervisor',
          subOptions: [
            { id: 'activities', label: 'Activities' },
            { id: 'manpower', label: 'Manpower' },
            { id: 'equipment', label: 'Equipment' }
          ]
        },
        { 
          id: 'HSE', 
          label: 'HSE',
          subOptions: [
            { id: 'permits', label: 'Permits' },
            { id: 'manhours', label: 'Manhours' },
            { id: 'weatherConditions', label: 'Weather' },
            { id: 'stopWorkOrders', label: 'Stop Work Orders' },
            { id: 'healthStatus', label: 'Health Status' }
          ]
        },
        { 
          id: 'QC', 
          label: 'QC',
          subOptions: [
            { id: 'inspections', label: 'Inspections' },
            { id: 'nonConformity', label: 'Non-Conformity' },
            { id: 'testResults', label: 'Test Results' },
            { id: 'punchList', label: 'Punch List' }
          ]
        },
        { 
          id: 'HR', 
          label: 'HR',
          subOptions: [
            { id: 'personnelList', label: 'Personnel List' }
          ]
        },
        { id: 'Procurement', label: 'Procurement' },
        { id: 'Document Control', label: 'Document Control' },
        { id: 'Mechanic & Electrical', label: 'Mechanic & Electrical' },
        { 
          id: 'Engineering', 
          label: 'Engineering',
          subOptions: [
            { id: 'shopDrawings', label: 'Shop Drawings' },
            { id: 'rfis', label: 'RFIs' },
            { id: 'materialSubmittals', label: 'Material Submittals' },
            { id: 'methodStatements', label: 'Method Statements' }
          ]
        },
        { 
          id: 'campbos', 
          label: 'Camp Boss',
          subOptions: [
            { id: 'occupancy', label: 'Occupancy' },
            { id: 'mealCounts', label: 'Meal Counts' },
            { id: 'facilityIssues', label: 'Facility Issues' }
          ]
        },
        { 
          id: 'Permit Officer', 
          label: 'Permit Officer',
          subOptions: [
            { id: 'permitsIssued', label: 'Permits Issued' },
            { id: 'permitViolations', label: 'Permit Violations' },
            { id: 'dailyPermitLog', label: 'Daily Permit Log' }
          ]
        },
        { 
          id: 'Paramedic', 
          label: 'Paramedic',
          subOptions: [
            { id: 'healthStats', label: 'Health Stats' },
            { id: 'firstAidTreatments', label: 'First Aid Treatments' },
            { id: 'sickLeaveRecords', label: 'Sick Leave Records' },
            { id: 'referrals', label: 'Referrals' }
          ]
        },
      ];

      const technicalOptions = [
        { id: 'General', label: 'General Project' },
        { id: 'Civil', label: 'Civil Work' },
        { id: 'Mechanical', label: 'Mechanical Work' },
        { id: 'Electrical', label: 'Electrical Work' },
        { id: 'Piping', label: 'Piping Work' },
        { id: 'Instrument', label: 'Instrument Work' },
      ];

      const toggleReport = (reportId: string) => {
        const current = formData.includedReports || [];
        const next = current.includes(reportId)
          ? current.filter((r: string) => r !== reportId)
          : [...current, reportId];
        
        // If removing report, also remove its sub-options
        const nextSubOptions = { ...(formData.reportSubOptions || {}) };
        if (current.includes(reportId)) {
          delete nextSubOptions[reportId];
        } else {
          // If adding, select all sub-options by default for convenience
          const report = availableReports.find(r => r.id === reportId);
          if (report?.subOptions) {
            nextSubOptions[reportId] = report.subOptions.map(s => s.id);
          }
        }

        setFormData({ 
          ...formData, 
          includedReports: next,
          reportSubOptions: nextSubOptions
        });
      };

      const toggleSubOption = (reportId: string, subOptionId: string) => {
        const current = formData.reportSubOptions || {};
        const reportOptions = current[reportId] || [];
        const nextOptions = reportOptions.includes(subOptionId)
          ? reportOptions.filter((o: string) => o !== subOptionId)
          : [...reportOptions, subOptionId];
        
        setFormData({
          ...formData,
          reportSubOptions: {
            ...current,
            [reportId]: nextOptions
          }
        });
      };

      const toggleTechnical = (techId: string) => {
        const current = formData.technicalDetails || [];
        const next = current.includes(techId)
          ? current.filter((t: string) => t !== techId)
          : [...current, techId];
        setFormData({ ...formData, technicalDetails: next });
      };

      const addSignature = () => {
        const current = formData.signatures || [];
        setFormData({ 
          ...formData, 
          signatures: [...current, { company: '', name: '', title: '' }] 
        });
      };

      const removeSignature = (index: number) => {
        const current = [...(formData.signatures || [])];
        current.splice(index, 1);
        setFormData({ ...formData, signatures: current });
      };

      const updateSignature = (index: number, field: string, value: string) => {
        const current = [...(formData.signatures || [])];
        current[index] = { ...current[index], [field]: value };
        setFormData({ ...formData, signatures: current });
      };

      const addOtherNote = () => {
        const current = formData.otherNotes || [];
        setFormData({ 
          ...formData, 
          otherNotes: [...current, { workItem: 'Civil', discipline: 'Mechanic & Electrical', note: '', status: 'Open' }] 
        });
      };

      const removeOtherNote = (index: number) => {
        const current = [...(formData.otherNotes || [])];
        current.splice(index, 1);
        setFormData({ ...formData, otherNotes: current });
      };

      const updateOtherNote = (index: number, field: string, value: string) => {
        const current = [...(formData.otherNotes || [])];
        current[index] = { ...current[index], [field]: value };
        setFormData({ ...formData, otherNotes: current });
      };

      const addRemarksDrawing = () => {
        const current = formData.remarksDrawings || [];
        setFormData({ 
          ...formData, 
          remarksDrawings: [...current, { workItem: '', area: '', remarks: '', photoUrl: '' }] 
        });
      };

      const removeRemarksDrawing = (index: number) => {
        const current = [...(formData.remarksDrawings || [])];
        current.splice(index, 1);
        setFormData({ ...formData, remarksDrawings: current });
      };

      const updateRemarksDrawing = (index: number, field: string, value: any) => {
        const current = [...(formData.remarksDrawings || [])];
        current[index] = { ...current[index], [field]: value };
        setFormData({ ...formData, remarksDrawings: current });
      };

      return (
        <div className="col-span-full space-y-6">
          <CollapsibleSection 
            title="General Progress" 
            icon={FileText} 
            isOpen={openSections['General']} 
            onToggle={() => toggleSection('General')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Today's Actual Progress</label>
                <textarea
                  value={formData.todaysActual || ''}
                  onChange={(e) => setFormData({ ...formData, todaysActual: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none min-h-[200px] resize-none"
                  placeholder="Describe today's actual achievements..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Tomorrow's Plan</label>
                <textarea
                  value={formData.tomorrowsPlan || ''}
                  onChange={(e) => setFormData({ ...formData, tomorrowsPlan: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none min-h-[200px] resize-none"
                  placeholder="Describe plans for tomorrow..."
                />
              </div>
              <div className="space-y-2 col-span-full">
                <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Report Color Style</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, colorStyle: 'Color' })}
                    className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs tracking-widest ${
                      formData.colorStyle === 'Color' 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:bg-neutral-800/80'
                    }`}
                  >
                    FULL COLOR
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, colorStyle: 'B&W' })}
                    className={`flex-1 py-3 rounded-xl border transition-all font-bold text-xs tracking-widest ${
                      formData.colorStyle === 'B&W' 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:bg-neutral-800/80'
                    }`}
                  >
                    BLACK & WHITE
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <CollapsibleSection 
              title="Consolidated Reports" 
              icon={ClipboardCheck} 
              isOpen={openSections['Consolidated']} 
              onToggle={() => toggleSection('Consolidated')}
            >
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-4">Select reports and specific details to include in the final project control output</p>
              <div className="space-y-4">
                {availableReports.map(report => {
                  const isIncluded = (formData.includedReports || []).includes(report.id);
                  const hasReport = submittedReports.some(r => r.discipline === report.id);
                  
                  return (
                    <div key={report.id} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleReport(report.id)}
                          className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center justify-between ${
                            isIncluded
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                              : 'bg-neutral-900 text-neutral-600 border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {report.label}
                            {!hasReport && isIncluded && (
                              <span className="text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">NO DATA SUBMITTED</span>
                            )}
                            {hasReport && (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">DATA READY</span>
                            )}
                          </div>
                          {report.subOptions && (
                            <motion.div
                              animate={{ rotate: isIncluded ? 180 : 0 }}
                              className="text-neutral-500"
                            >
                              <ArrowDownCircle className="w-3 h-3" />
                            </motion.div>
                          )}
                        </button>
                      </div>
                      
                      {isIncluded && report.subOptions && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="ml-4 pl-4 border-l border-neutral-800 grid grid-cols-2 gap-2 py-2"
                        >
                          {report.subOptions.map(sub => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleSubOption(report.id, sub.id)}
                              className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border text-left ${
                                (formData.reportSubOptions?.[report.id] || []).includes(sub.id)
                                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                  : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                              }`}
                            >
                              {sub.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Technical Details" 
              icon={Settings} 
              isOpen={openSections['Technical']} 
              onToggle={() => toggleSection('Technical')}
            >
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-4">Select technical details to be adjusted in the report</p>
              <div className="flex flex-wrap gap-2">
                {technicalOptions.map(tech => (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => toggleTechnical(tech.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      (formData.technicalDetails || []).includes(tech.id)
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-neutral-900 text-neutral-600 border-neutral-800'
                    }`}
                  >
                    {tech.label}
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          <CollapsibleSection 
            title="Other Notes & Status" 
            icon={ClipboardCheck} 
            isOpen={openSections['OtherNotes']} 
            onToggle={() => toggleSection('OtherNotes')}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Add additional notes with status for specific work items</p>
              <button 
                type="button"
                onClick={addOtherNote}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                ADD NOTE
              </button>
            </div>
            <div className="space-y-4">
              {(formData.otherNotes || []).map((note: any, index: number) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-neutral-900 border border-neutral-700 rounded-xl relative group">
                  <button 
                    type="button"
                    onClick={() => removeOtherNote(index)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Work Item</label>
                    <select 
                      value={note.workItem} 
                      onChange={(e) => updateOtherNote(index, 'workItem', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="Civil">Civil</option>
                      <option value="Structure">Structure</option>
                      <option value="Piping">Piping</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Instrument">Instrument</option>
                      <option value="Mechanical">Mechanical</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Discipline</label>
                    <select 
                      value={note.discipline} 
                      onChange={(e) => updateOtherNote(index, 'discipline', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="Mechanic & Electrical">Mechanic & Electrical</option>
                      <option value="HR">HR</option>
                      <option value="HSE">HSE</option>
                      <option value="QC">QC</option>
                      <option value="SPV">SPV</option>
                      <option value="Engineering">Engineering</option>
                      <option value="campbos">Camp Boss</option>
                      <option value="Permit Officer">Permit Officer</option>
                      <option value="Paramedic">Paramedic</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Status</label>
                    <select 
                      value={note.status} 
                      onChange={(e) => updateOtherNote(index, 'status', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="Open">Open</option>
                      <option value="Close">Close</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Note Details</label>
                    <input 
                      value={note.note} 
                      onChange={(e) => updateOtherNote(index, 'note', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                      placeholder="Enter note details..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection 
            title="Remarks Drawings" 
            icon={FileText} 
            isOpen={openSections['RemarksDrawings']} 
            onToggle={() => toggleSection('RemarksDrawings')}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Upload drawings with remarks and area details</p>
              <button 
                type="button"
                onClick={addRemarksDrawing}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                ADD DRAWING
              </button>
            </div>
            <div className="space-y-6">
              {(formData.remarksDrawings || []).map((rd: any, index: number) => (
                <div key={index} className="p-6 bg-neutral-900 border border-neutral-700 rounded-2xl relative group space-y-4">
                  <button 
                    type="button"
                    onClick={() => removeRemarksDrawing(index)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <label className="text-[9px] text-neutral-500 uppercase block">Drawing Photo</label>
                      <div className="relative aspect-video bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden group/photo">
                        {rd.photoUrl ? (
                          <img src={rd.photoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Plus className="w-8 h-8" />
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, (base64) => updateRemarksDrawing(index, 'photoUrl', base64))}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Work Item</label>
                          <input 
                            value={rd.workItem} 
                            onChange={(e) => updateRemarksDrawing(index, 'workItem', e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            placeholder="e.g. Civil, Piping"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Area</label>
                          <input 
                            value={rd.area} 
                            onChange={(e) => updateRemarksDrawing(index, 'area', e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                            placeholder="e.g. Area 1, Zone B"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase">Remarks</label>
                        <textarea 
                          value={rd.remarks} 
                          onChange={(e) => updateRemarksDrawing(index, 'remarks', e.target.value)}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-20 resize-none" 
                          placeholder="Enter drawing remarks..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection 
            title="Signatures" 
            icon={UserCheck} 
            isOpen={openSections['Signatures']} 
            onToggle={() => toggleSection('Signatures')}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Add signatures for the final report output</p>
              <button 
                type="button"
                onClick={addSignature}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                ADD SIGNATURE
              </button>
            </div>
            <div className="space-y-4">
              {(formData.signatures || []).map((sig: any, index: number) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-900 border border-neutral-700 rounded-xl relative group">
                  <button 
                    type="button"
                    onClick={() => removeSignature(index)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Company Name</label>
                    <input 
                      value={sig.company} 
                      onChange={(e) => updateSignature(index, 'company', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                      placeholder="e.g. PT. LNG"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Person Name</label>
                    <input 
                      value={sig.name} 
                      onChange={(e) => updateSignature(index, 'name', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase">Job Title</label>
                    <input 
                      value={sig.title} 
                      onChange={(e) => updateSignature(index, 'title', e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                      placeholder="e.g. Project Manager"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Additional Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none min-h-[100px] resize-none"
              placeholder="Enter any additional project control notes..."
            />
          </div>
        </div>
      );
    }

    if (discipline === 'Supervisor') {
      return (
        <div className="col-span-full space-y-10">
          <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Supervisor Information</h3>
            <div className="space-y-1">
              <label className="text-[9px] text-neutral-500 uppercase">Supervisor Name</label>
              <input 
                value={formData.supervisorName || ''} 
                onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })} 
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                placeholder="Name of supervisor on duty"
              />
            </div>
          </div>

          {renderSPBSection()}
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Daily Activities</label>
              <button 
                type="button"
                onClick={() => {
                  const newActivity = {
                    workItem: '',
                    area: '',
                    location: '',
                    discipline: 'Civil',
                    progress: 0,
                    unit: '',
                    manpowerDirect: 0,
                    manpowerList: [],
                    heavyEquipment: [{ name: '', count: 0 }],
                    equipment: '',
                    brokenEquipment: [{ name: '', count: 0 }],
                    overtime: { 
                      hours: 0, 
                      manpower: 0, 
                      manpowerList: [],
                      heavyEquipment: [{ name: '', count: 0 }],
                      photos: []
                    },
                    photos: [],
                    notes: '',
                    assistanceNeeded: ''
                  };
                  setFormData({ ...formData, activities: [...(formData.activities || []), newActivity] });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                ADD ACTIVITY
              </button>
            </div>

            <div className="space-y-8">
              {formData.activities?.map((activity: any, index: number) => (
                <div key={index} className="p-6 bg-neutral-800/30 border border-neutral-700 rounded-3xl space-y-6 relative group">
                  <button 
                    type="button"
                    onClick={() => {
                      const newList = [...formData.activities];
                      newList.splice(index, 1);
                      setFormData({ ...formData, activities: newList });
                    }}
                    className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-red-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Item Pekerjaan</label>
                      <input value={activity.workItem || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].workItem = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" placeholder="e.g. Galian Tanah" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Area</label>
                      <input value={activity.area || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].area = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Location</label>
                      <input value={activity.location || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].location = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Discipline</label>
                      <select value={activity.discipline || 'Civil'} onChange={(e) => { const newList = [...formData.activities]; newList[index].discipline = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white">
                        <option value="Civil">Civil</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Piping">Piping</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Instrument">Instrument</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Progress</label>
                      <input type="number" value={activity.progress || 0} onChange={(e) => { const newList = [...formData.activities]; newList[index].progress = parseFloat(e.target.value) || 0; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Unit</label>
                      <input value={activity.unit || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].unit = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Manpower Direct</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
                          <input 
                            placeholder="Search by Name, ID, or Position..."
                            value={manpowerSearch[index] || ''}
                            onChange={(e) => setManpowerSearch(prev => ({ ...prev, [index]: e.target.value }))}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
                          />
                        </div>
                        
                        {manpowerSearch[index] && (
                          <div className="max-h-32 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg p-1 space-y-1">
                            {allManpower
                              .filter(m => 
                                m.activeStatus === 'Active' && 
                                m.siteStatus === 'On Site' &&
                                m.classification === 'Direct' &&
                                (m.name.toLowerCase().includes(manpowerSearch[index].toLowerCase()) ||
                                 m.manpowerId.toLowerCase().includes(manpowerSearch[index].toLowerCase()) ||
                                 m.position.toLowerCase().includes(manpowerSearch[index].toLowerCase())) &&
                                !(activity.manpowerList || []).some((p: any) => p.manpowerId === m.manpowerId)
                              )
                              .map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    const newList = [...formData.activities];
                                    const currentList = newList[index].manpowerList || [];
                                    newList[index].manpowerList = [...currentList, { 
                                      name: m.name, 
                                      manpowerId: m.manpowerId, 
                                      position: m.position 
                                    }];
                                    newList[index].manpowerDirect = newList[index].manpowerList.length;
                                    setFormData({ ...formData, activities: newList });
                                    setManpowerSearch(prev => ({ ...prev, [index]: '' }));
                                  }}
                                  className="w-full text-left px-3 py-2 text-[10px] text-neutral-400 hover:bg-neutral-800 rounded transition-all flex justify-between items-center"
                                >
                                  <span>{m.name} ({m.position})</span>
                                  <span className="text-[8px] opacity-50">{m.manpowerId}</span>
                                </button>
                              ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {(activity.manpowerList || []).map((p: any, pIdx: number) => (
                            <div key={pIdx} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                              <span className="text-[10px] text-emerald-500 font-medium">{p.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newList = [...formData.activities];
                                  newList[index].manpowerList.splice(pIdx, 1);
                                  newList[index].manpowerDirect = newList[index].manpowerList.length;
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="text-emerald-500 hover:text-emerald-400"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          {(activity.manpowerList || []).length === 0 && (
                            <span className="text-[10px] text-neutral-600 italic">No manpower selected</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Overtime (Hours)</label>
                      <input type="number" value={activity.overtime?.hours || 0} onChange={(e) => { 
                        const newList = [...formData.activities]; 
                        newList[index].overtime = { ...newList[index].overtime, hours: parseFloat(e.target.value) || 0 }; 
                        setFormData({ ...formData, activities: newList }); 
                      }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Overtime Manpower</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
                          <input 
                            placeholder="Search by Name, ID, or Position..."
                            value={overtimeManpowerSearch[index] || ''}
                            onChange={(e) => setOvertimeManpowerSearch(prev => ({ ...prev, [index]: e.target.value }))}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
                          />
                        </div>
                        
                        {overtimeManpowerSearch[index] && (
                          <div className="max-h-32 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg p-1 space-y-1">
                            {allManpower
                              .filter(m => 
                                m.activeStatus === 'Active' && 
                                m.siteStatus === 'On Site' &&
                                m.classification === 'Direct' &&
                                (m.name.toLowerCase().includes(overtimeManpowerSearch[index].toLowerCase()) ||
                                 m.manpowerId.toLowerCase().includes(overtimeManpowerSearch[index].toLowerCase()) ||
                                 m.position.toLowerCase().includes(overtimeManpowerSearch[index].toLowerCase())) &&
                                !(activity.overtime?.manpowerList || []).some((p: any) => p.manpowerId === m.manpowerId)
                              )
                              .map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    const newList = [...formData.activities];
                                    const currentList = newList[index].overtime?.manpowerList || [];
                                    newList[index].overtime = {
                                      ...newList[index].overtime,
                                      manpowerList: [...currentList, { 
                                        name: m.name, 
                                        manpowerId: m.manpowerId, 
                                        position: m.position 
                                      }],
                                      manpower: currentList.length + 1
                                    };
                                    setFormData({ ...formData, activities: newList });
                                    setOvertimeManpowerSearch(prev => ({ ...prev, [index]: '' }));
                                  }}
                                  className="w-full text-left px-3 py-2 text-[10px] text-neutral-400 hover:bg-neutral-800 rounded transition-all flex justify-between items-center"
                                >
                                  <span>{m.name} ({m.position})</span>
                                  <span className="text-[8px] opacity-50">{m.manpowerId}</span>
                                </button>
                              ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {(activity.overtime?.manpowerList || []).map((p: any, pIdx: number) => (
                            <div key={pIdx} className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                              <span className="text-[10px] text-amber-500 font-medium">{p.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newList = [...formData.activities];
                                  const currentList = [...(newList[index].overtime?.manpowerList || [])];
                                  currentList.splice(pIdx, 1);
                                  newList[index].overtime = {
                                    ...newList[index].overtime,
                                    manpowerList: currentList,
                                    manpower: currentList.length
                                  };
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="text-amber-500 hover:text-amber-400"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          {(activity.overtime?.manpowerList || []).length === 0 && (
                            <span className="text-[10px] text-neutral-600 italic">No overtime manpower selected</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-neutral-500 uppercase">Equipment Used</label>
                      <input value={activity.equipment || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].equipment = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" placeholder="e.g. Welding Machine, Tools" />
                    </div>
                  </div>                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Regular Hours Equipment */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Heavy Equipment (Regular Hours)</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const newList = [...formData.activities];
                            newList[index].heavyEquipment = [...(newList[index].heavyEquipment || []), { name: '', count: 0 }];
                            setFormData({ ...formData, activities: newList });
                          }}
                          className="p-1 bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(activity.heavyEquipment || []).map((eq: any, eqIdx: number) => (
                          <div key={eqIdx} className="flex gap-2 items-center">
                            <input 
                              value={eq.name || ''} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].heavyEquipment[eqIdx].name = e.target.value;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Equipment Name"
                            />
                            <input 
                              type="number"
                              value={eq.count || 0} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].heavyEquipment[eqIdx].count = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Qty"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const newList = [...formData.activities];
                                newList[index].heavyEquipment.splice(eqIdx, 1);
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="p-2 text-neutral-600 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Overtime Equipment */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-amber-500 uppercase font-bold tracking-wider">Heavy Equipment (Overtime)</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const newList = [...formData.activities];
                            if (!newList[index].overtime) newList[index].overtime = { hours: 0, manpower: 0, manpowerList: [], heavyEquipment: [], photos: [] };
                            newList[index].overtime.heavyEquipment = [...(newList[index].overtime.heavyEquipment || []), { name: '', count: 0 }];
                            setFormData({ ...formData, activities: newList });
                          }}
                          className="p-1 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500/20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(activity.overtime?.heavyEquipment || []).map((eq: any, eqIdx: number) => (
                          <div key={eqIdx} className="flex gap-2 items-center">
                            <input 
                              value={eq.name || ''} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].overtime.heavyEquipment[eqIdx].name = e.target.value;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Equipment Name"
                            />
                            <input 
                              type="number"
                              value={eq.count || 0} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].overtime.heavyEquipment[eqIdx].count = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Qty"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const newList = [...formData.activities];
                                newList[index].overtime.heavyEquipment.splice(eqIdx, 1);
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="p-2 text-neutral-600 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-neutral-500 uppercase">Broken Equipment</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const newList = [...formData.activities];
                            newList[index].brokenEquipment = [...(newList[index].brokenEquipment || []), { name: '', count: 0 }];
                            setFormData({ ...formData, activities: newList });
                          }}
                          className="p-1 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(activity.brokenEquipment || []).map((eq: any, eqIdx: number) => (
                          <div key={eqIdx} className="flex gap-2 items-center">
                            <input 
                              value={eq.name || ''} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].brokenEquipment[eqIdx].name = e.target.value;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Equipment Name"
                            />
                            <input 
                              type="number"
                              value={eq.count || 0} 
                              onChange={(e) => {
                                const newList = [...formData.activities];
                                newList[index].brokenEquipment[eqIdx].count = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white" 
                              placeholder="Qty"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const newList = [...formData.activities];
                                newList[index].brokenEquipment.splice(eqIdx, 1);
                                setFormData({ ...formData, activities: newList });
                              }}
                              className="p-2 text-neutral-600 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Regular Photos */}
                    <div className="space-y-4">
                      <label className="text-[9px] text-neutral-500 uppercase block font-bold tracking-wider">Photos (Regular Hours - Max 4)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map((pIdx) => (
                          <div key={pIdx} className="space-y-2 bg-neutral-900/50 p-3 rounded-2xl border border-neutral-800">
                            <div className="relative aspect-video bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden group/photo">
                              {activity.photos?.[pIdx]?.url ? (
                                <img src={activity.photos[pIdx].url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                  <Plus className="w-6 h-6" />
                                </div>
                              )}
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, (base64) => {
                                  const newList = [...formData.activities];
                                  const newPhotos = [...(newList[index].photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], url: base64 };
                                  newList[index].photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                })}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </div>
                            <div className="space-y-2">
                              <input 
                                placeholder="Location"
                                value={activity.photos?.[pIdx]?.location || ''}
                                onChange={(e) => {
                                  const newList = [...formData.activities];
                                  const newPhotos = [...(newList[index].photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], location: e.target.value };
                                  newList[index].photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white"
                              />
                              <textarea 
                                placeholder="Description"
                                value={activity.photos?.[pIdx]?.description || ''}
                                onChange={(e) => {
                                  const newList = [...formData.activities];
                                  const newPhotos = [...(newList[index].photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], description: e.target.value };
                                  newList[index].photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white h-12 resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Overtime Photos */}
                    <div className="space-y-4">
                      <label className="text-[9px] text-amber-500 uppercase block font-bold tracking-wider">Photos (Overtime - Max 4)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map((pIdx) => (
                          <div key={pIdx} className="space-y-2 bg-neutral-900/50 p-3 rounded-2xl border border-neutral-800">
                            <div className="relative aspect-video bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden group/photo">
                              {activity.overtime?.photos?.[pIdx]?.url ? (
                                <img src={activity.overtime.photos[pIdx].url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                  <Plus className="w-6 h-6" />
                                </div>
                              )}
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, (base64) => {
                                  const newList = [...formData.activities];
                                  if (!newList[index].overtime) newList[index].overtime = { hours: 0, manpower: 0, manpowerList: [], heavyEquipment: [], photos: [] };
                                  const newPhotos = [...(newList[index].overtime.photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], url: base64 };
                                  newList[index].overtime.photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                })}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </div>
                            <div className="space-y-2">
                              <input 
                                placeholder="Location"
                                value={activity.overtime?.photos?.[pIdx]?.location || ''}
                                onChange={(e) => {
                                  const newList = [...formData.activities];
                                  if (!newList[index].overtime) newList[index].overtime = { hours: 0, manpower: 0, manpowerList: [], heavyEquipment: [], photos: [] };
                                  const newPhotos = [...(newList[index].overtime.photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], location: e.target.value };
                                  newList[index].overtime.photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white"
                              />
                              <textarea 
                                placeholder="Description"
                                value={activity.overtime?.photos?.[pIdx]?.description || ''}
                                onChange={(e) => {
                                  const newList = [...formData.activities];
                                  if (!newList[index].overtime) newList[index].overtime = { hours: 0, manpower: 0, manpowerList: [], heavyEquipment: [], photos: [] };
                                  const newPhotos = [...(newList[index].overtime.photos || [])];
                                  newPhotos[pIdx] = { ...newPhotos[pIdx], description: e.target.value };
                                  newList[index].overtime.photos = newPhotos;
                                  setFormData({ ...formData, activities: newList });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white h-12 resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] text-neutral-500 uppercase">Constraints / Notes</label>
                      <textarea value={activity.notes || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].notes = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-20 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] text-neutral-500 uppercase">Assistance Needed</label>
                      <textarea value={activity.assistanceNeeded || ''} onChange={(e) => { const newList = [...formData.activities]; newList[index].assistanceNeeded = e.target.value; setFormData({ ...formData, activities: newList }); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-20 resize-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    const fields = Object.keys(formData).filter(f => f !== 'materialRequests');
    return (
      <div className="col-span-full space-y-10">
        {renderSPBSection()}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {fields.map((field) => (
            <div key={field} className="space-y-2">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
              <textarea
                value={formData[field] || ''}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none min-h-[100px] resize-none"
                placeholder={`Enter ${field.toLowerCase()} details...`}
                disabled={loading}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl"
    >
      <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="min-w-0 flex-1 mr-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
            {discipline === 'Logistics' ? 'DAILY REPORT LOGISTIC' : `DAILY REPORT: ${discipline.toUpperCase()}`}
          </h2>
          <p className="text-[10px] sm:text-xs text-neutral-500 font-mono uppercase tracking-widest truncate">{project.name} • {new Date().toLocaleDateString()}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-white transition-all flex-shrink-0">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-4 sm:p-8 space-y-8 max-h-[calc(100dvh-12rem)] overflow-y-auto custom-scrollbar">
        {/* Discipline Selector for Multi-role Users */}
        {profile.roles.length > 1 && !initialReport && (
          <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
            <label className="text-[10px] text-emerald-500 uppercase font-mono tracking-widest mb-2 block">Reporting As</label>
            <div className="flex flex-wrap gap-2">
              {profile.roles.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setDiscipline(role)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    discipline === role 
                      ? 'bg-emerald-500 text-black border-emerald-400' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="space-y-4 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Report Template
            </h3>
            <select 
              value={formData.template || 'Standard'}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 transition-all"
            >
              <option value="Standard">Standard Corporate</option>
              <option value="Modern">Modern Minimalist</option>
              <option value="Compact">Compact Data-Grid</option>
              <option value="Detailed">Detailed Technical</option>
            </select>
          </div>
        </div>

        {discipline === 'Admin' && (
          <div className="space-y-6 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-500" />
              General Project Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-[10px] font-mono text-neutral-500 uppercase">Weather (Hours)</p>
                <div className="grid grid-cols-4 gap-2">
                  {['rainy', 'drizzle', 'cloudy', 'sunny'].map((type) => (
                    <div key={type} className="space-y-1">
                      <label className="text-[9px] text-neutral-600 uppercase">{type}</label>
                      <input
                        type="number"
                        value={(weather as any)[type]}
                        onChange={(e) => setWeather({ ...weather, [type]: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-mono text-neutral-500 uppercase">Manpower (Personnel)</p>
                <div className="grid grid-cols-3 gap-2">
                  {['indirect', 'direct', 'total'].map((type) => (
                    <div key={type} className="space-y-1">
                      <label className="text-[9px] text-neutral-600 uppercase">{type}</label>
                      <input
                        type="number"
                        value={(manpower as any)[type]}
                        onChange={(e) => setManpower({ ...manpower, [type]: parseInt(e.target.value) || 0 })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {renderFields()}
        </div>
      </div>

      <div className="p-4 sm:p-6 border-t border-neutral-800 bg-neutral-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-neutral-400 font-bold rounded-xl hover:bg-neutral-700 hover:text-white transition-all text-sm border border-neutral-700 disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          PREVIEW PDF
        </button>
        <button
          onClick={() => handleSubmit('Draft')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-all text-sm border border-neutral-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          SAVE DRAFT
        </button>
        <button
          onClick={() => handleSubmit('Submitted')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          SUBMIT REPORT
        </button>
      </div>
    </motion.div>
  );
}
