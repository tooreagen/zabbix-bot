/**
 * Преобразует GPON серийный номер из HEX-формата OLT в читаемый вид.
 * @param {string} hexSN - Серийник в HEX (например, "48575443C26ED106")
 * @returns {string} Читаемый серийный номер (например, "HWTCC26ED106")
 */
export function convertOnuHexSNToReadable(hexSN) {
  // Убираем возможные лишние символы (дефисы, пробелы и т.п.)
  const cleanHex = hexSN.replace(/[^0-9A-Fa-f]/g, "");

  // Стандартный GPON SN — ровно 16 HEX-символов (8 байт)
  if (cleanHex.length !== 16) {
    throw new Error("Неверная длина серийного номера: ожидается 16 HEX-символов");
  }

  // Первые 8 символов — Vendor ID в HEX (ASCII)
  const vendorHex = cleanHex.slice(0, 8);
  // Оставшиеся 8 символов — уникальная часть (уже HEX, остаётся как есть)
  const serialPart = cleanHex.slice(8);

  // Преобразуем каждые два HEX-символа в один ASCII-символ
  let vendor = "";
  for (let i = 0; i < vendorHex.length; i += 2) {
    const hexByte = vendorHex.substr(i, 2);
    const charCode = parseInt(hexByte, 16);
    vendor += String.fromCharCode(charCode);
  }

  return vendor + serialPart;
}
