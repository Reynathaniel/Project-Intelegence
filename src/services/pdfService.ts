import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Project, DailyReport, UserRole, MaterialRequest } from '../types';

const addLogoToDoc = (doc: jsPDF, logo: string, x: number) => {
  try {
    // Use jsPDF's built-in method to get image properties synchronously for data URLs
    const props = doc.getImageProperties(logo);
    const ratio = props.width / props.height;
    const maxWidth = 35;
    const maxHeight = 15;
    
    let width = maxWidth;
    let height = width / ratio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    
    doc.addImage(logo, 'PNG', x === 15 ? x : 195 - width, 10, width, height);
  } catch (e) {
    console.error('Error adding logo to PDF', e);
    // Fallback to a fixed size if properties can't be determined
    try {
      doc.addImage(logo, 'PNG', x === 15 ? x : 160, 10, 30, 15);
    } catch (err) {
      // Silently fail if logo is completely invalid
    }
  }
};

export const generateProjectReport = (project: Project, reports: DailyReport[], filterRole?: UserRole, template: string = 'Standard', isPreview: boolean = false, colorStyle: string = 'Color') => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd MMMM yyyy');
  const reportDate = reports.length > 0 ? reports[0].date : format(new Date(), 'yyyy-MM-dd');
  const today = reportDate;
  const todayReports = reports.filter(r => r.date === today || r.id === 'preview');
  const historicalReports = reports.filter(r => r.date < today && r.id !== 'preview');

  // Template-based colors and styles
  const allStyles = {
    Standard: {
      primary: [0, 50, 100],
      secondary: [240, 240, 240],
      text: [0, 0, 0],
      accent: [0, 100, 0]
    },
    Modern: {
      primary: [30, 41, 59],
      secondary: [248, 250, 252],
      text: [15, 23, 42],
      accent: [16, 185, 129]
    },
    Compact: {
      primary: [0, 0, 0],
      secondary: [250, 250, 250],
      text: [0, 0, 0],
      accent: [50, 50, 50]
    },
    Detailed: {
      primary: [20, 20, 20],
      secondary: [245, 245, 245],
      text: [0, 0, 0],
      accent: [0, 0, 150]
    }
  };
  let styles = allStyles[template as keyof typeof allStyles] || allStyles.Standard;

  if (colorStyle === 'B&W') {
    const toGrayscale = (rgb: number[]) => {
      const gray = Math.round(0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
      return [gray, gray, gray];
    };
    styles = {
      primary: toGrayscale(styles.primary),
      secondary: toGrayscale(styles.secondary),
      text: toGrayscale(styles.text),
      accent: toGrayscale(styles.accent)
    };
  }

  // Helper for drawing lines
  const drawLine = (y: number) => {
    doc.setLineWidth(0.5);
    doc.setDrawColor(styles.primary[0], styles.primary[1], styles.primary[2]);
    doc.line(15, y, 195, y);
  };

  if (project.clientLogo) addLogoToDoc(doc, project.clientLogo, 15);
  if (project.contractorLogo) addLogoToDoc(doc, project.contractorLogo, 165);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
  
  // Project Name - Bold and Underlined
  doc.text(project.name.toUpperCase(), 105, 12, { align: 'center' });
  const nameWidth = doc.getTextWidth(project.name.toUpperCase());
  doc.line(105 - (nameWidth / 2), 13, 105 + (nameWidth / 2), 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(project.location.toUpperCase(), 105, 17, { align: 'center' });
  doc.text(`CONTRACT : ${project.contractNo || 'N/A'}`.toUpperCase(), 105, 21, { align: 'center' });

  // PT Names - Bold (if needed elsewhere, but user said remove from top)
  // We'll keep them available for signatures but remove from the centered header block

  if (template === 'Modern') {
    doc.setDrawColor(styles.accent[0], styles.accent[1], styles.accent[2]);
    doc.setLineWidth(1);
    doc.line(15, 32, 195, 32);
  }

  doc.setFontSize(12);
  if (template === 'Modern') {
    doc.setTextColor(styles.accent[0], styles.accent[1], styles.accent[2]);
    doc.text('DAILY PROGRESS REPORT', 105, 38, { align: 'center' });
  } else {
    doc.rect(15, 30, 180, 8);
    doc.text('DAILY PROGRESS REPORT', 105, 35.5, { align: 'center' });
  }
  
  // Project Info Table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
  doc.text(`Date: ${format(new Date(reportDate), 'dd-MMM-yyyy')}`, 195, 42, { align: 'right' });

  // EPC Standard Header Info
  doc.setFontSize(8);
  doc.text(`CLIENT: ${project.client || 'N/A'}`, 15, 27);
  doc.text(`CONTRACTOR: ${project.contractorName || 'N/A'}`, 195, 27, { align: 'right' });
  doc.line(15, 28, 195, 28);

  // Manpower & Weather Summary - Integrated from HR and HSE
  const hrReport = todayReports.find(r => r.discipline === 'HR');
  const hseReport = todayReports.find(r => r.discipline === 'HSE');
  const pcReport = todayReports.find(r => r.discipline === 'Project Control');
  
  const hrData = hrReport ? JSON.parse(hrReport.data) : null;
  const hseData = hseReport ? JSON.parse(hseReport.data) : null;
  const pcData = pcReport ? JSON.parse(pcReport.data) : null;

  const weather = todayReports.find(r => r.weather)?.weather;
  
  // Use HR manpower if available, otherwise fallback
  const totalManpower = hrData?.personnelList?.length || todayReports.find(r => r.manpower)?.manpower?.total || 'N/A';
  // Use HSE manhours if available
  const totalManhours = hseData?.manhours?.total || 'N/A';

  autoTable(doc, {
    startY: 45,
    head: [['Man Power Total', 'Total Manhours', 'Working Time', 'Weather Condition']],
    body: [[
      totalManpower,
      totalManhours,
      weather?.workingTime || '06:00 - 18:00',
      `Rainy: ${weather?.rainy || 0}h | Sunny: ${weather?.sunny || 0}h`
    ]],
    theme: template === 'Modern' ? 'striped' : 'grid',
    headStyles: { 
      fillColor: styles.secondary as [number, number, number], 
      textColor: styles.text as [number, number, number], 
      fontStyle: 'bold' 
    },
    styles: { fontSize: 8, halign: 'center' },
    margin: { left: 15, right: 15 }
  });

  let yPos = (doc as any).lastAutoTable.finalY + 10;

  // Disciplines Breakdown - Ordered as requested: HR, HSE, QC, Mechanic & Electrical, etc.
  const disciplines: UserRole[] = filterRole ? [filterRole] : [
    'HR',
    'HSE',
    'QC',
    'Mechanic & Electrical',
    'Document Control',
    'Procurement',
    'Logistics',
    'Supervisor',
    'Project Control'
  ];

  // Included Reports and Sub-options Filter
  const includedReports = pcData?.includedReports || [];
  const reportSubOptions = pcData?.reportSubOptions || {};

  disciplines.forEach((discipline) => {
    // Skip if not in included reports for PC report (if filterRole is not set, it's a PC report)
    if (!filterRole && includedReports.length > 0 && !includedReports.includes(discipline)) {
      return;
    }

    const disciplineReports = todayReports.filter(r => r.discipline === discipline);
    
    if (disciplineReports.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(styles.secondary[0], styles.secondary[1], styles.secondary[2]);
      doc.rect(15, yPos, 180, 7, 'F');
      doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
      doc.text(discipline.toUpperCase(), 20, yPos + 5);
      doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
      yPos += 10;

      disciplineReports.forEach((report) => {
        const data = JSON.parse(report.data);
        
        // Add Supervisor Name if available
        if (discipline === 'Supervisor' && data.supervisorName) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
          doc.text(`Supervisor: ${data.supervisorName}`, 15, yPos);
          doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
          yPos += 5;
        }
        // LOGISTICS SPECIFIC RENDERING
        if (discipline === 'Logistics') {
          const logisticsOptions = reportSubOptions['Logistics'] || ['materialRequests', 'materialReceipts', 'materialUsages', 'fuelIn', 'fuelOut', 'fuelConsumption'];
          
          // Material Requests (SPB)
          if (logisticsOptions.includes('materialRequests') && data.materialRequests?.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('MATERIAL REQUESTS (SPB)', 15, yPos);
            yPos += 5;
            const logisticsRows = data.materialRequests.map((req: any) => [
              req.spbNo,
              req.itemName,
              req.volumeSPB,
              req.unit,
              req.requestedBy || '-',
              req.discipline || '-',
              req.status
            ]);

            autoTable(doc, {
              startY: yPos,
              head: [['No SPB', 'Item', 'Vol', 'Unit', 'Req By', 'Disc', 'Status']],
              body: logisticsRows,
              theme: template === 'Modern' ? 'striped' : 'grid',
              headStyles: { fillColor: styles.accent as [number, number, number], textColor: 255 },
              styles: { fontSize: 7 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;
          }

          // Material Receipts
          if (logisticsOptions.includes('materialReceipts') && data.materialReceipts?.length > 0) {
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('MATERIAL RECEIPTS', 15, yPos);
            yPos += 5;
            const receiptRows = data.materialReceipts.map((r: any) => [r.itemName, r.volume, r.unit, r.vendor, r.status]);
            autoTable(doc, {
              startY: yPos,
              head: [['Item', 'Vol', 'Unit', 'Vendor', 'Status']],
              body: receiptRows,
              theme: template === 'Modern' ? 'striped' : 'grid',
              headStyles: { fillColor: [styles.accent[0], styles.accent[1] + 20, styles.accent[2]] as [number, number, number], textColor: 255 },
              styles: { fontSize: 7 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;
          }

          // Material Usages
          if (logisticsOptions.includes('materialUsages') && data.materialUsages?.length > 0) {
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('MATERIAL USAGES', 15, yPos);
            yPos += 5;
            const usageRows = data.materialUsages.map((u: any) => [u.itemName, u.volume, u.unit, u.location, u.workItem]);
            autoTable(doc, {
              startY: yPos,
              head: [['Item', 'Vol', 'Unit', 'Location', 'Work Item']],
              body: usageRows,
              theme: template === 'Modern' ? 'striped' : 'grid',
              headStyles: { fillColor: [styles.accent[0], styles.accent[1] + 40, styles.accent[2]] as [number, number, number], textColor: 255 },
              styles: { fontSize: 7 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;
          }

          // Fuel Management
          const hasFuelData = (logisticsOptions.includes('fuelIn') && data.fuelIn?.length > 0) || 
                              (logisticsOptions.includes('fuelOut') && data.fuelOut?.length > 0);
          
          if (hasFuelData) {
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('FUEL MANAGEMENT', 15, yPos);
            yPos += 5;
            
            const fuelRows = [];
            if (logisticsOptions.includes('fuelIn')) {
              fuelRows.push(...data.fuelIn.map((f: any) => ['IN', f.volume, f.unit, f.source || f.vendor, '-']));
            }
            if (logisticsOptions.includes('fuelOut')) {
              fuelRows.push(...data.fuelOut.map((f: any) => ['OUT', f.volume, f.unit, f.location, f.vehicleName || f.equipment]));
            }

            if (fuelRows.length > 0) {
              autoTable(doc, {
                startY: yPos,
                head: [['Type', 'Vol', 'Unit', 'Source/Loc', 'Equip']],
                body: fuelRows,
                theme: template === 'Modern' ? 'striped' : 'grid',
                headStyles: { fillColor: [styles.accent[0], styles.accent[1] + 60, styles.accent[2]] as [number, number, number], textColor: 255 },
                styles: { fontSize: 7 },
                margin: { left: 15, right: 15 },
              });
              yPos = (doc as any).lastAutoTable.finalY + 8;
            }
          }
        }

        // HSE SPECIFIC RENDERING
        else if (discipline === 'HSE') {
          const hseOptions = reportSubOptions['HSE'] || ['permits', 'manhours', 'safetyStats', 'incidentTypes', 'complianceStats', 'weatherConditions', 'stopWorkOrders', 'healthStatus'];
          
          const permitsText = hseOptions.includes('permits') ? (data.permits?.map((p: any) => `${p.number} (${p.status})`).join(', ') || '-') : 'N/A';
          const swoText = hseOptions.includes('stopWorkOrders') ? (data.stopWorkOrders?.map((s: any) => `${s.type}: ${s.number} - ${s.cause}`).join('\n') || 'None') : 'N/A';
          
          const hseRows = [];
          if (hseOptions.includes('permits')) hseRows.push(['Permits', permitsText]);
          if (hseOptions.includes('manhours')) {
            hseRows.push(['Manhours (Direct)', data.manhours?.direct || '0']);
            hseRows.push(['Manhours (Indirect)', data.manhours?.indirect || '0']);
            hseRows.push(['Manhours (OT)', data.manhours?.overtime || '0']);
            hseRows.push(['Manhours (Total)', data.manhours?.total || '0']);
            hseRows.push(['Total Man-day', data.manhours?.totalManDay || '0']);
            hseRows.push(['Avg Men / Month', data.manhours?.avgMenPerMonth || '0']);
          }
          if (hseOptions.includes('safetyStats') && data.safetyStats) {
            hseRows.push(['No. of Injury', data.safetyStats.noOfInjury || '0']);
            hseRows.push(['Days Charged', data.safetyStats.daysCharged || '0']);
            hseRows.push(['Frequency Rate', data.safetyStats.frequencyRate || '0']);
            hseRows.push(['Severity Rate', data.safetyStats.severityRate || '0']);
          }
          if (hseOptions.includes('incidentTypes') && data.incidentTypes) {
            hseRows.push(['Incidents: Falling from height', data.incidentTypes.fallingFromHeight || '0']);
            hseRows.push(['Incidents: Falling objects', data.incidentTypes.fallingObjects || '0']);
            hseRows.push(['Incidents: Hit by object', data.incidentTypes.hitByObject || '0']);
            hseRows.push(['Incidents: Collapse of stack', data.incidentTypes.collapseOfStack || '0']);
            hseRows.push(['Incidents: Electrical hazards', data.incidentTypes.electricalHazards || '0']);
            hseRows.push(['Incidents: Other', data.incidentTypes.otherIncidents || '0']);
          }
          if (hseOptions.includes('complianceStats') && data.complianceStats) {
            hseRows.push(['MOM Summons', data.complianceStats.momSummons || '0']);
            hseRows.push(['MOM Non-Compliance', data.complianceStats.momNonCompliance || '0']);
            hseRows.push(['Demerit Points', data.complianceStats.demeritPoints || '0']);
            hseRows.push(['MOM Warning Letter', data.complianceStats.momWarningLetter || '0']);
            hseRows.push(['MOM Stop Work Order (Verbal)', data.complianceStats.momStopWorkOrderVerbal || '0']);
          }
          if (hseOptions.includes('stopWorkOrders')) hseRows.push(['Stop Work Orders', swoText]);
          if (hseOptions.includes('healthStatus')) {
            hseRows.push(['Health Status', `Direct: ${data.healthStatus?.directHealthy || 0}H/${data.healthStatus?.directSick || 0}S | Indirect: ${data.healthStatus?.indirectHealthy || 0}H/${data.healthStatus?.indirectSick || 0}S`]);
          }

          if (hseRows.length > 0) {
            autoTable(doc, {
              startY: yPos,
              head: [['HSE Category', 'Details']],
              body: hseRows,
              theme: template === 'Modern' ? 'striped' : 'grid',
              headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
              styles: { fontSize: 8 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 8;
          }
        }

        // HR SPECIFIC RENDERING
        else if (discipline === 'HR') {
          const hrOptions = reportSubOptions['HR'] || ['personnel', 'notes'];
          
          if (hrOptions.includes('personnel') && data.personnelList?.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('PERSONNEL MANAGEMENT', 15, yPos);
            yPos += 5;

            const visibleCols = data.visibleColumns || ['manpowerId', 'name', 'position', 'classification', 'siteStatus', 'activeStatus'];
            const headers = visibleCols.map((c: string) => c.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
            const body = data.personnelList.map((p: any) => visibleCols.map((c: string) => p[c] || '-'));

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: body,
              theme: template === 'Modern' ? 'striped' : 'grid',
              headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
              styles: { fontSize: 6 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 8;
          }

          if (hrOptions.includes('notes') && data.notes) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('HR Notes:', 15, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(data.notes, 180);
            doc.text(splitNotes, 15, yPos);
            yPos += (splitNotes.length * 5) + 5;
          }
        }

        // PROJECT CONTROL SPECIFIC RENDERING
        else if (discipline === 'Project Control') {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
          
          if (data.todaysActual) {
            doc.text("TODAY'S ACTUAL PROGRESS", 15, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
            const splitActual = doc.splitTextToSize(data.todaysActual, 180);
            doc.text(splitActual, 15, yPos);
            yPos += (splitActual.length * 5) + 5;
          }

          if (data.tomorrowsPlan) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
            doc.text("TOMORROW'S PLAN", 15, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
            const splitPlan = doc.splitTextToSize(data.tomorrowsPlan, 180);
            doc.text(splitPlan, 15, yPos);
            yPos += (splitPlan.length * 5) + 5;
          }

          // Summary of all roles
          if (!filterRole) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
            doc.text("PROGRESS SUMMARY (CUMULATIVE)", 15, yPos);
            yPos += 5;
            
            // Calculate cumulative progress for Supervisor activities
            const supervisorReports = reports.filter(r => r.discipline === 'Supervisor');
            const activitySummary: Record<string, { untilYesterday: number, today: number, unit: string }> = {};
            
            supervisorReports.forEach(r => {
              try {
                const rData = JSON.parse(r.data);
                const isToday = r.date === today || r.id === 'preview';
                rData.activities?.forEach((act: any) => {
                  const key = `${act.workItem ? act.workItem + ' - ' : ''}${act.discipline} - ${act.area}`;
                  if (!activitySummary[key]) {
                    activitySummary[key] = { untilYesterday: 0, today: 0, unit: act.unit || 'nos' };
                  }
                  if (isToday) {
                    activitySummary[key].today += Number(act.progress) || 0;
                  } else {
                    activitySummary[key].untilYesterday += Number(act.progress) || 0;
                  }
                });
              } catch (e) {}
            });

            const summaryRows = Object.entries(activitySummary).map(([key, s]) => [
              key,
              s.untilYesterday.toFixed(1),
              s.today.toFixed(1),
              (s.untilYesterday + s.today).toFixed(1),
              s.unit
            ]);

            if (summaryRows.length > 0) {
              autoTable(doc, {
                startY: yPos,
                head: [['Activity', 'Until Yesterday', 'Today', 'Cumulative', 'Unit']],
                body: summaryRows,
                theme: 'grid',
                headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
                styles: { fontSize: 7 },
                margin: { left: 15, right: 15 },
              });
              yPos = (doc as any).lastAutoTable.finalY + 10;
            } else {
              // Report as 0 if no activities found
              autoTable(doc, {
                startY: yPos,
                head: [['Activity', 'Until Yesterday', 'Today', 'Cumulative', 'Unit']],
                body: [['NO ACTIVITIES RECORDED', '0.0', '0.0', '0.0', '-']],
                theme: 'grid',
                headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
                styles: { fontSize: 7, halign: 'center' },
                margin: { left: 15, right: 15 },
              });
              yPos = (doc as any).lastAutoTable.finalY + 10;
            }
          }

          // Other Notes
          if (data.otherNotes?.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
            doc.text("OTHER NOTES & STATUS", 15, yPos);
            yPos += 5;

            const noteRows = data.otherNotes.map((n: any) => [
              n.workItem,
              n.discipline,
              n.note,
              n.status
            ]);

            autoTable(doc, {
              startY: yPos,
              head: [['Work Item', 'Discipline', 'Note', 'Status']],
              body: noteRows,
              theme: 'grid',
              headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
              styles: { fontSize: 7 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
          }

          // Signatures Section (Moved before Remarks Drawings)
          const signatures = data.signatures || [];
          if (signatures.length > 0) {
            const sigsToRender = signatures.slice(0, 4);
            const count = sigsToRender.length;
            
            if (yPos > 230) { doc.addPage(); yPos = 20; }
            else { yPos += 10; }

            const pageWidth = 210;
            const margin = 15;
            const availableWidth = pageWidth - (2 * margin);
            const colWidth = availableWidth / count;

            sigsToRender.forEach((sig: any, index: number) => {
              const x = margin + (index * colWidth) + (colWidth / 2);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
              doc.text(sig.company.toUpperCase(), x, yPos, { align: 'center' });
              
              doc.text('____________________', x, yPos + 20, { align: 'center' });
              doc.text(sig.name, x, yPos + 25, { align: 'center' });
              
              doc.setFont('helvetica', 'normal');
              doc.text(sig.title, x, yPos + 30, { align: 'center' });
            });
            
            yPos += 45;
          }

          // Remarks Drawings
          if (data.remarksDrawings?.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
            doc.text("REMARKS DRAWINGS", 15, yPos);
            yPos += 10;

            for (let i = 0; i < data.remarksDrawings.length; i += 2) {
              const rd1 = data.remarksDrawings[i];
              const rd2 = data.remarksDrawings[i + 1];

              // Check for page break
              if (yPos > 220) { doc.addPage(); yPos = 20; }

              const colWidth = 85;
              const col1X = 15;
              const col2X = 110;
              
              let maxRowHeight = 0;

              // If only one drawing in row, center it
              if (!rd2) {
                const centerX = 45; // (210 - 120) / 2
                const centerWidth = 120;
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
                doc.text(`Drawing #${i + 1}: ${rd1.workItem} - ${rd1.area}`, centerX, yPos);
                
                doc.setFont('helvetica', 'normal');
                const splitRemarks1 = doc.splitTextToSize(`Remarks: ${rd1.remarks}`, centerWidth);
                doc.text(splitRemarks1, centerX, yPos + 5);
                
                let currentY1 = yPos + 5 + (splitRemarks1.length * 5) + 5;
                
                if (rd1.photoUrl) {
                  const imgWidth = 120;
                  const imgHeight = 90;
                  if (currentY1 + imgHeight > 280) {
                    doc.addPage();
                    yPos = 20;
                    currentY1 = 20;
                  }
                  try {
                    doc.addImage(rd1.photoUrl, 'JPEG', centerX, currentY1, imgWidth, imgHeight);
                    currentY1 += imgHeight + 10;
                  } catch (e) {}
                } else {
                  currentY1 += 5;
                }
                maxRowHeight = currentY1 - yPos;
              } else {
                // Two drawings side by side
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
                
                // Col 1
                doc.text(`Drawing #${i + 1}: ${rd1.workItem} - ${rd1.area}`, col1X, yPos);
                // Col 2
                doc.text(`Drawing #${i + 2}: ${rd2.workItem} - ${rd2.area}`, col2X, yPos);
                
                doc.setFont('helvetica', 'normal');
                const splitRemarks1 = doc.splitTextToSize(`Remarks: ${rd1.remarks}`, colWidth);
                const splitRemarks2 = doc.splitTextToSize(`Remarks: ${rd2.remarks}`, colWidth);
                
                doc.text(splitRemarks1, col1X, yPos + 5);
                doc.text(splitRemarks2, col2X, yPos + 5);
                
                let currentY1 = yPos + 5 + (splitRemarks1.length * 4) + 5;
                let currentY2 = yPos + 5 + (splitRemarks2.length * 4) + 5;
                
                const imgHeight = 60;
                const imgWidth = 85;

                if (rd1.photoUrl) {
                  if (currentY1 + imgHeight > 280) {
                    // This is tricky for side-by-side. 
                    // For simplicity, if it overflows, we just let it be or add page.
                    // But side-by-side should ideally be on the same page.
                  }
                  try {
                    doc.addImage(rd1.photoUrl, 'JPEG', col1X, currentY1, imgWidth, imgHeight);
                    currentY1 += imgHeight + 10;
                  } catch (e) {}
                } else {
                  currentY1 += 5;
                }
                
                if (rd2.photoUrl) {
                  try {
                    doc.addImage(rd2.photoUrl, 'JPEG', col2X, currentY2, imgWidth, imgHeight);
                    currentY2 += imgHeight + 10;
                  } catch (e) {}
                } else {
                  currentY2 += 5;
                }
                
                maxRowHeight = Math.max(currentY1 - yPos, currentY2 - yPos);
              }

              yPos += maxRowHeight + 5;
            }
          }

          // Legacy Remarks Drawing (fallback)
          if (data.remarksDrawing && (!data.remarksDrawings || data.remarksDrawings.length === 0)) {
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(styles.primary[0], styles.primary[1], styles.primary[2]);
            doc.text("REMARKS DRAWING (LEGACY)", 15, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(styles.text[0], styles.text[1], styles.text[2]);
            const splitRemarks = doc.splitTextToSize(data.remarksDrawing, 180);
            doc.text(splitRemarks, 15, yPos);
            yPos += (splitRemarks.length * 5) + 10;
          }
        }

        // SUPERVISOR SPECIFIC RENDERING
        else if (discipline === 'Supervisor') {
          if (data.activities?.length > 0) {
            data.activities.forEach((act: any, idx: number) => {
              if (yPos > 220) { doc.addPage(); yPos = 20; }
              
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.text(`Activity #${idx + 1}: ${act.workItem || '-'} (${act.discipline} - ${act.area})`, 15, yPos);
              yPos += 5;

              const heText = (act.heavyEquipment || []).map((eq: any) => `${eq.count}x ${eq.name}`).join(', ') || '-';
              const brokenText = (act.brokenEquipment || []).map((eq: any) => `${eq.count}x ${eq.name}`).join(', ') || '-';
              
              let otText = '-';
              if (act.overtime) {
                const otStaff = (act.overtime.manpowerList || []).map((p: any) => p.name).join(', ') || '-';
                const otHE = (act.overtime.heavyEquipment || []).map((eq: any) => `${eq.count}x ${eq.name}`).join(', ') || '-';
                otText = `${act.overtime.hours}h (${act.overtime.manpower} pax)\nStaff: ${otStaff}\nHE (OT): ${otHE}`;
              }

              const actRows = [
                ['Location', act.location],
                ['Progress', `${act.progress} ${act.unit}`],
                ['Manpower', `${act.manpowerDirect} (${(act.manpowerList || []).map((p: any) => p.name).join(', ') || '-'})`],
                ['Overtime', otText],
                ['Heavy Equipment', heText],
                ['Broken Equipment', brokenText],
                ['Equipment Used', act.equipment || '-'],
                ['Notes', act.notes || '-'],
                ['Assistance Needed', act.assistanceNeeded || '-']
              ];

              autoTable(doc, {
                startY: yPos,
                body: actRows,
                theme: 'grid',
                styles: { fontSize: 7 },
                margin: { left: 15, right: 15 },
              });
              yPos = (doc as any).lastAutoTable.finalY + 5;

              // Photos (Regular)
              const renderPhotos = (photos: any[], title: string) => {
                if (!photos || photos.length === 0) return;
                
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 15, yPos);
                yPos += 5;

                const photoWidth = 40;
                const photoHeight = 30;
                const gap = 5;
                let xPos = 15;

                photos.forEach((photo: any) => {
                  const url = typeof photo === 'string' ? photo : photo.url;
                  const location = typeof photo === 'string' ? '' : (photo.location || '');
                  const description = typeof photo === 'string' ? '' : (photo.description || '');

                  if (!url) return;

                  if (xPos + photoWidth > 195) {
                    xPos = 15;
                    yPos += photoHeight + 15; // Extra space for text
                  }
                  
                  if (yPos + photoHeight + 10 > 280) {
                    doc.addPage();
                    yPos = 20;
                    xPos = 15;
                  }

                  try {
                    doc.addImage(url, 'JPEG', xPos, yPos, photoWidth, photoHeight);
                    
                    // Add location/description below photo
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'normal');
                    if (location) {
                      doc.text(`Loc: ${location}`, xPos, yPos + photoHeight + 3);
                    }
                    if (description) {
                      const splitDesc = doc.splitTextToSize(description, photoWidth);
                      doc.text(splitDesc, xPos, yPos + photoHeight + (location ? 6 : 3));
                    }

                    xPos += photoWidth + gap;
                  } catch (e) {
                    console.error('Error adding activity photo to PDF', e);
                  }
                });
                yPos += photoHeight + 15;
              };

              renderPhotos(act.photos, "Photos (Regular Hours)");
              renderPhotos(act.overtime?.photos, "Photos (Overtime)");
            });
          } else {
            // Report as 0 if no activities
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Activity: NO ACTIVITIES RECORDED`, 15, yPos);
            yPos += 5;
            autoTable(doc, {
              startY: yPos,
              head: [['Category', 'Value']],
              body: [
                ['Progress', '0'],
                ['Manpower', '0'],
                ['Equipment', '0'],
                ['Status', 'No Activity Recorded']
              ],
              theme: 'grid',
              styles: { fontSize: 7 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
          }
        }

        // QC SPECIFIC RENDERING
        else if (discipline === 'QC') {
          const qcOptions = reportSubOptions['QC'] || ['inspections', 'nonConformity', 'testResults', 'punchList'];
          const qcRows = [];
          if (qcOptions.includes('inspections')) qcRows.push(['Inspections', data.inspections || '-']);
          if (qcOptions.includes('nonConformity')) qcRows.push(['Non-Conformity', data.nonConformity || '-']);
          if (qcOptions.includes('testResults')) qcRows.push(['Test Results', data.testResults || '-']);
          if (qcOptions.includes('punchList')) qcRows.push(['Punch List', data.punchList || '-']);

          if (qcRows.length > 0) {
            autoTable(doc, {
              startY: yPos,
              head: [['QC Category', 'Details']],
              body: qcRows,
              theme: 'grid',
              headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
              styles: { fontSize: 8 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 8;
          }
        }

        // GENERIC RENDERING FOR OTHER ROLES
        else {
          const rows = Object.entries(data)
            .filter(([key]) => key !== 'materialRequests')
            .map(([key, value]) => [
              key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              String(value)
            ]);

          if (rows.length > 0) {
            autoTable(doc, {
              startY: yPos,
              head: [['Activity/Category', 'Details/Status']],
              body: rows,
              theme: 'striped',
              headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
              styles: { fontSize: 8 },
              margin: { left: 15, right: 15 },
            });
            yPos = (doc as any).lastAutoTable.finalY + 8;
          }
        }
      });
    }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('REY-COMMAND Project Control Nexus - Automated Intelligence Report', 105, 285, { align: 'center' });
  }

  if (isPreview) {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`${project.name}_Daily_Report_${format(new Date(reportDate), 'yyyyMMdd')}.pdf`);
  }
};

export const generateSupervisorSummaryReport = (project: Project, reports: DailyReport[], colorStyle: 'Color' | 'B&W' = 'Color') => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd MMMM yyyy');
  const supervisorReports = reports
    .filter(r => r.discipline === 'Supervisor' && r.status === 'Submitted')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Define styles based on colorStyle
  const styles = {
    primary: [41, 128, 185] as [number, number, number],
    text: [44, 62, 80] as [number, number, number],
  };

  if (colorStyle === 'B&W') {
    const p = styles.primary;
    const grayP = Math.round(p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114);
    styles.primary = [grayP, grayP, grayP];
    
    const t = styles.text;
    const grayT = Math.round(t[0] * 0.299 + t[1] * 0.587 + t[2] * 0.114);
    styles.text = [grayT, grayT, grayT];
  }

  // Header Section
  if (project.clientLogo) addLogoToDoc(doc, project.clientLogo, 15);
  if (project.contractorLogo) addLogoToDoc(doc, project.contractorLogo, 165);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name.toUpperCase(), 105, 12, { align: 'center' });
  doc.text('SUPERVISOR DASHBOARD SUMMARY', 105, 18, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${dateStr}`, 105, 24, { align: 'center' });

  // Stats Calculation (same as SupervisorDashboard.tsx)
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const parseReportData = (report?: DailyReport) => {
    if (!report) return { activities: [], totalManpower: 0, brokenEquipment: 0, totalHE: 0 };
    try {
      const data = JSON.parse(report.data);
      const activities = data.activities || [];
      const totalManpower = activities.reduce((sum: number, act: any) => sum + (Number(act.manpowerDirect) || 0), 0);
      const brokenEquipment = activities.reduce((sum: number, act: any) => {
        const broken = act.brokenEquipment || [];
        return sum + broken.reduce((s: number, eq: any) => s + (Number(eq.count) || 0), 0);
      }, 0);
      const totalHE = activities.reduce((sum: number, act: any) => {
        const he = act.heavyEquipment || [];
        return sum + he.reduce((s: number, eq: any) => s + (Number(eq.count) || 0), 0);
      }, 0);
      return { activities, totalManpower, brokenEquipment, totalHE };
    } catch (e) {
      return { activities: [], totalManpower: 0, brokenEquipment: 0, totalHE: 0 };
    }
  };

  const unitStats: Record<string, { untilYesterday: number, today: number, untilToday: number, yesterday: number }> = {};
  
  supervisorReports.forEach((report) => {
    const data = parseReportData(report);
    const reportDate = new Date(report.date);
    const isToday = reportDate.toDateString() === today.toDateString();
    const isYesterday = reportDate.toDateString() === yesterday.toDateString();
    const isBeforeToday = reportDate < new Date(today.setHours(0,0,0,0));
    
    data.activities.forEach((act: any) => {
      const unit = act.unit || 'nos';
      if (!unitStats[unit]) {
        unitStats[unit] = { untilYesterday: 0, today: 0, untilToday: 0, yesterday: 0 };
      }
      if (isToday) unitStats[unit].today += Number(act.progress) || 0;
      if (isYesterday) unitStats[unit].yesterday += Number(act.progress) || 0;
      if (isBeforeToday) unitStats[unit].untilYesterday += Number(act.progress) || 0;
      if (reportDate <= new Date()) unitStats[unit].untilToday += Number(act.progress) || 0;
    });
  });

  const todayReport = supervisorReports.find(r => new Date(r.date).toDateString() === today.toDateString()) || supervisorReports[0];
  const yesterdayReport = supervisorReports.find(r => new Date(r.date).toDateString() === yesterday.toDateString());
  const todayData = parseReportData(todayReport);
  const yesterdayData = parseReportData(yesterdayReport);

  // Overview Table
  autoTable(doc, {
    startY: 35,
    head: [['Metric', 'Today', 'Yesterday', 'Variance']],
    body: [
      ['Total Manpower', todayData.totalManpower, yesterdayData.totalManpower, todayData.totalManpower - yesterdayData.totalManpower],
      ['Total Heavy Equipment', todayData.totalHE, '-', '-'],
      ['Broken Equipment', todayData.brokenEquipment, yesterdayData.brokenEquipment, todayData.brokenEquipment - yesterdayData.brokenEquipment]
    ],
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Progress by Unit Table
  let yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PROGRESS BY UNIT', 15, yPos);
  yPos += 5;

  const unitRows = Object.entries(unitStats).map(([unit, s]) => [
    unit,
    s.untilYesterday.toFixed(1),
    s.today.toFixed(1),
    s.untilToday.toFixed(1),
    (s.today - s.yesterday).toFixed(1)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Unit', 'Until Yesterday', 'Today', 'Until Today', 'Variance']],
    body: unitRows,
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Discipline Progress
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCIPLINE CUMULATIVE ACHIEVEMENT', 15, yPos);
  yPos += 5;

  const disciplines = ['Civil', 'Mechanical', 'Piping', 'Electrical', 'Instrument'];
  const discRows = disciplines.map(disc => {
    const discActivities: any[] = [];
    supervisorReports.forEach(r => {
      const d = parseReportData(r);
      discActivities.push(...d.activities.filter((act: any) => act.discipline === disc));
    });
    const totalProgress = discActivities.reduce((sum, act) => sum + (Number(act.progress) || 0), 0);
    const unit = discActivities[0]?.unit || 'nos';
    return [disc, totalProgress.toFixed(1), unit];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Discipline', 'Total Progress', 'Unit']],
    body: discRows,
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('REY-COMMAND Supervisor Intelligence Report', 105, 285, { align: 'center' });
  }

  doc.save(`${project.name}_Supervisor_Dashboard_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const generateLogisticsSummaryReport = (project: Project, reports: DailyReport[], requests: MaterialRequest[], colorStyle: 'Color' | 'B&W' = 'Color') => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd MMMM yyyy');

  // Define styles based on colorStyle
  const styles = {
    primary: [41, 128, 185] as [number, number, number],
    text: [44, 62, 80] as [number, number, number],
  };

  if (colorStyle === 'B&W') {
    const p = styles.primary;
    const grayP = Math.round(p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114);
    styles.primary = [grayP, grayP, grayP];
    
    const t = styles.text;
    const grayT = Math.round(t[0] * 0.299 + t[1] * 0.587 + t[2] * 0.114);
    styles.text = [grayT, grayT, grayT];
  }
  
  // Header Section
  if (project.clientLogo) addLogoToDoc(doc, project.clientLogo, 15);
  if (project.contractorLogo) addLogoToDoc(doc, project.contractorLogo, 165);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name.toUpperCase(), 105, 12, { align: 'center' });
  doc.text('LOGISTICS HUB SUMMARY', 105, 18, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${dateStr}`, 105, 24, { align: 'center' });

  // Fuel Stats Calculation
  const fuelStats = reports.reduce((acc, report) => {
    try {
      if (report.discipline !== 'Logistics') return acc;
      const data = JSON.parse(report.data);
      const fuelIn = data.fuelIn?.reduce((sum: number, item: any) => sum + (item.volume || 0), 0) || 0;
      const fuelOut = data.fuelOut?.reduce((sum: number, item: any) => sum + (item.volume || 0), 0) || 0;
      return {
        totalIn: acc.totalIn + fuelIn,
        totalOut: acc.totalOut + fuelOut,
        balance: acc.balance + fuelIn - fuelOut
      };
    } catch (e) {
      return acc;
    }
  }, { totalIn: 0, totalOut: 0, balance: 0 });

  // Request Stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Proses').length,
    completed: requests.filter(r => r.status === 'Done').length,
    lowStock: requests.filter(r => r.remaining < (r.volumeSPB * 0.2)).length
  };

  // Overview Table
  autoTable(doc, {
    startY: 35,
    head: [['Metric', 'Value', 'Details']],
    body: [
      ['Total SPB Requests', stats.total, `${stats.pending} Pending | ${stats.completed} Completed`],
      ['Fuel Balance', `${fuelStats.balance} L`, `Total In: ${fuelStats.totalIn} L | Total Out: ${fuelStats.totalOut} L`],
      ['Low Inventory Items', stats.lowStock, 'Below 20% threshold']
    ],
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Material Requests Table
  let yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MATERIAL REQUESTS (SPB) STATUS', 15, yPos);
  yPos += 5;

  const requestRows = requests.map(req => [
    req.spbNo,
    req.itemName,
    `${req.used} / ${req.totalVolume} ${req.unit}`,
    req.remaining,
    req.status
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['SPB No', 'Item Name', 'Used/Total', 'Remaining', 'Status']],
    body: requestRows,
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Recent Fuel Transactions
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RECENT FUEL TRANSACTIONS', 15, yPos);
  yPos += 5;

  const fuelIn = reports.flatMap(r => {
    try {
      if (r.discipline !== 'Logistics') return [];
      const d = JSON.parse(r.data);
      return (d.fuelIn || []).map((fi: any) => ['IN', r.date, fi.source, `${fi.volume} L`]);
    } catch(e) { return []; }
  });

  const fuelOut = reports.flatMap(r => {
    try {
      if (r.discipline !== 'Logistics') return [];
      const d = JSON.parse(r.data);
      return (d.fuelOut || []).map((fo: any) => ['OUT', r.date, `${fo.vehicleName} (${fo.driverName})`, `${fo.volume} L`]);
    } catch(e) { return []; }
  });

  const fuelRows = [...fuelIn, ...fuelOut].sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime()).slice(0, 15);

  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Date', 'Source/Vehicle', 'Volume']],
    body: fuelRows,
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('REY-COMMAND Logistics Hub Intelligence Report', 105, 285, { align: 'center' });
  }

  doc.save(`${project.name}_Logistics_Hub_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const generateHSESummaryReport = (project: Project, reports: DailyReport[], colorStyle: 'Color' | 'B&W' = 'Color') => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd MMMM yyyy');
  const hseReports = reports.filter(r => r.discipline === 'HSE' && r.status === 'Submitted');

  // Define styles based on colorStyle
  const styles = {
    primary: [41, 128, 185] as [number, number, number],
    text: [44, 62, 80] as [number, number, number],
  };

  if (colorStyle === 'B&W') {
    const p = styles.primary;
    const grayP = Math.round(p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114);
    styles.primary = [grayP, grayP, grayP];
    
    const t = styles.text;
    const grayT = Math.round(t[0] * 0.299 + t[1] * 0.587 + t[2] * 0.114);
    styles.text = [grayT, grayT, grayT];
  }

  // Header Section
  if (project.clientLogo) addLogoToDoc(doc, project.clientLogo, 15);
  if (project.contractorLogo) addLogoToDoc(doc, project.contractorLogo, 165);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name.toUpperCase(), 105, 12, { align: 'center' });
  doc.text('HSE DASHBOARD SUMMARY', 105, 18, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${dateStr}`, 105, 24, { align: 'center' });

  // Stats Calculation
  let totalMH = 0;
  let totalManDay = 0;
  let totalInjuries = 0;
  let totalIncidents = 0;
  let totalComplianceIssues = 0;
  let openPermits = 0;
  let swoCount = 0;
  let healthIssues = 0;

  hseReports.forEach(r => {
    try {
      const data = JSON.parse(r.data);
      totalMH += (data.manhours?.total || 0);
      totalManDay += (data.manhours?.totalManDay || 0);
      
      if (data.safetyStats) {
        totalInjuries += (data.safetyStats.noOfInjury || 0);
      }
      
      if (data.incidentTypes) {
        totalIncidents += (data.incidentTypes.fallingFromHeight || 0) +
                         (data.incidentTypes.fallingObjects || 0) +
                         (data.incidentTypes.hitByObject || 0) +
                         (data.incidentTypes.collapseOfStack || 0) +
                         (data.incidentTypes.electricalHazards || 0) +
                         (data.incidentTypes.otherIncidents || 0);
      }
      
      if (data.complianceStats) {
        totalComplianceIssues += (data.complianceStats.momSummons || 0) +
                                (data.complianceStats.momNonCompliance || 0) +
                                (data.complianceStats.demeritPoints || 0) +
                                (data.complianceStats.momWarningLetter || 0) +
                                (data.complianceStats.momStopWorkOrderVerbal || 0);
      }

      openPermits += (data.permits?.filter((p: any) => p.status === 'Open').length || 0);
      swoCount += (data.stopWorkOrders?.length || 0);
      
      const hs = data.healthStatus;
      healthIssues += (hs?.directSick || 0) + (hs?.indirectSick || 0);
    } catch(e) { /* ignore */ }
  });

  // Overview Table
  autoTable(doc, {
    startY: 35,
    head: [['Metric', 'Value', 'Details']],
    body: [
      ['Total Manhours', totalMH.toLocaleString(), 'Cumulative safe manhours'],
      ['Total Man-day', totalManDay.toLocaleString(), 'Cumulative man-days'],
      ['Total Injuries', totalInjuries, 'Safety incidents resulting in injury'],
      ['Total Incidents', totalIncidents, 'All recorded incident types'],
      ['Compliance Issues', totalComplianceIssues, 'MOM summons and non-compliance'],
      ['Open Permits', openPermits, 'Active work permits'],
      ['Stop Work Orders', swoCount, 'Safety violations recorded'],
      ['Health Issues', healthIssues, 'Total sick cases logged']
    ],
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Recent HSE Incidents/Observations
  let yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RECENT HSE OBSERVATIONS & PERMITS', 15, yPos);
  yPos += 5;

  const hseRows = hseReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15).map(r => {
    try {
      const data = JSON.parse(r.data);
      const openCount = data.permits?.filter((p: any) => p.status === 'Open').length || 0;
      const totalCount = data.permits?.length || 0;
      const swoNos = data.stopWorkOrders?.map((s: any) => s.number).filter(Boolean).join(', ') || 'None';
      
      return [
        r.date,
        `${openCount}/${totalCount} Open`,
        swoNos,
        `${data.healthStatus?.directSick || 0} Direct / ${data.healthStatus?.indirectSick || 0} Indirect`,
        data.manhours?.total || 0
      ];
    } catch(e) { return [r.date, 'Error', 'Error', 'Error', 'Error']; }
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Permit Status', 'SWO No', 'Health Status', 'Manhours']],
    body: hseRows,
    theme: 'grid',
    headStyles: { fillColor: styles.primary as [number, number, number], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('REY-COMMAND HSE Safety Intelligence Report', 105, 285, { align: 'center' });
  }

  doc.save(`${project.name}_HSE_Dashboard_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
