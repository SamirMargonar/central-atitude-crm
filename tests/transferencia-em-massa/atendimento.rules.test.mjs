// ATENDIMENTO COMPARTILHADO — Firestore Rules (Emulator). Recepcionista ATIVA atende o lead de outra consultora
// por operações explícitas, sem mudar a propriedade e com autoria verificável. Nada aqui toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where,
  serverTimestamp, addDoc, deleteDoc,
} from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const env = await initializeTestEnvironment({
  projectId: "demo-tme-atendimento",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const { t, par, check, fim } = criarRelatorio();
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const SRV = serverTimestamp;
const NOMES = { ana: "Ana Lara", isa: "Isabelle", lari: "Larissa", inativa: "Inativa", [ADM]: "Samir", [NAY]: "Naykison" };
const TIT = { responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara" };

async function seed() {
  await env.clearFirestore();
  await raw(async (db) => {
    // turno da Isabelle 08:00–12:00: as visitas são às 15:00, então o caminho antigo "dentro do turno" NÃO se aplica (isola o caminho novo)
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "12:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador"); await u("coord-outro", "Outro Coord", "coordenador");
    await u("ana", "Ana Lara", "recepcionista"); await u("isa", "Isabelle", "recepcionista"); await u("lari", "Larissa", "recepcionista");
    await u("inativa", "Inativa", "recepcionista", { ativo: false });
    const lead = (id, etapa, extra = {}) => setDoc(doc(db, "leads", id), { nome: "Cliente " + id, telefone: "000", etapa, assumido: true, ...TIT, ...extra });
    await lead("LN", 4);                                           // negociação
    await lead("LV", 3, { visita: { id: "vV", data: "2026-10-20", hora: "15:00", consultor: "Ana Lara", observacao: "" } }); // visita agendada
    await lead("LC", 3, { visita: { id: "vC", data: "2026-10-01", hora: "15:00", consultor: "Ana Lara", observacao: "" } }); // visita antiga sem baixa
    await lead("LM", 5, { matricula: { confirmada: true, consultor: "Ana Lara", status: "ATIVA", plano: "MENSAL" } }); // já matriculado
    await lead("L2", 2);
    await lead("LMX", 4, { matricula: { confirmada: true, consultor: "Ana Lara", status: "ATIVA", plano: "MENSAL" } });   // estado inconsistente: negociação COM matrícula já gravada (isola a regra "não regravar matrícula")
    await lead("LS", 3);                                                                                                // etapa 3 sem espelho de visita
    await setDoc(doc(db, "leads", "FILA"), { nome: "Fila", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "" });
    await lead("LT", 3, { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" });   // carteira JÁ transferida para a Larissa
    await setDoc(doc(db, "visitas", "vV"), { leadId: "LV", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-20", hora: "15:00", status: "AGENDADA", comparecimento: "" });
    await setDoc(doc(db, "visitas", "vC"), { leadId: "LC", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-01", hora: "15:00", status: "CONFIRMADA", comparecimento: "" });
    await setDoc(doc(db, "visitas", "vDone"), { leadId: "LC", consultora: "Ana Lara", consultoraId: "ana", data: "2026-09-01", hora: "15:00", status: "CONFIRMADA", comparecimento: "COMPARECEU", atendidoPor: "ana", atendidoPorNome: "Ana Lara" });
    await setDoc(doc(db, "visitas", "vOld"), { leadId: "LT", consultora: "Isadora", consultoraId: "isadora-antiga", data: "2026-09-10", hora: "15:00", status: "CONFIRMADA", comparecimento: "" });  // visita ANTIGA da carteira transferida
    await lead("LT2", 3, { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" });
    await setDoc(doc(db, "visitas", "vT2"), { leadId: "LT2", consultora: "Isadora", consultoraId: "isadora-antiga", data: "2026-09-15", hora: "17:00", status: "CONFIRMADA", comparecimento: "" });
    await setDoc(doc(db, "visitas", "vOld2"), { leadId: "LT", consultora: "Isadora", consultoraId: "isadora-antiga", data: "2026-09-12", hora: "16:00", status: "CONFIRMADA", comparecimento: "" });
    await setDoc(doc(db, "visitas", "vS"), { leadId: "LS", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-22", hora: "15:00", status: "AGENDADA", comparecimento: "" });
    await setDoc(doc(db, "visitas", "vOutra"), { leadId: "L2", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-20", hora: "15:00", status: "AGENDADA", comparecimento: "" });
    await setDoc(doc(db, "leads", "LV", "eventos", "ev0"), { leadId: "LV", tipo: "OBSERVACAO", usuario: "Ana Lara", usuarioUid: "ana", descricao: "antigo", dados: {}, criadoEm: new Date("2026-09-01") });
  });
}

// ---------------- construtores das operações ----------------
const evento = (uid, leadId, tipo = "OBSERVACAO", extra = {}) => ({ leadId, tipo, usuario: NOMES[uid], usuarioUid: uid, descricao: "resultado do atendimento", dados: { atendimentoCompartilhado: true }, criadoEm: SRV(), ...extra });
const addEv = (uid, leadId, ev) => addDoc(collection(as(uid), "leads", leadId, "eventos"), ev);
// `consultor` = a TITULAR do lead (a matrícula conta para ela); quem fechou fica em registradoPorUid/Nome
const MAT = (uid, extra = {}) => ({ confirmada: true, data: "14/10/2026", hora: "10:00", consultor: "Ana Lara", observacao: "", plano: "MENSAL", dataInicio: "2026-10-14", dataVencimento: "2026-11-14", status: "ATIVA", registradoPorUid: uid, registradoPorNome: NOMES[uid], atendimentoCompartilhado: true, ...extra });
const fechar = (uid, id, over = {}) => updateDoc(doc(as(uid), "leads", id), { etapa: 5, ultimoAtendimento: "x", matricula: MAT(uid), atualizadoEm: SRV(), ...over });
const updLead = (uid, id, d) => updateDoc(doc(as(uid), "leads", id), { atualizadoEm: SRV(), ...d });
const updVis = (uid, id, d) => updateDoc(doc(as(uid), "visitas", id), d);
const REAG = { data: "2026-10-25", hora: "14:00", observacao: "pediu para remarcar", comparecimento: "", pendenciaResolvida: true, status: "AGENDADA" };
const ESPELHO = (id) => ({ id, data: "2026-10-25", hora: "14:00", consultor: "Ana Lara", observacao: "pediu para remarcar" });
const ATEND = (uid) => ({ atendidoPor: uid, atendidoPorNome: NOMES[uid], atendidoEm: SRV(), observacao: "atendido" });

// =============================================================
console.log("\n=== A. CONSULTA: lead e histórico (leitura já liberada) — sem acesso irrestrito às VISITAS");
await seed();
await t("recepcionista de outra consultora lê o lead", "ALLOW", () => getDoc(doc(as("isa"), "leads", "LN")));
await t("...e o histórico (eventos) do lead", "ALLOW", () => getDocs(collection(as("isa"), "leads", "LV", "eventos")));
await t("...mas NÃO lê a visita de lead alheio fora do turno (sem acesso irrestrito a visitas)", "DENY", () => getDoc(doc(as("isa"), "visitas", "vV")));
await t("...nem lista visitas de lead alheio", "DENY", () => getDocs(query(collection(as("isa"), "visitas"), where("leadId", "==", "LV"))));

console.log("\n=== B. OBSERVAÇÃO / RESULTADO DE ATENDIMENTO (evento append-only com autor real)");
await seed();
await t("Isabelle registra observação no lead da Ana (autor = Isabelle)", "ALLOW", () => addEv("isa", "LN", evento("isa", "LN")));
const evs = (await raw((db) => getDocs(collection(db, "leads", "LN", "eventos")))).docs.map((d) => d.data());
check("o evento gravado tem usuarioUid e nome da Isabelle (nunca o da titular) e instante do servidor", evs.length === 1 && evs[0].usuarioUid === "isa" && evs[0].usuario === "Isabelle" && !!evs[0].criadoEm?.toDate);
await par("autoria: usuarioUid de OUTRA pessoa", seed, (v) => addEv("isa", "LN", evento("isa", "LN", "OBSERVACAO", v ? { usuarioUid: "ana" } : {})));
await par("autoria: nome da TITULAR como autor", seed, (v) => addEv("isa", "LN", evento("isa", "LN", "OBSERVACAO", v ? { usuario: "Ana Lara" } : {})));
await par("autoria: sem usuarioUid", seed, (v) => { const e = evento("isa", "LN"); if (v) delete e.usuarioUid; return addEv("isa", "LN", e); });
await par("tipo de evento fora da lista (TRANSFERENCIA forjado)", seed, (v) => addEv("isa", "LN", evento("isa", "LN", v ? "TRANSFERENCIA" : "OBSERVACAO")));
await par("data do evento escolhida pelo cliente (não é o instante do servidor)", seed, (v) => addEv("isa", "LN", evento("isa", "LN", "OBSERVACAO", v ? { criadoEm: new Date("2020-01-01") } : {})));
await par("campo extra no evento", seed, (v) => addEv("isa", "LN", evento("isa", "LN", "OBSERVACAO", v ? { responsavelUid: "isa" } : {})));
await par("evento com leadId de OUTRO lead", seed, (v) => addEv("isa", "LN", evento("isa", v ? "L2" : "LN")));
await seed();
await t("lead da FILA (sem dono): evento negado (decisão mantida)", "DENY", () => addEv("isa", "FILA", evento("isa", "FILA")));
await t("conta INATIVA não registra observação", "DENY", () => addEv("inativa", "LN", evento("inativa", "LN")));
await t("não fechamento (NAO_FECHAMENTO) registrado por Isabelle", "ALLOW", () => addEv("isa", "LN", evento("isa", "LN", "NAO_FECHAMENTO", { descricao: "vai pensar" })));
await t("não fechamento por conta INATIVA negado", "DENY", () => addEv("inativa", "LN", evento("inativa", "LN", "NAO_FECHAMENTO")));

console.log("\n=== C. FECHAMENTO (fluxo oficial de matrícula): só etapa 4 -> 5, com autor e sem tocar no dono");
await seed();
await t("Isabelle confirma a matrícula do lead da Ana (etapa 4 -> 5)", "ALLOW", () => fechar("isa", "LN"));
await t("...e grava os eventos MATRICULA e JORNADA com autoria dela", "ALLOW", async () => { await addEv("isa", "LN", evento("isa", "LN", "MATRICULA", { descricao: "Matrícula confirmada." })); await addEv("isa", "LN", evento("isa", "LN", "JORNADA")); });
const ln = (await raw((db) => getDoc(doc(db, "leads", "LN")))).data();
check("MÉTRICA: o lead continua da Ana e a matrícula conta para ela (consultor = titular); a autoria do fechamento é da Isabelle (registradoPorUid/Nome)", ln.responsavelUid === "ana" && ln.responsavel === "Ana Lara" && ln.consultora === "Ana Lara" && ln.etapa === 5 && ln.matricula.consultor === "Ana Lara" && ln.matricula.registradoPorUid === "isa" && ln.matricula.registradoPorNome === "Isabelle");
const cenario = (nome, over, ver = "DENY") => par(nome, seed, (v) => fechar("isa", "LN", v ? over : {}));
await cenario("fechamento mudando responsavelUid", { responsavelUid: "isa" });
await cenario("fechamento mudando responsavel", { responsavel: "Isabelle" });
await cenario("fechamento mudando consultora", { consultora: "Isabelle" });
await cenario("fechamento com campo extra (nome)", { nome: "outro" });
await cenario("fechamento pulando etapa (4 -> 6)", { etapa: 6 });
await cenario("fechamento atribuindo a matrícula a QUEM FECHOU (consultor = Isabelle, não a titular)", { matricula: MAT("isa", { consultor: "Isabelle" }) });
await cenario("fechamento atribuindo a matrícula a uma TERCEIRA pessoa (consultor = Larissa)", { matricula: MAT("isa", { consultor: "Larissa" }) });
await cenario("fechamento com consultor vazio", { matricula: MAT("isa", { consultor: "" }) });
await cenario("fechamento com registradoPorUid de outra pessoa", { matricula: MAT("isa", { registradoPorUid: "ana" }) });
await cenario("fechamento com campo extra dentro da matrícula", { matricula: MAT("isa", { bonus: 1 }) });
await cenario("fechamento sem confirmada=true", { matricula: MAT("isa", { confirmada: false }) });
await seed(); await raw((db) => setDoc(doc(db, "leads", "LNN"), { nome: "sem nomes", etapa: 4, assumido: true, responsavelUid: "ana" }));
await t("lead sem nome de titular gravado: a matrícula NÃO pode ficar sem consultora (consultor vazio negado)", "DENY", () => fechar("isa", "LNN", { matricula: MAT("isa", { consultor: "" }) }));
await par("fechamento de lead que NÃO está em negociação (etapa 2)", seed, (v) => fechar("isa", v ? "L2" : "LN"));
await par("fechamento regravando matrícula já existente (histórico), mesmo na etapa 4", seed, (v) => fechar("isa", v ? "LMX" : "LN"));
await par("fechamento de lead já matriculado (etapa 5)", seed, (v) => fechar("isa", v ? "LM" : "LN"));
await par("fechamento com atualizadoEm escolhido pelo cliente", seed, (v) => fechar("isa", "LN", v ? { atualizadoEm: new Date("2020-01-01") } : {}));
await seed();
await t("conta INATIVA não fecha matrícula", "DENY", () => fechar("inativa", "LN"));

console.log("\n=== D. REAGENDAMENTO de visita de lead alheio (visita + espelho no lead + evento)");
await seed();
await t("Isabelle reagenda a visita do lead da Ana (visita, fora do turno dela)", "ALLOW", () => updVis("isa", "vV", REAG));
await t("...atualiza o espelho da visita no lead (a titular continua a mesma)", "ALLOW", () => updLead("isa", "LV", { visita: ESPELHO("vV"), ultimoAtendimento: "x" }));
await t("...e registra o evento VISITA com autoria dela", "ALLOW", () => addEv("isa", "LV", evento("isa", "LV", "VISITA", { descricao: "Visita reagendada." })));
const vv = (await raw((db) => getDoc(doc(db, "visitas", "vV")))).data(); const lv = (await raw((db) => getDoc(doc(db, "leads", "LV")))).data();
check("ID da visita, consultoraId e leadId preservados; lead continua da Ana", vv.consultoraId === "ana" && vv.leadId === "LV" && vv.consultora === "Ana Lara" && lv.responsavelUid === "ana" && lv.visita.id === "vV");
const reag = (nome, over) => par(nome, seed, (v) => updVis("isa", "vV", { ...REAG, ...(v ? over : {}) }));
await reag("reagendamento trocando consultoraId (dona da visita)", { consultoraId: "isa" });
await reag("reagendamento trocando o nome da consultora da visita", { consultora: "Isabelle" });
await reag("reagendamento trocando leadId da visita", { leadId: "L2" });
await reag("reagendamento marcando COMPARECEU (não é reagendar)", { comparecimento: "COMPARECEU" });
await reag("reagendamento com status CONFIRMADA", { status: "CONFIRMADA" });
await reag("reagendamento com campo extra (atendidoPor)", { atendidoPor: "isa" });
await reag("reagendamento mexendo na marca de transferência", { ultimaTransferenciaEmMassaId: "x" });
await par("reagendamento com atualizadoEm escolhido pelo cliente (o app grava o instante do servidor)", seed, (v) => updVis("isa", "vV", { ...REAG, atualizadoEm: v ? new Date("2020-01-01") : SRV() }));
await par("baixa com atualizadoEm escolhido pelo cliente", seed, async (v) => { await updVis("isa", "vC", ATEND("isa")); return updVis("isa", "vC", { comparecimento: "COMPARECEU", status: "CONFIRMADA", atualizadoEm: v ? new Date("2020-01-01") : SRV() }); });
await par("reagendar visita JÁ realizada (COMPARECEU) não reescreve histórico", seed, (v) => updVis("isa", v ? "vDone" : "vV", REAG));
await par("espelho do lead apontando para visita de OUTRO lead", seed, (v) => updLead("isa", "LV", { visita: ESPELHO(v ? "vOutra" : "vV"), ultimoAtendimento: "x" }));
await par("espelho do lead trocando para outra visita (id diferente do atual)", seed, (v) => updLead("isa", "LV", { visita: ESPELHO(v ? "vC" : "vV"), ultimoAtendimento: "x" }));
await par("espelho trocando para OUTRA visita do MESMO lead (só o 'mesmo id' barra)", seed, (v) => updLead("isa", "LC", { visita: ESPELHO(v ? "vDone" : "vC"), ultimoAtendimento: "x" }));
await par("espelho de lead SEM espelho anterior apontando para visita de OUTRO lead (só o vínculo visita-lead barra)", seed, (v) => updLead("isa", "LS", { visita: ESPELHO(v ? "vOutra" : "vS"), ultimoAtendimento: "x" }));
await par("espelho com campo extra", seed, (v) => updLead("isa", "LV", { visita: v ? { ...ESPELHO("vV"), extra: 1 } : ESPELHO("vV"), ultimoAtendimento: "x" }));
await par("espelho com consultor = outra pessoa", seed, (v) => updLead("isa", "LV", { visita: { ...ESPELHO("vV"), consultor: v ? "Isabelle" : "Ana Lara" }, ultimoAtendimento: "x" }));
await par("reagendamento mudando o dono do lead junto", seed, (v) => updLead("isa", "LV", { visita: ESPELHO("vV"), ultimoAtendimento: "x", ...(v ? { responsavelUid: "isa" } : {}) }));
await seed();
await t("conta INATIVA não reagenda a visita", "DENY", () => updVis("inativa", "vV", REAG));
await t("conta INATIVA não altera o espelho no lead", "DENY", () => updLead("inativa", "LV", { visita: ESPELHO("vV"), ultimoAtendimento: "x" }));

console.log("\n=== E. COMPARECIMENTO / NÃO COMPARECIMENTO");
await seed();
await t("botão do lead: Isabelle registra comparecimento (etapa 3 -> 4)", "ALLOW", () => updLead("isa", "LV", { etapa: 4, ultimoAtendimento: "x" }));
await par("comparecimento do lead em lead que NÃO está na etapa 3 (etapa 2 -> 4)", seed, (v) => updLead("isa", v ? "L2" : "LV", { etapa: 4, ultimoAtendimento: "x" }));
await par("comparecimento do lead pulando para etapa 5", seed, (v) => updLead("isa", "LV", { etapa: v ? 5 : 4, ultimoAtendimento: "x" }));
await par("comparecimento do lead mudando o dono", seed, (v) => updLead("isa", "LV", { etapa: 4, ultimoAtendimento: "x", ...(v ? { responsavelUid: "isa" } : {}) }));
// baixa pela agenda: (1) atendimento da visita, (2) comparecimento, (3) lead
await seed();
await t("agenda: Isabelle registra o atendimento da visita ANTIGA sem baixa (autoria = ela)", "ALLOW", () => updVis("isa", "vC", ATEND("isa")));
await t("...dá baixa COMPARECEU na visita (resultado informado por ela, não inventado)", "ALLOW", () => updVis("isa", "vC", { comparecimento: "COMPARECEU", status: "CONFIRMADA" }));
await t("...e move o lead para negociação referenciando essa visita", "ALLOW", () => updLead("isa", "LC", { etapa: 4, ultimoAtendimento: "x", alertaNaoCompareceu: false, ultimaVisitaId: "vC" }));
await seed();
await t("agenda: atendimento + NAO_COMPARECEU na visita antiga", "ALLOW", async () => { await updVis("isa", "vC", ATEND("isa")); await updVis("isa", "vC", { comparecimento: "NAO_COMPARECEU", status: "CONFIRMADA", pendenciaResolvida: false }); });
await t("...e o lead recebe o alerta de não comparecimento", "ALLOW", () => updLead("isa", "LC", { etapa: 3, ultimoAtendimento: "x", alertaNaoCompareceu: true, alertaNaoCompareceuEm: "x", alertaNaoCompareceuVisitaId: "vC", pendenciaComercial: "NOVO_CONTATO_NAO_COMPARECIMENTO" }));
await par("atendimento com autoria de OUTRA pessoa", seed, (v) => updVis("isa", "vC", { ...ATEND("isa"), ...(v ? { atendidoPor: "ana" } : {}) }));
await par("atendimento com nome de outra pessoa", seed, (v) => updVis("isa", "vC", { ...ATEND("isa"), ...(v ? { atendidoPorNome: "Ana Lara" } : {}) }));
await par("atendimento sobre registro de atendimento de OUTRA pessoa (visita ainda sem baixa)", seed, async (v) => { await raw((db) => updateDoc(doc(db, "visitas", "vC"), { atendidoPor: v ? "ana" : "isa", atendidoPorNome: v ? "Ana Lara" : "Isabelle", atendidoEm: new Date("2026-10-01") })); return updVis("isa", "vC", ATEND("isa")); });
await par("atendimento em visita JÁ baixada (histórico)", seed, (v) => updVis("isa", v ? "vDone" : "vC", ATEND("isa")));
await par("baixa por quem NÃO registrou o atendimento", seed, async (v) => { await updVis("isa", "vC", ATEND("isa")); return updVis(v ? "lari" : "isa", "vC", { comparecimento: "COMPARECEU", status: "CONFIRMADA" }); });
await par("baixa sem atendimento prévio (autor não registrado)", seed, async (v) => { if (!v) await updVis("isa", "vC", ATEND("isa")); return updVis("isa", "vC", { comparecimento: "COMPARECEU", status: "CONFIRMADA" }); });
await par("baixa regravando visita JÁ baixada (COMPARECEU -> NAO_COMPARECEU)", seed, async (v) => { if (v) { await raw((db) => updateDoc(doc(db, "visitas", "vC"), { ...ATEND("isa"), comparecimento: "COMPARECEU", atendidoEm: new Date() })); return updVis("isa", "vC", { comparecimento: "NAO_COMPARECEU", status: "CONFIRMADA", pendenciaResolvida: false }); } await updVis("isa", "vC", ATEND("isa")); return updVis("isa", "vC", { comparecimento: "NAO_COMPARECEU", status: "CONFIRMADA", pendenciaResolvida: false }); });
await par("baixa com resultado inventado", seed, async (v) => { await updVis("isa", "vC", ATEND("isa")); return updVis("isa", "vC", { comparecimento: v ? "TALVEZ" : "COMPARECEU", status: "CONFIRMADA" }); });
await par("lead movido para negociação SEM a visita estar baixada como COMPARECEU", seed, async (v) => { if (!v) { await updVis("isa", "vC", ATEND("isa")); await updVis("isa", "vC", { comparecimento: "COMPARECEU", status: "CONFIRMADA" }); } return updLead("isa", "LC", { etapa: 4, ultimoAtendimento: "x", alertaNaoCompareceu: false, ultimaVisitaId: "vC" }); });
await par("lead movido citando visita baixada por OUTRA pessoa", seed, async (v) => { await raw((db) => updateDoc(doc(db, "visitas", "vC"), { atendidoPor: v ? "ana" : "isa", comparecimento: "COMPARECEU", status: "CONFIRMADA" })); return updLead("isa", "LC", { etapa: 4, ultimoAtendimento: "x", alertaNaoCompareceu: false, ultimaVisitaId: "vC" }); });
const NAOCOMP = (vid, over = {}) => ({ etapa: 3, ultimoAtendimento: "x", alertaNaoCompareceu: true, alertaNaoCompareceuEm: "x", alertaNaoCompareceuVisitaId: vid, pendenciaComercial: "NOVO_CONTATO_NAO_COMPARECIMENTO", ...over });
const baixaRaw = (vid, res) => raw((db) => updateDoc(doc(db, "visitas", vid), { atendidoPor: "isa", atendidoPorNome: "Isabelle", comparecimento: res, status: "CONFIRMADA" }));
await par("lead com alerta de não comparecimento sem a pendência comercial esperada", seed, async (v) => { await baixaRaw("vC", "NAO_COMPARECEU"); return updLead("isa", "LC", NAOCOMP("vC", v ? { pendenciaComercial: "OUTRA" } : {})); });
await par("alerta de não comparecimento com alertaNaoCompareceu=false (inconsistente)", seed, async (v) => { await baixaRaw("vC", "NAO_COMPARECEU"); return updLead("isa", "LC", NAOCOMP("vC", v ? { alertaNaoCompareceu: false } : {})); });
await par("não comparecimento aplicado a lead que NÃO está na etapa 3 (regressão 4 -> 3)", seed, async (v) => { await raw((db) => setDoc(doc(db, "visitas", "vN"), { leadId: "LN", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-01", hora: "15:00", status: "CONFIRMADA", comparecimento: "" })); await baixaRaw(v ? "vN" : "vC", "NAO_COMPARECEU"); return updLead("isa", v ? "LN" : "LC", NAOCOMP(v ? "vN" : "vC")); });
await par("comparecimento pela agenda com alertaNaoCompareceu=true (inconsistente)", seed, async (v) => { await baixaRaw("vC", "COMPARECEU"); return updLead("isa", "LC", { etapa: 4, ultimoAtendimento: "x", alertaNaoCompareceu: v ? true : false, ultimaVisitaId: "vC" }); });
await par("reagendamento com data de tipo inválido (número)", seed, (v) => updVis("isa", "vV", { ...REAG, ...(v ? { data: 20261025 } : {}) }));
await par("reagendamento com hora de tipo inválido (número)", seed, (v) => updVis("isa", "vV", { ...REAG, ...(v ? { hora: 1400 } : {}) }));
await seed();
await t("conta INATIVA não registra atendimento nem baixa", "DENY", () => updVis("inativa", "vC", ATEND("inativa")));
await t("conta INATIVA não move o lead de etapa", "DENY", () => updLead("inativa", "LV", { etapa: 4, ultimoAtendimento: "x" }));

console.log("\n=== F. PROPRIEDADE E CAMPOS FORA DA OPERAÇÃO (diretamente no Firestore)");
await seed();
for (const [nome, d] of [["responsavelUid", { responsavelUid: "isa" }], ["responsavel", { responsavel: "Isabelle" }], ["consultora", { consultora: "Isabelle" }], ["os três campos de dono", { responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" }],
  ["marca da transferência", { ultimaTransferenciaEmMassaId: "op1" }], ["cadastroGerencial", { cadastroGerencial: true }], ["nome do cliente", { nome: "Outro" }], ["telefone", { telefone: "999" }], ["etapa para trás (4 -> 1)", { etapa: 1 }], ["status de reativação", { status: "REATIVACAO" }], ["matricula (injetar)", { matricula: MAT("isa") }]]) {
  await t(`Isabelle NÃO altera ${nome} do lead da Ana`, "DENY", () => updLead("isa", "LN", d));
}
await t("Isabelle NÃO altera campo do lead por updateDoc com chave aninhada (visita.consultor)", "DENY", () => updateDoc(doc(as("isa"), "leads", "LV"), { "visita.consultor": "Isabelle", atualizadoEm: SRV() }));
await t("Isabelle NÃO cria lead em nome da Ana", "DENY", () => setDoc(doc(as("isa"), "leads", "NOVO"), { nome: "x", etapa: 1, ...TIT }));
await t("transferência de carteira continua negada a recepcionista (individual)", "DENY", () => updLead("isa", "LN", { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" }));

console.log("\n=== G. HISTÓRICO APPEND-ONLY e EXCLUSÃO");
await seed();
await t("recepcionista NÃO edita evento anterior", "DENY", () => updateDoc(doc(as("isa"), "leads", "LV", "eventos", "ev0"), { descricao: "adulterado" }));
await t("...nem a titular edita o evento", "DENY", () => updateDoc(doc(as("ana"), "leads", "LV", "eventos", "ev0"), { descricao: "adulterado" }));
await t("recepcionista NÃO exclui evento", "DENY", () => deleteDoc(doc(as("isa"), "leads", "LV", "eventos", "ev0")));
await t("coordenador/admin autorizados também NÃO excluem evento", "DENY", () => deleteDoc(doc(as(ADM), "leads", "LV", "eventos", "ev0")));
await t("recepcionista (não titular) NÃO exclui o lead", "DENY", () => deleteDoc(doc(as("isa"), "leads", "LN")));
await t("a TITULAR (recepcionista) também NÃO exclui o lead", "DENY", () => deleteDoc(doc(as("ana"), "leads", "LN")));
await t("recepcionista NÃO exclui visita", "DENY", () => deleteDoc(doc(as("isa"), "visitas", "vV")));
await t("outro coordenador (não autorizado) NÃO exclui lead", "DENY", () => deleteDoc(doc(as("coord-outro"), "leads", "LN")));
await t("só os dois UIDs autorizados excluem lead (Samir)", "ALLOW", () => deleteDoc(doc(as(ADM), "leads", "L2")));
check("o histórico do lead continua com o evento original", (await raw((db) => getDoc(doc(db, "leads", "LV", "eventos", "ev0")))).data().descricao === "antigo");

console.log("\n=== H. VISITAS ANTIGAS DE CARTEIRA TRANSFERIDA: a nova responsável consulta e trata, sem reescrever o histórico");
await seed();
await t("Larissa (nova titular de LT) lê a visita ANTIGA (consultoraId = antiga dona, fora do turno)", "ALLOW", () => getDoc(doc(as("lari"), "visitas", "vOld")));
await t("...e lista as visitas do lead por leadId", "ALLOW", () => getDocs(query(collection(as("lari"), "visitas"), where("leadId", "==", "LT"))));
const lstIn = await (async () => { try { await getDocs(query(collection(as("lari"), "visitas"), where("leadId", "in", ["LT"]))); return "ALLOW"; } catch (e) { return e.code === "permission-denied" ? "DENY" : "ERRO"; } })();
console.log(`INFO  | consulta com 'leadId in [LT]' pela titular: ${lstIn}`);
await t("a agenda da titular busca as visitas de VÁRIOS leads dela de uma vez (leadId in [LT, LT2])", "ALLOW", () => getDocs(query(collection(as("lari"), "visitas"), where("leadId", "in", ["LT", "LT2"]))));
await t("...mas a mesma consulta incluindo lead de OUTRA consultora (LN) é negada (sem vazamento)", "DENY", () => getDocs(query(collection(as("lari"), "visitas"), where("leadId", "in", ["LT", "LN"]))));
await t("...e uma recepcionista que não é titular não lista nem os leads transferidos", "DENY", () => getDocs(query(collection(as("isa"), "visitas"), where("leadId", "in", ["LT", "LT2"]))));
await t("...mas Isabelle (não titular, fora do turno) NÃO lê a mesma visita", "DENY", () => getDoc(doc(as("isa"), "visitas", "vOld")));
await t("Larissa dá baixa na visita antiga: atendimento (autor = ela)", "ALLOW", () => updVis("lari", "vOld", ATEND("lari")));
await t("...e resultado NAO_COMPARECEU (decisão dela; nada é inventado)", "ALLOW", () => updVis("lari", "vOld", { comparecimento: "NAO_COMPARECEU", status: "CONFIRMADA", pendenciaResolvida: false }));
const vo = (await raw((db) => getDoc(doc(db, "visitas", "vOld")))).data();
check("ID, data, hora, consultoraId e consultora históricos da visita antiga preservados", vo.consultoraId === "isadora-antiga" && vo.consultora === "Isadora" && vo.data === "2026-09-10" && vo.hora === "15:00" && vo.leadId === "LT");
await t("Larissa NÃO troca o consultoraId (histórico) da visita antiga", "DENY", () => updVis("lari", "vOld2", { consultoraId: "lari" }));
await t("Larissa NÃO apaga a visita antiga", "DENY", () => deleteDoc(doc(as("lari"), "visitas", "vOld2")));
await t("Larissa NÃO lê visita de lead que não é dela (vV)", "DENY", () => getDoc(doc(as("lari"), "visitas", "vV")));
await t("conta INATIVA, mesmo titular, não lê visitas pelo caminho novo", "DENY", async () => { await raw((db) => updateDoc(doc(db, "leads", "LT"), { responsavelUid: "inativa", responsavel: "Inativa", consultora: "Inativa" })); return getDoc(doc(as("inativa"), "visitas", "vOld")); });

console.log("\n=== I. REGRESSÃO: fluxo normal da titular, caminhos antigos e transferência");
await seed();
await t("a titular edita o próprio lead (campos de negócio)", "ALLOW", () => updLead("ana", "LN", { objetivo: "emagrecer" }));
await t("a titular grava evento com o próprio nome (sem usuarioUid, formato antigo)", "ALLOW", () => addDoc(collection(as("ana"), "leads", "LN", "eventos"), { leadId: "LN", tipo: "OBSERVACAO", usuario: "Ana Lara", descricao: "x", dados: {}, criadoEm: SRV() }));
await t("a titular reagenda/atende a própria visita (dona da visita)", "ALLOW", () => updVis("ana", "vV", REAG));
await t("a titular NÃO muda o próprio dono (continua exclusivo dos 2 UIDs)", "DENY", () => updLead("ana", "LN", { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" }));
await t("caminho antigo por TURNO continua: recepcionista no turno baixa visita das 10:00", "ALLOW", async () => { await raw((db) => setDoc(doc(db, "visitas", "vTurno"), { leadId: "LN", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-20", hora: "10:00", status: "AGENDADA" })); return updateDoc(doc(as("isa"), "visitas", "vTurno"), { observacao: "turno" }); });
await t("recepcionista ainda assume lead da fila em nome próprio", "ALLOW", () => updateDoc(doc(as("isa"), "leads", "FILA"), { responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle", assumido: true, atualizadoEm: SRV() }));
await t("admin autorizado transfere carteira (Samir)", "ALLOW", () => updateDoc(doc(as(ADM), "leads", "L2"), { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa", atualizadoEm: SRV() }));
await t("coordenador NÃO autorizado continua sem transferir", "DENY", () => updateDoc(doc(as("coord-outro"), "leads", "LN"), { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa", atualizadoEm: SRV() }));
await t("transferenciasEmMassa continua restrita (Isabelle não lê)", "DENY", () => getDocs(collection(as("isa"), "transferenciasEmMassa")));

process.exit(fim() ? 1 : 0);
