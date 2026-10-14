// ==========================================================
// BUSCA DE LEADS — comparação de texto
// ==========================================================
//
// Ignora maiúsculas/minúsculas, acentos e espaços repetidos.
// Nome: TODAS as palavras digitadas precisam aparecer no nome
// (em qualquer posição), então "silva", "maria s" e
// "souza maria" encontram "Maria Souza Silva".
// Telefone: compara só os dígitos, com ou sem máscara/+55.
// ==========================================================

export function normalizarTexto(valor) {

  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

}


export function somenteDigitos(valor) {

  return String(valor ?? "").replace(/\D/g, "");

}


// Telefone brasileiro sem o código do país, para comparar
// "+55 (11) 99999-0000" com "11999990000".
function semCodigoDoPais(digitos) {

  return digitos.length > 11 && digitos.startsWith("55")
    ? digitos.slice(2)
    : digitos;

}


// `minDigitos`: quantidade mínima de dígitos para comparar telefone
// (a lista local mantém o comportamento antigo, 1; a busca global usa 3).
export function leadCombinaComBusca(lead, termo, { minDigitos = 1 } = {}) {

  const texto = normalizarTexto(termo);

  if (!texto) {
    return true;
  }

  // ---- nome: todas as palavras
  const nome = normalizarTexto(lead?.nome);

  const palavras = texto.split(" ").filter(Boolean);

  if (palavras.length > 0 && palavras.every((p) => nome.includes(p))) {
    return true;
  }

  // ---- telefone: só dígitos
  const digitosBusca = semCodigoDoPais(somenteDigitos(termo));

  if (digitosBusca.length >= minDigitos) {

    const telefone = semCodigoDoPais(somenteDigitos(lead?.telefone));

    if (telefone.includes(digitosBusca)) {
      return true;
    }

  }

  return false;

}
