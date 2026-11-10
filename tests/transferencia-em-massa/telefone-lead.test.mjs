// TELEFONE ÚNICO — validação (10/11 dígitos com DDD), chave e diagnóstico — lógica pura, sem Firebase.
import { REPO, criarRelatorio } from "./helpers.mjs";

const { check, fim } = criarRelatorio();
const { chaveTelefone, telefoneValido, mesmoTelefone, diagnosticarTelefone, MOTIVO_TELEFONE: M, MENSAGEM_TELEFONE_DUPLICADO, MENSAGEM_TELEFONE_INVALIDO } = await import(`${REPO}/src/utils/telefoneLead.js`);

// Todos representam o MESMO número: (41) 99618-3695
const MESMO_NUMERO = [
  "(41) 99618-3695", "41 99618-3695", "41996183695", "41-99618-3695", "41.99618.3695", "  (41)  9 9618 - 3695  ",
  "+55 41 99618-3695", "+55 (41) 99618-3695", "5541996183695", "55 41 99618 3695", "0055 41 99618-3695", "(041) 99618-3695", "041 99618-3695",
  "41 9618-3695", "(41) 9618-3695", "4196183695", "+55 41 9618-3695", "554196183695",           // sem o nono dígito
];

console.log("\n=== A. Mesmo número, escritas diferentes => MESMA chave");
{
  const chaves = new Set(MESMO_NUMERO.map(chaveTelefone));
  check(`${MESMO_NUMERO.length} formas de escrever o número geram uma única chave (4196183695)`, chaves.size === 1 && chaves.has("4196183695"), [...chaves].join());
  check("formatação (espaços, parênteses, traços, pontos)", mesmoTelefone("(41) 99618-3695", "41.99618.3695") && mesmoTelefone("41 99618-3695", "  (41)99618 3695 "));
  check("com e sem DDI (+55 / 55 / 0055)", mesmoTelefone("+55 41 99618-3695", "41996183695") && mesmoTelefone("5541996183695", "(41) 99618-3695") && mesmoTelefone("0055 41 99618-3695", "41996183695"));
  check("com e sem o nono dígito", mesmoTelefone("41 99618-3695", "41 9618-3695") && mesmoTelefone("+55 41 9618-3695", "(41) 99618-3695"));
  check("com e sem DDI E sem nono dígito ao mesmo tempo", mesmoTelefone("+55 (41) 9618-3695", "41 99618-3695"));
  check("zeros à esquerda (prefixo de operadora) são ignorados", mesmoTelefone("041 99618-3695", "41 99618-3695"));
  check("todas essas formas são telefones VÁLIDOS", MESMO_NUMERO.every(telefoneValido));
}

console.log("\n=== B. Números DIFERENTES não podem ser confundidos");
{
  check("último dígito diferente", !mesmoTelefone("(41) 99618-3695", "(41) 99618-3696"));
  check("DDD diferente (41 x 11) com o mesmo final", !mesmoTelefone("(41) 99618-3695", "(11) 99618-3695"));
  check("DDD 55 (RS) não é confundido com o código do país 55", chaveTelefone("(55) 99999-0000") === "5599990000" && chaveTelefone("+55 (55) 99999-0000") === "5599990000" && !mesmoTelefone("(55) 99999-0000", "(41) 99999-0000"));
  check("DDD 55 com 10 dígitos (sem nono) também não é cortado", chaveTelefone("55 9999-0000") === "5599990000");
  check("fixo (10 dígitos) com DDD", chaveTelefone("(41) 3333-4444") === "4133334444");
  check("fixo x celular com finais diferentes", !mesmoTelefone("(41) 3333-4444", "(41) 99333-4445"));
  check("pessoas diferentes com o MESMO número são o mesmo telefone (número compartilhado não é aceito)", mesmoTelefone("(41) 99618-3695", "41 99618 3695"));
}

console.log("\n=== C. Telefone FORA DO PADRÃO é inválido (cadastro novo e troca de telefone): chave vazia + motivo");
{
  const casos = [
    ["", M.AUSENTE], ["   ", M.AUSENTE], [null, M.AUSENTE], [undefined, M.AUSENTE],
    ["abc", M.SEM_DIGITOS], ["---", M.SEM_DIGITOS],
    [41996183695, M.NAO_TEXTO], [{}, M.NAO_TEXTO], [[], M.NAO_TEXTO],
    ["123", M.CURTO], ["(41) 123", M.CURTO], ["1234567", M.CURTO],
    ["99618-3695", M.CURTO], ["996183695", M.CURTO], ["9618-3695", M.CURTO], ["96183695", M.CURTO],            // sem DDD
    ["419618369", M.CURTO],                                                                                      // DDD + 7 dígitos (incompleto)
    ["41996183695512", M.LONGO], ["4199618369512", M.LONGO], ["+55 41 99618-36955", M.LONGO], ["6199618369512", M.LONGO],  // dígitos a mais
    ["(10) 99618-3695", M.DDD_INVALIDO], ["(01) 99618-3695".replace("01", "00"), M.CURTO], ["(41) 19618-3695", M.NUMERO_INVALIDO],  // 11 dígitos sem o 9; DDD com 0
    ["(41) 1618-3695", M.NUMERO_INVALIDO], ["+1 202 555 0143", M.NUMERO_INVALIDO],                              // 10 dígitos começando por 0/1; estrangeiro
  ];
  for (const [valor, motivo] of casos) {
    const d = diagnosticarTelefone(valor);
    check(`${JSON.stringify(valor)} => inválido, motivo ${motivo}`, !d.valido && d.chave === "" && d.motivo === motivo && !telefoneValido(valor) && chaveTelefone(valor) === "", `${d.motivo}`);
  }
  check("exatamente 10 ou 11 dígitos (depois do DDI) é o que vale", telefoneValido("(41) 3333-4444") && telefoneValido("(41) 93333-4444") && !telefoneValido("(41) 3333-444") && !telefoneValido("(41) 933333-4444"));
  check("DDD válido vai de 11 a 99 (nenhum dígito zero)", telefoneValido("(11) 98765-4321") && telefoneValido("(99) 98765-4321") && !telefoneValido("(10) 98765-4321") && !telefoneValido("(40) 98765-4321") && !telefoneValido("(20) 98765-4321"));
  check("dois inválidos nunca são 'o mesmo telefone'", !mesmoTelefone("abc", "abc") && !mesmoTelefone("", "") && !mesmoTelefone("96183695", "96183695"));
  check("o diagnóstico devolve os dígitos (para achar repetidos entre números fora do padrão)", diagnosticarTelefone("419618369").digitos === "419618369" && diagnosticarTelefone("41 9618-369").digitos === "419618369");
}

console.log("\n=== D. Mensagens exigidas");
check("texto exato da mensagem de duplicidade", MENSAGEM_TELEFONE_DUPLICADO === "Telefone já cadastrado! Este número já está vinculado a outro lead no Central Attitude.");
check("mensagem de telefone inválido pede DDD e 10 ou 11 dígitos", /DDD/.test(MENSAGEM_TELEFONE_INVALIDO) && /10 ou 11 dígitos/.test(MENSAGEM_TELEFONE_INVALIDO));
fim();
