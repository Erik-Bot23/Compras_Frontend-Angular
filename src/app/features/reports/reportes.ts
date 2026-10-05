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
  CajaCorte,
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
import { CashBox } from '../../core/interfaces/cash-interface/cash-interface';

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
  // 🔑 `cashSummary` se eliminó. Era el endpoint `/cash/summary`, que devuelve
  // el turno ABIERTO en ese momento (findByActiveTrue) y por eso ignoraba la caja
  // seleccionada. Ahora el corte es `corteCaja`, que se suma de los turnos de la
  // caja elegida. Ver `calcularCorteDeCaja`.
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
   * Hay una petición del reporte de caja en vuelo.
   *
   * <p><b>Es aparte de `loading` a propósito.</b> `loading` es el de la barra de
   * filtros general (summary, gráficas, stock bajo): si se reutilizara, el botón
   * "Aplicar" y los <select> de arriba se bloquearían mientras se cambia el
   * usuario de una caja, que es una operación local y rápida.
   *
   * <p>🔑 <b>Por qué la tabla NO se limpia al filtrar por usuario.</b> Con
   * `cashBoxReport = null` el `*ngIf` de la tabla la borraba de la pantalla
   * durante cada petición: el usuario veía la sección desaparecer y reaparecer
   * un segundo después, y el <select> de usuario iba con ella, así que durante
   * la carga no había ni siquiera forma de volver a "Todos".
   */
  boxLoading = false;

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
   /**
   * <p>🔑 <b>Guardarlo en una propiedad y recalcularlo solo cuando llega el
   * reporte</b> corta el ciclo por la raíz, en vez de intentar frenarlo en la
   * plantilla.
   *
   * <p><b>Y recalcularlo SOLO cuando la respuesta no viene filtrada.</b> Con un
   * filtro de usuario activo el backend devuelve solo los turnos de ese
   * usuario, así que sus `sellers` también viene recortados: si se reconstruyera
   * la lista con ellos, el desplegable se quedaría con una sola opción (la del
   * usuario filtrado) y el usuario tendría que volver a elegir "Todos" para
   * recuperar a los demás. Es un menú que se come a sí mismo.
   */
  boxReportUsers: { userId: number | null; userName: string }[] = [];

  /**
   * ¿La respuesta que llega trae ALGÚN filtro aplicado?
   *
   * <p>Se deduce de lo que se MANDÓ, no de lo que llegó. Mirar las sesiones
   * recibidas no serviría: si el filtro no encuentra nada, `sessions` viene vacío y
   * no hay forma de distinguir "esta caja no tiene turnos" de "el filtro no
   * coincidió con ninguno".
   *
   * <p>🔑 Esta pregunta es SOLO para la diferencia del corte, que no es
   * calculable si el total que se está mirando no es el total de la caja. Para el
   * desplegable de usuarios hay otra pregunta distinta: ver `filtradoPorUsuario`.
   */
  private get reporteFiltrado(): boolean {
    return this.usuarioAplicado !== null || !!this.from || !!this.to;
  }

  /**
   * ¿El recorte de la respuesta se debe al filtro de USUARIO?
   *
   * <p>Es la pregunta que decide si se reconstruye `boxReportUsers`, y no puede
   * ser la misma que `reporteFiltrado`:
   *
   * <table>
   *   <tr><th>Filtro</th><th>Qué llega</th><th>Roster</th></tr>
   *   <tr><td>Solo fechas</td>
   *       <td>Los turnos del rango, con TODOS los que vendieron en él</td>
   *       <td>✅ sí se reconstruye</td></tr>
   *   <tr><td>Usuario</td>
   *       <td>Solo los turnos de ese usuario, y sus `sellers` son solo él</td>
   *       <td>❌ no se reconstruye</td></tr>
   * </table>
   *
   * <p>Usar `reporteFiltrado` para las dos cosas dejaba el desplegable en "Todos"
   * y nada más siempre que hubiera fechas: se trampa al usuario con el caso común
   * (filtrar por mes y luego buscar a un vendedor) para arreglar un caso que solo
   * ocurre sin fechas.
   */
  private get filtradoPorUsuario(): boolean {
    return this.usuarioAplicado !== null;
  }

  /**
   * El corte de caja: la suma de los turnos que la tabla de arriba muestra.
   *
   * <p><b>Es una propiedad, no un getter, y se calcula UNA vez por respuesta.</b>
   * Es la misma razón por la que `boxReportUsers` es una propiedad y no un
   * getter: un getter devuelve un objeto NUEVO en cada ciclo de detección de
   * cambios. Acá no dispara peticiones (no hay `ngModel` que lo escuche), pero
   * sí rehace los bindings del DOM sin parar y, sobre todo, rompe la
   * identidad para `*ngIf` y para el `?.` del template.
   *
   * <p>`null` cuando la caja no tiene turnos visibles: no se muestra una tarjeta
   * de ceros, porque "no hay datos" y "todo fue cero" son cosas distintas.
   */
  corteCaja: CajaCorte | null = null;

  /**
   * Suma los turnos del reporte en un corte de caja.
   *
   * <p>🔑 <b>La diferencia se suma SOLO sobre turnos cerrados.</b> Es un dato
   * congelado al cerrar: un turno abierto todavía no tiene diferencia (el
   * backend manda `sesion.getDifference()`, que es null hasta que se cierra).
   * Si se sumara incluyendo los abiertos, un turno abierto entra como 0 y el
   * total queda más chico de lo que es, sin que nada lo advierta.
   */
  private calcularCorteDeCaja(data: CashBoxReportDTO) {
    const s = data.sessions;
    if (s.length === 0) {
      this.corteCaja = null;
      return;
    }

    let fondo = 0, efectivo = 0, debito = 0, credito = 0;
    let esperado = 0, tickets = 0, utilidad = 0, diferencia = 0;
    let cerrados = 0, abiertos = 0;
    const motivos: string[] = [];

    for (const x of s) {
      fondo += x.openingAmount ?? 0;
      efectivo += x.cashSales ?? 0;
      debito += x.debitSales ?? 0;
      credito += x.creditSales ?? 0;
      esperado += x.expectedAmount ?? 0;
      tickets += x.totalTickets ?? 0;
      utilidad += x.grossProfit ?? 0;

      if (x.active) {
        abiertos++;
      } else {
        cerrados++;
      }

      // Con filtros la diferencia llega null en TODOS los turnos y no se puede
      // reconstruir: no es que sea cero, es que no corresponde.
      if (x.difference !== null && x.difference !== undefined) {
        diferencia += x.difference;
        if (x.differenceReason) motivos.push(x.differenceReason);
      }
    }

    const sinDiferenciaUtil = this.reporteFiltrado || cerrados === 0;

    this.corteCaja = {
      turnos: s.length,
      turnosCerrados: cerrados,
      turnoAbierto: abiertos > 0,
      openingAmount: fondo,
      cashSales: efectivo,
      debitSales: debito,
      creditSales: credito,
      // Se recalcula en vez de sumarse por coherencia: `expectedAmount` del
      // backend es `fondo + efectivo` (ReportsImpl:509), así que el total
      // tiene que salir de la misma cuenta y no de otra suma.
      totalSales: efectivo + debito + credito,
      expectedAmount: esperado,
      totalTickets: tickets,
      grossProfit: utilidad,
      difference: sinDiferenciaUtil ? null : diferencia,
      differenceReason: motivos.length ? motivos.join(' · ') : null,
    };
  }

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
    // Ya no se pide `/cash/summary`: el corte sale de `corteCaja`, que se arma
    // con los turnos que devuelve el reporte de la caja elegida.
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

    // El rango de fechas es COMPARTIDO con la sección de caja, a propósito: el
    // usuario no debería tener dos juegos de fechas que se pisen. Pero si eso es
    // así, aplicar los filtros tiene que recargar TAMBIÉN la tabla de turnos.
    // Sin esta línea, cambiar las fechas solo movía las gráficas y la caja
    // seguía mostrando el rango anterior: el filtro de arriba parecía no
    // filtrar, que es justo lo que se reportó.
    if (this.selectedBoxId !== null) {
      this.loadCashBoxReport(this.selectedBoxId);
    }
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
  //
  // 🔑 Estas tres exportaciones leen `corteCaja`, que se arma sumando los
  // turnos de la caja ELEGIDA. Antes leían `cashSummary` (endpoint
  // `/cash/summary`), que devuelve el turno abierto en ese momento: con el
  // corte en pantalla y el PDF de otra caja, el papel no cuadraba con la
  // pantalla. Exportar lo que se ve es la única forma de que el corte impreso
  // sirva para conferir.
  //
  // El nombre del archivo lleva el número de caja y el filtro de usuario, para
  // que al imprimir varias cajas seguidas no se confundan los papeles.

  /** Etiqueta de la caja en curso, para encabezados y nombres de archivo. */
  get corteRotulo(): string {
    const caja = this.cashBoxReport;
    if (!caja) return 'caja';
    return this.cashBoxUserFilter === null
      ? caja.number
      : `${caja.number} - ${this.nombreUsuarioFiltrado()}`;
  }

  /** El usuario filtrado, para el encabezado. 'Todos' si no hay filtro. */
  private nombreUsuarioFiltrado(): string {
    if (this.cashBoxUserFilter === null) return 'Todos';
    const u = this.boxReportUsers.find((x) => x.userId === this.cashBoxUserFilter);
    return u ? u.userName : `usuario ${this.cashBoxUserFilter}`;
  }

  printCorte() {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  exportCortePDF() {
    const c = this.corteCaja;
    if (!c) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Corte de caja', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${this.corteRotulo}  |  ${c.turnos} turno(s)  |  Generado: ${new Date().toLocaleString('es-MX')}`,
      14,
      22
    );

    const rows: string[][] = [
      ['Turnos sumados', `${c.turnos} (${c.turnosCerrados} cerrados)`],
      ['Fondo inicial', this.fmt(c.openingAmount)],
      ['Ventas en efectivo', this.fmt(c.cashSales)],
      ['Ventas débito', this.fmt(c.debitSales)],
      ['Ventas crédito', this.fmt(c.creditSales)],
      ['Total ventas', this.fmt(c.totalSales)],
      ['Tickets', `${c.totalTickets}`],
      ['Monto esperado', this.fmt(c.expectedAmount)],
      ['Utilidad', this.fmt(c.grossProfit)],
      // 🔑 "—" y no $0.00 cuando la diferencia no es calculable. Ver `CajaCorte`.
      ['Diferencia', c.difference === null ? '—' : this.fmt(c.difference)],
    ];
    autoTable(doc, { startY: 30, head: [['Concepto', 'Monto']], body: rows });

    if (c.differenceReason) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Motivo del descuadre: ${c.differenceReason}`, 14, this.finalYDeAutoTable(doc) + 12);
    }

    doc.save(`corte-caja-${this.filenameDate()}.pdf`);
  }

  /**
   * El `Y` donde terminó la última tabla de autoTable.
   *
   * <p>`doc.lastAutoTable` existe en tiempo de ejecución (jspdf-autotable lo
   * agrega al objeto), pero no está en la definición de `jsPDF`, así que
   * TypeScript lo marca como propiedad inexistente. En vez de un `any` suelto se
   * declara el tipo de lo que se usa: si la biblioteca cambiara la forma del
   * objeto, el error aparecería acá y no como `undefined` en un PDF ya guardado.
   */
  private finalYDeAutoTable(doc: jsPDF): number {
    const conTabla = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    return conTabla.lastAutoTable?.finalY ?? 40;
  }

  exportCorteExcel() {
    const c = this.corteCaja;
    if (!c) return;

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Monto'],
      ['Caja', this.corteRotulo],
      ['Turnos sumados', c.turnos],
      ['Turnos cerrados', c.turnosCerrados],
      ['Fondo inicial', c.openingAmount],
      ['Ventas en efectivo', c.cashSales],
      ['Ventas débito', c.debitSales],
      ['Ventas crédito', c.creditSales],
      ['Total ventas', c.totalSales],
      ['Tickets', c.totalTickets],
      ['Monto esperado', c.expectedAmount],
      ['Utilidad', c.grossProfit],
      // 🔑 Celda VACÍA, no 0: 0 significaría "cuadró perfecto" y es falso.
      ['Diferencia', c.difference === null ? '' : c.difference],
      ['Motivo del descuadre', c.differenceReason ?? ''],
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

    // 🔑 NO se pone `cashBoxReport = null` aquí. La caja NO cambia, solo el
    // filtro: el título sigue siendo el mismo y los turnos que ya están en
    // pantalla son los mismos, nada más que recortados. Borrarlos dejaba la
    // sección en blanco durante cada petición (y se llevaba por delante el
    // desplegable de usuario, que está dentro del mismo `*ngIf`).
    //
    // El contraste con `onBoxSelected()` es a propósito: ahí SÍ se limpia,
    // porque ver los turnos de CAJA 1 bajo el título de CAJA 2 sería peyor.
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
    this.boxLoading = true;

    this.reportService.getCashBoxReport(boxId, {
      from: this.from,
      to: this.to,
      userId: this.cashBoxUserFilter,
    }).subscribe({
      next: (data) => {
        this.cashBoxReport = data;

        // El corte se calcula AQUÍ, en el mismo turno que llega la tabla: por
        // construcción no puede quedar desfasado de lo que se ve arriba.
        this.calcularCorteDeCaja(data);

        // 🔑 La lista de vendedores NO se reconstruye cuando el recorte vino del
        // filtro de USUARIO: en ese caso los `sellers` que llegan son un
        // subconjunto y armar el menú con ellos lo dejaría con una sola opción.
        // Con filtro de FECHAS sí se reconstruye, porque la respuesta trae a
        // todos los que vendieron en el rango: ver `filtradoPorUsuario`.
        if (!this.filtradoPorUsuario) {
          this.recalcularUsuariosDeLaCaja();
        }
      },
      // 404 tolerado: la caja se pudo dar de baja o borrar entre la carga de la
      // lista y el clic. No debe romper la pantalla.
      error: () => {
        this.cashBoxReport = null;
        this.corteCaja = null;
        this.boxReportUsers = [];
      },
      complete: () => (this.boxLoading = false),
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
    // El corte se limpia con la caja: es un derivado de ella. Si sobrevive,
    // al elegir otra caja quedaría un total de la anterior junto a la tabla
    // nueva, que es exactamente el descuadre que este arreglo vino a quitar.
    this.corteCaja = null;
    this.cashBoxUserFilter = null;
    this.usuarioAplicado = null;
    this.sessionAbiertaId = null;
    this.boxReportUsers = [];
  }
}