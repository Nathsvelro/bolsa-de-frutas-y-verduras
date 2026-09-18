// Parser CSV en streaming, sin dependencias.
//
// `parseCsv` recibe un iterable asíncrono de "chunks" (Buffer o string) —
// típicamente un stream Readable de fs.createReadStream o de la salida
// estándar de un proceso hijo (child.stdout), que ya son async iterables —
// y produce, de forma perezosa, un arreglo de strings por cada fila.
//
// Soporta:
// - campos entre comillas dobles que contienen comas y saltos de línea,
// - comillas escapadas dentro de un campo entre comillas (""),
// - terminadores de línea CRLF y LF (y CR suelto, por si acaso),
// - un BOM (﻿) al inicio del archivo,
// - chunks que cortan un carácter multibyte UTF-8 o un CRLF a la mitad.
//
// No carga el archivo completo en memoria: solo mantiene en buffer el
// fragmento de la fila que aún no se puede resolver.

const COMA = ',';
const COMILLA = '"';
const CR = '\r';
const LF = '\n';

/**
 * @param {AsyncIterable<Buffer|string>|Iterable<Buffer|string>} iterable
 * @returns {AsyncGenerator<string[]>}
 */
export async function* parseCsv(iterable) {
  const decoder = new TextDecoder('utf-8');

  let field = '';
  let fieldStarted = false; // el campo actual ya recibió al menos un carácter
  let inQuotes = false;
  let row = [];
  let pendingRows = [];
  let leftover = '';
  let firstText = true;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };

  const endRow = () => {
    endField();
    pendingRows.push(row);
    row = [];
  };

  // Procesa `text` hasta donde se pueda sin ambigüedad; devuelve el índice
  // hasta el que se consumió. Lo no consumido (por ejemplo una comilla o un
  // CR justo al final del chunk, que podrían seguir con más contenido)
  // se conserva como `leftover` para la siguiente vuelta. Cuando `isFinal`
  // es true (ya no hay más datos) se resuelve toda ambigüedad pendiente.
  const feed = (text, isFinal) => {
    let i = 0;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === COMILLA) {
          if (i + 1 < n) {
            if (text[i + 1] === COMILLA) {
              field += COMILLA;
              i += 2;
              continue;
            }
            inQuotes = false;
            i += 1;
            continue;
          }
          if (isFinal) {
            inQuotes = false;
            i += 1;
            continue;
          }
          return i; // ambiguo: podría ser "" (comilla escapada) — pedir más datos
        }
        field += c;
        i += 1;
        continue;
      }

      if (c === COMILLA && !fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
        i += 1;
        continue;
      }
      if (c === COMA) {
        endField();
        i += 1;
        continue;
      }
      if (c === CR) {
        if (i + 1 < n) {
          if (text[i + 1] === LF) {
            endRow();
            i += 2;
            continue;
          }
          endRow(); // CR suelto: fin de línea igualmente
          i += 1;
          continue;
        }
        if (isFinal) {
          endRow();
          i += 1;
          continue;
        }
        return i; // ambiguo: el siguiente chunk podría empezar con LF
      }
      if (c === LF) {
        endRow();
        i += 1;
        continue;
      }
      field += c;
      fieldStarted = true;
      i += 1;
    }
    return i;
  };

  for await (const chunk of iterable) {
    let text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    if (firstText) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      firstText = false;
    }
    if (leftover) {
      text = leftover + text;
      leftover = '';
    }
    const consumed = feed(text, false);
    if (consumed < text.length) leftover = text.slice(consumed);
    if (pendingRows.length) {
      yield* pendingRows;
      pendingRows = [];
    }
  }

  let tail = decoder.decode(); // vacía cualquier byte pendiente del decodificador
  if (leftover) {
    tail = leftover + tail;
    leftover = '';
  }
  if (firstText && tail.charCodeAt(0) === 0xfeff) tail = tail.slice(1);
  if (tail) feed(tail, true);

  // Si quedó contenido sin cerrar (archivo sin salto de línea final), se
  // emite como última fila.
  if (fieldStarted || field !== '' || row.length > 0) {
    endRow();
  }
  if (pendingRows.length) yield* pendingRows;
}
