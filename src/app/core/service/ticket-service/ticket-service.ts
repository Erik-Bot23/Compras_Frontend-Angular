import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { PaymentMethod } from '../../enums/paymentMethod';
import { CardPaymentResponse } from '../../interfaces/payment/payment';

@Injectable({
  providedIn: 'root'
})
export class TicketService {

  generateTicket(
    saleId: number,
    total: number,
    recibido: number,
    cambio: number,
    items: any[],
    paymentMethod: PaymentMethod,
    cardData?: CardPaymentResponse
  ){
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200] //Tamaño de ticket térmico
    });

    let y = 5;

    // =========================================
    // 1. ENCABEZADO
    // =========================================
    doc.setFontSize(14);
    doc.setTextColor(0,0,0);
    doc.setFont('helvetica', 'bold');
    doc.text('Tienda "Buscar nombre"', 40, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Calle Principal No.123, Col. Centro', 40, y, { align: 'center' });
    y += 4;
    doc.text('Tel: 555-123-4567', 40, y, {align: 'center'});
    y += 4;
    doc.text('RFC: XXXX-XXXX-XXX', 40, y, { align: 'center' });
    y += 6;

    //Línea separadora
    doc.setDrawColor(200,200,200);
    doc.line(5,y,75,y);
    y+= 4;

    // =========================================
    // 2. INFORMACIÓN DE LA VENTA
    // =========================================
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TICKET DE VENTA', 40, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    //Fecha y hora
    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    doc.text(`Ticket: #${String(saleId).padStart(6, '0')}`, 10, y);
    doc.text(`Fecha: ${fecha} ${hora}`, 10, y + 4);
    y += 10;

    // =========================================
    // 3. MÉTODO DE PAGO
    // =========================================
    const paymentLabel = paymentMethod === PaymentMethod.CASH ? 'EFECTIVO' :
                         paymentMethod === PaymentMethod.DEBIT ? 'TARJETA DÉBITO' :
                         'TARJETA CRÉDITO';
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Método: ${paymentLabel}`, 10, y);
    y += 6;

    // =========================================
    // 4. DETALLES DE TARJETA (si aplica)
    // =========================================
    if(cardData && paymentMethod !== PaymentMethod.CASH){
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      //Mostrar los últimos 4 dígitos
      const lastFour = cardData.authorizationCode?.slice(-4) || '****';
      doc.text(`Tarjeta: ****-****-****-${lastFour}`, 10, y);
      y += 4;

      doc.text(`Transacción: ${cardData.transactionId}`, 10, y);
      y += 4;

      doc.text(`Código de autorización: ${cardData.authorizationCode || 'N/A'}`, 10, y);
      y += 4;

      doc.text(`Fecha de pago: ${new Date(cardData.paymentDate).toLocaleString('es-MX')}`, 10, y);
      y += 4;

      //Estado del pago
      const statusLabel = cardData?.status === 'APPROVED' ? 'APROBADO'
                          : cardData?.status === 'REJECTED' ? 'RECHAZADO'
                          : 'PENDIENTE';

      doc.setFont('helvetica', 'bold');
      doc.text(`Estado: ${statusLabel}`, 10, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
    }

    // =========================================
    // 5. PRODUCTOS
    // =========================================
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    // x=10: nombre alineado a la izquierda, x=42: cantidad centrada, x=68: precio centrado
    doc.text('PRODUCTO', 10, y);
    doc.text('CANTIDAD', 42, y, { align: 'center' });
    doc.text('PRECIO', 68, y, { align: 'center' });
    y += 2;
    
    doc.line(2, y, 75, y); // Linea separadora debajo de los headers
    y += 3;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    items.forEach((item) => {
      // Mismo tamaño de letra para toda la fila (nombre, cantidad, precio)
      doc.setFontSize(7);

      // Nombre del producto truncado para que no se encime con cantidad
      let productName = item.product.name;
      if (productName.length > 16) {
        productName = productName.substring(0, 14) + '...';
      }

      // Fila completa: nombre a la izquierda, cantidad centrada, precio centrada
      doc.text(productName, 10, y);                             // Nombre del producto
      doc.text(`${item.quantity} uds`, 42, y, { align: 'center' }); // Cantidad debajo del header CANTIDAD
      doc.text(`$${item.unitPrice.toFixed(2)}`, 68, y, { align: 'center' }); // Precio debajo del header PRECIO
      y += 4;
      y += 1;
    });

    // Línea separadora
    y += 2;
    doc.line(5, y, 75, y);
    y += 4;

    // =========================================
    // 6. TOTALES
    // =========================================
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Subtotal (si hay más de 1 producto, mostrar)
    if (items.length > 1) {
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      doc.text('SUBTOTAL:', 10, y);
      doc.text(`$${subtotal.toFixed(2)}`, 68, y, { align: 'right' });
      y += 5;
    }

    // Total
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL:', 10, y);
    doc.text(`$${total.toFixed(2)}`, 68, y, { align: 'right' });
    y += 6;

    // =========================================
    // 7. INFORMACIÓN DE PAGO
    // =========================================
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    if (paymentMethod === PaymentMethod.CASH) {
      // Efectivo
      doc.text(`Recibido: $${recibido.toFixed(2)}`, 10, y);
      y += 4;
      doc.text(`Cambio: $${cambio.toFixed(2)}`, 10, y);
      y += 6;
    } else if (cardData) {
      // Tarjeta
      doc.text(`Monto: $${total.toFixed(2)}`, 10, y);
      y += 4;
      
      // Si fue aprobado
      if (cardData.status === 'APPROVED') {
        doc.setTextColor(0, 150, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('PAGO APROBADO', 10, y);
        y += 4;
      }
    }

    // =========================================
    // 8. PIE DE PÁGINA
    // =========================================
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(5, y, 75, y);
    y += 4;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });
    y += 4;
    doc.text('Este ticket es su comprobante de pago', 40, y, { align: 'center' });
    y += 4;
    doc.text('Productos no reembolsables', 40, y, { align: 'center' });
    y += 6;

    // Código de barras simulado (líneas decorativas)
    doc.setDrawColor(0, 0, 0);
    for (let i = 0; i < 20; i++) {
      const x = 10 + i * 3;
      const height = i % 3 === 0 ? 4 : 2;
      doc.line(x, y, x, y + height);
    }
    y += 6;

    doc.text(`Venta #${String(saleId).padStart(6, '0')}`, 40, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Gracias por preferirnos', 40, y, { align: 'center' });

    // =========================================
    // 9. GUARDAR PDF
    // =========================================
    doc.save(`ticket-venta-${saleId}.pdf`);
  }   
}