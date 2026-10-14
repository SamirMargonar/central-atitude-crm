// ==========================================================
// FORMATAÇÃO DE DATAS (padrão brasileiro) — só APRESENTAÇÃO
// ==========================================================
//
// Nunca altera o valor armazenado nem é usado em cálculo/ordenação.
//
//   Data:            DD/MM/AAAA
//   Data e hora:     DD/MM/AAAA HH:mm   (24 h, sem vírgula)
//
// Tipos aceitos:
//   - Timestamp do Firestore (toDate()) ou { seconds }
//   - Date
//   - string "AAAA-MM-DD"            -> convertida por divisão de
//                                       texto, NUNCA por new Date()
//                                       (new Date("2026-10-14") é
//                                       UTC e mostraria 13/10 no
//                                       fuso do Brasil)
//   - string ISO com horário         -> com "Z"/offset é um instante
//                                       (vai para o fuso do negócio);
//                                       sem offset é horário "de
//                                       parede" e é só reformatada
//   - string já formatada (DD/MM/AAAA...) -> devolvida como está
//   - null/undefined                 -> `vazio`
//   - qualquer outra coisa           -> a própria string (nada é
//                                       inventado nem escondido)
// ==========================================================

export const FUSO_NEGOCIO = "America/Sao_Paulo";

const FORMATADOR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

function instanteParaPartes(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    return null;
  }
  const partes = {};
  for (const p of FORMATADOR.formatToParts(data)) {
    partes[p.type] = p.value;
  }
  return partes;
}

// Converte o valor em { ano, mes, dia, hora, minuto, temHora } ou null.
function decompor(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  // Timestamp do Firestore
  if (typeof valor === "object" && typeof valor.toDate === "function") {
    valor = valor.toDate();
  } else if (
    typeof valor === "object" &&
    !(valor instanceof Date) &&
    typeof valor.seconds === "number"
  ) {
    valor = new Date(valor.seconds * 1000);
  }

  if (valor instanceof Date) {
    const p = instanteParaPartes(valor);
    return p
      ? { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, temHora: true }
      : null;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();

  let m = RE_DATA.exec(texto);
  if (m) {
    return { ano: m[1], mes: m[2], dia: m[3], hora: "", minuto: "", temHora: false };
  }

  m = RE_DATA_HORA.exec(texto);
  if (m) {
    if (m[6]) {
      // instante absoluto (Z ou offset) -> fuso do negócio
      const instante = new Date(texto.replace(" ", "T"));
      const p = instanteParaPartes(instante);
      return p
        ? { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, temHora: true }
        : null;
    }
    return { ano: m[1], mes: m[2], dia: m[3], hora: m[4], minuto: m[5], temHora: true };
  }

  return null;
}

function textoOriginal(valor) {
  if (typeof valor === "string") {
    return valor;
  }
  return "";
}

// DD/MM/AAAA
export function formatarData(valor, vazio = "") {
  if (valor === null || valor === undefined || valor === "") {
    return vazio;
  }
  const d = decompor(valor);
  if (!d) {
    return textoOriginal(valor) || vazio;
  }
  return `${d.dia}/${d.mes}/${d.ano}`;
}

// DD/MM/AAAA HH:mm  (sem horário de origem: só a data)
export function formatarDataHora(valor, vazio = "") {
  if (valor === null || valor === undefined || valor === "") {
    return vazio;
  }
  const d = decompor(valor);
  if (!d) {
    return textoOriginal(valor) || vazio;
  }
  return d.temHora
    ? `${d.dia}/${d.mes}/${d.ano} ${d.hora}:${d.minuto}`
    : `${d.dia}/${d.mes}/${d.ano}`;
}

// Visita/agendamento: a data e a hora são a AGENDA LOCAL do negócio
// (strings separadas, sem fuso). "14/10/2026 às 15:00" com `separador`
// " às ", ou "14/10/2026 15:00" com " ".
export function formatarDataEHoraDaAgenda(data, hora, separador = " ", vazio = "") {
  const dataTexto = formatarData(data, "");
  const horaTexto = hora ? String(hora) : "";
  if (!dataTexto && !horaTexto) {
    return vazio;
  }
  if (!dataTexto) {
    return horaTexto;
  }
  return horaTexto ? `${dataTexto}${separador}${horaTexto}` : dataTexto;
}
