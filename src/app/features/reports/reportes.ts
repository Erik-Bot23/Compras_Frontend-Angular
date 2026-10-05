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
  CashBoxReportDTO,
  CashReportDTO,
  CategoryPerformanceDTO,
  LowStockDTO,
  MarginDTO,
  PaymentMethodDTO,
  PeriodSalesDTO,
  ProfitDTO,
  ReportsSummaryDTO,
  TopProductDTO,
} from '../../core/interfaces/reports/reports';
import { CashBox, CashSummary } from '../../core/interfaces/cash-interface/cash-interface';

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
  profit!: ProfitDTO;

  // =========================================================================
  //  HISTORIAL DE CAJA (V5)
  // =========================================================================

  /**
   * Cajas FÍSICAS para el selector, no turnos.
   *
   * <p>Es `CashBox[]` y antes era `CashRegister[]`. La diferencia no es
   * estética: una caja abierta cinco veces produce cinco filas en
   * `cashHistory`, así que el dropdown mostraba "CAJA 1" cinco veces y el
   * usuario no podía distinguir los turnos entre sí.
   */
  cashBoxes: CashBox[] = [];

  /** Id de la caja elegida en la barra de filtros (null = ninguna elegida). */
  selectedBoxId: number | null = null;

  /** La caja elegida con TODAS sus sesiones. Llega al elegirla. */
  cashBoxReport: CashBoxReportDTO | null = null;

  /**
   * Filtro por usuario DENTRO de la sección de caja (null = todos).
   *
   * <p>Es el mismo patrón que `selectedBoxId`: se aplica en el backend y por eso
   * hay que volver a pedir el reporte. Un filtro solo en el frontend obligaría a
   * traer todas las ventas de todos los turnos para descartar la mayoría en el
   * navegador.
   */
  cashBoxUserFilter: number | null = null;

  /**
   * Último filtro de usuario que se aplicó de verdad al backend.
   *
   * <p>Existe SOLO para comparar: si el `ngModel` re-emite el mismo valor (por
   * ejemplo porque las opciones se re-renderizaron), esta guarda evita repetir
   * la petición. Sin ella, el ciclo render → `ngModelChange` → request →
   * render deja la página colgada.
   */
  private usuarioAplicado: number | null = null;

  /**
   * Vendedores que aparecen en esta caja, para alimentar el filtro de usuario.
   *
   * <p>Se arma con los `sellers` de las sesiones, NO con el padrón de usuarios
   * del sistema: son los que de verdad vendieron ahí. Con la lista completa, en
   * un local con 8 empleados, 6 opciones darían una tabla vacía sin poder
   * distinguir "sin resultados" de "este usuario no vendió aquí".
   *
   * 🔑 <b>POR QUÉ ES UN ARREGLO GUARDADO Y NO UN GETTER.</b> Con un getter que
   * devuelve `[...mapa.values()].sort(...)`, cada ciclo de detección de cambios
   * produce un array NUEVO con objetos NUEVOS. El `*ngFor` de los `<option>` no
   * tiene `trackBy`, así que destruye y reconstruye todas las opciones en cada
   * ciclo; eso hace que `ngModel` re-emita `ngModelChange`, que dispara la
   * petición HTTP, que devuelve datos nuevos, que vuelven a crear el array... y
   * la página se queda colgada.
   *
   * <p>Guardarlo en una propiedad y recalcularlo solo cuando llega el reporte
   * corta el ciclo por la raíz, en vez de intentarfrenarlo en la plantilla.
   */
  boxReportUsers: { userId: number | null; userName: string }[] = [];

  /**
   * Recalcula `boxReportUsers` a partir del reporte recibido.
   *
   * <p>Se llama UNA vez por respuesta HTTP, nunca desde la plantilla.
   */
  private recalcularUsuariosDeLaCaja() {
    if (!this.cashBoxReport) {
      this.boxReportUsers = [];
      return;
    }

    const porId = new Map<number | null, { userId: number | null; userName: string }>();

    for (const sesion of this.cashBoxReport.sessions) {
      for (const v of sesion.sellers) {
        // set() y no add(): el mismo vendedor aparece en varios turnos y en el
        // dropdown solo debe salir una vez.
        porId.set(v.userId, { userId: v.userId, userName: v.userName });
      }
    }

    // Null (sin usuario) al final: es el caso excepcional, no el principal.
    this.boxReportUsers = [...porId.values()].sort((a, b) => {
      if (a.userId === null) return 1;
      if (b.userId === null) return -1;
      return a.userName.localeCompare(b.userName);
    });
  }

  /**
   * `trackBy` del `*ngFor` de usuarios.
   *
   * <p>Segunda barrera contra el mismo problema: con `trackBy` Angular REUSSA los
   * nodos del DOM cuando la identidad del objeto no cambia, en vez de recrear
   * cada `<option>`. El id del usuario es la identidad correcta aquí.
   *
   * <p>Para el caso sin usuario (id null) se usa una etiqueta fija, porque
   * `null` no sirve como clave de `trackBy` ( Angular lo trata como valor vacío).
   */
  trackByUsuario(userId: number | null): string {
    return userId === null ? 'sin-usuario' : String(userId);
  }

  /** Id del turno cuyo detalle de ventas está desplegado (null = ninguno). */
  sessionAbiertaId: number | null = null;

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
    this.loadCashBoxes();
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

    //V3: utilidad (profit = ingresos - costo de lo vendido)
    this.reportService.getProfit(this.from, this.to).subscribe((data) => {
      this.profit = data;
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

  // ============================================================
  //  V5: Historial de CAJA con sus sesiones (filtro)
  // ============================================================

  /**
   * Carga las cajas FÍSICAS para el selector de la barra de filtros.
   *
   * <p>El error se traga a propósito: sin permiso VER_CAJA el backend responde
   * 403, y el resto de los reportes (utilidad, ventas, gráficas) debe seguir
   * funcionando. Un toast de error por un filtro opcional sería ruido.
   */
  loadCashBoxes() {
    this.cashService.getBoxes().subscribe({
      next: (data) => (this.cashBoxes = data),
      error: () => (this.cashBoxes = []),
    });
  }

  /**
   * Se dispara al elegir una caja en el filtro (o "todas").
   *
   * <p>Al cambiar de caja se limpian el filtro de usuario y el turno desplegado:
   * si no, se quedaría un `userId` que pertenece a la caja anterior y la tabla
   * saldría vacía sin motivo aparente.
   */
  onBoxSelected(boxId: number | null) {
    this.cashBoxUserFilter = null;
    this.usuarioAplicado = null;
    this.sessionAbiertaId = null;

    if (boxId === null || boxId === undefined) {
      this.clearBoxSelection();
      return;
    }

    // Se limpian primero para que la tabla anterior no quede visible mientras
    // carga la nueva: ver los datos de CAJA 1 bajo el título de CAJA 2 sería
    // peor que no mostrar nada.
    this.cashBoxReport = null;
    this.boxReportUsers = [];
    this.loadCashBoxReport(boxId);
  }

  /** Cambia el filtro de usuario y recarga el reporte de la caja. */
  applyCashBoxUserFilter() {
    if (this.selectedBoxId === null) return;

    // 🔑 Tercera barrera contra el ciclo infinito: si el valor no CAMBIÓ, no se
    // pide nada. Sin esta guarda, cualquier re-emisión del `ngModel` (por
    // ejemplo al re-renderizar las opciones) volvería a disparar el request.
    if (this.cashBoxUserFilter === this.usuarioAplicado) return;

    this.usuarioAplicado = this.cashBoxUserFilter;
    this.sessionAbiertaId = null;
    this.cashBoxReport = null;
    this.loadCashBoxReport(this.selectedBoxId);
  }

  /**
   * Pide el reporte de UNA caja con sus sesiones.
   *
   * <p>Los filtros de usuario y fechas van al backend: si se filtrara en el
   * navegador habría que traer las ventas de todos los turnos para descartar la
   * mayoría, y los totales de la tabla no coincidirían con los del backend.
   *
   * <p>El rango de fechas es el de la barra de filtros general: son los mismos
   * "Desde/Hasta" de arriba y así el usuario no tiene dos juegos de fechas que
   * se pisen.
   */
  private loadCashBoxReport(boxId: number) {
    this.reportService.getCashBoxReport(boxId, {
      from: this.from,
      to: this.to,
      userId: this.cashBoxUserFilter,
    }).subscribe({
      next: (data) => {
        this.cashBoxReport = data;
        // La lista de vendedores se recalcula AQUÍ y no en un getter: ver la nota
        // de `boxReportUsers` sobre por qué eso congela la página si se hace al
        // revés.
        this.recalcularUsuariosDeLaCaja();
      },
      // 404 tolerado: la caja se pudo dar de baja o borrar entre la carga de la
      // lista y el clic. No debe romper la pantalla.
      error: () => {
        this.cashBoxReport = null;
        this.boxReportUsers = [];
      },
    });
  }

  /**
   * Despliega u oculta el detalle de ventas de un turno.
   *
   * <p>Solo uno a la vez: `sessionAbiertaId` es un id, no una lista. Con dos
   * turnos abiertos a la vez la tabla duplicaría su alto y se perdería de vista
   * de qué turno es cada bloque.
   */
  toggleSesion(sessionId: number) {
    this.sessionAbiertaId = this.sessionAbiertaId === sessionId ? null : sessionId;
  }

  clearBoxSelection() {
    this.selectedBoxId = null;
    this.cashBoxReport = null;
    this.cashBoxUserFilter = null;
    this.usuarioAplicado = null;
    this.sessionAbiertaId = null;
    this.boxReportUsers = [];
  }
}