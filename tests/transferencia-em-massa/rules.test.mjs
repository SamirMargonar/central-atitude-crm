// ETAPA 1 — Firestore Rules da transferência em massa (Emulator).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc, setDoc, updateDoc, getDoc, getDocs, collection, writeBatch, runTransaction,
  serverTimestamp, addDoc, deleteDoc, deleteField,
} from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const env = await initializeTestEnvironment({
  projectId: "demo-tme-rules",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const { t, par, check, fim } = criarRelatorio();
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const NOVO = (id, nome) => ({ responsavelUid: id, responsavel: nome, consultora: nome });
const LARI = NOVO("lari", "Larissa"), ISA = NOVO("isa", "Isadora");

async function seed() {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "18:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador");
    await u("coord-outro", "Outro Coord", "coordenador"); await u("admin-extra", "Admin Extra", "admin");
    await u("isa", "Isadora", "recepcionista", { ativo: false });   // origem INATIVA
    await u("lari", "Larissa", "recepcionista");
    await u("inativa", "Inativa", "recepcionista", { ativo: false });
    await u("outra", "Outra", "recepcionista");
    for (const id of ["A1", "A2", "A3", "LEG", "R1", "R2", "R3", "NUNCA"]) {
      await setDoc(doc(db, "leads", id), { nome: id, etapa: 2, assumido: true, ...ISA });
    }
    await setDoc(doc(db, "leads", "LEG"), { nome: "legado", etapa: 2, assumido: true, responsavelUid: "isa", consultora: "Isadora" }); // sem 'responsavel'
    await setDoc(doc(db, "leads", "FILA"), { nome: "Fila", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "" });
    await setDoc(doc(db, "visitas", "vA"), { leadId: "A1", consultora: "Isadora", consultoraId: "isa", data: "2026-10-12", hora: "10:00", status: "AGENDADA" });
    await setDoc(doc(db, "visitas", "vB"), { leadId: "A1", consultora: "Outra", consultoraId: "outra", data: "2026-10-12", hora: "10:00", status: "AGENDADA" });
  });
}
const upd = (uid, id, d) => updateDoc(doc(as(uid), "leads", id), d);

// ---- helpers de operação/itens (espelham o que o serviço faz)
const NOME = { isa: "Isadora", lari: "Larissa", outra: "Outra", inativa: "Inativa" };
const NOMEUSER = { [ADM]: "Samir", [NAY]: "Naykison", "coord-outro": "Outro Coord", "admin-extra": "Admin Extra", lari: "Larissa", isa: "Isadora", outra: "Outra" };
const anteriorDe = (id) => ({ responsavelUid: id, responsavel: NOME[id] ?? null, consultora: NOME[id] ?? null });
const abrirOp = (uid, opId, extra = {}) => {
  const d = { tipo: "transferencia", executadoPorUid: uid, executadoPorNome: NOMEUSER[uid] || "x", origemUid: "isa", destinoUid: "lari", status: "em_andamento", leadIds: ["A1"], criadoEm: serverTimestamp(), ...extra };
  d.origemNome ??= NOME[d.origemUid] ?? "x"; d.destinoNome ??= NOME[d.destinoUid] ?? "x"; d.totalPrevisto ??= d.leadIds.length;
  return setDoc(doc(as(uid), "transferenciasEmMassa", opId), d);
};
const finalizar = (uid, opId, status = "concluida") => updateDoc(doc(as(uid), "transferenciasEmMassa", opId), status === "concluida"
  ? { status, totalConcluido: 1, totalFalhas: 0, totalPulados: 0, falhas: [], pulados: [], finalizadoEm: serverTimestamp(), finalizadoPorUid: uid }
  : { status, totalConcluido: 0, totalFalhas: 0, totalPulados: 1, falhas: [], pulados: [{ leadId: "A1", resultado: "PULADO_DONO_MUDOU" }], finalizadoEm: serverTimestamp(), finalizadoPorUid: uid });
// Evento TRANSFERENCIA + item de auditoria na MESMA transação, coerentes entre si (como o serviço grava).
// `item` sobrescreve campos do item; o evento acompanha os valores finais do item, para que cada defeito
// testado seja só o defeito (e `evento` permite quebrar o evento de propósito).
function auditar(tx, d, { opId, leadId, uid, de, para, etapa = 2, anterior, item = {}, evento = {}, semEvento = false }) {
  const eventoRef = doc(collection(d, "leads", leadId, "eventos"));
  const it = { executadoPorUid: uid, deUid: de, deNome: NOME[de], paraUid: para, paraNome: NOME[para], etapa, eventoId: eventoRef.id, anterior: anterior ?? anteriorDe(de), visitasAtualizadas: [], criadoEm: serverTimestamp(), ...item };
  if (!semEvento) tx.set(eventoRef, { leadId, tipo: "TRANSFERENCIA", usuario: NOMEUSER[uid] || "x", descricao: "t", dados: { origem: "massa", operacaoId: opId, responsavelAnteriorUid: it.deUid, novoResponsavelUid: it.paraUid, ...(evento.dados || {}) }, criadoEm: serverTimestamp(), ...(evento.campos || {}) });
  tx.set(doc(d, "transferenciasEmMassa", opId, "itens", leadId), it);
}
function moverLeadTx(uid, opId, leadId, de, para, destinoDoc, itemExtra = {}) {
  const db = as(uid);
  return runTransaction(db, async (tx) => {
    await tx.get(doc(db, "leads", leadId));
    tx.update(doc(db, "leads", leadId), { ...destinoDoc, ultimaTransferenciaEmMassaId: opId, atualizadoEm: serverTimestamp() });
    auditar(tx, db, { opId, leadId, uid, de, para, item: itemExtra });
  });
}

// =============================================================
console.log("\n=== A. AUTORIZAÇÃO: só Samir e Naykison (UIDs reais) trocam o dono");
await seed();
await t("Samir (admin) transfere 1 lead para recepcionista ativa", "ALLOW", () => upd(ADM, "A1", LARI));
await t("Naykison (coordenador) transfere 1 lead para recepcionista ativa", "ALLOW", () => upd(NAY, "A2", LARI));
await t("Naykison: lote de 3 leads no mesmo batch", "ALLOW", async () => { const d = as(NAY); const b = writeBatch(d); for (const id of ["A3", "R1", "R2"]) b.update(doc(d, "leads", id), LARI); await b.commit(); });
await seed();
await t("lead legado (sem campo 'responsavel') é transferível pelos autorizados", "ALLOW", () => upd(NAY, "LEG", LARI));
await seed();
for (const [nome, uid] of [["outro coordenador", "coord-outro"], ["outro administrador", "admin-extra"], ["recepcionista destino", "lari"], ["recepcionista dona", "isa"], ["recepcionista qualquer", "outra"]]) {
  await t(`${nome}: NÃO troca o dono`, "DENY", () => upd(uid, "A1", LARI));
}
await t("sem login: NÃO troca o dono", "DENY", () => updateDoc(doc(env.unauthenticatedContext().firestore(), "leads", "A1"), LARI));
await t("outro coordenador: lote de 10 negado inteiro", "DENY", async () => { const d = as("coord-outro"); const b = writeBatch(d); for (const id of ["A1", "A2", "A3"]) b.update(doc(d, "leads", id), LARI); await b.commit(); });
await t("coordenador grava flag de 'autorizado' no PRÓPRIO documento (permitido hoje, sem efeito)", "ALLOW", () => updateDoc(doc(as("coord-outro"), "usuarios", "coord-outro"), { podeTransferenciaEmMassa: true, autorizado: true, uid: NAY }));
await t("…e mesmo assim NÃO troca o dono (nem com uid forjado no doc)", "DENY", () => upd("coord-outro", "A1", LARI));
await t("coordenador cria um usuário com ID arbitrário em usuarios (permitido hoje; não dá autorização)", "ALLOW", () => setDoc(doc(as("coord-outro"), "usuarios", "qualquer-id"), { nome: "Falso", perfil: "coordenador", ativo: true }));
await t("…doc com ID arbitrário não dá autorização (vale o UID do Auth)", "DENY", () => upd("qualquer-id", "A1", LARI));
await t("coordenador NÃO vira admin", "DENY", () => updateDoc(doc(as("coord-outro"), "usuarios", "coord-outro"), { perfil: "admin" }));
await t("falha SEGURA: outro coordenador rebaixa o Naykison", "ALLOW", () => updateDoc(doc(as("coord-outro"), "usuarios", NAY), { perfil: "recepcionista" }));
await t("…e o Naykison deixa de poder transferir", "DENY", () => upd(NAY, "A1", LARI));

console.log("\n=== B. DESTINO: transferência normal só para recepcionista ATIVA");
await seed();
await t("autorizado → destino INATIVO (transferência normal)", "DENY", () => upd(NAY, "A1", NOVO("inativa", "Inativa")));
await t("autorizado → destino coordenador", "DENY", () => upd(ADM, "A1", NOVO("coord-outro", "Outro Coord")));
await t("autorizado → destino administrador", "DENY", () => upd(ADM, "A1", NOVO(ADM, "Samir")));
await t("autorizado → UID inexistente", "DENY", () => upd(ADM, "A1", NOVO("fantasma", "X")));
await t("autorizado → nome divergente do cadastro", "DENY", () => upd(ADM, "A1", NOVO("lari", "Outro Nome")));
await t("autorizado → só 'responsavelUid' trocado (nomes antigos)", "DENY", () => upd(ADM, "A1", { responsavelUid: "lari" }));
await t("autorizado → esvaziar dono (devolver à fila)", "DENY", () => upd(NAY, "A1", NOVO("", "")));

console.log("\n=== C. REVERSÃO: devolve a consultora INATIVA sem liberar transferência normal para inativos");
await seed();
// operação original REAL: Isadora (inativa) → Larissa, finalizada, com item para A1 e A2
await t("Naykison abre operação original", "ALLOW", () => abrirOp(NAY, "opF"));
await t("Naykison move A1 (item de auditoria na mesma transação)", "ALLOW", () => moverLeadTx(NAY, "opF", "A1", "isa", "lari", LARI));
await t("Naykison move A2", "ALLOW", () => moverLeadTx(NAY, "opF", "A2", "isa", "lari", LARI));
await t("Naykison finaliza a original", "ALLOW", () => finalizar(NAY, "opF"));
const reversao = (uid, opId, extra = {}) => abrirOp(uid, opId, { tipo: "reversao", reverteOpId: "opF", origemUid: "lari", destinoUid: "isa", ...extra });
await t("transferência NORMAL de volta para a inativa continua NEGADA", "DENY", () => upd(NAY, "A1", ISA));
await t("…mesmo apontando para a operação original como se fosse reversão", "DENY", () => updateDoc(doc(as(NAY), "leads", "A1"), { ...ISA, ultimaTransferenciaEmMassaId: "opF" }));
await t("outro coordenador NÃO abre reversão", "DENY", () => reversao("coord-outro", "rev-opF"));
await t("reversão com origem/destino trocados é negada", "DENY", () => reversao(NAY, "rev-opF", { origemUid: "isa", destinoUid: "lari" }));
await t("reversão de operação ainda EM ANDAMENTO é negada", "DENY", async () => { await abrirOp(NAY, "opAberta"); await reversao(NAY, "rev-opAberta", { reverteOpId: "opAberta" }); });
await t("Samir abre a reversão da operação do Naykison", "ALLOW", () => reversao(ADM, "rev-opF"));
await t("reversão SEM item na mesma transação é negada", "DENY", () => updateDoc(doc(as(ADM), "leads", "A1"), { ...ISA, ultimaTransferenciaEmMassaId: "rev-opF" }));
await t("reversão de lead que NÃO foi transferido na original é negada", "DENY", () => moverLeadTx(ADM, "rev-opF", "NUNCA", "lari", "isa", ISA));
await t("reversão com destino diferente do original é negada", "DENY", () => moverLeadTx(ADM, "rev-opF", "A1", "lari", "isa", NOVO("inativa", "Inativa")));
await t("reversão com nome divergente do cadastro é negada", "DENY", () => moverLeadTx(ADM, "rev-opF", "A1", "lari", "isa", NOVO("isa", "Nome Errado")));
await t("recepcionista NÃO executa reversão", "DENY", () => moverLeadTx("lari", "rev-opF", "A1", "lari", "isa", ISA));
await t("reversão VÁLIDA de A1 para a consultora INATIVA", "ALLOW", () => moverLeadTx(ADM, "rev-opF", "A1", "lari", "isa", ISA));
check("A1 voltou para Isadora", (await raw((db) => getDoc(doc(db, "leads", "A1")))).data().responsavelUid === "isa");
await t("segunda reversão do mesmo lead é negada (já está com a origem)", "DENY", () => moverLeadTx(ADM, "rev-opF", "A1", "lari", "isa", ISA));
await t("reversão de A2 por Naykison também é aceita", "ALLOW", () => moverLeadTx(NAY, "rev-opF", "A2", "lari", "isa", ISA));
await raw((db) => updateDoc(doc(db, "leads", "R3"), LARI));
await t("lead que está com Larissa (sem registro) NÃO volta para a inativa por transferência normal", "DENY", () => upd(NAY, "R3", ISA));
await t("reversão de lead legado restaura com 'responsavel' preenchido", "ALLOW", async () => {
  await raw((db) => setDoc(doc(db, "leads", "LEG"), { nome: "legado", etapa: 2, assumido: true, responsavelUid: "isa", consultora: "Isadora" }));
  await abrirOp(NAY, "opL", { leadIds: ["LEG"] }); await moverLeadTx(NAY, "opL", "LEG", "isa", "lari", LARI, { anterior: { responsavelUid: "isa", responsavel: null, consultora: "Isadora" } }); await finalizar(NAY, "opL");
  await abrirOp(NAY, "rev-opL", { tipo: "reversao", reverteOpId: "opL", origemUid: "lari", destinoUid: "isa", leadIds: ["LEG"] });
  await moverLeadTx(NAY, "rev-opL", "LEG", "lari", "isa", ISA);
});
await t("reverter uma REVERSÃO é negado", "DENY", async () => { await finalizar(ADM, "rev-opF", "concluida"); await abrirOp(ADM, "rev-rev-opF", { tipo: "reversao", reverteOpId: "rev-opF", origemUid: "isa", destinoUid: "lari" }); });

console.log("\n=== D. COLEÇÃO transferenciasEmMassa: leitura, alteração, falsificação, exclusão");
await seed();
const op = (extra = {}) => ({ tipo: "transferencia", executadoPorUid: NAY, executadoPorNome: "Naykison", origemUid: "isa", destinoUid: "lari", origemNome: "Isadora", destinoNome: "Larissa", status: "em_andamento", leadIds: ["A1"], totalPrevisto: 1, criadoEm: serverTimestamp(), ...extra });
await t("Naykison cria operação", "ALLOW", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), op()));
await t("status inicial 'concluida' é negado", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o2"), op({ status: "concluida" })));
await t("autoria em nome do admin é negada", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o3"), op({ executadoPorUid: ADM })));
await t("criadoEm forjado (data antiga) é negado", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o4"), op({ criadoEm: new Date("2020-01-01") })));
await t("origem == destino é negado", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o5"), op({ destinoUid: "isa" })));
await t("tipo inválido é negado", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o6"), op({ tipo: "outra" })));
await t("transferência com 'reverteOpId' é negada", "DENY", () => setDoc(doc(as(NAY), "transferenciasEmMassa", "o7"), op({ reverteOpId: "o1" })));
await t("progresso: contadores e arrays", "ALLOW", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { totalConcluido: 1, totalFalhas: 0, falhas: [], pulados: [], visitasTardias: [] }));
await t("NÃO troca origem/destino/autor/tipo", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { destinoUid: "outra" }));
await t("NÃO troca executadoPorUid", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { executadoPorUid: ADM }));
await t("finalizar sem 'finalizadoPorUid' é negado", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { status: "concluida", finalizadoEm: serverTimestamp() }));
await t("finalizar com 'finalizadoEm' forjado é negado", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { status: "concluida", finalizadoPorUid: NAY, finalizadoEm: new Date("2020-01-01") }));
await t("status inventado é negado", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { status: "sucesso", finalizadoPorUid: NAY, finalizadoEm: serverTimestamp() }));
await t("OUTRO autorizado (Samir) encerra a operação abandonada do Naykison", "ALLOW", () => finalizar(ADM, "o1", "concluida_com_pendencias"));
check("autoria original preservada após encerrar", (await raw((db) => getDoc(doc(db, "transferenciasEmMassa", "o1")))).data().executadoPorUid === NAY);
await t("operação finalizada é IMUTÁVEL (até para o autor)", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "o1"), { totalConcluido: 0 }));
await t("ninguém exclui operação (nem Samir)", "DENY", () => deleteDoc(doc(as(ADM), "transferenciasEmMassa", "o1")));
await t("Samir lê e lista", "ALLOW", async () => { await getDoc(doc(as(ADM), "transferenciasEmMassa", "o1")); await getDocs(collection(as(ADM), "transferenciasEmMassa")); });
for (const [nome, uid] of [["coordenador não autorizado", "coord-outro"], ["outro admin", "admin-extra"], ["recepcionista", "lari"]]) {
  await t(`${nome}: NÃO lê`, "DENY", () => getDoc(doc(as(uid), "transferenciasEmMassa", "o1")));
  await t(`${nome}: NÃO lista`, "DENY", () => getDocs(collection(as(uid), "transferenciasEmMassa")));
  await t(`${nome}: NÃO cria operação`, "DENY", () => setDoc(doc(as(uid), "transferenciasEmMassa", "x-" + uid), op({ executadoPorUid: uid })));
  await t(`${nome}: NÃO lê itens`, "DENY", () => getDocs(collection(as(uid), "transferenciasEmMassa", "o1", "itens")));
}
await t("sem login: NÃO lê", "DENY", () => getDoc(doc(env.unauthenticatedContext().firestore(), "transferenciasEmMassa", "o1")));

console.log("\n=== D2. ITENS de auditoria");
await seed();
await abrirOp(NAY, "oI");
await t("item apontando para destino diferente da operação derruba a transação", "DENY", () => moverLeadTx(NAY, "oI", "A1", "isa", "outra", LARI));
check("…e o lead continua com a origem", (await raw((db) => getDoc(doc(db, "leads", "A1")))).data().responsavelUid === "isa");
await t("item correto (lead + item + marca na mesma transação)", "ALLOW", () => moverLeadTx(NAY, "oI", "A1", "isa", "lari", LARI, { visitasAtualizadas: [] }));
await t("item não pode ser editado", "DENY", () => updateDoc(doc(as(NAY), "transferenciasEmMassa", "oI", "itens", "A1"), { paraUid: "outra" }));
await t("item não pode ser apagado", "DENY", () => deleteDoc(doc(as(NAY), "transferenciasEmMassa", "oI", "itens", "A1")));
await t("OUTRO autorizado retoma a operação e grava item", "ALLOW", () => moverLeadTx(ADM, "oI", "A2", "isa", "lari", LARI));
await finalizar(ADM, "oI");
await t("operação finalizada NÃO aceita novos itens", "DENY", () => moverLeadTx(NAY, "oI", "A3", "isa", "lari", LARI));

console.log("\n=== D3. ITEM DE AUDITORIA — cada cláusula isolada (controle aceito × só o defeito negado)");
{
  const prep = (defeitoEstado) => async (v) => { await seed(); await abrirOp(NAY, "oI"); if (v && defeitoEstado) await defeitoEstado(); };
  const transferir = (uid, { lead = {}, item = {}, semMarca = false, semAtualizadoEm = false } = {}) => {
    const d = as(uid);
    return runTransaction(d, async (tx) => {
      const patch = { ...LARI, ultimaTransferenciaEmMassaId: "oI", atualizadoEm: serverTimestamp(), ...lead };
      if (semMarca) delete patch.ultimaTransferenciaEmMassaId;
      if (semAtualizadoEm) delete patch.atualizadoEm;
      tx.update(doc(d, "leads", "A1"), patch);
      auditar(tx, d, { opId: "oI", leadId: "A1", uid, de: "isa", para: "lari", item });
    });
  };
  await par("item em nome de OUTRO usuário (executadoPorUid ≠ quem escreve)", prep(), (v) => transferir(NAY, v ? { item: { executadoPorUid: ADM } } : {}));
  await par("lead SEM a marca ultimaTransferenciaEmMassaId", prep(), (v) => transferir(NAY, { semMarca: v }));
  await par("item com criadoEm forjado (≠ request.time)", prep(), (v) => transferir(NAY, v ? { item: { criadoEm: new Date("2020-01-01") } } : {}));
  await par("item com etapa diferente da etapa real do lead", prep(), (v) => transferir(NAY, v ? { item: { etapa: 4 } } : {}));
  await par("lead com atualizadoEm que NÃO é o instante da transferência (não gravado)", prep(), (v) => transferir(NAY, { semAtualizadoEm: v }));
  await par("lead com atualizadoEm forjado (data antiga)", prep(), (v) => transferir(NAY, v ? { lead: { atualizadoEm: new Date("2020-01-01") } } : {}));
  await par("operação já encerrada (item para operação finalizada)", async (v) => { await seed(); await abrirOp(NAY, "oI"); if (v) await finalizar(NAY, "oI"); }, () => transferir(NAY));
  await par("item.deUid ≠ origem da operação (lead de outra dona, item coerente com o lead)", async (v) => { await seed(); await abrirOp(NAY, "oI"); if (v) await raw((d) => updateDoc(doc(d, "leads", "A1"), NOVO("outra", "Outra"))); }, (v) => transferir(NAY, v ? { item: { deUid: "outra" }, anterior: anteriorDe("outra") } : {}));
  await par("item.paraUid ≠ destino da operação (lead e item coerentes entre si)", prep(), (v) => transferir(NAY, v ? { lead: NOVO("outra", "Outra"), item: { paraUid: "outra" } } : {}));
  await par("lead termina com alguém diferente de item.paraUid", prep(), (v) => transferir(NAY, v ? { lead: NOVO("outra", "Outra") } : {}));
  await par("lead NÃO estava com a origem da operação (item e operação coerentes: de 'isa', mas o lead é de 'outra')", async (v) => { await seed(); await abrirOp(NAY, "oI"); if (v) await raw((d) => updateDoc(doc(d, "leads", "A1"), NOVO("outra", "Outra"))); }, (v) => transferir(NAY, v ? { anterior: anteriorDe("outra") } : {}));
  await par("lead NÃO estava com item.deUid (item diz outro dono de origem)", prep(), (v) => transferir(NAY, v ? { item: { deUid: "outra" } } : {}));
  await par("item sem lead movido na mesma transação (item solto)", prep(), (v) => {
    const d = as(NAY);
    return runTransaction(d, async (tx) => {
      if (!v) tx.update(doc(d, "leads", "A1"), { ...LARI, ultimaTransferenciaEmMassaId: "oI", atualizadoEm: serverTimestamp() });
      auditar(tx, d, { opId: "oI", leadId: "A1", uid: NAY, de: "isa", para: "lari" });
    });
  });
}

console.log("\n=== D4. RETOMADA APÓS FALHA PARCIAL (nível das Rules): uma transação negada não deixa rastro e a retomada funciona");
{
  await seed(); await abrirOp(NAY, "oR", { leadIds: ["A1", "A2"] });
  const mov = (uid, leadId, extraItem = {}, semMarca = false) => {
    const d = as(uid);
    return runTransaction(d, async (tx) => {
      const patch = { ...LARI, ultimaTransferenciaEmMassaId: "oR", atualizadoEm: serverTimestamp() };
      if (semMarca) delete patch.ultimaTransferenciaEmMassaId;
      tx.update(doc(d, "leads", leadId), patch);
      auditar(tx, d, { opId: "oR", leadId, uid, de: "isa", para: "lari", item: extraItem });
    });
  };
  await t("lead 1 é transferido normalmente", "ALLOW", () => mov(NAY, "A1"));
  await t("lead 2 FALHA (transação negada pelas Rules: lead sem a marca)", "DENY", () => mov(NAY, "A2", {}, true));
  check("a falha parcial não deixou rastro: A2 continua com a origem e sem item", (await raw((d) => getDoc(doc(d, "leads", "A2")))).data().responsavelUid === "isa" && !(await raw((d) => getDoc(doc(d, "transferenciasEmMassa", "oR", "itens", "A2")))).exists());
  check("o lead 1 (já transferido) segue com a destinatária e com item", (await raw((d) => getDoc(doc(d, "leads", "A1")))).data().responsavelUid === "lari" && (await raw((d) => getDoc(doc(d, "transferenciasEmMassa", "oR", "itens", "A1")))).exists());
  await t("RETOMADA por OUTRO autorizado: lead 2 passa a ser transferido", "ALLOW", () => mov(ADM, "A2"));
  await t("repetir a transferência do lead 1 não é aceito (o dono já mudou)", "DENY", () => mov(NAY, "A1"));
  check("itens finais: A1 e A2, uma vez cada, autorias de quem executou", (await raw(async (d) => (await getDocs(collection(d, "transferenciasEmMassa", "oR", "itens"))).docs.map((x) => x.id + ":" + (x.data().executadoPorUid === NAY ? "N" : "S")).sort().join())) === "A1:N,A2:S");
}

console.log("\n=== E. VISITAS: consultoraId só muda pelos autorizados");
await seed();
const vupd = (uid, id, d) => updateDoc(doc(as(uid), "visitas", id), d);
await t("outro coordenador NÃO muda consultoraId", "DENY", () => vupd("coord-outro", "vA", { consultoraId: "lari" }));
await t("outro admin NÃO muda consultoraId", "DENY", () => vupd("admin-extra", "vA", { consultoraId: "lari" }));
await t("recepcionista em turno NÃO muda consultoraId (nem para si)", "DENY", () => vupd("outra", "vB", { consultoraId: "lari" }));
await t("Naykison muda consultoraId", "ALLOW", () => vupd(NAY, "vA", { consultoraId: "lari", consultora: "Larissa" }));
await t("Samir muda consultoraId", "ALLOW", () => vupd(ADM, "vA", { consultoraId: "isa", consultora: "Isadora" }));
await t("recepcionista em turno reagenda (data/hora/consultora/comparecimento/status) como hoje", "ALLOW", () => vupd("outra", "vB", { data: "2026-10-20", hora: "14:00", consultora: "Outra", observacao: "x", comparecimento: "", pendenciaResolvida: true, status: "AGENDADA" }));
await t("autorizado confirma visita com a PRÓPRIA autoria (regra de autoria preservada)", "ALLOW", () => vupd(NAY, "vB", { status: "CONFIRMADA", confirmadoPor: NAY, confirmadoPorNome: "Naykison", confirmadoEm: serverTimestamp() }));
await t("autorizado NÃO consegue gravar autoria de OUTRA pessoa na visita", "DENY", () => vupd(NAY, "vA", { status: "CONFIRMADA", confirmadoPor: ADM, confirmadoPorNome: "Samir", confirmadoEm: serverTimestamp() }));
await t("autorizado NÃO consegue mudar consultoraId E forjar autoria na mesma escrita", "DENY", () => vupd(ADM, "vA", { consultoraId: "lari", atendidoPor: NAY, atendidoPorNome: "Naykison", atendidoEm: serverTimestamp() }));
await t("outro coordenador NÃO consegue forjar autoria na visita", "DENY", () => vupd("coord-outro", "vA", { confirmadoPor: ADM, confirmadoPorNome: "Samir", confirmadoEm: serverTimestamp() }));
await t("outro coordenador ajusta status/confirmação como hoje", "ALLOW", () => vupd("coord-outro", "vA", { status: "CONFIRMADA", confirmadoPor: "coord-outro", confirmadoPorNome: "Outro Coord", confirmadoEm: serverTimestamp() }));

console.log("\n=== F. FLUXOS EXISTENTES PRESERVADOS");
await seed();
await t("outro coordenador edita campo comum do lead", "ALLOW", () => upd("coord-outro", "A1", { ultimoAtendimento: "x" }));
await t("outro coordenador assume lead da fila", "ALLOW", () => upd("coord-outro", "FILA", { ...NOVO("coord-outro", "Outro Coord"), assumido: true }));
await raw((db) => updateDoc(doc(db, "leads", "FILA"), { ...NOVO("", ""), assumido: false }));
await t("recepcionista assume lead da fila", "ALLOW", () => upd("lari", "FILA", { ...LARI, assumido: true }));
await t("dona (inativa) edita campo comum do próprio lead", "ALLOW", () => upd("isa", "A1", { ultimoAtendimento: "y" }));
await t("outro coordenador cria evento na timeline", "ALLOW", () => addDoc(collection(as("coord-outro"), "leads", "A1", "eventos"), { leadId: "A1", tipo: "OBSERVACAO", usuario: "x", descricao: "x", dados: {}, criadoEm: serverTimestamp() }));
await t("outro coordenador faz cadastro gerencial (create de lead)", "ALLOW", () => setDoc(doc(as("coord-outro"), "leads", "novo"), { nome: "N", etapa: 0, assumido: true, ...NOVO("coord-outro", "Outro Coord"), cadastroGerencial: true }));
await t("evento da timeline segue imutável (autorizado não edita)", "DENY", async () => { const r = await addDoc(collection(as(NAY), "leads", "A1", "eventos"), { leadId: "A1", tipo: "OBSERVACAO", usuario: "x", descricao: "x", dados: {}, criadoEm: serverTimestamp() }); await updateDoc(r, { descricao: "alterada" }); });

console.log("\n=== G. A1 — CONTORNO POR EXCLUSÃO E RECRIAÇÃO (chamadas diretas ao Firestore)");
await seed();
const base = { nome: "Cliente", telefone: "4199", etapa: 0, idade: 30, status: "Novo Lead", createdAt: serverTimestamp() };
const criar = (uid, id, dono) => setDoc(doc(as(uid), "leads", id), { ...base, assumido: !!dono?.responsavelUid, responsavelUid: "", responsavel: "", consultora: "", ...(dono || {}) });
const existe = async (id) => (await raw((d) => getDoc(doc(d, "leads", id)))).exists();
for (const [nome, uid] of [["outro coordenador", "coord-outro"], ["outro administrador", "admin-extra"], ["recepcionista dona", "isa"], ["recepcionista qualquer", "lari"]]) {
  await t(`${nome}: NÃO exclui lead`, "DENY", () => deleteDoc(doc(as(uid), "leads", "A1")));
}
check("A1 continua existindo com a Isadora após as tentativas de exclusão", (await existe("A1")) && (await raw((d) => getDoc(doc(d, "leads", "A1")))).data().responsavelUid === "isa");
await t("contorno completo: excluir A1 e recriar com outro dono — já a EXCLUSÃO é negada", "DENY", async () => {
  await deleteDoc(doc(as("coord-outro"), "leads", "A1"));
  await setDoc(doc(as("coord-outro"), "leads", "A1"), { ...base, assumido: true, ...NOVO("outra", "Outra") });
});
check("…e o lead segue com a Isadora", (await raw((d) => getDoc(doc(d, "leads", "A1")))).data().responsavelUid === "isa");
await t("recriar por cima de lead existente é um UPDATE de dono (negado)", "DENY", () => setDoc(doc(as("coord-outro"), "leads", "A1"), { ...base, assumido: true, ...NOVO("outra", "Outra") }));
await t("Samir (autorizado) exclui lead", "ALLOW", () => deleteDoc(doc(as(ADM), "leads", "A2")));
await t("Naykison (autorizado) exclui lead", "ALLOW", () => deleteDoc(doc(as(NAY), "leads", "A3")));
console.log("--- criação de lead: propriedade inicial");
await t("coordenador cria lead SEM responsável (fila) — cadastro normal", "ALLOW", () => criar("coord-outro", "c1"));
await t("outro admin cria lead SEM responsável (fila) — cadastro normal", "ALLOW", () => criar("admin-extra", "c2"));
await t("coordenador cria lead em nome de SI MESMO (Cadastro Gerencial)", "ALLOW", () => criar("coord-outro", "c3", { responsavelUid: "coord-outro", responsavel: "Outro Coord", consultora: "Outro Coord", cadastroGerencial: true }));
await t("recepcionista cria lead em nome de SI MESMA (cadastro normal)", "ALLOW", () => criar("lari", "c4", { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" }));
await t("coordenador cria lead atribuído a OUTRA pessoa (com o nome dela)", "DENY", () => criar("coord-outro", "c5", NOVO("lari", "Larissa")));
await t("coordenador cria lead atribuído a UID arbitrário", "DENY", () => criar("coord-outro", "c6", NOVO("fantasma", "X")));
await t("coordenador cria lead com o próprio UID mas o NOME de outra pessoa", "DENY", () => criar("coord-outro", "c7", { responsavelUid: "coord-outro", responsavel: "Larissa", consultora: "Larissa" }));
await t("coordenador cria lead sem UID mas com o NOME de outra pessoa (dono por nome)", "DENY", () => criar("coord-outro", "c8", { responsavelUid: "", responsavel: "Isadora", consultora: "Isadora" }));
await t("outro admin cria lead atribuído a outra pessoa", "DENY", () => criar("admin-extra", "c9", NOVO("lari", "Larissa")));
await t("recepcionista cria lead atribuído a OUTRA recepcionista", "DENY", () => criar("lari", "c10", NOVO("outra", "Outra")));
await t("recepcionista cria lead com o próprio UID e o nome de outra", "DENY", () => criar("lari", "c11", { responsavelUid: "lari", responsavel: "Outra", consultora: "Outra" }));
await t("autorizado (Samir) cria lead atribuído a uma recepcionista (equivale a transferir)", "ALLOW", () => criar(ADM, "c12", NOVO("lari", "Larissa")));
await t("autorizado (Naykison) cria lead em nome de si mesmo", "ALLOW", () => criar(NAY, "c13", { responsavelUid: NAY, responsavel: "Naykison", consultora: "Naykison" }));
await t("fluxo real: após Samir excluir A2, outro coordenador NÃO consegue recriá-lo com dono", "DENY", () => criar("coord-outro", "A2", NOVO("outra", "Outra")));
await t("…mas pode recriá-lo SEM dono (vira fila; não rouba carteira de ninguém)", "ALLOW", () => criar("coord-outro", "A2"));

console.log("\n=== H. M2 — UMA reversão por operação, imposta pelas Rules");
await seed();
await abrirOp(NAY, "opU"); await moverLeadTx(NAY, "opU", "A1", "isa", "lari", LARI); await finalizar(NAY, "opU");
const revU = (uid, id, extra = {}) => abrirOp(uid, id, { tipo: "reversao", reverteOpId: "opU", origemUid: "lari", destinoUid: "isa", ...extra });
await t("reversão com ID fora do padrão 'rev-<operação>' é negada", "DENY", () => revU(NAY, "rev-qualquer"));
await t("reversão com ID de OUTRA operação é negada", "DENY", () => revU(NAY, "rev-opX"));
await t("primeira reversão (ID rev-opU) é aceita", "ALLOW", () => revU(NAY, "rev-opU"));
await t("segunda reversão com outro ID é negada", "DENY", () => revU(ADM, "rev-opU-2"));
await t("segunda reversão com o MESMO ID (recriar por cima) é negada", "DENY", () => revU(ADM, "rev-opU"));
await t("…mesmo sobrescrevendo com os mesmos campos (set integral)", "DENY", () => setDoc(doc(as(ADM), "transferenciasEmMassa", "rev-opU"), { tipo: "reversao", reverteOpId: "opU", executadoPorUid: ADM, executadoPorNome: "x", origemUid: "lari", destinoUid: "isa", status: "em_andamento", leadIds: [], criadoEm: serverTimestamp() }));
await finalizar(NAY, "rev-opU", "concluida_com_pendencias");
await t("depois de encerrada (mesmo com pendências), nova reversão da mesma operação segue negada", "DENY", () => revU(ADM, "rev-opU-3"));
await t("e a operação encerrada não aceita reabertura", "DENY", () => updateDoc(doc(as(ADM), "transferenciasEmMassa", "rev-opU"), { status: "em_andamento" }));


console.log("\n=== I. M2 — REVERSÃO PROTEGIDA PELAS RULES (cada cláusula isolada: controle aceito × só o defeito negado)");
{
  // Estado: operação original REAL (isa → lari) com item para A1, finalizada; reversão (lari → isa) em andamento.
  const cenario = async ({ visita = false, origemAtiva = false } = {}) => {
    await seed();
    if (origemAtiva) await raw((d) => updateDoc(doc(d, "usuarios", "isa"), { ativo: true }));
    if (visita) await raw((d) => updateDoc(doc(d, "leads", "A1"), { visita: { id: "v1", data: "2026-10-12", hora: "10:00", consultor: "Isadora" } }));
    await abrirOp(NAY, "opF"); await moverLeadTx(NAY, "opF", "A1", "isa", "lari", LARI); await finalizar(NAY, "opF");
    await abrirOp(NAY, "rev-opF", { tipo: "reversao", reverteOpId: "opF", origemUid: "lari", destinoUid: "isa" });
  };
  const reverter = (uid, { owner = ISA, lead = {}, item = {} } = {}) => {
    const d = as(uid);
    return runTransaction(d, async (tx) => {
      tx.update(doc(d, "leads", "A1"), { ...owner, ultimaTransferenciaEmMassaId: "rev-opF", atualizadoEm: serverTimestamp(), ...lead });
      auditar(tx, d, { opId: "rev-opF", leadId: "A1", uid, de: "lari", para: "isa", item });
    });
  };
  const defeitoDeEstado = (opts, fn) => async (v) => { await cenario(opts); if (v) await fn(); };
  for (const [rotulo, opts] of [["origem INATIVA", {}], ["origem ATIVA", { origemAtiva: true }]]) {
    console.log(`--- ${rotulo}`);
    const P = (nome, fn, acao = () => reverter(NAY)) => par(`[${rotulo}] ${nome}`, defeitoDeEstado(opts, fn), acao);
    await t(`[${rotulo}] reversão legítima do lead transferido pela operação`, "ALLOW", async () => { await cenario(opts); await reverter(NAY); });
    await P("lead NUNCA transferido pela operação (sem item original)", () => raw((d) => deleteDoc(doc(d, "transferenciasEmMassa", "opF", "itens", "A1"))));
    await P("item original aponta outra destinatária (paraUid ≠ dono atual)", () => raw((d) => updateDoc(doc(d, "transferenciasEmMassa", "opF", "itens", "A1"), { paraUid: "outra" })));
    await P("item original aponta outra origem (deUid ≠ quem recebe de volta)", () => raw((d) => updateDoc(doc(d, "transferenciasEmMassa", "opF", "itens", "A1"), { deUid: "outra" })));
    await P("lead movido por OUTRA operação depois (marca diferente)", () => raw((d) => updateDoc(doc(d, "leads", "A1"), { ultimaTransferenciaEmMassaId: "outraOp" })));
    await P("lead ALTERADO depois da transferência (atualizadoEm mais novo)", () => raw((d) => updateDoc(doc(d, "leads", "A1"), { ultimoAtendimento: "x", atualizadoEm: serverTimestamp() })));
    // O item da reversão grava a etapa ATUAL do lead (4), como o serviço faz: assim o único defeito é
    // "a etapa de hoje difere da etapa registrada na transferência original".
    await par(`[${rotulo}] lead AVANÇOU de etapa depois (etapa mudou, atualizadoEm igual)`, defeitoDeEstado(opts, async () => {}), async (v) => { if (v) await raw((d) => updateDoc(doc(d, "leads", "A1"), { etapa: 4 })); return reverter(NAY, v ? { item: { etapa: 4 } } : {}); });
    await P("lead sem atualizadoEm (não dá para provar que está intocado)", () => raw((d) => updateDoc(doc(d, "leads", "A1"), { atualizadoEm: deleteField() })));
    await P("operação de reversão já ENCERRADA", () => raw((d) => updateDoc(doc(d, "transferenciasEmMassa", "rev-opF"), { status: "concluida" })));
    await par(`[${rotulo}] reversão que também altera OUTRO campo do lead (nome)`, defeitoDeEstado(opts, () => {}), (v) => reverter(NAY, v ? { lead: { nome: "Alterado" } } : {}));
    await par(`[${rotulo}] reversão que também muda a ETAPA`, defeitoDeEstado(opts, () => {}), (v) => reverter(NAY, v ? { lead: { etapa: 4 } } : {}));
    await par(`[${rotulo}] reversão executada por usuário NÃO autorizado`, defeitoDeEstado(opts, () => {}), (v) => reverter(v ? "coord-outro" : NAY));
  }
  console.log("--- só origem INATIVA (o caminho do update do lead é a exceção da reversão)");
  await par("operação de reversão com tipo errado ('transferencia')", defeitoDeEstado({}, () => raw((d) => updateDoc(doc(d, "transferenciasEmMassa", "rev-opF"), { tipo: "transferencia" }))), () => reverter(NAY));
  await par("destino da reversão com 'responsavel' diferente do cadastro", defeitoDeEstado({}, () => {}), (v) => reverter(NAY, v ? { owner: { responsavelUid: "isa", responsavel: "Nome Errado", consultora: "Isadora" } } : {}));
  await par("destino da reversão com 'consultora' diferente do cadastro", defeitoDeEstado({}, () => {}), (v) => reverter(NAY, v ? { owner: { responsavelUid: "isa", responsavel: "Isadora", consultora: "Nome Errado" } } : {}));
  await par("destino da reversão deixou de ser recepcionista", defeitoDeEstado({}, () => raw((d) => updateDoc(doc(d, "usuarios", "isa"), { perfil: "coordenador" }))), () => reverter(NAY));
  console.log("--- espelho da visita (lead.visita) na reversão");
  const comVisita = () => async () => { await cenario({ visita: true }); };
  await par("reversão muda SÓ visita.consultor (permitido) × também visita.data (proibido)", comVisita(), (v) => reverter(NAY, { lead: v ? { "visita.consultor": "Isadora", "visita.data": "2099-01-01" } : { "visita.consultor": "Isadora" } }));
  console.log("--- limites do que as Rules comprovam (documentados)");
  await t("LIMITE: evento novo só na timeline (sem gravar no lead) NÃO é visto pelas Rules — a reversão passa; a proteção é do serviço", "ALLOW", async () => {
    await cenario();
    await raw((d) => addDoc(collection(d, "leads", "A1", "eventos"), { leadId: "A1", tipo: "OBSERVACAO", usuario: "Larissa", descricao: "falou com o cliente", dados: {}, criadoEm: serverTimestamp() }));
    await reverter(NAY);
  });
}

console.log("\n=== J. PROPRIEDADE INICIAL (create) — cada cláusula isolada");
{
  const base = { nome: "Cliente", telefone: "4199", etapa: 0, idade: 30, status: "Novo Lead", createdAt: serverTimestamp() };
  const criar = (uid, id, dono) => setDoc(doc(as(uid), "leads", id), { ...base, assumido: !!dono?.responsavelUid, responsavelUid: "", responsavel: "", consultora: "", ...(dono || {}) });
  const prep = async () => { await seed(); };
  for (const [quem, uid, nome] of [["coordenador não autorizado", "coord-outro", "Outro Coord"], ["outro administrador", "admin-extra", "Admin Extra"], ["recepcionista", "lari", "Larissa"]]) {
    const proprio = { responsavelUid: uid, responsavel: nome, consultora: nome };
    await par(`[${quem}] UID de OUTRA pessoa (nomes próprios)`, prep, (v) => criar(uid, "j1", v ? { responsavelUid: "outra", responsavel: nome, consultora: nome } : proprio));
    await par(`[${quem}] UID de outra pessoa e nomes VAZIOS`, prep, (v) => criar(uid, "j2", v ? { responsavelUid: "outra", responsavel: "", consultora: "" } : { responsavelUid: uid, responsavel: "", consultora: "" }));
    await par(`[${quem}] 'responsavel' de outra pessoa (UID e 'consultora' próprios)`, prep, (v) => criar(uid, "j3", v ? { ...proprio, responsavel: "Isadora" } : proprio));
    await par(`[${quem}] 'consultora' de outra pessoa (UID e 'responsavel' próprios)`, prep, (v) => criar(uid, "j4", v ? { ...proprio, consultora: "Isadora" } : proprio));
    await par(`[${quem}] SEM UID mas com o nome próprio (não é fila nem é dele por UID)`, prep, (v) => criar(uid, "j5", v ? { responsavelUid: "", responsavel: nome, consultora: nome } : proprio));
    await par(`[${quem}] fila com 'responsavel' preenchido e sem UID`, prep, (v) => criar(uid, "j6", v ? { responsavelUid: "", responsavel: "Isadora", consultora: "" } : {}));
    await par(`[${quem}] fila com 'consultora' preenchida e sem UID`, prep, (v) => criar(uid, "j7", v ? { responsavelUid: "", responsavel: "", consultora: "Isadora" } : {}));
    await par(`[${quem}] UID e nomes INCONSISTENTES entre si (UID dele, nomes de outra pessoa)`, prep, (v) => criar(uid, "j8", v ? { responsavelUid: uid, responsavel: "Isadora", consultora: "Isadora" } : proprio));
    await par(`[${quem}] UID de outra pessoa com os NOMES dela`, prep, (v) => criar(uid, "j9", v ? { responsavelUid: "isa", responsavel: "Isadora", consultora: "Isadora" } : proprio));
  }
  await t("autorizado (Samir) pode atribuir lead novo a uma recepcionista (equivale a transferir)", "ALLOW", async () => { await prep(); await criar(ADM, "j10", NOVO("lari", "Larissa")); });
  await t("autorizado (Naykison) pode criar lead com UID e nomes inconsistentes? (permitido: ele já altera donos livremente)", "ALLOW", async () => { await prep(); await criar(NAY, "j11", { responsavelUid: "lari", responsavel: "Isadora", consultora: "Isadora" }); });
}

console.log("\n=== K. TRANSFERÊNCIA NORMAL — cada cláusula do destino isolada");
{
  const prep = async () => { await seed(); };
  const dest = (uid, dono) => updateDoc(doc(as(uid), "leads", "A1"), dono);
  for (const [quem, uid] of [["Samir", ADM], ["Naykison", NAY]]) {
    await par(`[${quem}] 'responsavel' diferente do cadastro do destino`, prep, (v) => dest(uid, v ? { responsavelUid: "lari", responsavel: "Isadora", consultora: "Larissa" } : LARI));
    await par(`[${quem}] 'consultora' diferente do cadastro do destino`, prep, (v) => dest(uid, v ? { responsavelUid: "lari", responsavel: "Larissa", consultora: "Isadora" } : LARI));
    await par(`[${quem}] UID de uma recepcionista com os nomes de OUTRA`, prep, (v) => dest(uid, v ? { responsavelUid: "lari", responsavel: "Outra", consultora: "Outra" } : LARI));
    await par(`[${quem}] destino com nomes certos mas INATIVO`, async () => { await seed(); }, (v) => dest(uid, v ? NOVO("inativa", "Inativa") : LARI));
    await par(`[${quem}] destino com nomes certos mas perfil de COORDENADOR`, prep, (v) => dest(uid, v ? NOVO("coord-outro", "Outro Coord") : LARI));
    await par(`[${quem}] só o nome trocado (UID antigo mantido)`, prep, (v) => dest(uid, v ? { responsavelUid: "isa", responsavel: "Larissa", consultora: "Larissa" } : LARI));
  }
  await t("cadastro de recepcionista sem o campo 'ativo' conta como ATIVO (padrão do sistema)", "ALLOW", async () => { await seed(); await raw((d) => setDoc(doc(d, "usuarios", "semativo"), { nome: "Sem Ativo", perfil: "recepcionista" })); await dest(ADM, NOVO("semativo", "Sem Ativo")); });
}


console.log("\n=== L. B1 — ASSUMIR LEAD SÓ EM NOME DE SI MESMO (UID real + nome do próprio cadastro)");
{
  const prep = async () => { await seed(); };
  // Mesmo payload do desktop (Leads.jsx) e do mobile (assumirLeadMobile.js).
  const payload = (uid, nome, extra = {}) => ({ assumido: true, responsavel: nome, responsavelUid: uid, consultora: nome, assumidoPor: nome, assumidoPorUid: uid, assumidoEm: serverTimestamp(), ...extra });
  const assumir = (uid, dados) => updateDoc(doc(as(uid), "leads", "FILA"), dados);
  const donoDaFila = async () => (await raw((d) => getDoc(doc(d, "leads", "FILA")))).data();
  for (const [quem, uid, nome] of [
    ["coordenador NÃO autorizado", "coord-outro", "Outro Coord"], ["outro administrador", "admin-extra", "Admin Extra"],
    ["recepcionista Larissa", "lari", "Larissa"], ["recepcionista Outra", "outra", "Outra"],
    ["Samir (autorizado)", ADM, "Samir"], ["Naykison (autorizado)", NAY, "Naykison"],
  ]) {
    await t(`[${quem}] assunção LEGÍTIMA (UID e nome do próprio cadastro; payload de desktop e mobile)`, "ALLOW", async () => { await prep(); await assumir(uid, payload(uid, nome)); });
    await par(`[${quem}] 'responsavel' com o nome de OUTRA pessoa (UID e 'consultora' próprios)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { responsavel: "Isadora" } : {})));
    await par(`[${quem}] 'consultora' com o nome de OUTRA pessoa (UID e 'responsavel' próprios)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { consultora: "Isadora" } : {})));
    await par(`[${quem}] os DOIS nomes de outra pessoa (UID próprio): o caso da auditoria`, prep, (v) => assumir(uid, payload(uid, nome, v ? { responsavel: "Isadora", consultora: "Isadora" } : {})));
    await par(`[${quem}] UID de OUTRA pessoa (nomes próprios)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { responsavelUid: "isa" } : {})));
    await par(`[${quem}] UID e nomes da MESMA outra pessoa (atribuir a terceiros)`, prep, (v) => assumir(uid, payload(v ? "isa" : uid, v ? "Isadora" : nome)));
    await par(`[${quem}] nomes VAZIOS (UID próprio)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { responsavel: "", consultora: "" } : {})));
    await par(`[${quem}] 'assumidoPorUid' de outra pessoa (campo de auditoria da assunção)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { assumidoPorUid: "isa" } : {})));
    await par(`[${quem}] 'assumidoPor' com o nome de outra pessoa (campo de auditoria da assunção)`, prep, (v) => assumir(uid, payload(uid, nome, v ? { assumidoPor: "Isadora" } : {})));
  }
  await t("assunção sem os campos opcionais assumidoPor/assumidoPorUid continua aceita (nada novo é exigido)", "ALLOW", async () => { await prep(); await assumir("lari", { assumido: true, responsavel: "Larissa", responsavelUid: "lari", consultora: "Larissa" }); });
  await par("lead que JÁ tem dono não pode ser assumido (cláusula 'sem responsável')", async (v) => { await seed(); if (v) await raw((d) => updateDoc(doc(d, "leads", "FILA"), NOVO("outra", "Outra"))); }, () => assumir("lari", payload("lari", "Larissa")));
  await t("[efeito] tentativa de assumir em nome de outra pessoa NÃO deixa rastro: o lead segue na fila", "DENY", async () => { await prep(); await assumir("lari", payload("lari", "Larissa", { responsavel: "Isadora", consultora: "Isadora" })); });
  check("…o lead continua sem responsável (nem UID nem nome gravados)", (await donoDaFila()).responsavelUid === "" && (await donoDaFila()).responsavel === "" && (await donoDaFila()).consultora === "");
  await t("[efeito] depois da assunção legítima a dona edita o próprio lead", "ALLOW", async () => { await prep(); await assumir("lari", payload("lari", "Larissa")); await updateDoc(doc(as("lari"), "leads", "FILA"), { ultimoAtendimento: "x" }); });
  // cadastro renomeado depois do login: o nome da sessão ficou desatualizado
  await par("[sessão desatualizada] nome do cadastro foi alterado depois do login", async (v) => { await seed(); if (v) await raw((d) => updateDoc(doc(d, "usuarios", "lari"), { nome: "Larissa Nova" })); }, () => assumir("lari", payload("lari", "Larissa")));
}

console.log("\n=== M. B3 — INTEGRIDADE DA AUDITORIA: cada campo conferido pelas Rules (controle × só o defeito)");
{
  const prep = async () => { await seed(); await abrirOp(NAY, "oM"); };
  const transferir = (uid, o = {}) => {
    const d = as(uid);
    return runTransaction(d, async (tx) => {
      tx.update(doc(d, "leads", "A1"), { ...LARI, ultimaTransferenciaEmMassaId: "oM", atualizadoEm: serverTimestamp() });
      auditar(tx, d, { opId: "oM", leadId: "A1", uid, de: "isa", para: "lari", ...o });
    });
  };
  console.log("--- campos do item");
  await par("anterior.responsavelUid FALSO", prep, (v) => transferir(NAY, v ? { anterior: { responsavelUid: "outra", responsavel: "Isadora", consultora: "Isadora" } } : {}));
  await par("anterior.responsavel FALSO", prep, (v) => transferir(NAY, v ? { anterior: { responsavelUid: "isa", responsavel: "Outra", consultora: "Isadora" } } : {}));
  await par("anterior.consultora FALSA", prep, (v) => transferir(NAY, v ? { anterior: { responsavelUid: "isa", responsavel: "Isadora", consultora: "Outra" } } : {}));
  await par("anterior que NÃO é um mapa", prep, (v) => transferir(NAY, v ? { item: { anterior: "texto" } } : {}));
  await par("anterior de lead LEGADO (sem 'responsavel'): null é verdadeiro, 'Isadora' é falso", async () => { await seed(); await abrirOp(NAY, "oM", { leadIds: ["LEG"] }); }, (v) => {
    const d = as(NAY);
    return runTransaction(d, async (tx) => {
      tx.update(doc(d, "leads", "LEG"), { ...LARI, ultimaTransferenciaEmMassaId: "oM", atualizadoEm: serverTimestamp() });
      auditar(tx, d, { opId: "oM", leadId: "LEG", uid: NAY, de: "isa", para: "lari", anterior: { responsavelUid: "isa", responsavel: v ? "Isadora" : null, consultora: "Isadora" } });
    });
  });
  await par("deNome ≠ nome de origem da operação", prep, (v) => transferir(NAY, v ? { item: { deNome: "Nome Falso" } } : {}));
  await par("paraNome ≠ nome de destino da operação", prep, (v) => transferir(NAY, v ? { item: { paraNome: "Nome Falso" } } : {}));
  await par("visitasAtualizadas que NÃO é uma lista", prep, (v) => transferir(NAY, v ? { item: { visitasAtualizadas: "x" } } : {}));
  console.log("--- eventoId: precisa ser um evento TRANSFERENCIA real, desta operação, entre os mesmos responsáveis");
  await par("eventoId de um evento que NÃO existe", prep, (v) => transferir(NAY, v ? { item: { eventoId: "nao-existe" } } : {}));
  await par("item SEM evento criado na mesma transação", prep, (v) => transferir(NAY, { semEvento: v }));
  await par("eventoId que não é texto", prep, (v) => transferir(NAY, v ? { item: { eventoId: 123 } } : {}));
  await par("evento com tipo diferente de TRANSFERENCIA", prep, (v) => transferir(NAY, v ? { evento: { campos: { tipo: "OBSERVACAO" } } } : {}));
  await par("evento com 'leadId' de OUTRO lead", prep, (v) => transferir(NAY, v ? { evento: { campos: { leadId: "A2" } } } : {}));
  await par("evento de OUTRA operação (dados.operacaoId)", prep, (v) => transferir(NAY, v ? { evento: { dados: { operacaoId: "outraOp" } } } : {}));
  await par("evento com responsável anterior diferente do item", prep, (v) => transferir(NAY, v ? { evento: { dados: { responsavelAnteriorUid: "outra" } } } : {}));
  await par("evento com novo responsável diferente do item", prep, (v) => transferir(NAY, v ? { evento: { dados: { novoResponsavelUid: "outra" } } } : {}));
  console.log("--- operação: identidade e contagens na CRIAÇÃO");
  await par("executadoPorNome diferente do cadastro de quem cria", seed, (v) => abrirOp(NAY, "opC", v ? { executadoPorNome: "Nome Falso" } : {}));
  await par("origemNome diferente do cadastro da origem", seed, (v) => abrirOp(NAY, "opC", v ? { origemNome: "Nome Falso" } : {}));
  await par("destinoNome diferente do cadastro do destino", seed, (v) => abrirOp(NAY, "opC", v ? { destinoNome: "Nome Falso" } : {}));
  await par("totalPrevisto diferente do número de leads", seed, (v) => abrirOp(NAY, "opC", v ? { totalPrevisto: 5 } : {}));
  await par("origem == destino (nomes coerentes com o cadastro: só o defeito 'mesma pessoa')", seed, (v) => abrirOp(NAY, "opC", v ? { destinoUid: "isa", destinoNome: "Isadora" } : {}));
  await par("operação SEM leads", seed, (v) => abrirOp(NAY, "opC", v ? { leadIds: [], totalPrevisto: 0 } : {}));
  await par("leadIds que não é uma lista", seed, (v) => abrirOp(NAY, "opC", v ? { leadIds: "A1", totalPrevisto: 2 } : {}));
  console.log("--- operação: contadores e estado final DECLARADOS");
  const prepFin = async () => { await seed(); await abrirOp(NAY, "opZ", { leadIds: ["A1", "A2"] }); };
  const fin = (extra, status = "concluida") => updateDoc(doc(as(NAY), "transferenciasEmMassa", "opZ"), { status, totalConcluido: 2, totalFalhas: 0, totalPulados: 0, falhas: [], pulados: [], finalizadoEm: serverTimestamp(), finalizadoPorUid: NAY, ...extra });
  await par("'concluida' declarando MENOS concluídos que o previsto", prepFin, (v) => fin(v ? { totalConcluido: 1 } : {}));
  await par("'concluida' declarando uma falha", prepFin, (v) => fin(v ? { totalConcluido: 1, totalFalhas: 1, falhas: [{ leadId: "A2" }] } : {}));
  await par("'concluida' declarando um pulado", prepFin, (v) => fin(v ? { totalConcluido: 1, totalPulados: 1, pulados: [{ leadId: "A2" }] } : {}));
  await par("contadores que somam MAIS que o previsto", prepFin, (v) => fin(v ? { totalConcluido: 2, totalFalhas: 1, falhas: [{}] } : {}, "concluida_com_pendencias"));
  const pend = (c, p) => ({ totalConcluido: c, totalPulados: p, pulados: Array.from({ length: p }, (_, i) => ({ leadId: "A" + (i + 1) })) });
  await par("contador NEGATIVO (soma dentro do previsto, tamanhos coerentes: só o defeito 'negativo')", prepFin, (v) => fin(v ? pend(-1, 3) : pend(1, 1), "concluida_com_pendencias"));
  await par("contador que não é inteiro (1.5: só o defeito 'não inteiro')", prepFin, (v) => fin(v ? { totalConcluido: 1.5, totalPulados: 0, pulados: [] } : { totalConcluido: 1, totalPulados: 0, pulados: [] }, "concluida_com_pendencias"));
  await par("contador que é texto", prepFin, (v) => fin(v ? { totalConcluido: "2" } : {}));
  await par("falhas com tamanho diferente de totalFalhas", prepFin, (v) => fin(v ? { totalConcluido: 1, totalFalhas: 1, falhas: [] } : { totalConcluido: 1, totalFalhas: 1, falhas: [{ leadId: "A2" }] }, "concluida_com_pendencias"));
  await par("pulados com tamanho diferente de totalPulados", prepFin, (v) => fin(v ? { totalConcluido: 1, totalPulados: 1, pulados: [] } : { totalConcluido: 1, totalPulados: 1, pulados: [{ leadId: "A2" }] }, "concluida_com_pendencias"));
  await par("progresso em andamento acima do previsto", prepFin, (v) => updateDoc(doc(as(NAY), "transferenciasEmMassa", "opZ"), { totalConcluido: v ? 3 : 2 }));
  console.log("--- marca da transferência nas visitas (a reversão usa para saber quais visitas foram mexidas)");
  for (const [quem, uid, ok] of [["coordenador não autorizado", "coord-outro", false], ["outro administrador", "admin-extra", false], ["recepcionista em turno", "outra", false], ["Naykison (autorizado)", NAY, true], ["Samir (autorizado)", ADM, true]]) {
    const alvo = uid === "outra" ? "vB" : "vA";
    await t(`[${quem}] atualiza um campo comum da visita (controle)`, "ALLOW", async () => { await seed(); await updateDoc(doc(as(uid), "visitas", alvo), { observacao: "x" }); });
    await t(`[${quem}] grava a MARCA ultimaTransferenciaEmMassaId numa visita`, ok ? "ALLOW" : "DENY", async () => { await seed(); await updateDoc(doc(as(uid), "visitas", alvo), { observacao: "x", ultimaTransferenciaEmMassaId: "opQualquer" }); });
  }
  console.log("--- LIMITES (o que as Rules NÃO conseguem comprovar — documentado)");
  await t("LIMITE: contadores coerentes com ZERO itens gravados são aceitos (as Rules não contam itens)", "ALLOW", async () => { await prepFin(); await fin({}); });
  await t("LIMITE: conteúdo de visitasAtualizadas (uma lista) é aceito como o cliente enviou — por isso a reversão NÃO a usa", "ALLOW", async () => { await prep(); await transferir(NAY, { item: { visitasAtualizadas: [{ id: "qualquer", consultoraIdAnterior: "uid-falso" }] } }); });
}

await env.cleanup();
process.exit(fim() ? 1 : 0);
