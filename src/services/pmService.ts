import { db, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from '../firebase';
import { PMScheduleItem, PMCostItem, PMCashFlowItem, PMProcurementItem, PMContractClaimItem, PMIntelligence } from '../types';

export async function seedPMData(projectId: string) {
  console.log('Seeding PM data for project:', projectId);

  try {
    // Clear existing data first to avoid duplicates
    const collections = ['pmSchedules', 'pmCosts', 'pmCashFlows', 'pmProcurements', 'pmContractClaims', 'pmIntelligence'];
    for (const coll of collections) {
      const q = query(collection(db, coll), where('projectId', '==', projectId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, coll, d.id));
      }
    }

    // 1. Schedule Items
    const scheduleItems = [
      { no: 1, activity: 'Engineering & Shop Drawings', duration: 30, start: '2026-04-01', finish: '2026-04-30', predecessor: '-', resource: 'Eng Team', remark: 'Critical path start', isCritical: true },
      { no: 2, activity: 'Procurement Long Lead Items', duration: 60, start: '2026-04-15', finish: '2026-06-15', predecessor: '1', resource: 'Procurement', remark: 'High risk delivery', isCritical: true },
      { no: 3, activity: 'Site Preparation & Mobilization', duration: 15, start: '2026-05-01', finish: '2026-05-15', predecessor: '1', resource: 'Civil Team', remark: 'On track', isCritical: false },
      { no: 4, activity: 'Foundation & Piling', duration: 45, start: '2026-05-16', finish: '2026-06-30', predecessor: '3', resource: 'Civil Team', remark: 'Critical for structure', isCritical: true },
      { no: 5, activity: 'Main Structure Fabrication', duration: 40, start: '2026-06-01', finish: '2026-07-10', predecessor: '2', resource: 'Fab Shop', remark: 'Off-site work', isCritical: false },
    ];

    for (const item of scheduleItems) {
      await addDoc(collection(db, 'pmSchedules'), { ...item, projectId });
    }

    // 2. Cost Items
    const costItems = [
      { item: 'Engineering Services', budgetCost: 500000, actualCost: 480000, variance: 20000, progress: 95, costProgressRatio: 0.98 },
      { item: 'Civil Works', budgetCost: 2500000, actualCost: 2750000, variance: -250000, progress: 40, costProgressRatio: 1.15 },
      { item: 'Mechanical Equipment', budgetCost: 4500000, actualCost: 4200000, variance: 300000, progress: 20, costProgressRatio: 0.95 },
      { item: 'Electrical & Instrument', budgetCost: 1800000, actualCost: 1500000, variance: 300000, progress: 10, costProgressRatio: 0.90 },
      { item: 'Project Management & Overheads', budgetCost: 800000, actualCost: 850000, variance: -50000, progress: 50, costProgressRatio: 1.05 },
    ];

    for (const item of costItems) {
      await addDoc(collection(db, 'pmCosts'), { ...item, projectId });
    }

    // 3. Cash Flow Items
    const cashFlowItems = [
      { period: 'Month 1', plannedProgress: 5, actualProgress: 4, plannedCost: 500000, actualCost: 450000, cumulativeCost: 450000 },
      { period: 'Month 2', plannedProgress: 15, actualProgress: 12, plannedCost: 1200000, actualCost: 1100000, cumulativeCost: 1550000 },
      { period: 'Month 3', plannedProgress: 30, actualProgress: 25, plannedCost: 2500000, actualCost: 2400000, cumulativeCost: 3950000 },
      { period: 'Month 4', plannedProgress: 50, actualProgress: 42, plannedCost: 4000000, actualCost: 4200000, cumulativeCost: 8150000 },
    ];

    for (const item of cashFlowItems) {
      await addDoc(collection(db, 'pmCashFlows'), { ...item, projectId });
    }

    // 4. Procurement Items
    const procurementItems = [
      { material: 'Main Power Transformer', status: 'PO Issued', poDate: '2026-04-10', deliveryDate: '2026-08-15', delay: 15, riskLevel: 'High' },
      { material: 'Structural Steel (Phase 1)', status: 'On Site', poDate: '2026-03-20', deliveryDate: '2026-05-05', delay: 0, riskLevel: 'Low' },
      { material: 'Control System (DCS)', status: 'Manufacturing', poDate: '2026-04-25', deliveryDate: '2026-09-10', delay: 5, riskLevel: 'Medium' },
      { material: 'Piping Materials', status: 'In Transit', poDate: '2026-04-05', deliveryDate: '2026-05-20', delay: 0, riskLevel: 'Low' },
    ];

    for (const item of procurementItems) {
      await addDoc(collection(db, 'pmProcurements'), { ...item, projectId });
    }

    // 5. Contract Claims
    const claimItems = [
      { issue: 'Site Access Delay (Area A)', type: 'Delay', responsible: 'Client', eot: 14, costClaim: 150000, status: 'Negotiation' },
      { issue: 'Foundation Design Change', type: 'Variation', responsible: 'Engineering', eot: 7, costClaim: 85000, status: 'Approved' },
      { issue: 'Unforeseen Soil Condition', type: 'Variation', responsible: 'Force Majeure', eot: 21, costClaim: 320000, status: 'Submitted' },
    ];

    for (const item of claimItems) {
      await addDoc(collection(db, 'pmContractClaims'), { ...item, projectId });
    }

    // 6. Intelligence Report
    const intelligence = {
      projectId,
      date: new Date().toISOString().split('T')[0],
      summary: {
        overallProgress: 42,
        scheduleStatus: 'Delay',
        costStatus: 'Over Budget',
        criticalIssues: [
          'Main Transformer delivery delay impacting substation commissioning',
          'Civil works cost overrun due to soil condition variation',
          'Critical path pressure on foundation completion'
        ],
        cashFlowHealth: 'Stable - Sufficient Liquidity',
        procurementRiskLevel: 'High (Long Lead Items)',
        claimPotentialValue: 555000,
        claimPotentialTime: 42
      },
      analysis: {
        schedule: {
          criticalPath: 'Engineering -> Procurement -> Foundation -> Installation',
          delayCauses: 'Late site access and design changes in foundation piling.'
        },
        cost: {
          overrunSource: 'Civil works labor and material escalation.',
          profitRisk: 'Erosion of contingency due to unforeseen ground conditions.'
        },
        procurement: {
          materialDelaysImpact: 'Long lead items delay will push commissioning by 3 weeks.'
        },
        contract: {
          eotEntitlement: 'Strong entitlement for site access delays.',
          ldRisk: 'Low, provided EOT is granted.'
        }
      },
      actionPlan: {
        immediate: [
          'Expedite Transformer manufacturer audit',
          'Finalize Variation Order #04 for soil conditions',
          'Increase piling rig count to 3 units'
        ],
        strategic: [
          'Re-baseline schedule for Phase 2',
          'Implement stricter subcontractor cost monitoring',
          'Engage legal for EOT claim formalization'
        ],
        recovery: 'Parallelize piping installation with structural works to recover 10 days.',
        costOptimization: 'Value engineering on instrument cabling routes.'
      },
      forecast: {
        estimatedCompletionDate: '2027-02-15',
        eac: 12500000,
        profitLossProjection: 1200000
      },
      scenarios: {
        bestCase: 'All claims approved, no further weather delays. Completion by Jan 2027.',
        mostLikely: 'Partial claim approval, minor logistics friction. Completion by Feb 2027.',
        worstCase: 'Claim rejection, further supply chain disruption. Completion by April 2027.'
      },
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'pmIntelligence'), intelligence);

    return true;
  } catch (error) {
    console.error('Error seeding PM data:', error);
    throw error;
  }
}

export async function seedLogisticsData(projectId: string) {
  console.log('Seeding Logistics data for project:', projectId);

  try {
    // Clear existing data
    const coll = 'logisticsIntelligence';
    const q = query(collection(db, coll), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, coll, d.id));
    }

    // Logistics Intelligence Report
    const intelligence = {
      projectId,
      date: new Date().toISOString().split('T')[0],
      materialPlan: [
        { material: 'Structural Steel (Grade S355)', quantity: 450, unit: 'Tons', requiredDate: '2026-05-15', source: 'Local Fabricator', priority: 'Critical' },
        { material: 'Cement (OPC Type 1)', quantity: 1200, unit: 'Bags', requiredDate: '2026-04-20', source: 'Regional Supplier', priority: 'High' },
        { material: 'Reinforcement Bars (D16/D25)', quantity: 85, unit: 'Tons', requiredDate: '2026-04-25', source: 'Local Supplier', priority: 'High' },
        { material: 'High Pressure Valves', quantity: 24, unit: 'Units', requiredDate: '2026-06-10', source: 'International (Italy)', priority: 'Medium' },
      ],
      deliverySchedule: [
        { material: 'Main Transformer', poDate: '2026-03-01', deliveryDate: '2026-08-15', leadTime: 165, status: 'Fabrication' },
        { material: 'Piping Spools (Batch 1)', poDate: '2026-03-15', deliveryDate: '2026-05-05', leadTime: 50, status: 'Transit' },
        { material: 'Electrical Cables', poDate: '2026-04-01', deliveryDate: '2026-06-20', leadTime: 80, status: 'Ordered' },
        { material: 'Foundation Bolts', poDate: '2026-02-20', deliveryDate: '2026-04-10', leadTime: 50, status: 'Delivered' },
      ],
      transportAnalysis: [
        { item: 'Aggregates (Quarry to Site)', distance: 45, cycleTime: 3.5, fleetRequired: '10x Dump Trucks', tripsPerDay: 25 },
        { item: 'Steel Structures (Fab to Site)', distance: 120, cycleTime: 6, fleetRequired: '4x Flatbed Trailers', tripsPerDay: 8 },
        { item: 'Heavy Lift (Port to Site)', distance: 85, cycleTime: 12, fleetRequired: '1x Multi-axle Trailer', tripsPerDay: 1 },
      ],
      sitePlan: {
        laydownAreaAllocation: 'Area A (2000m2) for Steel, Area B (500m2) for Piping, Area C (Indoor) for E&I.',
        accessRoutes: 'Main Gate for heavy vehicles, North Gate for light vehicles. One-way traffic flow implemented.',
        materialFlow: 'Unloading at Laydown A -> Pre-assembly -> Transport to Installation Point via Route 1.'
      },
      inventoryStatus: [
        { material: 'Cement', stock: 450, incoming: 600, usageRate: 40, daysRemaining: 11 },
        { material: 'Diesel Fuel', stock: 15000, incoming: 20000, usageRate: 2500, daysRemaining: 6 },
        { material: 'Rebar D25', stock: 12, incoming: 50, usageRate: 5, daysRemaining: 2 },
        { material: 'Scaffolding Pipes', stock: 2500, incoming: 0, usageRate: 100, daysRemaining: 25 },
      ],
      riskAnalysis: {
        delays: 'Potential port congestion impacting international valve delivery.',
        bottlenecks: 'Limited crane capacity for simultaneous unloading at Laydown A.',
        supplyRisks: 'Cement shortage reported by regional supplier due to plant maintenance.'
      },
      optimization: {
        deliveryOptimization: 'Consolidate small orders into weekly shipments to reduce transport cost.',
        transportEfficiency: 'Implement night-shift hauling for aggregates to avoid city traffic.',
        costReduction: 'Negotiate bulk fuel purchase with direct refinery distributor.'
      },
      impact: {
        scheduleImpact: '2-week delay in foundation if cement shortage is not mitigated.',
        costImpact: 'Increased transport cost due to emergency air-freight for critical valves.',
        productivityImpact: 'Low productivity in Area A due to material handling bottlenecks.'
      },
      scenarios: {
        bestCase: 'All deliveries on time, cement shortage resolved by alternate supplier.',
        normalCase: 'Minor transport delays, manageable stock levels with buffer strategy.',
        worstCase: 'Port strike + major supplier failure. Project delay exceeds 1 month.'
      },
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'logisticsIntelligence'), intelligence);

    return true;
  } catch (error) {
    console.error('Error seeding Logistics data:', error);
    throw error;
  }
}
