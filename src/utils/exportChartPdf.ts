import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { STRINGS } from '../constants';
import { Cycle, DayLog } from '../types';
import { getLocalDateISO } from './marquetteAlgorithm';

const CHART_DAYS = 35;
const CYCLES_PER_PAGE = 8;

const pageWidth = 792;
const pageHeight = 612;
const margin = 28;
const labelWidth = 98;
const cellWidth = (pageWidth - margin * 2 - labelWidth) / CHART_DAYS;
const cellHeight = 34;

const palette = {
  text: rgb(0.13, 0.13, 0.13),
  secondaryText: rgb(0.42, 0.42, 0.42),
  border: rgb(0.82, 0.82, 0.82),
  surface: rgb(1, 1, 1),
  header: rgb(0.36, 0.42, 0.75),
  period: rgb(0.39, 0.71, 0.96),
  low: rgb(0.65, 0.84, 0.65),
  high: rgb(1, 0.8, 0.5),
  peak: rgb(0.94, 0.6, 0.6),
  pale: rgb(0.96, 0.96, 0.96),
  heart: rgb(0.9, 0.12, 0.36),
};

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCycleNumber(allCycles: Cycle[], cycle: Cycle): number {
  return allCycles.findIndex(item => item.id === cycle.id) + 1;
}

function getCellColor(log: DayLog | undefined, cycleDay: number) {
  if (log?.reading === 'peak') return palette.peak;
  if (log?.reading === 'high') return palette.high;
  if (log?.reading === 'low') return palette.low;
  if (cycleDay <= 5) return palette.period;
  return palette.surface;
}

function getCellLabel(cycle: Cycle, cycleDay: number, log: DayLog | undefined): string {
  if (cycle.peakDay && cycleDay === cycle.peakDay) return 'P';
  if (cycle.peakDay && cycleDay === cycle.peakDay + 1) return 'P2';
  if (cycle.peakDay && cycleDay >= cycle.peakDay + 2 && cycleDay <= cycle.peakDay + 4) {
    return String(cycleDay - cycle.peakDay - 1);
  }
  if (log?.reading === 'high') return 'H';
  if (log?.reading === 'low') return 'L';
  if (log?.reading === 'peak') return log.isAutoPeak ? 'P2' : 'P';
  if (log?.bleeding && log.bleeding !== 'none') return 'B';
  return '';
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: PDFFont,
  color = palette.text
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y,
    size,
    font,
    color,
  });
}

export async function exportMarquetteChartPdf(cycles: Cycle[]) {
  try {
    const completedCycles = cycles
      .filter(cycle => cycle.isComplete)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (completedCycles.length === 0) {
      Alert.alert('No Completed Cycles', 'There are no completed cycles to export.');
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const chunks: Cycle[][] = [];

    for (let i = 0; i < completedCycles.length; i += CYCLES_PER_PAGE) {
      chunks.push(completedCycles.slice(i, i + CYCLES_PER_PAGE));
    }

    chunks.forEach((chunk, pageIndex) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const titleY = pageHeight - margin - 14;

      page.drawText(`${STRINGS.appName} Marquette Chart`, {
        x: margin,
        y: titleY,
        size: 18,
        font: boldFont,
        color: palette.header,
      });

      page.drawText(`Generated ${formatDate(getLocalDateISO())}`, {
        x: pageWidth - margin - 150,
        y: titleY + 2,
        size: 9,
        font: regularFont,
        color: palette.secondaryText,
      });

      page.drawText(`Cycles ${getCycleNumber(completedCycles, chunk[0])}-${getCycleNumber(completedCycles, chunk[chunk.length - 1])}`, {
        x: margin,
        y: titleY - 18,
        size: 10,
        font: regularFont,
        color: palette.secondaryText,
      });

      const tableTop = pageHeight - margin - 72;

      page.drawRectangle({
        x: margin,
        y: tableTop,
        width: labelWidth,
        height: 24,
        color: palette.pale,
        borderColor: palette.border,
        borderWidth: 1,
      });
      page.drawText('Cycle', {
        x: margin + 8,
        y: tableTop + 8,
        size: 9,
        font: boldFont,
        color: palette.text,
      });

      for (let day = 1; day <= CHART_DAYS; day += 1) {
        const x = margin + labelWidth + (day - 1) * cellWidth;
        page.drawRectangle({
          x,
          y: tableTop,
          width: cellWidth,
          height: 24,
          color: palette.pale,
          borderColor: palette.border,
          borderWidth: 0.6,
        });
        drawCenteredText(page, String(day), x, tableTop + 8, cellWidth, 7, boldFont, palette.secondaryText);
      }

      chunk.forEach((cycle, rowIndex) => {
        const y = tableTop - (rowIndex + 1) * cellHeight;
        const cycleNumber = getCycleNumber(completedCycles, cycle);

        page.drawRectangle({
          x: margin,
          y,
          width: labelWidth,
          height: cellHeight,
          color: palette.surface,
          borderColor: palette.border,
          borderWidth: 0.8,
        });
        page.drawText(`Cycle ${cycleNumber}`, {
          x: margin + 6,
          y: y + 18,
          size: 8,
          font: boldFont,
          color: palette.text,
        });
        page.drawText(formatDate(cycle.startDate), {
          x: margin + 6,
          y: y + 7,
          size: 6.5,
          font: regularFont,
          color: palette.secondaryText,
        });

        for (let day = 1; day <= CHART_DAYS; day += 1) {
          const x = margin + labelWidth + (day - 1) * cellWidth;
          const log = cycle.days.find(item => item.cycleDay === day);
          const label = getCellLabel(cycle, day, log);
          const isPeak = cycle.peakDay === day;

          page.drawRectangle({
            x,
            y,
            width: cellWidth,
            height: cellHeight,
            color: getCellColor(log, day),
            borderColor: isPeak ? rgb(0.82, 0.1, 0.1) : palette.border,
            borderWidth: isPeak ? 1.2 : 0.5,
          });

          if (label) {
            drawCenteredText(page, label, x, y + 13, cellWidth, label.length > 1 ? 6.2 : 8, boldFont);
          }

          if (log?.intercourse) {
            drawCenteredText(page, 'I', x, y + 3, cellWidth, 6, boldFont, palette.heart);
          }
        }
      });

      const legendY = margin + 34;
      const legendItems = [
        { label: 'Period', color: palette.period },
        { label: 'Low', color: palette.low },
        { label: 'High', color: palette.high },
        { label: 'Peak', color: palette.peak },
        { label: 'I = intercourse', color: palette.surface },
      ];

      legendItems.forEach((item, index) => {
        const x = margin + index * 120;
        page.drawRectangle({
          x,
          y: legendY,
          width: 12,
          height: 12,
          color: item.color,
          borderColor: palette.border,
          borderWidth: 0.6,
        });
        page.drawText(item.label, {
          x: x + 18,
          y: legendY + 2,
          size: 8,
          font: regularFont,
          color: palette.text,
        });
      });

      page.drawText(`Page ${pageIndex + 1} of ${chunks.length}`, {
        x: pageWidth - margin - 60,
        y: margin,
        size: 8,
        font: regularFont,
        color: palette.secondaryText,
      });
    });

    const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
    const filename = `Fidelis_Marquette_Chart_${getLocalDateISO()}.pdf`;
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Export Marquette Chart PDF',
    });
  } catch (error: any) {
    console.error('PDF Export Error:', error);
    Alert.alert('PDF Export Failed', `An error occurred: ${error.message || 'Unknown error'}`);
  }
}
