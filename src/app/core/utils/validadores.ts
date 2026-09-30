/**
 * Validadores de entrada para los formularios (V3, 2026-09-30).
 *
 * <p>Es el espejo de `InputValidator.java` del backend. Está duplicado a
 * propósito, y no por descuido: son dos capas con trabajos distintos.
 *
 * <ul>
 *   <li>El backend valida porque es <b>la frontera de confianza</b>. Aunque el
 *       frontend se equivoque, nada enters mal en la base de datos.</li>
 *   <li>El frontend valida porque es <b>la experiência del usuario</b>. Nadie
 *       quiere enviar un formulario y que le salte un error del servidor tres
 *       segundos después. Aquí el error se muestra mientras escribe.</li>
 * </ul>
 *
 * <p>Que estén los dos es una defensa en profundidad: si alguien llama al
 * backend con un script, sigue habiendo validación. Y si alguien se saltara el
 * backend, el formulario no dejaría escribir el error.
 *
 * <p><b>El detalle técnico que importa:</b> se valida el TEXTO, no el número ya
 * convertido. Al pasar a `number`, `"000.2"` se vuelve `0.2` y `"1.875"` se
 * vuelve `1.875`: los ceros a la izquierda y el tercer decimal ya se perdieron,
 * y no hay forma de detectarlos después. Por eso cada función mira la cadena.
 */

/** Máximo de caracteres del SKU. */
export const MAX_SKU_LENGTH = 50;

/** Un RFC mexicano tiene 13 (física) o 12 (moral). */
export const MAX_RFC_LENGTH = 13;

/** Los códigos de barras más largos que se usan en la práctica no pasan de 20. */
export const MAX_BARCODE_LENGTH = 20;

/** Resultado de una validación: `ok` o el mensaje de error ya redactado. */
export interface ValidationResult {
  ok: boolean;
  error: string;
}

const ok = (): ValidationResult => ({ ok: true, error: '' });
const fail = (error: string): ValidationResult => ({ ok: false, error });

/** Quita espacios (incluso los que pega el portapapeles) y deja el valor limpio. */
function limpiar(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim().replace(/\s/g, '');
}

/** Detecta 'e'/'E': la notación científica que se cuela en los campos numéricos. */
function tieneExponente(valor: string): boolean {
  return valor.includes('e') || valor.includes('E');
}

// ===========================================================================
//  Códigos
// ===========================================================================

/**
 * SKU: letras, números y los separadores de uso común (- _ . /).
 *
 * <p>Admite letras a propósito: un SKU no es un número, "CHOC-500" es un SKU
 * perfectamente válido. Es la razón por la que el SKU y el código de barras
 * tienen reglas distintas.
 */
export function validarSku(valor: string): ValidationResult {
  const codigo = (valor || '').trim().toUpperCase();

  if (!codigo) return ok(); //el SKU es opcional

  if (codigo.length > MAX_SKU_LENGTH) {
    return fail(`El SKU no puede tener más de ${MAX_SKU_LENGTH} caracteres (lleva ${codigo.length}).`);
  }

  if (!/^[A-Z0-9\-_./]+$/.test(codigo)) {
    return fail('El SKU solo admite letras, números y los separadores - _ . /');
  }

  return ok();
}

/** RFC: solo letras y números, máximo 13. */
export function validarRfc(valor: string): ValidationResult {
  const codigo = (valor || '').trim().toUpperCase();

  if (!codigo) return ok();

  if (codigo.length > MAX_RFC_LENGTH) {
    return fail(`El RFC no puede tener más de ${MAX_RFC_LENGTH} caracteres. Un RFC mexicano tiene 12 o 13.`);
  }

  if (!/^[A-Z0-9]+$/.test(codigo)) {
    return fail('El RFC solo admite letras y números, sin guiones ni espacios');
  }

  return ok();
}

/**
 * Código de barras: solo dígitos.
 *
 * <p>Se conserva como texto a propósito. El código de barras es un
 * <i>identificador</i>: si se guardara como número, `0001234567895` perdería los
 * ceros de la izquierda y el lector dejaría de encontrar el producto.
 */
export function validarBarcode(valor: string): ValidationResult {
  const codigo = (valor || '').trim();

  if (!codigo) return ok();

  if (!/^[0-9]+$/.test(codigo)) {
    return fail('El código de barras solo admite números');
  }

  if (codigo.length > MAX_BARCODE_LENGTH) {
    return fail(`El código de barras no puede tener más de ${MAX_BARCODE_LENGTH} dígitos.`);
  }

  return ok();
}

// ===========================================================================
//  Números
// ===========================================================================

/**
 * Entero no negativo: stock y cantidades.
 *
 * <p>Rechaza decimales porque no existe 1.6 de jabón (se mide en piezas o en
 * kilos, no en 1.6 unidades), rechaza negativos porque un stock negativo es una
 * contradicción, y rechaza `1e5` porque el atajo de notación científica
 * convertiría un error de dedo en 100,000 unidades.
 */
export function validarEntero(valor: string | number | null | undefined, campo = 'stock'): ValidationResult {
  const texto = limpiar(valor);

  if (!texto) return ok(); //vacío se valida en "obligatorio", no aquí

  if (tieneExponente(texto)) {
    return fail(`El ${campo} solo admite números enteros, no notación científica (1e5)`);
  }

  if (texto.includes('.') || texto.includes(',')) {
    return fail(`El ${campo} no admite decimales: solo números enteros.`);
  }

  if (texto.includes('-')) {
    return fail(`El ${campo} no puede ser negativo.`);
  }

  if (!/^[0-9]+$/.test(texto)) {
    return fail(`El ${campo} solo admite números.`);
  }

  const ceros = cerosIniciales(texto);
  if (ceros) {
    return fail(`El ${campo} no puede empezar con ceros: escribe ${ceros} en vez de ${texto}.`);
  }

  return ok();
}

/**
 * Precio: no negativo y con máximo 2 decimales.
 *
 * <p>El límite de 2 decimales no es arbitrario: la columna es `numeric(38,2)`,
 * así que `1.875` se redondearía a `1.88` <b>en silencio</b>. El usuario
 * escribiría 1.875, el sistema cobraría 1.88 y nadie vería el redondeo.
 */
export function validarPrecio(valor: string | number | null | undefined, campo = 'precio'): ValidationResult {
  const texto = limpiar(valor).replace(/,/g, '.');

  if (!texto) return ok();

  if (tieneExponente(texto)) {
    return fail(`El ${campo} no admite notación científica (1e5).`);
  }

  if (texto.includes('-')) {
    return fail(`El ${campo} no puede ser negativo.`);
  }

  const partes = texto.split('.');
  const entero = partes[0];
  const decimal = partes[1] ?? '';

  if (!/^[0-9]+$/.test(entero)) {
    return fail(`El ${campo} solo admite números.`);
  }

  if (partes.length > 2 || (decimal && !/^[0-9]+$/.test(decimal))) {
    return fail(`El ${campo} solo admite números, con un punto decimal.`);
  }

  if (decimal.length > 2) {
    return fail(`El ${campo} admite máximo 2 decimales (por ejemplo 150.50). Lleva ${decimal.length}.`);
  }

  const ceros = cerosIniciales(entero);
  if (ceros) {
    return fail(`El ${campo} no puede empezar con ceros: escribe ${ceros} en vez de ${entero}.`);
  }

  return ok();
}

// ===========================================================================
//  Filtros para (keydown) / reglas de pegado
// ===========================================================================

/**
 * Filtro para `(keydown)` de campos que solo aceptan dígitos.
 *
 * <p><b>Por qué bloquear la 'e' y la 'E' aquí.</b> El `<input type="number">`
 * del navegador las acepta y produce valores como `1e5`. Ese es el hueco clásico:
 * el navegador dice que "es un número válido" y el usuario termina escribiendo
 * cien mil. Con este filtro la tecla ni siquiera entra al campo.
 *
 * <p>También bloquea `e`, `E`, `+`, `-`, `.` y `,` en campos enteros: son teclas
 * que solo sirven para escribir negativos o decimales, que ya se rechazan.
 */
export function soloDigitos(event: KeyboardEvent): void {
  const teclasBloqueadas = ['e', 'E', '+', '-', '.', ','];
  if (teclasBloqueadas.includes(event.key)) {
    event.preventDefault();
  }
}

/** Variante para campos de precio: aquí el punto sí se permite. */
export function soloDigitosYPunto(event: KeyboardEvent): void {
  if (['e', 'E', '+', '-', ','].includes(event.key)) {
    event.preventDefault();
  }
}

/**
 * Sanea lo que se PEGA en un campo de solo dígitos.
 *
 * <p>Necesario aparte del filtro de teclas porque pegar NO dispara `keydown`: si
 * no, el usuario podría pegar "1e5" o "12a" saltándose la validación.
 */
export function sanearDigitos(texto: string): string {
  return texto.replace(/[^0-9]/g, '');
}

/** Sanea un pegado en campo de precio: deja dígitos y un solo punto. */
export function sanearPrecio(texto: string): string {
  return texto.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

/** Pasa a mayúsculas un campo de código (RFC, SKU, barcode, número de caja). */
export function aMayusculas(event: Event): void {
  const input = event.target as HTMLInputElement;
  const inicio = input.selectionStart;
  const valor = input.value.toUpperCase();
  input.value = valor;
  //Se reposiciona el cursor: si no, al escribir en minúsculas el cursor salta
  //al final y da la impresión de que el campo "se traga" lo que se escribe.
  if (inicio !== null) {
    input.setSelectionRange(inicio, inicio);
  }
}

// ===========================================================================
//  Auxiliares
// ===========================================================================

/**
 * Detecta ceros a la izquierda y devuelve el número "correcto".
 * Un "0" suelto SÍ es válido: el stock puede estar en cero y no es un error.
 */
function cerosIniciales(entero: string): string | null {
  if (entero.length > 1 && entero.charAt(0) === '0') {
    return entero.replace(/^0+(?=\d)/, '');
  }
  return null;
}
