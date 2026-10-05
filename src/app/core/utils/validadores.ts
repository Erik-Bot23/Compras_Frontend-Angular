/**
 * Validadores de entrada para los formularios (V3, 2026-09-30).
 *
 * Es el espejo de `InputValidator.java` del backend. Está duplicado a
 * propósito, y no por descuido: son dos capas con trabajos distintos.
 *
 * El backend valida porque es la frontera de confianza. Aunque el
 * frontend se equivoque, nada entra mal en la base de datos.
 * El frontend valida porque es la experiência del usuario. Nadie
 * quiere enviar un formulario y que le salte un error del servidor tres
 * segundos después. Aquí el error se muestra mientras escribe.
 *
 * Que estén los dos es una defensa en profundidad: si alguien llama al
 * backend con un script, sigue habiendo validación. Y si alguien se saltara el
 * backend, el formulario no dejaría escribir el error.
 *
 * El detalle técnico que importa: se valida el TEXTO, no el número ya
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

/**
 * Mensaje de campo obligatorio, con el género gramatical correcto.
 *
 * "El contraseña es obligatorio" se lee mal de inmediato, y el backend ya lo
 * corrigió el 2026-10-04 separando `requerido()` de `requerida()` por esto.
 * Aquí se resuelve igual: casi todos los campos son masculinos ("el nombre",
 * "el correo", "el RFC") y solo la contraseña es femenina.
 */
function mensajeObligatorio(campo: string, femenino = false): string {
  return femenino ? `La ${campo} es obligatoria.` : `El ${campo} es obligatorio.`;
}

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
 * Admite letras a propósito: un SKU no es un número, "CHOC-500" es un SKU
 * perfectamente válido. Es la razón por la que el SKU y el código de barras
 * tienen reglas distintas.
 */
export function validarSku(valor: string): ValidationResult {
  const codigo = (valor || '').trim().toUpperCase();

  // V7: el SKU pasó a OBLIGATORIO (antes era opcional). El backend ya devuelve
  // 400 con "El SKU es obligatorio", pero si el frontend lo acepta como válido
  // el usuario llena todo el formulario, aprieta Guardar y solo entonces se le
  // avisa. Aquí se marca el campo en rojo al instante, que es lo que hace útil
  // la validación del cliente: señalar DÓNDE está el error.
  if (!codigo) return fail('El SKU es obligatorio.');

  if (codigo.length > MAX_SKU_LENGTH) {
    return fail(`El SKU no puede tener más de ${MAX_SKU_LENGTH} caracteres (lleva ${codigo.length}).`);
  }

  if (!/^[A-Z0-9\-_./]+$/.test(codigo)) {
    return fail('El SKU solo admite letras, números y los separadores - _ . /');
  }

  return ok();
}

/**
 * RFC: solo letras y números, máximo 13.
 *
 * `obligatorio` existe porque el RFC es obligatorio en el alta de un proveedor
 * (V7) pero no en todos los formularios que lo usan.
 */
export function validarRfc(valor: string, obligatorio = false): ValidationResult {
  const codigo = (valor || '').trim().toUpperCase();

  if (!codigo) return obligatorio ? fail(mensajeObligatorio('RFC')) : ok();

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
 * Se conserva como texto a propósito. El código de barras es un
 * identificador: si se guardara como número, `0001234567895` perdería los
 * ceros de la izquierda y el lector dejaría de encontrar el producto.
 */
export function validarBarcode(valor: string): ValidationResult {
  const codigo = (valor || '').trim();

  // V7: el código de barras pasó a OBLIGATORIO. Mismo motivo que en el SKU: el
  // backend ya lo rechaza, pero aquí el error se ve en el campo y no después
  // de enviar todo el formulario.
  if (!codigo) return fail('El código de barras es obligatorio.');

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
 * `min` es el mínimo permitido y se deja en 0 a propósito: el stock de un
 * producto que ya se vendió puede quedar en cero (agotado, no eliminado). Lo que
 * no se permite es CREAR un producto en cero, y eso lo pide el formulario de
 * productos pasando `min = 1`, no esta función por defecto.
 *
 * <p>Rechaza decimales porque no existe 1.6 de jabón (se mide en piezas o en
 * kilos, no en 1.6 unidades), rechaza negativos porque un stock negativo es una
 * contradicción, y rechaza `1e5` porque el atajo de notación científica
 * convertiría un error de dedo en 100,000 unidades.
 */
export function validarEntero(valor: string | number | null | undefined, campo = 'stock', min = 0): ValidationResult {
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

  // Va DESPUÉS de los chequeos de formato a propósito: si alguien escribe "-5"
  // el mensaje que importa es "no puede ser negativo", no "debe ser al menos 1".
  if (Number(texto) < min) {
    return fail(`El ${campo} debe ser al menos ${min}.`);
  }

  return ok();
}

/**
 * Precio: no negativo y con máximo 2 decimales.
 *
 * `min` va en 0 por defecto porque hay precios que sí pueden ser 0: el monto
 * inicial con el que se abre una caja (`cash-facade.ts` valida ese campo con esta
 * misma función y una caja puede abrirse en cero). El formulario de productos
 * pasa `min = 1` porque un producto no se crea a precio 0.
 *
 * El límite de 2 decimales no es arbitrario: la columna es `numeric(38,2)`,
 * así que `1.875` se redondearía a `1.88` en silencio. El usuario
 * escribiría 1.875, el sistema cobraría 1.88 y nadie vería el redondeo.
 */
export function validarPrecio(valor: string | number | null | undefined, campo = 'precio', min = 0): ValidationResult {
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

  // Al final, y por el mismo motivo que en validarEntero: primero se explica el
  // problema de formato, después el de rango.
  if (Number(entero) < min) {
    return fail(`El ${campo} debe ser al menos ${min}.`);
  }

  return ok();
}

// ===========================================================================
//  Filtros para (keydown) / reglas de pegado
// ===========================================================================

/**
 * Filtro para `(keydown)` de campos que solo aceptan dígitos.
 *
 * Por qué bloquear la 'e' y la 'E' aquí. El `<input type="number">`
 * del navegador las acepta y produce valores como `1e5`. Ese es el hueco clásico:
 * el navegador dice que "es un número válido" y el usuario termina escribiendo
 * cien mil. Con este filtro la tecla ni siquiera entra al campo.
 *
 * También bloquea `e`, `E`, `+`, `-`, `.` y `,` en campos enteros: son teclas
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
 * Necesario aparte del filtro de teclas porque pegar NO dispara `keydown`: si
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
 *
 * Un "0" suelto NO se marca aquí: puede ser un valor legítimo. Lo que no puede
 * ser es "007". Si además el campo exige un mínimo de 1, el "0" lo rechaza el
 * chequeo de rango que va después, no este.
 */
function cerosIniciales(entero: string): string | null {
  if (entero.length > 1 && entero.charAt(0) === '0') {
    return entero.replace(/^0+(?=\d)/, '');
  }
  return null;
}

// ===========================================================================
//  Textos, correos y contraseñas (punto 5 del encargo)
// ===========================================================================

/**
 * Email: forma básica. No valida todo el RFC 5322 porque eso es inútil en la práctica.
 *
 * `obligatorio` lo activa el formulario de usuarios: el correo es obligatorio
 * tanto al crear como al editar (V7).
 */
export function validarEmail(valor: string, obligatorio = false): ValidationResult {
  const correo = (valor || '').trim().toLowerCase();

  if(!correo) return obligatorio ? fail(mensajeObligatorio('correo')) : ok();

  if(correo.length > 120){
    return fail('El correo no puede tener más de 120 caracteres.');
  }

  if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(correo)){
    return fail('El correo no es válido. Ejemplo: usuario@gmail.com');
  }

  return ok();
}

/**
 * Texto libre con límite de caracteres: nombres de categoría, rol, proveedor y producto.
 *
 * `obligatorio` convierte el "vacío" en error. Antes el vacío pasaba siempre:
 * esa era la razón por la que categorías y roles bloqueaban el guardado con un
 * `return` mudo y sin avisar nada. Ahora el vacío es un error más, y se dice por
 * qué en el mensaje, no con un return invisible.
 *
 * No se permiten saltos de línea ni caracteres de control, porque en una tabla
 * un "Bebidas\nRicas" descoloca la fila y un tabulador invisible rompe el layout.
 */
export function validarTexto(valor: string, campo: string, max: number, obligatorio = false): ValidationResult{
  const texto = (valor || '').trim();

  if(!texto) return obligatorio ? fail(mensajeObligatorio(campo)) : ok();

  if(texto.length > max){
    return fail(`El ${campo} no puede tener más de ${max} caracteres (lleva ${texto.length}).`);
  }

  if(/[\n\r\t]/.test(texto)){
    return fail(`El ${campo} no puede tener saltos de línea ni tabuladores.`);
  }

  return ok();
}

/**
 * Teléfono: solo dígitos, espacios, guiones y paréntesis.
 * Es deliberadamente lao porque cada país lo escribe distinto
 */
export function validarTelefono(valor: string): ValidationResult{
  const tel = (valor || '').trim();

  if(!tel) return ok();

  if(!/^[0-9\s()+-]+$/.test(tel)){
    return fail(`El teléfono solo admite números, espacios, guiones y paréntesis.`);
  }

  if(tel.replace(/\D/g, '').length > 12){
    return fail('El teléfono es demasiado largo.');
  }

  return ok();
}

/**
 * Contraseña: entre 8 y 16 caracteres.
 *
 * `obligatorio` solo se activa al CREAR un usuario: al editar, `updateUser` no
 * manda el campo password, así que exigirlo dejaría imposible guardar cualquier
 * edición. Ese matiz lo aplica el formulario, no esta función.
 */
export function validarPassword(valor: string, min = 8, max =16, obligatorio = false): ValidationResult{
  const pw = valor ?? '';

  // "vacío = no se cambia" solo vale si el campo es opcional. Al crear el
  // usuario sí es obligatorio, y ahí es donde este mensaje aparece.
  if(!pw) return obligatorio ? fail(mensajeObligatorio('contraseña', true)) : ok();

  const largo = pw.trim().length;
  if(largo < min){
    return fail(`La contraseña debe tener mínimo ${min} caracteres (lleva ${largo}).`);
  }

  if(largo > max){
    return fail(`La contraseña debe tener máximo ${max} caracteres (lleva ${largo}).`);
  }

  return ok();
}

/**
 * Minúsculas para correos: son una clave, no un texto
 */
export function aMinusculas(event: Event): void {
  const input = event.target as HTMLInputElement;
  const inicio = input.selectionStart;
  input.value = input.value.toLowerCase();
  if(inicio !== null) input.setSelectionRange(inicio, inicio);
}

/**
 * Aceptar solo digitos en el campo de telefono
 */
export function soloDigitosTelefono(event: KeyboardEvent): void{
  if(['e', 'E', '+'].includes(event.key)) event.preventDefault();
}