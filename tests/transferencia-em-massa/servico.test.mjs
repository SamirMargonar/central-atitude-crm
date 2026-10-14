// ETAPA 2 — Serviço REAL (src/services/transferenciaEmMassa.js) contra o Emulator,
// com as Rules REAIS do repositório. O serviço recebe db + fs por injeção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { pathToFileURL } from "node:url";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const {
  criarServicoTransferencia, classificarLeads, classificarVisita, hojeBrasilia, normalizarNome,
  RESULTADO_LEAD, MOTIVO_ANALISE,
} = await import(pathToFileURL(`${REPO}/src/services/transferenciaEmMassa.js`).href);

const { doc, setDoc, getDoc, getDocs, collection, updateDoc } = fs;
const { t, tErro, check, fim } = criarRelatorio();

const AGORA = () => new Date("2026-10-10T15:00:00Z");   // hoje = 2026-10-10 (Brasília)
const env = await initializeTestEnvironment({
  projectId: "demo-tme-servico",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const ctx = {};
const db = (uid) => (ctx[uid] ||= env.authenticatedContext(uid).firestore());
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const lerLead = (id) => raw(async (d) => (await getDoc(doc(d, "leads", id))).data());
const lerVisita = (id) => raw(async (d) => (await getDoc(doc(d, "visitas", id))).data());
const eventos = (id) => raw(async (d) => (await getDocs(collection(d, "leads", id, "eventos"))).docs.map((x) => x.data()));
const itens = (op) => raw(async (d) => (await getDocs(collection(d, "transferenciasEmMassa", op, "itens"))).docs.map((x) => ({ id: x.id, ...x.data() })));
const lerOp = (id) => raw(async (d) => (await getDoc(doc(d, "transferenciasEmMassa", id))).data());
const snapshotColecao = (nome) => raw(async (d) => Object.fromEntries((await getDocs(collection(d, nome))).docs.map((x) => [x.id, JSON.stringify(x.data())])));

// fábrica com possibilidade de injetar falhas e ganchos
const faltas = { proximas: 0, aposTx: null };
const fsTeste = {
  ...fs,
  runTransaction: async (d, fn, o) => {
    if (faltas.proximas > 0) { faltas.proximas--; throw Object.assign(new Error("rede caiu"), { code: "unavailable" }); }
    const r = await fs.runTransaction(d, fn, o);
    if (faltas.aposTx) await faltas.aposTx();
    return r;
  },
};
const servico = (uid) => criarServicoTransferencia({ db: db(uid), fs: fsTeste, agora: AGORA });
const exec = (uid, nome) => ({ uid, nome });

const ISA = { id: "isa", nome: "Isadora", ativo: false };
const LARI = { id: "lari", nome: "Larissa", ativo: true };
const NOMES = (n) => ({ responsavelUid: n === "Isadora" ? "isa" : "lari", responsavel: n, consultora: n });

async function seed() {
  await env.clearFirestore();
  faltas.proximas = 0; faltas.aposTx = null;
  await raw(async (d) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(d, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "18:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador");
    await u("coord-outro", "Outro Coord", "coordenador"); await u("admin-extra", "Admin Extra", "admin");
    await u("isa", "Isadora", "recepcionista", { ativo: false });
    await u("lari", "Larissa", "recepcionista"); await u("outra", "Outra", "recepcionista");
    await u("inativa2", "Inativa Dois", "recepcionista", { ativo: false });
    const lead = (id, extra) => setDoc(doc(d, "leads", id), { nome: `Cliente ${id}`, telefone: "4199", etapa: 2, assumido: true, ...NOMES("Isadora"), observacoes: [{ texto: "obs " + id }], ...extra });
    await lead("L1", { etapa: 3, visita: { id: "vA", data: "2026-10-12", hora: "10:00", consultor: "Isadora", observacao: "" } });
    await lead("L2", {}); await lead("L3", { etapa: 4 });
    await setDoc(doc(d, "leads", "L4"), { nome: "Legado", etapa: 2, assumido: true, responsavelUid: "isa", consultora: "Isadora" });
    await lead("L5", { cadastroGerencial: true });
    await lead("L6", { etapa: 0, assumido: false });
    await lead("L7", { consultora: "Outra Pessoa" });
    await setDoc(doc(d, "leads", "L8"), { nome: "SemUid", etapa: 2, assumido: true, responsavelUid: "", consultora: "Isadora" });
    await setDoc(doc(d, "leads", "L9"), { nome: "UidOutro", etapa: 2, assumido: true, responsavelUid: "outra", responsavel: "Outra", consultora: "Isadora" });
    await setDoc(doc(d, "leads", "FILA1"), { nome: "Fila", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "" });
    await setDoc(doc(d, "leads", "O1"), { nome: "Da Outra", etapa: 2, assumido: true, ...{ responsavelUid: "outra", responsavel: "Outra", consultora: "Outra" } });
    for (let i = 10; i < 30; i++) await lead(`L${i}`, {});
    const v = (id, leadId, extra) => setDoc(doc(d, "visitas", id), { leadId, leadNome: "x", consultora: "Isadora", consultoraId: "isa", status: "AGENDADA", hora: "10:00", ...extra });
    await v("vA", "L1", { data: "2026-10-12" });
    await v("vB", "L1", { data: "2026-10-10", status: "CONFIRMADA", comparecimento: "" });
    await v("vC", "L1", { data: "2026-09-20", status: "CONFIRMADA", comparecimento: "COMPARECEU" });
    await v("vD", "L1", { data: "2026-09-25", status: "CONFIRMADA", comparecimento: "NAO_COMPARECEU" });
    await v("vE", "L1", { data: "2026-09-28" });
    await setDoc(doc(d, "visitas", "vF"), { leadId: "L1", leadNome: "x", consultora: "Isadora", status: "AGENDADA", hora: "11:00", data: "2026-10-11" });
    await v("vG", "L1", { data: "2026-10-13", consultoraId: "outra", consultora: "Outra" });
    await v("vL2", "L2", { data: "2026-10-15" });
  });
}

// ===========================================================
console.log("\n=== A. LÓGICA PURA");
check("hoje em Brasília: 2026-10-10T02:00Z ainda é dia 09", hojeBrasilia(new Date("2026-10-10T02:00:00Z")) === "2026-10-09");
check("hoje em Brasília: 2026-10-10T15:00Z é dia 10", hojeBrasilia(AGORA()) === "2026-10-10");
check("normalizarNome ignora acento, caixa e espaços", normalizarNome("  ANNA   Lára ") === "anna lara");
const H = "2026-10-10";
const cv = (v) => classificarVisita(v, { origemId: "isa", hoje: H }).acao;
check("visita futura da origem → atualizar", cv({ data: "2026-10-12", consultoraId: "isa" }) === "atualizar");
check("visita de hoje → atualizar", cv({ data: "2026-10-10", consultoraId: "isa" }) === "atualizar");
check("visita legada sem consultoraId → atualizar", cv({ data: "2026-10-12" }) === "atualizar");
check("COMPARECEU → manter", cv({ data: "2026-10-12", comparecimento: "COMPARECEU" }) === "manter_realizada");
check("NAO_COMPARECEU → manter", cv({ data: "2026-09-01", comparecimento: "NAO_COMPARECEU" }) === "manter_realizada");
check("passada sem baixa → análise", cv({ data: "2026-09-28" }) === "analise");
check("de outro dono → análise", cv({ data: "2026-10-12", consultoraId: "outra" }) === "analise");
check("sem data → análise", cv({}) === "analise");
const g = classificarLeads({
  origem: { id: "isa", nome: "Isadora" },
  daOrigem: [
    { id: "a", etapa: 2, assumido: true, consultora: "Isadora", responsavel: "Isadora" },
    { id: "b", etapa: 0, assumido: false, consultora: "Isadora" },
    { id: "c", etapa: 3, assumido: true, cadastroGerencial: true, consultora: "Isadora" },
    { id: "d", etapa: 2, assumido: true, consultora: "Outra Pessoa" },
    { id: "e", etapa: 2, assumido: true, consultora: "isadora" },
    { id: "f", etapa: 0, assumido: undefined, consultora: "Isadora" },
  ],
  porNome: [{ id: "a", responsavelUid: "isa" }, { id: "x", responsavelUid: "" }, { id: "y", responsavelUid: "outra" }],
});
check("elegíveis = a, e (nome igual sem diferenciar caixa)", g.elegiveis.map((l) => l.id).sort().join() === "a,e");
check("gerenciais separados = c", g.gerenciais.map((l) => l.id).join() === "c");
check("etapa 0 não assumido (inclui assumido ausente) → análise", g.analise.filter((x) => x.motivo === MOTIVO_ANALISE.ETAPA_0_NAO_ASSUMIDO).map((x) => x.lead.id).sort().join() === "b,f");
check("nomes divergentes → análise", g.analise.some((x) => x.lead.id === "d" && x.motivo === MOTIVO_ANALISE.NOMES_DIVERGENTES));
check("sem UID com o nome → análise", g.analise.some((x) => x.lead.id === "x" && x.motivo === MOTIVO_ANALISE.SEM_UID_COM_NOME));
check("UID de outro com o nome → análise", g.analise.some((x) => x.lead.id === "y" && x.motivo === MOTIVO_ANALISE.UID_DE_OUTRO_COM_NOME));
check("lead já da origem repetido em porNome não duplica", g.analise.filter((x) => x.lead.id === "a").length === 0);
check("resumo por etapa só dos elegíveis", g.resumoPorEtapa[2] === 2 && Object.keys(g.resumoPorEtapa).length === 1);

// ===========================================================
console.log("\n=== B. USUÁRIOS e PRÉVIA (somente leitura, como Naykison)");
await seed();
const sNay = servico(NAY);
const { origens, destinos } = await sNay.carregarUsuarios();
check("origens = todas as recepcionistas (ativas E inativas)", origens.map((u) => u.id).sort().join() === "inativa2,isa,lari,outra");
check("destinos = só recepcionistas ativas", destinos.map((u) => u.id).sort().join() === "lari,outra");
await raw((d) => setDoc(doc(d, "usuarios", "lari"), { id: "ID-ERRADO", uid: "UID-ERRADO", nome: "Larissa", perfil: "recepcionista", ativo: true }));
check("ID real do documento prevalece sobre campo 'id' gravado", (await sNay.carregarUsuarios()).destinos.some((u) => u.id === "lari") && !(await sNay.carregarUsuarios()).destinos.some((u) => u.id === "ID-ERRADO"));
await raw((d) => setDoc(doc(d, "usuarios", "lari"), { nome: "Larissa", perfil: "recepcionista", ativo: true, horaEntrada: "08:00", horaSaida: "18:00" }));
const antesPrevia = { leads: await snapshotColecao("leads"), visitas: await snapshotColecao("visitas") };
const previa = await sNay.montarPrevia({ origem: ISA, destino: LARI });
check("prévia NÃO grava nada", JSON.stringify(antesPrevia.leads) === JSON.stringify(await snapshotColecao("leads")) && JSON.stringify(antesPrevia.visitas) === JSON.stringify(await snapshotColecao("visitas")));
const ids = (l) => l.map((x) => x.id).sort().join();
const esperados = ["L1", "L2", "L3", "L4", ...Array.from({ length: 20 }, (_, i) => `L${i + 10}`)].sort().join();
check("elegíveis (inclui legado sem 'responsavel')", ids(previa.elegiveis) === esperados, ids(previa.elegiveis));
check("gerencial L5 separado (não elegível por padrão)", ids(previa.gerenciais) === "L5");
check("L6 (etapa 0 não assumido) em análise", previa.analise.some((a) => a.lead.id === "L6" && a.motivo === "ETAPA_0_NAO_ASSUMIDO"));
check("L7 (nomes divergentes) em análise", previa.analise.some((a) => a.lead.id === "L7" && a.motivo === "NOMES_DIVERGENTES"));
check("L8 (sem UID, com nome) em análise", previa.analise.some((a) => a.lead.id === "L8" && a.motivo === "SEM_UID_COM_NOME"));
check("L9 (UID de outra, nome da origem) em análise", previa.analise.some((a) => a.lead.id === "L9" && a.motivo === "UID_DE_OUTRO_COM_NOME"));
check("fila compartilhada e leads de outras NUNCA aparecem", ![...previa.elegiveis, ...previa.gerenciais, ...previa.analise.map((a) => a.lead)].some((l) => ["FILA1", "O1"].includes(l.id)));
const l1 = previa.elegiveis.find((l) => l.id === "L1");
check("visitas de L1: 3 a atualizar, 2 realizadas, 2 em análise (passada sem baixa + outro dono)", JSON.stringify(l1.visitasResumo) === JSON.stringify({ atualizar: 3, realizadas: 2, analise: 2 }), JSON.stringify(l1.visitasResumo));
check("resumo por etapa soma os elegíveis", Object.values(previa.resumoPorEtapa).reduce((a, b) => a + b, 0) === previa.elegiveis.length);
await tErro("origem == destino é recusada", /pessoas diferentes/, () => sNay.montarPrevia({ origem: LARI, destino: LARI }));

// ===========================================================
console.log("\n=== C. EXECUÇÃO COMPLETA como Naykison (lead + visitas + evento + item, por lead)");
const selecionados = previa.elegiveis.map((l) => l.id);
await tErro("destino INATIVO é recusado pelo serviço", /recepcionista ativa/, () => sNay.iniciarOperacao({ previa: { ...previa, destino: { id: "inativa2", nome: "Inativa Dois" } }, leadIds: ["L2"], motivo: "x", executor: exec(NAY, "Naykison") }));
await tErro("motivo vazio é recusado", /motivo/i, () => sNay.iniciarOperacao({ previa, leadIds: ["L2"], motivo: "  ", executor: exec(NAY, "Naykison") }));
await tErro("lead fora do conjunto elegível (L6) é recusado", /não são elegíveis/, () => sNay.iniciarOperacao({ previa, leadIds: ["L2", "L6"], motivo: "x", executor: exec(NAY, "Naykison") }));
await tErro("lead da fila é recusado", /não são elegíveis/, () => sNay.iniciarOperacao({ previa, leadIds: ["FILA1"], motivo: "x", executor: exec(NAY, "Naykison") }));
const op1 = await sNay.iniciarOperacao({ previa, leadIds: selecionados, motivo: "Saída da consultora", executor: exec(NAY, "Naykison") });
const progresso = [];
const r1 = await sNay.executarOperacao({ opId: op1, executor: exec(NAY, "Naykison"), aoProgredir: (p) => progresso.push(p.concluidos) });
check("resultado: concluída, sem pendências", r1.estado === "concluida" && r1.pendentes.length === 0 && r1.totalConcluido === selecionados.length);
check("progresso reportado chegou ao total", Math.max(...progresso) === selecionados.length);
const o1 = await lerOp(op1);
check("operação gravada como 'concluida' com autoria do Naykison", o1.status === "concluida" && o1.executadoPorUid === NAY && o1.finalizadoPorUid === NAY && o1.totalConcluido === selecionados.length);
const lead1 = await lerLead("L1");
check("L1: 3 campos de dono = Larissa", lead1.responsavelUid === "lari" && lead1.responsavel === "Larissa" && lead1.consultora === "Larissa");
check("L1: etapa e observações preservadas", lead1.etapa === 3 && lead1.observacoes[0].texto === "obs L1" && lead1.assumido === true);
check("L1: visita embutida mantém id/data/hora; só o consultor muda", lead1.visita.id === "vA" && lead1.visita.data === "2026-10-12" && lead1.visita.hora === "10:00" && lead1.visita.consultor === "Larissa");
const vis = Object.fromEntries(await Promise.all(["vA", "vB", "vC", "vD", "vE", "vF", "vG", "vL2"].map(async (i) => [i, await lerVisita(i)])));
check("visitas futuras elegíveis (vA, vB, vF legada, vL2) → Larissa", ["vA", "vB", "vF", "vL2"].every((i) => vis[i].consultoraId === "lari" && vis[i].consultora === "Larissa"));
check("ID/data/hora/status das visitas atualizadas preservados", vis.vA.status === "AGENDADA" && vis.vA.data === "2026-10-12" && vis.vA.hora === "10:00" && vis.vB.status === "CONFIRMADA" && vis.vB.data === "2026-10-10");
check("visitas realizadas (vC, vD) mantêm a responsável original", ["vC", "vD"].every((i) => vis[i].consultoraId === "isa" && vis[i].consultora === "Isadora"));
check("visita passada sem baixa (vE) e de outro dono (vG) intocadas", vis.vE.consultoraId === "isa" && vis.vG.consultoraId === "outra" && vis.vG.consultora === "Outra");
check("nenhuma visita criada/apagada (8)", Object.keys(await snapshotColecao("visitas")).length === 8);
check("cada lead tem exatamente 1 evento TRANSFERENCIA com o ID da operação", (await Promise.all(selecionados.map(eventos))).every((e) => e.length === 1 && e[0].tipo === "TRANSFERENCIA" && e[0].dados.operacaoId === op1 && e[0].dados.origem === "massa"));
const it1 = await itens(op1);
check("1 item de auditoria por lead movido", it1.length === selecionados.length);
const itL1 = it1.find((i) => i.id === "L1"), itL4 = it1.find((i) => i.id === "L4");
check("item guarda valores anteriores e visitas alteradas (para reversão)", itL1.anterior.responsavelUid === "isa" && itL1.visitasAtualizadas.length === 3 && itL1.visitaEmbutidaAjustada?.id === "vA");
check("lead legado: 'responsavel' anterior registrado como nulo e agora preenchido", itL4.anterior.responsavel === null && (await lerLead("L4")).responsavel === "Larissa");
check("L5 (gerencial), L6, L7, L8, L9, FILA1, O1 NÃO foram tocados", (await Promise.all(["L5", "L6", "L7", "L8", "L9", "FILA1", "O1"].map(lerLead))).every((l) => l.responsavelUid !== "lari" && (l.ultimaTransferenciaEmMassaId === undefined)));
await tErro("operação encerrada não pode ser executada de novo", /já foi encerrada/, () => sNay.executarOperacao({ opId: op1, executor: exec(NAY, "Naykison") }));
check("nenhum evento extra após a tentativa de reexecução", (await eventos("L2")).length === 1);

// ===========================================================
console.log("\n=== D. FALHA PARCIAL, INTERRUPÇÃO, RETOMADA E REPETIÇÃO (sem duplicar eventos)");
await seed();
const p2 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const sel2 = p2.elegiveis.map((l) => l.id);
const op2 = await servico(NAY).iniciarOperacao({ previa: p2, leadIds: sel2, motivo: "teste", executor: exec(NAY, "Naykison") });
faltas.proximas = 3;
const r2 = await servico(NAY).executarOperacao({ opId: op2, executor: exec(NAY, "Naykison"), concorrencia: 1 });
check("3 falhas de rede: NÃO declara sucesso (estado 'pendencias')", r2.estado === "pendencias" && r2.pendentes.length === 3 && r2.pendentes.every((p) => p.resultado === RESULTADO_LEAD.FALHA));
check("operação segue 'em_andamento' (não finalizada)", (await lerOp(op2)).status === "em_andamento");
check("só os leads processados têm item (total - 3)", (await itens(op2)).length === sel2.length - 3);
check("leads que falharam continuam com a origem, sem evento", (await Promise.all(r2.pendentes.map(async (p) => [(await lerLead(p.leadId)).responsavelUid, (await eventos(p.leadId)).length]))).every(([u, n]) => u === "isa" && n === 0));
const r2b = await servico(ADM).executarOperacao({ opId: op2, executor: exec(ADM, "Samir") });
check("RETOMADA por OUTRO autorizado (Samir) conclui", r2b.estado === "concluida" && r2b.totalConcluido === sel2.length);
check("nenhum evento duplicado após retomada (1 por lead)", (await Promise.all(sel2.map(eventos))).every((e) => e.length === 1));
check("itens: exatamente 1 por lead, com a autoria de quem de fato executou", (await itens(op2)).length === sel2.length && new Set((await itens(op2)).map((i) => i.executadoPorUid)).size === 2);
check("operação criada pelo Naykison e encerrada pelo Samir (autorias preservadas)", (await lerOp(op2)).executadoPorUid === NAY && (await lerOp(op2)).finalizadoPorUid === ADM);

// interrupção (usuário cancela) e retomada
await seed();
const p3 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const sel3 = p3.elegiveis.map((l) => l.id);
const op3 = await servico(NAY).iniciarOperacao({ previa: p3, leadIds: sel3, motivo: "teste", executor: exec(NAY, "Naykison") });
let feitos = 0;
const r3 = await servico(NAY).executarOperacao({ opId: op3, executor: exec(NAY, "Naykison"), concorrencia: 1, aoProgredir: () => { feitos++; }, deveParar: () => feitos >= 4 });
check("cancelamento: estado 'interrompida', op continua em andamento, 4 itens", r3.estado === "interrompida" && (await lerOp(op3)).status === "em_andamento" && (await itens(op3)).length === 4);
const r3b = await servico(NAY).executarOperacao({ opId: op3, executor: exec(NAY, "Naykison") });
check("retomada conclui e não duplica eventos", r3b.estado === "concluida" && (await Promise.all(sel3.map(eventos))).every((e) => e.length === 1));

// lead alterado por terceiros depois da prévia
await seed();
const p4 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const sel4 = p4.elegiveis.map((l) => l.id);
const op4 = await servico(NAY).iniciarOperacao({ previa: p4, leadIds: sel4, motivo: "teste", executor: exec(NAY, "Naykison") });
await raw((d) => updateDoc(doc(d, "leads", "L2"), { responsavelUid: "outra", responsavel: "Outra", consultora: "Outra", ultimoAtendimento: "feito por terceiros" }));
const r4 = await servico(NAY).executarOperacao({ opId: op4, executor: exec(NAY, "Naykison") });
check("lead trocado de dono por terceiros é PULADO (não sobrescrito)", r4.estado === "pendencias" && r4.pendentes.length === 1 && r4.pendentes[0].leadId === "L2" && r4.pendentes[0].resultado === RESULTADO_LEAD.PULADO_DONO_MUDOU);
const l2 = await lerLead("L2");
check("L2 preserva a alteração de terceiros, sem evento, e sua visita não foi mexida", l2.responsavelUid === "outra" && l2.ultimoAtendimento === "feito por terceiros" && (await eventos("L2")).length === 0 && (await lerVisita("vL2")).consultoraId === "isa");
await servico(NAY).encerrarComPendencias({ opId: op4, executor: exec(NAY, "Naykison"), pendentes: r4.pendentes });
const o4 = await lerOp(op4);
check("encerrar com pendências registra o salto e NÃO é 'concluida'", o4.status === "concluida_com_pendencias" && o4.totalPulados === 1 && o4.pulados[0].leadId === "L2");

// visita criada entre a listagem e o fim
await seed();
const p5 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const op5 = await servico(NAY).iniciarOperacao({ previa: p5, leadIds: p5.elegiveis.map((l) => l.id), motivo: "teste", executor: exec(NAY, "Naykison") });
let criada = false;
faltas.aposTx = async () => {
  if (criada) return;
  if ((await lerLead("L1")).responsavelUid === "lari") {
    criada = true;
    await raw((d) => setDoc(doc(d, "visitas", "vTardia"), { leadId: "L1", leadNome: "x", consultora: "Isadora", consultoraId: "isa", status: "AGENDADA", data: "2026-10-20", hora: "09:00" }));
  }
};
const r5 = await servico(NAY).executarOperacao({ opId: op5, executor: exec(NAY, "Naykison"), concorrencia: 1 });
faltas.aposTx = null;
check("visita criada no meio da operação é corrigida pela varredura final e registrada", r5.estado === "concluida" && r5.visitasTardias.length === 1 && (await lerVisita("vTardia")).consultoraId === "lari" && (await lerOp(op5)).visitasTardias[0].visitaId === "vTardia");

// ===========================================================
console.log("\n=== E. REVERSÃO (inclusive para consultora INATIVA) e M2 — não reverter leads trabalhados");
await seed();
const p6 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const sel6 = p6.elegiveis.map((l) => l.id);
const op6 = await servico(NAY).iniciarOperacao({ previa: p6, leadIds: sel6, motivo: "teste", executor: exec(NAY, "Naykison") });
await servico(NAY).executarOperacao({ opId: op6, executor: exec(NAY, "Naykison") });
check("a transferência grava atualizadoEm do lead e criadoEm do item no MESMO instante (base da proteção M2 nas Rules)", (await (async () => { const l = await lerLead("L10"); const it = (await itens(op6)).find((i) => i.id === "L10"); return l.atualizadoEm.seconds === it.criadoEm.seconds && l.atualizadoEm.nanoseconds === it.criadoEm.nanoseconds; })()));
// o mundo muda depois da transferência: cada lead abaixo é "trabalhado" de um jeito diferente
await raw((d) => updateDoc(doc(d, "leads", "L3"), { responsavelUid: "outra", responsavel: "Outra", consultora: "Outra" }));                       // outro dono assumiu
await raw((d) => updateDoc(doc(d, "leads", "L2"), { ultimoAtendimento: "atendimento da Larissa", atualizadoEm: fs.serverTimestamp() }));          // alterado como o app faz (atualizarLead)
await raw((d) => fs.addDoc(collection(d, "leads", "L10", "eventos"), { leadId: "L10", tipo: "OBSERVACAO", usuario: "Larissa", descricao: "falou com o cliente", dados: {}, criadoEm: fs.serverTimestamp() })); // só evento na timeline
await raw((d) => updateDoc(doc(d, "leads", "L11"), { etapa: 4 }));                                                                             // avançou no funil
await raw((d) => updateDoc(doc(d, "leads", "L12"), { ultimaTransferenciaEmMassaId: "outra-operacao" }));                                        // movido por outra operação
await raw((d) => updateDoc(doc(d, "visitas", "vB"), { comparecimento: "COMPARECEU" }));                                                          // visita atendida pela Larissa (lead L1)
await tErro("destino normal para consultora INATIVA segue recusado (serviço)", /recepcionista ativa/, () => servico(NAY).iniciarOperacao({ previa: { ...p6, destino: ISA }, leadIds: ["L2"], motivo: "x", executor: exec(NAY, "Naykison") }));
await t("…e pelas Rules, mesmo com chamada direta", "DENY", () => updateDoc(doc(db(NAY), "leads", "L13"), { responsavelUid: "isa", responsavel: "Isadora", consultora: "Isadora" }));
await tErro("reverter operação que ainda está em andamento é recusado", /Encerre a operação original/, async () => { const aberta = await servico(NAY).iniciarOperacao({ previa: p6, leadIds: ["L2"], motivo: "x", executor: exec(NAY, "Naykison") }).catch(() => null); await servico(NAY).iniciarReversao({ opIdOriginal: aberta || "inexistente", executor: exec(NAY, "Naykison") }); });
const rev = await servico(ADM).iniciarReversao({ opIdOriginal: op6, executor: exec(ADM, "Samir") });
const revDup = await servico(ADM).iniciarReversao({ opIdOriginal: op6, executor: exec(ADM, "Samir") });
check("ID da reversão é fixo (rev-<operação>) e abrir duas vezes reaproveita a mesma", rev === `rev-${op6}` && rev === revDup);
const opRev = await lerOp(rev);
check("reversão: tipo, vínculo com a original e destino = consultora INATIVA", opRev.tipo === "reversao" && opRev.reverteOpId === op6 && opRev.destinoUid === "isa" && opRev.destinoAtiva === false);
const rr = await servico(ADM).executarOperacao({ opId: rev, executor: exec(ADM, "Samir") });
const motivoDe = (id) => rr.pendentes.find((p) => p.leadId === id)?.resultado;
check("reversão com pendências NÃO é 'concluida'", rr.estado === "pendencias" && rr.pendentes.length === 5, JSON.stringify(rr.pendentes.map((p) => [p.leadId, p.resultado])));
check("L3 (outro dono assumiu) → dono mudou", motivoDe("L3") === RESULTADO_LEAD.PULADO_DONO_MUDOU);
check("L2 (alterado depois da transferência) → NÃO revertido, motivo 'alterado'", motivoDe("L2") === RESULTADO_LEAD.PULADO_ALTERADO_APOS);
check("L10 (evento novo na timeline) → NÃO revertido, motivo 'eventos'", motivoDe("L10") === RESULTADO_LEAD.PULADO_EVENTOS_APOS);
check("L11 (avançou de etapa) → NÃO revertido, motivo 'etapa' com os valores", motivoDe("L11") === RESULTADO_LEAD.PULADO_ETAPA_MUDOU && rr.pendentes.find((p) => p.leadId === "L11").detalhe.includes("2") && rr.pendentes.find((p) => p.leadId === "L11").detalhe.includes("4"));
check("L12 (movido por outra operação) → NÃO revertido, motivo 'outra operação'", motivoDe("L12") === RESULTADO_LEAD.PULADO_OUTRA_TRANSFERENCIA);
const trabalhados = ["L2", "L3", "L10", "L11", "L12"];
const restantes = sel6.filter((i) => !trabalhados.includes(i));
check("os leads intocados voltaram para Isadora (inativa)", (await Promise.all(restantes.map(lerLead))).every((l) => l.responsavelUid === "isa" && l.responsavel === "Isadora" && l.consultora === "Isadora"));
check("os 5 leads trabalhados continuam EXATAMENTE como a destinatária deixou (sem evento de reversão)", (await lerLead("L3")).responsavelUid === "outra" && (await lerLead("L2")).responsavelUid === "lari" && (await lerLead("L2")).ultimoAtendimento === "atendimento da Larissa" && (await lerLead("L10")).responsavelUid === "lari" && (await lerLead("L11")).etapa === 4 && (await lerLead("L11")).responsavelUid === "lari" && (await lerLead("L12")).responsavelUid === "lari" && (await Promise.all(trabalhados.map(eventos))).every((e) => e.every((x) => !x.dados?.reversao)));
const opRevDoc = await lerOp(rev);
check("os motivos ficam gravados na operação (continua em andamento, não perde se fechar a janela)", opRevDoc.status === "em_andamento" && opRevDoc.totalPulados === 5 && opRevDoc.pulados.some((p) => p.leadId === "L2" && p.resultado === RESULTADO_LEAD.PULADO_ALTERADO_APOS));
check("lead legado (sem 'responsavel') volta com 'responsavel' preenchido", (await lerLead("L4")).responsavel === "Isadora");
const v2 = Object.fromEntries(await Promise.all(["vA", "vB", "vC", "vD", "vF", "vL2"].map(async (i) => [i, await lerVisita(i)])));
check("visitas ainda futuras voltam para Isadora (vA, e vF legada: sem consultoraId antes, agora com o UID da Isadora)", v2.vA.consultoraId === "isa" && v2.vF.consultoraId === "isa" && v2.vF.consultora === "Isadora" && v2.vA.consultora === "Isadora");
check("vL2 (do lead L2, que NÃO foi revertido) continua com a Larissa", v2.vL2.consultoraId === "lari");
check("visita atendida depois da transferência (vB) NÃO é revertida; realizadas (vC, vD) intactas", v2.vB.consultoraId === "lari" && v2.vC.consultoraId === "isa" && v2.vD.consultoraId === "isa");
check("histórico: lead revertido tem 2 eventos (transferência + reversão); os pulados só 1", (await eventos("L13")).length === 2 && (await eventos("L13")).some((e) => e.dados.reversao === true) && (await eventos("L3")).length === 1);
const l1b = await lerLead("L1");
check("L1: visita embutida volta a 'Isadora'; etapas e observações intactas após ida e volta", l1b.visita.consultor === "Isadora" && l1b.etapa === 3 && l1b.observacoes[0].texto === "obs L1");
await servico(ADM).encerrarComPendencias({ opId: rev, executor: exec(ADM, "Samir"), pendentes: rr.pendentes });
check("reversão encerrada com pendências, autoria do Samir", (await lerOp(rev)).status === "concluida_com_pendencias" && (await lerOp(rev)).executadoPorUid === ADM);

console.log("--- M2: UMA reversão por operação (serviço e Rules)");
const antesRep = await snapshotColecao("leads");
await tErro("segunda reversão da MESMA operação é recusada pelo serviço (mesmo encerrada com pendências)", /já foi revertida/, () => servico(ADM).iniciarReversao({ opIdOriginal: op6, executor: exec(ADM, "Samir") }));
await t("…e pelas Rules, mesmo com chamada direta e outro ID", "DENY", () => fs.setDoc(doc(db(ADM), "transferenciasEmMassa", "rev-outro-id"), { tipo: "reversao", reverteOpId: op6, executadoPorUid: ADM, executadoPorNome: "x", origemUid: "lari", destinoUid: "isa", status: "em_andamento", leadIds: sel6, criadoEm: fs.serverTimestamp() }));
check("nenhum lead mudou com as tentativas de segunda reversão", JSON.stringify(antesRep) === JSON.stringify(await snapshotColecao("leads")));

console.log("--- M1: visitas na reversão (varredura final e visitas posteriores)");
await seed();
const p9 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const op9 = await servico(NAY).iniciarOperacao({ previa: p9, leadIds: ["L1", "L2"], motivo: "teste", executor: exec(NAY, "Naykison") });
let tardiaCriada = false;
faltas.aposTx = async () => {
  if (tardiaCriada) return;
  if ((await lerLead("L1")).responsavelUid === "lari") {
    tardiaCriada = true;
    await raw((d) => setDoc(doc(d, "visitas", "vTardia"), { leadId: "L1", leadNome: "x", consultora: "Isadora", consultoraId: "isa", status: "AGENDADA", data: "2026-10-20", hora: "09:00" }));
  }
};
const r9 = await servico(NAY).executarOperacao({ opId: op9, executor: exec(NAY, "Naykison"), concorrencia: 1 });
faltas.aposTx = null;
check("pré-condição: a varredura final atualizou 1 visita tardia", r9.estado === "concluida" && r9.visitasTardias.length === 1 && (await lerVisita("vTardia")).consultoraId === "lari");
// depois da transferência a Larissa agenda uma visita NOVA para o lead
await raw((d) => setDoc(doc(d, "visitas", "vNova"), { leadId: "L1", leadNome: "x", consultora: "Larissa", consultoraId: "lari", status: "AGENDADA", data: "2026-10-25", hora: "15:00" }));
const totalVisitasAntes = Object.keys(await snapshotColecao("visitas")).length;
const idsAntes = Object.keys(await snapshotColecao("visitas")).sort().join();
check("a transferência (e a varredura final) MARCAM cada visita que mexeram", (await lerVisita("vA")).ultimaTransferenciaEmMassaId === op9 && (await lerVisita("vTardia")).ultimaTransferenciaEmMassaId === op9 && (await lerVisita("vNova")).ultimaTransferenciaEmMassaId === undefined);
// B3: a reversão NÃO depende das listas gravadas pelo cliente — apaga a lista da operação e o item continua informativo
await raw((d) => updateDoc(doc(d, "transferenciasEmMassa", op9), { visitasTardias: [] }));
const rev9 = await servico(NAY).iniciarReversao({ opIdOriginal: op9, executor: exec(NAY, "Naykison") });
const rr9 = await servico(NAY).executarOperacao({ opId: rev9, executor: exec(NAY, "Naykison") });
const vv = Object.fromEntries(await Promise.all(["vA", "vB", "vF", "vTardia", "vNova", "vL2"].map(async (i) => [i, await lerVisita(i)])));
check("reversão concluída sem pendências (visita nova não bloqueia, mas é listada)", rr9.estado === "concluida" && rr9.pendentes.length === 0);
check("M1: a visita da VARREDURA FINAL (vTardia) volta para Isadora", vv.vTardia.consultoraId === "isa" && vv.vTardia.consultora === "Isadora");
check("as visitas atualizadas na transferência também voltam (vA, vB, vF, vL2)", ["vA", "vB", "vF", "vL2"].every((i) => vv[i].consultoraId === "isa"));
check("M1: visita criada DEPOIS da transferência (vNova) NÃO é alterada e vai para análise", vv.vNova.consultoraId === "lari" && vv.vNova.consultora === "Larissa" && rr9.visitasParaAnalise.length === 1 && rr9.visitasParaAnalise[0].id === "vNova" && rr9.visitasParaAnalise[0].leadId === "L1");
check("a análise fica registrada no item da reversão (auditoria)", ((await itens(rev9)).find((i) => i.id === "L1").visitasParaAnalise || []).map((v) => v.id).join() === "vNova");
check("a reversão NÃO criou nem excluiu nenhuma visita (mesmos IDs)", Object.keys(await snapshotColecao("visitas")).sort().join() === idsAntes && Object.keys(await snapshotColecao("visitas")).length === totalVisitasAntes);
check("data, hora e status de todas as visitas preservados", vv.vA.status === "AGENDADA" && vv.vA.data === "2026-10-12" && vv.vA.hora === "10:00" && vv.vNova.data === "2026-10-25" && vv.vTardia.data === "2026-10-20" && vv.vTardia.hora === "09:00");
check("carregarRelatorio traz as visitas para análise", (await servico(NAY).carregarRelatorio(rev9)).visitasParaAnalise.some((v) => v.id === "vNova"));

console.log("\n=== E2. VISITA CUJO RESPONSÁVEL MUDOU, ETAPA 0 APÓS A PRÉVIA, RETOMADA DA REVERSÃO");
{
  // visita cujo responsável mudou depois da transferência: controle × defeito
  async function ciclo(mudarVisita) {
    await seed();
    const p = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
    const op = await servico(NAY).iniciarOperacao({ previa: p, leadIds: ["L1"], motivo: "t", executor: exec(NAY, "Naykison") });
    await servico(NAY).executarOperacao({ opId: op, executor: exec(NAY, "Naykison") });
    if (mudarVisita) await raw((d) => updateDoc(doc(d, "visitas", "vA"), { consultoraId: "outra", consultora: "Outra" }));
    const rev = await servico(NAY).iniciarReversao({ opIdOriginal: op, executor: exec(NAY, "Naykison") });
    const r = await servico(NAY).executarOperacao({ opId: rev, executor: exec(NAY, "Naykison") });
    return { r, itemRev: (await itens(rev)).find((i) => i.id === "L1"), vA: await lerVisita("vA"), vB: await lerVisita("vB"), vF: await lerVisita("vF") };
  }
  const ctrl = await ciclo(false);
  check("CONTROLE: sem mudança, a visita vA volta para a Isadora e consta como restaurada", ctrl.r.estado === "concluida" && ctrl.vA.consultoraId === "isa" && ctrl.itemRev.visitasAtualizadas.some((v) => v.id === "vA"));
  const def = await ciclo(true);
  check("DEFEITO: visita que mudou de responsável depois NÃO é restaurada (continua com 'outra')", def.vA.consultoraId === "outra" && def.vA.consultora === "Outra");
  check("…consta como não restaurada no item da reversão, com o motivo", def.itemRev.visitasNaoRestauradas.some((v) => v.id === "vA" && /mudou/.test(v.motivo)) && !def.itemRev.visitasAtualizadas.some((v) => v.id === "vA"));
  check("…e as demais visitas do lead voltaram normalmente (a diferença é só a visita alterada)", def.vB.consultoraId === "isa" && def.vF.consultoraId === "isa" && def.r.estado === "concluida");

  // lead que vira etapa 0 + não assumido DEPOIS da prévia: a transação recusa mesmo com o id na operação
  await seed();
  const pE = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
  const opE = await servico(NAY).iniciarOperacao({ previa: pE, leadIds: ["L2", "L3"], motivo: "t", executor: exec(NAY, "Naykison") });
  await raw((d) => updateDoc(doc(d, "leads", "L2"), { etapa: 0, assumido: false }));
  const rE = await servico(NAY).executarOperacao({ opId: opE, executor: exec(NAY, "Naykison") });
  check("etapa 0 + não assumido após a prévia → PULADO_ANALISE (não transfere, gera alerta evitado)", rE.estado === "pendencias" && rE.pendentes.length === 1 && rE.pendentes[0].leadId === "L2" && rE.pendentes[0].resultado === RESULTADO_LEAD.PULADO_ANALISE);
  check("…o lead L2 segue com a origem e sem evento; L3 foi transferido", (await lerLead("L2")).responsavelUid === "isa" && (await eventos("L2")).length === 0 && (await lerLead("L3")).responsavelUid === "lari");

  // retomada após FALHA PARCIAL na REVERSÃO
  await seed();
  const pR = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
  const selR = pR.elegiveis.map((l) => l.id);
  const opR = await servico(NAY).iniciarOperacao({ previa: pR, leadIds: selR, motivo: "t", executor: exec(NAY, "Naykison") });
  await servico(NAY).executarOperacao({ opId: opR, executor: exec(NAY, "Naykison") });
  const revR = await servico(NAY).iniciarReversao({ opIdOriginal: opR, executor: exec(NAY, "Naykison") });
  faltas.proximas = 3;
  const rr1 = await servico(NAY).executarOperacao({ opId: revR, executor: exec(NAY, "Naykison"), concorrencia: 1 });
  check("reversão com 3 falhas de rede: NÃO é 'concluida', fica em andamento, 3 pendências do tipo FALHA", rr1.estado === "pendencias" && rr1.pendentes.length === 3 && rr1.pendentes.every((p) => p.resultado === RESULTADO_LEAD.FALHA) && (await lerOp(revR)).status === "em_andamento");
  check("os leads que falharam continuam com a destinatária e sem evento de reversão", (await Promise.all(rr1.pendentes.map(async (p) => [(await lerLead(p.leadId)).responsavelUid, (await eventos(p.leadId)).filter((e) => e.dados?.reversao).length]))).every(([u, n]) => u === "lari" && n === 0));
  const rr2 = await servico(ADM).executarOperacao({ opId: revR, executor: exec(ADM, "Samir") });
  check("RETOMADA da reversão por OUTRO autorizado conclui", rr2.estado === "concluida" && rr2.totalConcluido === selR.length);
  check("todos voltaram para a Isadora; 1 item por lead; exatamente 1 evento de reversão por lead (sem duplicar)", (await Promise.all(selR.map(lerLead))).every((l) => l.responsavelUid === "isa") && (await itens(revR)).length === selR.length && (await Promise.all(selR.map(eventos))).every((e) => e.filter((x) => x.dados?.reversao).length === 1 && e.length === 2));

  // operação encerrada: o serviço recusa (mensagem) E as Rules recusam a escrita direta
  await t("operação ENCERRADA: gravar item direto nela é negado pelas Rules (independe do serviço)", "DENY", () => fs.runTransaction(db(NAY), async (tx) => {
    tx.update(doc(db(NAY), "leads", selR[0]), { ...NOMES("Larissa"), ultimaTransferenciaEmMassaId: opR, atualizadoEm: fs.serverTimestamp() });
    tx.set(doc(db(NAY), "transferenciasEmMassa", opR, "itens", selR[0] + "x"), { executadoPorUid: NAY, deUid: "isa", paraUid: "lari", etapa: 2, criadoEm: fs.serverTimestamp() });
  }));

  // duas pessoas executando a MESMA operação ao mesmo tempo: nenhum duplicado
  await seed();
  const pC = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
  const selC = pC.elegiveis.map((l) => l.id);
  const opC = await servico(NAY).iniciarOperacao({ previa: pC, leadIds: selC, motivo: "t", executor: exec(NAY, "Naykison") });
  await Promise.all([
    servico(NAY).executarOperacao({ opId: opC, executor: exec(NAY, "Naykison"), concorrencia: 3 }).catch(() => null),
    servico(ADM).executarOperacao({ opId: opC, executor: exec(ADM, "Samir"), concorrencia: 3 }).catch(() => null),
  ]);
  check("execução SIMULTÂNEA da mesma operação: 1 item e exatamente 1 evento por lead, todos com a destinatária", (await itens(opC)).length === selC.length && (await Promise.all(selC.map(eventos))).every((e) => e.length === 1) && (await Promise.all(selC.map(lerLead))).every((l) => l.responsavelUid === "lari"));
}

console.log("\n=== E3. B3 — INTEGRIDADE DA AUDITORIA: listas forjadas não influenciam a reversão; divergências aparecem");
{
  // Um autorizado grava a transferência de um lead com item FORJADO (listas de visitas falsas) — as Rules aceitam as
  // listas (não conseguem conferi-las), por isso a reversão não pode confiar nelas.
  await seed();
  await raw((d) => setDoc(doc(d, "visitas", "vOutroLead"), { leadId: "L2", leadNome: "x", consultora: "Isadora", consultoraId: "isa", status: "AGENDADA", data: "2026-10-15", hora: "10:00" }));
  const pF = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
  const opF = await servico(NAY).iniciarOperacao({ previa: pF, leadIds: ["L3"], motivo: "t", executor: exec(NAY, "Naykison") });
  const dN = db(NAY);
  const eventoRef = fs.doc(fs.collection(dN, "leads", "L3", "eventos"));
  await fs.runTransaction(dN, async (tx) => {
    tx.update(fs.doc(dN, "leads", "L3"), { ...NOMES("Larissa"), ultimaTransferenciaEmMassaId: opF, atualizadoEm: fs.serverTimestamp() });
    tx.set(eventoRef, { leadId: "L3", tipo: "TRANSFERENCIA", usuario: "Naykison", descricao: "t", dados: { origem: "massa", operacaoId: opF, responsavelAnteriorUid: "isa", novoResponsavelUid: "lari" }, criadoEm: fs.serverTimestamp() });
    tx.set(fs.doc(dN, "transferenciasEmMassa", opF, "itens", "L3"), {
      executadoPorUid: NAY, deUid: "isa", deNome: "Isadora", paraUid: "lari", paraNome: "Larissa", etapa: 4, eventoId: eventoRef.id,
      anterior: { responsavelUid: "isa", responsavel: "Isadora", consultora: "Isadora" }, criadoEm: fs.serverTimestamp(),
      // LISTAS FORJADAS: visita de OUTRO lead e visita do próprio lead com valores "anteriores" falsos
      visitasAtualizadas: [{ id: "vOutroLead", consultoraIdAnterior: "uid-falso", consultoraAnterior: "Nome Falso" }, { id: "vL2", consultoraIdAnterior: "uid-falso", consultoraAnterior: "Nome Falso" }],
      visitaEmbutidaAjustada: { id: "vOutroLead", consultorAnterior: "Nome Falso" },
    });
  });
  const rF = await servico(NAY).executarOperacao({ opId: opF, executor: exec(NAY, "Naykison") });
  check("pré-condição: operação com item forjado foi aceita pelas Rules e concluída", rF.estado === "concluida" && (await itens(opF)).length === 1);
  const antesVis = JSON.stringify([await lerVisita("vOutroLead"), await lerVisita("vL2")]);
  const revF = await servico(NAY).iniciarReversao({ opIdOriginal: opF, executor: exec(NAY, "Naykison") });
  const rrF = await servico(NAY).executarOperacao({ opId: revF, executor: exec(NAY, "Naykison") });
  check("reversão com item forjado: o lead volta ao dono da OPERAÇÃO", rrF.estado === "concluida" && (await lerLead("L3")).responsavelUid === "isa");
  check("as visitas citadas na lista FORJADA (inclusive de outro lead) NÃO foram alteradas", JSON.stringify([await lerVisita("vOutroLead"), await lerVisita("vL2")]) === antesVis);
  check("nenhum valor 'uid-falso'/'Nome Falso' foi aplicado a visita alguma", !JSON.stringify(await snapshotColecao("visitas")).includes("uid-falso") && !JSON.stringify(await snapshotColecao("visitas")).includes("Nome Falso"));

  // divergência: operação 'concluida' declarada SEM itens (as Rules não conseguem contar itens)
  await seed();
  const pD = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
  const opD = await servico(NAY).iniciarOperacao({ previa: pD, leadIds: ["L2", "L3"], motivo: "t", executor: exec(NAY, "Naykison") });
  await t("LIMITE (documentado): autorizado declara 'concluida' com contadores coerentes e ZERO itens — as Rules aceitam", "ALLOW", () => fs.updateDoc(fs.doc(db(NAY), "transferenciasEmMassa", opD), { status: "concluida", totalConcluido: 2, totalFalhas: 0, totalPulados: 0, falhas: [], pulados: [], finalizadoEm: fs.serverTimestamp(), finalizadoPorUid: NAY }));
  const relD = await servico(NAY).carregarRelatorio(opD);
  check("…mas o relatório detecta e sinaliza a divergência (declarado 2, itens gravados 0)", relD.divergencia && relD.divergencia.declarado === 2 && relD.divergencia.gravado === 0 && relD.itens.length === 0 && relD.pendentes.length === 2);
  const relOk = await (async () => { await seed(); const p = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI }); const o = await servico(NAY).iniciarOperacao({ previa: p, leadIds: ["L2"], motivo: "t", executor: exec(NAY, "Naykison") }); await servico(NAY).executarOperacao({ opId: o, executor: exec(NAY, "Naykison") }); return servico(NAY).carregarRelatorio(o); })();
  check("operação honesta: sem divergência", relOk.divergencia === null && relOk.itens.length === 1);
}

console.log("\n=== F. GERENCIAIS: só por seleção explícita, e só se pertencem à origem");
await seed();
const p7 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const op7 = await servico(NAY).iniciarOperacao({ previa: p7, leadIds: ["L5", "L2"], motivo: "gerencial explícito", executor: exec(NAY, "Naykison") });
await servico(NAY).executarOperacao({ opId: op7, executor: exec(NAY, "Naykison") });
const l5 = await lerLead("L5");
check("gerencial selecionado explicitamente é transferido e mantém cadastroGerencial", l5.responsavelUid === "lari" && l5.cadastroGerencial === true);
check("e só os dois selecionados mudaram", (await lerLead("L3")).responsavelUid === "isa");

// ===========================================================
console.log("\n=== G. AUTORIZAÇÃO NO SERVIÇO REAL (Rules reais)");
await seed();
const p8 = await servico(NAY).montarPrevia({ origem: ISA, destino: LARI });
const opOk = await servico(ADM).iniciarOperacao({ previa: p8, leadIds: ["L2", "L3"], motivo: "teste", executor: exec(ADM, "Samir") });
check("Samir (admin) inicia operação", !!(await lerOp(opOk)));
for (const [nome, uid] of [["coordenador NÃO autorizado", "coord-outro"], ["outro administrador", "admin-extra"], ["recepcionista", "lari"], ["recepcionista dona (inativa não loga, mas por segurança)", "isa"]]) {
  await t(`${nome}: NÃO consegue iniciar operação`, "DENY", () => servico(uid).iniciarOperacao({ previa: p8, leadIds: ["L2"], motivo: "x", executor: exec(uid, nome) }));
  const antes = await snapshotColecao("leads");
  const rx = await servico(uid).executarOperacao({ opId: opOk, executor: exec(uid, nome) }).catch((e) => ({ erro: e }));
  check(`${nome}: executar operação alheia não muda NENHUM lead`, JSON.stringify(antes) === JSON.stringify(await snapshotColecao("leads")) && (rx.erro || rx.estado !== "concluida"));
}
const lerComoRecep = await fs.getDocs(fs.query(fs.collection(db("lari"), "leads"), fs.where("responsavelUid", "==", "isa"))).then((x) => x.size).catch(() => -1);
check("(comportamento ATUAL, não muda) recepcionista consegue LER leads de outra; a restrição desta funcionalidade é nas ESCRITAS", lerComoRecep > 0);
check("recepcionista NÃO consegue montar a prévia completa (a leitura de visitas é negada)", await servico("lari").montarPrevia({ origem: ISA, destino: LARI }).then(() => false).catch(() => true));
check("coordenador não autorizado não consegue ler/listar operações", await servico("coord-outro").listarOperacoes().then(() => false).catch(() => true));
check("Naykison e Samir listam operações", (await servico(NAY).listarOperacoes()).length >= 1 && (await servico(ADM).listarOperacoes()).length >= 1);
const rel = await servico(NAY).carregarRelatorio(opOk);
check("relatório: operação, itens e pendentes (nada executado ainda)", rel.itens.length === 0 && rel.pendentes.length === 2);

await env.cleanup();
process.exit(fim() ? 1 : 0);
