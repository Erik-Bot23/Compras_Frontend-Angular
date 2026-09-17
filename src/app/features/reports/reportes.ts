import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { Sidebar } from '../sidebar/sidebar';
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
import { ReportService, ReportGroup } from '../../core/service/report-service/report-service';
import { CashService } from '../../core/service/cash-service/cash-service';
import {
  PeriodSalesDTO,
  TopProductDTO,
  PaymentMethodDTO,
  CategoryPerformanceDTO,
  LowStockDTO,
  ReportsSummaryDTO,
} from '../../core/interfaces/reports/reports';
import { CashSummary } from '../../core/interfaces/cash-interface/cash-interface';

Chart.register(...registerables);

//Paleta para las gráficas (acorde al tema oscuro del sidebar)
const PALETTE = ['#4f8cff', '#34c98c', '#ffb86b', '#ff6b8a', '#8d7bff', '#ffd166', '#06d6a0', '#118ab2'];

@Component({
  selector: 'app-reportes',
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes implements OnInit, OnDestroy, AfterViewInit {
  // ------- Filtros -------
  from: string = '';
  to: string = '';
  groupBy: ReportGroup = 'MONTH';
  topN = 5;
  threshold = 10;
  today = new Date();

  // ------- Datos -------
  loading = false;
  trend: PeriodSalesDTO[] = [];
  topProducts: TopProductDTO[] = [];
  paymentMethods: PaymentMethodDTO[] = [];
  categories: CategoryPerformanceDTO[] = [];
  lowStock: LowStockDTO[] = [];
  summary!: ReportsSummaryDTO;
  cashSummary!: CashSummary;

  // ------- Gráficas (solo navegador, SSR no soporta canvas) -------
  private trendChart?: Chart;
  private topChart?: Chart;
  private methodChart?: Chart;
  private catChart?: Chart;
  private viewReady = false;

  @ViewChild('trendCanvas') private trendCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCanvas') private topCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('methodCanvas') private methodCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('catCanvas') private catCanvas?: ElementRef<HTMLCanvasElement>;

  constructor(
    private reportService: ReportService,
    private cashService: CashService,
    public sidebar: SidebarService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.applyFilters();
    this.loadCashSummary();
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  // ------- Carga de datos -------
  applyFilters() {
    this.loading = true;

    this.reportService.getTrend(this.from, this.to, this.groupBy).subscribe((data) => {
      this.trend = data;
      this.renderCharts();
    });
    this.reportService.getTopProducts(this.from, this.to, this.topN).subscribe((data) => {
      this.topProducts = data;
      this.renderCharts();
    });
    this.reportService.getPaymentMethodDistribution(this.from, this.to).subscribe((data) => {
      this.paymentMethods = data;
      this.renderCharts();
    });
    this.reportService.getCategoryPerformance(this.from, this.to).subscribe((data) => {
      this.categories = data;
      this.renderCharts();
    });
    this.reportService.getSummary(this.from, this.to).subscribe((data) => {
      this.summary = data;
      this.renderCharts();
    });

    this.reportService.getLowStock(this.threshold).subscribe((data) => {
      this.lowStock = data;
      this.loading = false;
    });
  }

  // ------- Reset de filtros -------
  // Devuelve los filtros a sus valores por defecto y recarga los datos.
  resetFilters() {
    this.from = '';
    this.to = '';
    this.groupBy = 'MONTH';
    this.topN = 5;
    this.threshold = 10;
    this.applyFilters();
  }

  loadCashSummary() {
    this.cashService.getSummary().subscribe({
      next: (data) => (this.cashSummary = data),
      error: () => undefined, //Sin caja activa o sin autorización: el corte queda vacío
    });
  }

  // ------- Gráficas -------
  private renderCharts() {
    if (!this.viewReady || !isPlatformBrowser(this.platformId)) return;
    this.destroyCharts();

    //Tendencia (línea) — SSR-safe: solo crea Chart si el canvas existe
    if (this.trendCanvas?.nativeElement) {
      this.trendChart = new Chart(this.trendCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.trend.map((p) => p.period),
          datasets: [{
            label: 'Ventas',
            data: this.trend.map((p) => p.total),
            borderColor: PALETTE[0],
            tension: 0.3,
          }],
        },
        options: this.baseChartOptions('Importe de ventas aprobadas'),
      });
    }

    //Top productos (barras)
    if (this.topCanvas?.nativeElement) {
      this.topChart = new Chart(this.topCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: this.topProducts.map((p) => p.name),
          datasets: [{
            label: 'Unidades',
            data: this.topProducts.map((p) => p.quantity),
            backgroundColor: PALETTE[1],
          }],
        },
        options: this.baseChartOptions('Productos más vendidos'),
      });
    }

    //Métodos de pago (dona)
    if (this.methodCanvas?.nativeElement) {
      this.methodChart = new Chart(this.methodCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.paymentMethods.map((m) => m.label),
          datasets: [{
            data: this.paymentMethods.map((m) => m.total),
            backgroundColor: PALETTE.slice(0, this.paymentMethods.length),
          }],
        },
        // maintainAspectRatio:false → la dona llena el .chart-box (300px de alto)
        // y Chart.js la centra en el recuadro. Con el ratio por defecto el canvas
        // tomaba otras dimensiones y la grafica quedaba descuadrada.
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        } as any,
      });
    }

    //Categorías (barras)
    if (this.catCanvas?.nativeElement) {
      this.catChart = new Chart(this.catCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: this.categories.map((c) => c.name || 'Sin categoría'),
          datasets: [{
            label: 'Ventas',
            data: this.categories.map((c) => c.total),
            backgroundColor: PALETTE[3],
          }],
        },
        options: this.baseChartOptions('Rendimiento por categoría'),
      });
    }
  }

  private destroyCharts() {
    [this.trendChart, this.topChart, this.methodChart, this.catChart].forEach(
      (chart) => {
        chart?.destroy();
      }
    );
    this.trendChart = this.topChart = this.methodChart = this.catChart = undefined;
  }

  private baseChartOptions(title: string) {
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        title: { display: true, text: title },
      },
    } as any;
  }

  // ------- Exportaciones -------
  exportPDF() {
    const doc = new jsPDF();

    let y = 15;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de ventas', 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Rango: ${this.from || 'inicio'} → ${this.to || 'hoy'} | Agrupación: ${this.groupBy.toLowerCase()}`,
      14, y
    );
    y += 4;

    if (this.summary) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Ventas: ${this.summary.totalSales}  |  Total: $${this.summary.totalAmount.toFixed(2)}  |  Ticket promedio: $${this.summary.averageTicket.toFixed(2)}`,
        14, y
      );
      y += 8;
    }

    y = this.addTable(doc, 'Tendencia de ventas', ['Periodo', 'Ventas', 'Total'], this.trend.map((p) => [p.period, p.count, `$${p.total.toFixed(2)}`]), y);
    y = this.addTable(doc, 'Productos más vendidos', ['Producto', 'Unidades', 'Total'], this.topProducts.map((p) => [p.name, p.quantity, `$${p.total.toFixed(2)}`]), y);
    y = this.addTable(doc, 'Métodos de pago', ['Método', 'Tickets', 'Total'], this.paymentMethods.map((m) => [m.label, m.count, `$${m.total.toFixed(2)}`]), y);
    y = this.addTable(doc, 'Rendimiento por categoría', ['Categoría', 'Unidades', 'Ventas'], this.categories.map((c) => [c.name || 'Sin categoría', c.quantity, `$${c.total.toFixed(2)}`]), y);
    y = this.addTable(doc, 'Stock bajo', ['Producto', 'SKU', 'Categoría', 'Stock'], this.lowStock.map((p) => [p.name, p.sku || '—', p.category || '—', p.stock]), y);

    doc.save(`reporte-ventas-${this.filenameDate()}.pdf`);
  }

  exportExcel() {
    const wb = XLSX.utils.book_new();
    const addSheet = (name: string, head: string[], rows: (string | number)[][]) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), name.slice(0, 31));
    };

    addSheet('Tendencia', ['Periodo', 'Ventas', 'Total'], this.trend.map((p) => [p.period, p.count, p.total]));
    addSheet('Top productos', ['Producto', 'Unidades', 'Total'], this.topProducts.map((p) => [p.name, p.quantity, p.total]));
    addSheet('Metodos de pago', ['Método', 'Tickets', 'Total'], this.paymentMethods.map((m) => [m.label, m.count, m.total]));
    addSheet('Categorias', ['Categoría', 'Unidades', 'Ventas'], this.categories.map((c) => [c.name || 'Sin categoría', c.quantity, c.total]));
    addSheet('Stock bajo', ['Producto', 'SKU', 'Código', 'Categoría', 'Stock'], this.lowStock.map((p) => [p.name, p.sku, p.barcode, p.category, p.stock]));

    XLSX.writeFile(wb, `reporte-ventas-${this.filenameDate()}.xlsx`);
  }

  // ------- Corte de caja -------
  printCorte() {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  exportCortePDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Corte de caja', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Caja #${this.cashSummary?.cashId ?? '—'} | Generado: ${new Date().toLocaleString('es-MX')}`, 14, 22);

    const rows = [
      ['Fondo inicial', this.fmt(this.cashSummary?.openingAmount)],
      ['Ventas en efectivo', this.fmt(this.cashSummary?.cashSales)],
      ['Ventas débito', this.fmt(this.cashSummary?.debitSales)],
      ['Ventas crédito', this.fmt(this.cashSummary?.creditSales)],
      ['Total ventas', this.fmt(this.cashSummary?.totalSales)],
      ['Tickets', `${this.cashSummary?.totalTickets ?? 0}`],
      ['Monto esperado', this.fmt(this.cashSummary?.expectedAmount)],
      ['Diferencia', this.fmt(this.cashSummary?.difference)],
    ];
    autoTable(doc, { startY: 30, head: [['Concepto', 'Monto']], body: rows });
    doc.save(`corte-caja-${this.filenameDate()}.pdf`);
  }

  exportCorteExcel() {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Monto'],
      ['Fondo inicial', this.cashSummary?.openingAmount ?? 0],
      ['Ventas en efectivo', this.cashSummary?.cashSales ?? 0],
      ['Ventas débito', this.cashSummary?.debitSales ?? 0],
      ['Ventas crédito', this.cashSummary?.creditSales ?? 0],
      ['Total ventas', this.cashSummary?.totalSales ?? 0],
      ['Tickets', this.cashSummary?.totalTickets ?? 0],
      ['Monto esperado', this.cashSummary?.expectedAmount ?? 0],
      ['Diferencia', this.cashSummary?.difference ?? 0],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Corte de caja');
    XLSX.writeFile(wb, `corte-caja-${this.filenameDate()}.xlsx`);
  }

  // ------- Utilidades -------
  private addTable(doc: jsPDF, title: string, head: string[], body: (string | number)[][], startY: number): number {
    if (body.length === 0) return startY;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    if (startY > 240) {
      doc.addPage();
      startY = 15;
    }
    doc.text(title, 14, startY + 4);

    autoTable(doc, {
      startY: startY + 6,
      head: [head],
      body,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [49, 90, 158] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? startY;
    return finalY + 10;
  }

  private fmt(value: number | null | undefined): string {
    return value == null || isNaN(value) ? '$0.00' : `$${value.toFixed(2)}`;
  }

  private filenameDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}