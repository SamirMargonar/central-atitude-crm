// ==========================================================
// TELEFONE DO LEAD — VALIDAÇÃO E CHAVE ÚNICA DE COMPARAÇÃO
// ==========================================================
//
// Regra do negócio: não pode existir dois leads com o mesmo
// telefone (nem familiares, casais ou pessoas diferentes).
//
// TELEFONE VÁLIDO (cadastro novo e troca de telefone): número
// brasileiro COM DDD, com 10 ou 11 dígitos:
//
//   1. só dígitos (ignora espaço, hífen, parênteses, "+", ponto);
//   2. sem zeros à esquerda (prefixo de operadora/tronco: 041…);
//   3. sem o código do país 55, quando sobra um número completo
//      (12+ dígitos começando com 55);
//   4. DDD = 2 dígitos, de 11 a 99 (nenhum dígito do DDD é zero);
//   5. 10 dígitos: DDD + 8 (fixo ou celular sem o nono dígito),
//      começando por 2 a 9;
//   6. 11 dígitos: DDD + 9 + 8 (celular com o nono dígito).
//
//   Fora disso o número é "fora do padrão": sem DDD, curto, com
//   dígito a mais, DDD inválido, etc. Não é aceito num cadastro
//   novo nem numa troca de telefone — mas um lead ANTIGO com esse
//   tipo de número continua existindo e editável (só aparece na
//   lista "Telefones fora do padrão" da ferramenta de indexação).
//
// CHAVE ÚNICA (telefone válido): DDD + os 8 ÚLTIMOS dígitos. É isso
// que iguala "41 99618-3695", "41 9618-3695" (sem o nono dígito) e
// "+55 41 99618-3695". Telefone fora do padrão => chave vazia ("").
//
// ESTE ARQUIVO TEM UM ESPELHO EM firestore.rules (telChaveDe). As
// Rules recalculam a chave a partir do campo `telefone` do lead —
// nunca confiam na chave enviada pelo cliente — e os testes
// comparam as duas implementações com os mesmos casos. Se mudar
// uma, mude a outra junto.
// ==========================================================

export const MENSAGEM_TELEFONE_DUPLICADO =
  "Telefone já cadastrado! Este número já está vinculado a outro lead no Central Attitude.";

export const MENSAGEM_TELEFONE_INVALIDO =
  "Informe um telefone brasileiro válido, com DDD (10 ou 11 dígitos). Exemplo: (41) 99999-9999.";


// Motivos pelos quais um telefone está fora do padrão.
export const MOTIVO_TELEFONE = Object.freeze({
  AUSENTE: "AUSENTE",
  NAO_TEXTO: "NAO_TEXTO",
  SEM_DIGITOS: "SEM_DIGITOS",
  CURTO: "CURTO",
  LONGO: "LONGO",
  DDD_INVALIDO: "DDD_INVALIDO",
  NUMERO_INVALIDO: "NUMERO_INVALIDO",
});

export const TEXTO_MOTIVO_TELEFONE = Object.freeze({
  AUSENTE: "sem telefone",
  NAO_TEXTO: "telefone gravado em formato inválido (não é texto)",
  SEM_DIGITOS: "sem nenhum dígito",
  CURTO: "poucos dígitos (provavelmente sem DDD ou incompleto)",
  LONGO: "dígitos a mais (mais de 11 depois do código do país)",
  DDD_INVALIDO: "DDD inválido",
  NUMERO_INVALIDO: "número inválido para celular/fixo brasileiro",
});


function digitosNacionais(texto) {

  const digitos =
    texto
      .replace(/[^0-9]/g, "")
      .replace(/^0+/, "");

  return digitos.length >= 12 && digitos.startsWith("55")
    ? digitos.slice(2)
    : digitos;

}


// Diagnóstico completo: { valido, chave, motivo, digitos }.
// `digitos` = só os dígitos do número (sem zeros à esquerda e sem 55),
// útil para comparar números fora do padrão entre si.
export function diagnosticarTelefone(valor) {

  if (valor === undefined || valor === null || valor === "") {
    return { valido: false, chave: "", motivo: MOTIVO_TELEFONE.AUSENTE, digitos: "" };
  }

  if (typeof valor !== "string") {
    return { valido: false, chave: "", motivo: MOTIVO_TELEFONE.NAO_TEXTO, digitos: "" };
  }

  const n = digitosNacionais(valor);

  if (n.length === 0) {
    return {
      valido: false,
      chave: "",
      motivo: valor.trim() === "" ? MOTIVO_TELEFONE.AUSENTE : MOTIVO_TELEFONE.SEM_DIGITOS,
      digitos: "",
    };
  }

  const invalido = (motivo) => ({ valido: false, chave: "", motivo, digitos: n });

  if (n.length < 10) {
    return invalido(MOTIVO_TELEFONE.CURTO);
  }

  if (n.length > 11) {
    return invalido(MOTIVO_TELEFONE.LONGO);
  }

  if (!/^[1-9][1-9]/.test(n)) {
    return invalido(MOTIVO_TELEFONE.DDD_INVALIDO);
  }

  const formatoOk =
    n.length === 10
      ? /^[1-9][1-9][2-9][0-9]{7}$/.test(n)
      : /^[1-9][1-9]9[0-9]{8}$/.test(n);

  if (!formatoOk) {
    return invalido(MOTIVO_TELEFONE.NUMERO_INVALIDO);
  }

  return {
    valido: true,
    chave: n.slice(0, 2) + n.slice(-8),
    motivo: null,
    digitos: n,
  };

}


// Chave única do telefone, ou "" quando o telefone está fora do padrão.
export function chaveTelefone(valor) {

  return diagnosticarTelefone(valor).chave;

}


export function telefoneValido(valor) {

  return diagnosticarTelefone(valor).valido;

}


// Dois textos de telefone representam o mesmo número válido?
export function mesmoTelefone(a, b) {

  const chave = chaveTelefone(a);

  return chave !== "" && chave === chaveTelefone(b);

}
