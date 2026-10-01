import { TestBed } from '@angular/core/testing';

import { Salehistory } from './salehistory';
import { SaleHistory } from '../../core/interfaces/sale/sale';
import { PaymentMethod } from '../../core/enums/paymentMethod';
import { SaleService } from '../../core/service/sale-service/sale-service';
import { AuthService } from '../../core/service/auth-service/auth-service';
import { SidebarService } from '../../core/service/sidebar-service/sidebar-service';
import { Sidebar } from '../sidebar/sidebar';

/**
 * Tests de las REGLAS DE UI del ciclo de vida de la venta (2026-09-30).
 *
 * Qué se prueba y por qué estas funciones sí:
 *
 * `isAbierta`, `isConfirmada`, `isAnulada` y `canCancel` son funciones
 * PURAS: reciben un `SaleHistory` y devuelven un booleano, sin tocar el DOM ni
 * llamar al backend. Eso las hace triviales de testear y, más importante,
 * hace que la regla de "qué botón se pinta" quede escrita en un lugar
 * verificable en vez de estar repartida en condiciones del HTML donde un
 * `typo` no lo detecta nadie.
 *
 * <p>Estas reglas son una RÉPLICA de las del backend (`SaleImpl.confirm` y
 * `SaleImpl.cancel`), no las sustituyen. Sirven para no ofrecer un botón que
 * va a fallar con 409. Si alguien cambia la regla en Java y no acá, lo
 * detecta la diferencia de comportamiento, no este test.
 *
 * Estos specs NO se ejecutan hoy: `npm test` (Vitest) no encuentra
 * archivos de test en este proyecto porque la ruta del proyecto contiene
 * paréntesis (`Sistema de ventas (comida)`), que rompen el glob de Vitest.
 * Es un problema conocido, documentado en AGENTS.md. Los tests quedan escritos
 * y correctos para cuando se resuelva (mover/renombrar la carpeta o cambiar el
 * include de vitest.config).
 */
describe('Salehistory - ciclo de vida de la venta', () => {
  let component: Salehistory;
  let authStub: { hasPermission: (p: string) => boolean };

  // Venta base: abierta y en efectivo. Cada test parte de esta y cambia solo
  // lo que necesita, para que se vea qué es lo que hace fallar el caso.
  function venta(over: Partial<SaleHistory> = {}): SaleHistory {
    return {
      id: 1,
      saleDate: '2026-09-30T10:00:00',
      total: 100,
      paymentMethod: PaymentMethod.CASH,
      cashReceived: 100,
      changeAmount: 0,
      confirmed: false,
      confirmedAt: null,
      cancelled: false,
      cancelledAt: null,
      ...over,
    };
  }

  beforeEach(async () => {
    // Doble de prueba de AuthService con TODOS los permisos: los tests de las
    // reglas de estado no dependen de permisos, y así queda claro que `canCancel`
    // no mira permisos sino el estado de la venta.
    authStub = { hasPermission: () => true };

    await TestBed.configureTestingModule({
      imports: [Salehistory],
      providers: [
        { provide: SaleService, useValue: { getSales: () => ({ subscribe: () => {} }) } },
        { provide: AuthService, useValue: authStub },
        { provide: SidebarService, useValue: { menuOpen: true } },
      ],
    })
      // El Sidebar es un componente hijo con dependencias propias. No se
      // renderiza aquí porque estos tests no miran el DOM, solo la lógica; se
      // anula para que TestBed no intente construirlo.
      .overrideComponent(Salehistory, { remove: { imports: [Sidebar] } })
      .compileComponents();

    component = TestBed.createComponent(Salehistory).componentInstance;
  });

  describe('clasificación del estado', () => {
    it('una venta nueva está abierta: se puede confirmar y anular', () => {
      const s = venta();
      expect(component.isAbierta(s)).toBe(true);
      expect(component.isConfirmada(s)).toBe(false);
      expect(component.isAnulada(s)).toBe(false);
    });

    it('una venta confirmada es terminal: ningún estado más', () => {
      const s = venta({ confirmed: true, confirmedAt: '2026-09-30T10:05:00' });
      expect(component.isConfirmada(s)).toBe(true);
      expect(component.isAbierta(s)).toBe(false);
      expect(component.isAnulada(s)).toBe(false);
    });

    it('una venta anulada se reconoce como anulada, no como confirmada', () => {
      const s = venta({ cancelled: true, cancelledAt: '2026-09-30T10:06:00' });
      expect(component.isAnulada(s)).toBe(true);
      expect(component.isAbierta(s)).toBe(false);
    });
  });

  describe('canCancel: qué ventas se pueden anular desde la UI', () => {
    it('una venta abierta en efectivo SÍ se puede anular', () => {
      expect(component.canCancel(venta())).toBe(true);
    });

    it('una venta confirmada NO se puede anular (queda congelada)', () => {
      // Es la regla que cierra el bug del inventario reportado: una vez
      // confirmada, el stock ya salió y la venta es intocable.
      expect(component.canCancel(venta({ confirmed: true }))).toBe(false);
    });

    it('una venta ya anulada NO se puede anular otra vez', () => {
      // Si se pudiera, el stock subiría dos veces por la misma unidad vendida.
      expect(component.canCancel(venta({ cancelled: true }))).toBe(false);
    });

    it('una venta con tarjeta NO se puede anular (requiere reversa del pago)', () => {
      // El dinero quedó capturado: anular la venta no lo devolvería.
      expect(component.canCancel(venta({ paymentMethod: PaymentMethod.CREDIT }))).toBe(false);
      expect(component.canCancel(venta({ paymentMethod: PaymentMethod.DEBIT }))).toBe(false);
    });
  });

  describe('cancelBlockedReason: por qué el botón está deshabilitado', () => {
    it('explica el congelamiento cuando está confirmada', () => {
      expect(component.cancelBlockedReason(venta({ confirmed: true }))).toContain('confirmada');
    });

    it('explica que ya fue anulada', () => {
      expect(component.cancelBlockedReason(venta({ cancelled: true }))).toContain('anulada');
    });

    it('menciona la reversa cuando es con tarjeta', () => {
      expect(component.cancelBlockedReason(venta({ paymentMethod: PaymentMethod.CREDIT })))
        .toContain('reversa');
    });
  });

  describe('colSpan: alineación de las filas de mensaje', () => {
    it('son 8 columnas si el usuario puede confirmar o anular', () => {
      authStub.hasPermission = (p: string) => p === 'CONFIRMAR_VENTAS';
      expect(component.colSpan).toBe(8);
    });

    it('son 7 columnas si no tiene ninguno de los dos permisos', () => {
      // Sin la columna de acciones, un colspan fijo dejaría las filas
      // "No hay ventas..." desalineadas del encabezado.
      authStub.hasPermission = () => false;
      expect(component.colSpan).toBe(7);
    });
  });
});
