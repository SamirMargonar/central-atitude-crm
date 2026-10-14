// Utilitários compartilhados pelas suítes de transferência em massa.
// As suítes rodam FORA do projeto (ver README.md / run.sh) — o projeto não
// tem dependências de teste. Nada aqui toca produção: só Emulator local.
import path from "node:path";
import { fileURLToPath } from "node:url";

// Porta do Firestore Emulator (padrão 8085): permite rodar várias execuções em paralelo.
export const PORTA = Number(process.env.EMU_PORT || 8085);

export const REPO = process.env.REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// UIDs REAIS (Firebase Authentication) das duas identidades autorizadas —
// os mesmos que estão em firestore.rules. NUNCA o campo "uid" do documento.
export const ADM = "jDYvHOHYROec7Gr8DAFASz0ZfUy2"; // Samir (admin)
export const NAY = "jLZDUG9DtlZtRhBR04pxyMUlWxj2"; // Naykison (coordenador)

export function criarRelatorio() {
  const res = [];

  // esperado:
  //   "ALLOW" — a operação precisa ser aceita;
  //   "DENY"  — precisa ser negada PELAS RULES (erro permission-denied).
  //             Qualquer outro erro (rede, instância errada, validação do
  //             serviço, bug do teste) conta como FALHA: não vale como "negado";
  //   "ERRO"  — precisa falhar com um erro que NÃO seja das Rules (ex.: a
  //             validação do próprio serviço, antes de qualquer gravação).
  async function t(nome, esperado, fn) {
    let r, motivo = "";
    try { await fn(); r = "ALLOW"; } catch (e) {
      const permissao = e?.code === "permission-denied" || /PERMISSION_DENIED/i.test(String(e?.message || ""));
      r = permissao ? "DENY" : "ERRO";
      if (!permissao) motivo = " (" + String(e?.message || e).replace(/\s+/g, " ").slice(0, 70) + ")";
    }
    const ok = r === esperado; res.push(ok);
    console.log(`${ok ? "OK   " : "FALHA"} | ${nome} | esperado ${esperado} | obtido ${r}${!ok || r === "ERRO" ? motivo : ""}`);
  }

  // Falha de VALIDAÇÃO DO SERVIÇO (antes de qualquer gravação): precisa ser um
  // erro que NÃO seja das Rules e cuja mensagem corresponda ao motivo esperado.
  async function tErro(nome, padrao, fn) {
    let r = "ALLOW", msg = "";
    try { await fn(); } catch (e) {
      msg = String(e?.message || e);
      r = (e?.code === "permission-denied" || /PERMISSION_DENIED/i.test(msg)) ? "DENY" : "ERRO";
    }
    const ok = r === "ERRO" && padrao.test(msg); res.push(ok);
    console.log(`${ok ? "OK   " : "FALHA"} | ${nome} | esperado erro do serviço /${padrao.source}/ | obtido ${r}${r === "ERRO" ? " (" + msg.replace(/\s+/g, " ").slice(0, 70) + ")" : ""}`);
  }

  // Par controle/variante: o CONTROLE (idêntico, sem o defeito) precisa ser
  // aceito e a VARIANTE (só com o defeito) precisa ser negada pelas Rules.
  // Assim a negação só pode vir da cláusula testada, não de outra regra
  // incidental.
  // preparar(variante) monta o estado do banco (e pode aplicar o defeito de
  // ESTADO quando variante === true); acao(variante) executa a operação
  // (e pode aplicar o defeito na própria operação).
  async function par(nome, preparar, acao) {
    await preparar(false);
    await t(`${nome} — CONTROLE sem o defeito é aceito`, "ALLOW", () => acao(false));
    await preparar(true);
    await t(`${nome} — só com o defeito é NEGADO pelas Rules`, "DENY", () => acao(true));
  }

  function check(nome, cond, extra = "") {
    res.push(!!cond);
    console.log(`${cond ? "OK   " : "FALHA"} | ${nome}${!cond && extra ? " | " + extra : ""}`);
  }

  function fim() {
    const f = res.filter((x) => !x).length;
    console.log(`\nTOTAL: ${res.length} | OK: ${res.length - f} | FALHAS: ${f}`);
    return f;
  }

  return { res, t, tErro, par, check, fim };
}
