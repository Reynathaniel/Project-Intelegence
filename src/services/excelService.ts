import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Project, DailyReport } from '../types';

export const generateProjectExcel = (project: Project, reports: DailyReport[]) => {
  const reportDate = reports.length > 0 ? reports[0].date : format(new Date(), 'yyyy-MM-dd');
  const wb = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ['PROJECT DAILY PROGRESS REPORT'],
    [''],
    ['Project Name', project.name],
    ['Location', project.location],
    ['Client', project.client || 'N/A'],
    ['Contractor', project.contractorName || 'N/A'],
    ['Contract No', project.contractNo || 'N/A'],
    ['Date', format(new Date(reportDate), 'dd-MMM-yyyy')],
    [''],
    ['Manpower & Weather Summary'],
    ['Man Power Total', 'Working Time', 'Weather Condition']
  ];

  const weather = reports.find(r => r.weather)?.weather;
  const manpower = reports.find(r => r.manpower)?.manpower;

  summaryData.push([
    String(manpower?.total || 'N/A'),
    weather?.workingTime || '06:00 - 18:00',
    `Rainy: ${weather?.rainy || 0}h | Sunny: ${weather?.sunny || 0}h`
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Discipline Sheets
  const disciplines = [
    'Project Control',
    'Engineering',
    'Procurement',
    'Construction',
    'Logistics',
    'HSE',
    'QC',
    'HR'
  ];

  disciplines.forEach(discipline => {
    const disciplineReports = reports.filter(r => r.discipline === discipline);
    if (disciplineReports.length > 0) {
      let discData: any[][] = [['Category', 'Details']];
      
      if (discipline === 'Logistics') {
        discData = [['No SPB', 'Item Name', 'Vol', 'Unit', 'Work Item', 'Area', 'Loc', 'Status']];
        disciplineReports.forEach(report => {
          const data = JSON.parse(report.data);
          if (data.materialRequests?.length > 0) {
            data.materialRequests.forEach((req: any) => {
              discData.push([
                req.spbNo,
                req.itemName,
                req.volumeSPB,
                req.unit,
                req.workItem || '-',
                req.area || '-',
                req.location,
                req.status
              ]);
            });
          }
          // Add other fields if any
          Object.entries(data).forEach(([key, value]) => {
            if (key !== 'materialRequests') {
              discData.push([
                key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                String(value)
              ]);
            }
          });
        });
      } else {
        disciplineReports.forEach(report => {
          const data = JSON.parse(report.data);
          Object.entries(data).forEach(([key, value]) => {
            discData.push([
              key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              String(value)
            ]);
          });
        });
      }
      const wsDisc = XLSX.utils.aoa_to_sheet(discData);
      XLSX.utils.book_append_sheet(wb, wsDisc, discipline.substring(0, 31));
    }
  });

  XLSX.writeFile(wb, `${project.name}_Daily_Report_${format(new Date(reportDate), 'yyyyMMdd')}.xlsx`);
};
