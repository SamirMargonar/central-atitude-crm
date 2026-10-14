// ATENDIMENTO COMPARTILHADO — integração: o código REAL do app (registrarEvento, atualizarLead, registrarAtendimento, atualizarVisita,
// buscarVisitasDosLeadsDaTitular) rodando contra o Emulator COM as Rules reais. Só o módulo `firebase/firebase` (config de produção) é
// substituído por uma instância do Emulator autenticada como o usuário de teste; nada toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as FS from "firebase/firestore";
const { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } = FS;
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const env = await initializeTestEnvironment({ projectId: "demo-tme-integracao", firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA } });
const { t, check, fim } = criarRelatorio();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };

async function seed() {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "12:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador"); await u("ana", "Ana Lara", "recepcionista"); await u("isa", "Isabelle", "recepcionista");
    await u("lari", "Larissa", "recepcionista"); await u("inativa", "Inativa", "recepcionista", { ativo: false });
    const lead = (id, etapa, extra = {}) => setDoc(doc(db, "leads", id), { nome: "Cliente " + id, etapa, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", ...extra });
    await lead("LN", 4); await lead("LC", 3, { visita: { id: "vC", data: "2026-10-01", hora: "15:00", consultor: "Ana Lara", observacao: "" } });
    await lead("LT", 3, { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" }); await lead("LT2", 3, { responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa" });
    await setDoc(doc(db, "visitas", "vC"), { leadId: "LC", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-01", hora: "15:00", status: "CONFIRMADA", comparecimento: "" });
    for (const [id, lid] of [["vOld", "LT"], ["vOld2", "LT"], ["vT2", "LT2"]]) await setDoc(doc(db, "visitas", id), { leadId: lid, consultora: "Isadora", consultoraId: "isadora-antiga", data: "2026-09-10", hora: "15:00", status: "CONFIRMADA", comparecimento: "" });
  });
}

// --- módulo `firebase/firebase` substituído: db = instância do Emulator do usuário corrente; auth.currentUser = esse usuário
const mk = mkdtempSync(path.join(tmpdir(), "tme-integ-"));
globalThis.__dbInicial = env.authenticatedContext("ana").firestore();   // os engines criam `collection(db, "visitas")` ao carregar: precisa existir um db válido
writeFileSync(`${mk}/firebase-stub.mjs`, `export let db = globalThis.__dbInicial; export let auth = { currentUser: null }; export function __como(d, uid) { db = d; auth = { currentUser: { uid } }; }\n`);
// `firebase/firestore` do app = EXATAMENTE o módulo que este teste importou (a mesma instância das Rules-unit-testing): o stub só repassa as chamadas
globalThis.__fs = FS;
writeFileSync(`${mk}/firestore-ponte.mjs`, Object.keys(FS).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== "default").map((k) => typeof FS[k] === "function" && !/^[A-Z]/.test(k) ? `export const ${k} = (...a) => globalThis.__fs.${k}(...a);` : `export const ${k} = globalThis.__fs.${k};`).join("\n") + "\n");
const firestoreEsm = `${mk}/firestore-ponte.mjs`;
const { createServer } = await import(REPO + "/node_modules/vite/dist/node/index.js");
const vite = await createServer({ root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } },
  resolve: { alias: { "../firebase/firebase": `${mk}/firebase-stub.mjs`, "../../firebase/firebase": `${mk}/firebase-stub.mjs`, "firebase/firestore": firestoreEsm } }, ssr: { noExternal: [] } });
const stub = await vite.ssrLoadModule(`${mk}/firebase-stub.mjs`);
const EV = await vite.ssrLoadModule("/src/core/EventEngine.js");
const VE = await vite.ssrLoadModule("/src/Agenda/VisitaEngine.js");      // atualizarVisita, buscarVisitasDosLeadsDaTitular
const CV = await vite.ssrLoadModule("/src/core/VisitaEngine.js");         // registrarAtendimento (o mesmo módulo que DetalhesVisita.jsx importa)
const como = (uid) => { stub.__como(env.authenticatedContext(uid).firestore(), uid); };

console.log("\n=== A. registrarEvento REAL: autoria gravada e aceita pelas Rules no atendimento compartilhado");
await seed(); como("isa");
await t("Isabelle registra observação no lead da Ana com o registrarEvento REAL (usuario = ela)", "ALLOW", () => EV.registrarEvento({ leadId: "LN", tipo: "OBSERVACAO", usuario: "Isabelle", descricao: "cliente pediu prazo" }));
const evs = (await raw((db) => getDocs(collection(db, "leads", "LN", "eventos")))).docs.map((d) => d.data());
check("o documento gravado traz usuarioUid=isa, usuario=Isabelle e criadoEm do servidor", evs.length === 1 && evs[0].usuarioUid === "isa" && evs[0].usuario === "Isabelle" && !!evs[0].criadoEm?.toDate);
await t("o mesmo registrarEvento REAL com o NOME DA TITULAR como autor é negado", "DENY", () => EV.registrarEvento({ leadId: "LN", tipo: "OBSERVACAO", usuario: "Ana Lara", descricao: "x" }));
como("inativa");
await t("conta INATIVA com o registrarEvento REAL é negada", "DENY", () => EV.registrarEvento({ leadId: "LN", tipo: "OBSERVACAO", usuario: "Inativa", descricao: "x" }));
como("ana");
await t("a TITULAR continua registrando evento com o fluxo real (formato novo, com usuarioUid)", "ALLOW", () => EV.registrarEvento({ leadId: "LN", tipo: "OBSERVACAO", usuario: "Ana Lara", descricao: "x" }));

console.log("\n=== B. Baixa de visita ANTIGA sem baixa com as funções REAIS da agenda (atendimento -> comparecimento -> lead)");
await seed(); como("isa");
const usuarioAtual = { uid: "isa", nome: "Isabelle" };
await t("registrarAtendimento REAL (autoria = Isabelle) numa visita antiga de lead alheio", "ALLOW", () => CV.registrarAtendimento("vC", usuarioAtual, "atendida"));
await t("atualizarVisita REAL com o resultado NAO_COMPARECEU (decidido por ela)", "ALLOW", () => VE.atualizarVisita("vC", { comparecimento: "NAO_COMPARECEU", status: "CONFIRMADA", pendenciaResolvida: false }));
await t("atualizarLead REAL com o alerta de não comparecimento", "ALLOW", () => EV.atualizarLead("LC", { etapa: 3, ultimoAtendimento: "x", alertaNaoCompareceu: true, alertaNaoCompareceuEm: "x", alertaNaoCompareceuVisitaId: "vC", pendenciaComercial: "NOVO_CONTATO_NAO_COMPARECIMENTO" }));
const v = (await raw((db) => getDoc(doc(db, "visitas", "vC")))).data();
check("a visita preserva ID, leadId, data, hora, consultoraId e consultora; registra atendidoPor=isa", v.consultoraId === "ana" && v.leadId === "LC" && v.data === "2026-10-01" && v.hora === "15:00" && v.consultora === "Ana Lara" && v.atendidoPor === "isa" && v.comparecimento === "NAO_COMPARECEU");
await t("reagendar visita REAL (sem consultora na carga) é aceito para quem atende; com consultora trocada é negado", "ALLOW", () => VE.atualizarVisita("vC", { data: "2026-10-30", hora: "14:00", observacao: "remarcada", comparecimento: "", pendenciaResolvida: true, status: "AGENDADA" }));
await t("...reenviando `consultora` (como o código ANTIGO fazia) seria negado", "DENY", () => VE.atualizarVisita("vC", { data: "2026-11-02", hora: "14:00", consultora: "Isabelle", observacao: "x", comparecimento: "", pendenciaResolvida: true, status: "AGENDADA" }));

console.log("\n=== B2. Fechamento e reagendamento com as funções REAIS (mesmos payloads de MatriculaAction/ReagendarVisitaAction)");
await seed(); como("isa");
const MATRICULA = { confirmada: true, data: "14/10/2026", hora: "10:00", consultor: "Ana Lara", observacao: "", plano: "MENSAL", dataInicio: "2026-10-14", dataVencimento: "2026-11-14", status: "ATIVA", registradoPorUid: "isa", registradoPorNome: "Isabelle", atendimentoCompartilhado: true };
await t("atualizarLead REAL do fechamento (etapa 4 -> 5 + matricula) por Isabelle", "ALLOW", () => EV.atualizarLead("LN", { etapa: 5, ultimoAtendimento: "x", matricula: MATRICULA }));
await t("registrarEvento REAL MATRICULA e JORNADA (dados aninhados, autor = Isabelle)", "ALLOW", async () => { await EV.registrarEvento({ leadId: "LN", tipo: "MATRICULA", usuario: "Isabelle", descricao: "Matrícula confirmada.", dados: { plano: "MENSAL", atendimentoCompartilhado: true, titularUid: "ana", titularNome: "Ana Lara" } }); await EV.registrarEvento({ leadId: "LN", tipo: "JORNADA", usuario: "Isabelle", descricao: "avançou", dados: { etapaAnterior: 4, novaEtapa: 5 } }); });
const lnF = (await raw((db) => getDoc(doc(db, "leads", "LN")))).data();
check("o lead fechado continua da Ana (responsavelUid/responsavel/consultora) e na etapa 5 com a matrícula registrada por Isabelle", lnF.responsavelUid === "ana" && lnF.responsavel === "Ana Lara" && lnF.consultora === "Ana Lara" && lnF.etapa === 5 && lnF.matricula.consultor === "Ana Lara" && lnF.matricula.registradoPorUid === "isa");
await t("registrarEvento REAL NAO_FECHAMENTO", "ALLOW", () => EV.registrarEvento({ leadId: "LC", tipo: "NAO_FECHAMENTO", usuario: "Isabelle", descricao: "vai pensar", dados: { atendimentoCompartilhado: true, etapa: 3 } }));
await t("atualizarVisita REAL do reagendamento + atualizarLead REAL do espelho + evento VISITA com visitaAnterior/novaVisita", "ALLOW", async () => {
  await VE.atualizarVisita("vC", { data: "2026-10-30", hora: "14:00", observacao: "remarcada", comparecimento: "", pendenciaResolvida: true, status: "AGENDADA" });
  await EV.atualizarLead("LC", { visita: { id: "vC", data: "2026-10-30", hora: "14:00", consultor: "Ana Lara", observacao: "remarcada" }, ultimoAtendimento: "x" });
  await EV.registrarEvento({ leadId: "LC", tipo: "VISITA", usuario: "Isabelle", descricao: "Visita reagendada.", dados: { visitaAnterior: { id: "vC" }, novaVisita: { id: "vC" }, atendimentoCompartilhado: true, titularNome: "Ana Lara" } });
});
await t("o mesmo fechamento por conta INATIVA é negado", "DENY", async () => { como("inativa"); await seed(); como("inativa"); return EV.atualizarLead("LN", { etapa: 5, ultimoAtendimento: "x", matricula: { ...MATRICULA, registradoPorUid: "inativa", registradoPorNome: "Inativa" } }); });

console.log("\n=== C. Nova titular: buscarVisitasDosLeadsDaTitular REAL (visitas antigas da carteira transferida)");
await seed(); como("lari");
const lista = await VE.buscarVisitasDosLeadsDaTitular({ uid: "lari" });
check("a nova titular recebe as 3 visitas antigas dos 2 leads dela (consultoraId histórico preservado)", lista.length === 3 && lista.every((x) => x.consultoraId === "isadora-antiga") && ["vOld", "vOld2", "vT2"].every((id) => lista.some((x) => x.id === id)), JSON.stringify(lista.map((x) => x.id)));
como("isa");
const vazia = await VE.buscarVisitasDosLeadsDaTitular({ uid: "isa" });
check("quem não é titular de nenhum lead recebe lista vazia (sem erro e sem vazamento)", Array.isArray(vazia) && vazia.length === 0);
como("ana"); const daAna = await VE.buscarVisitasDosLeadsDaTitular({ uid: "ana" });
check("a titular Ana recebe só as visitas dos leads dela (vC), nunca as da carteira da Larissa", daAna.map((x) => x.id).sort().join() === "vC");

await vite.close();
process.exit(fim() ? 1 : 0);
void ADM; void NAY; void serverTimestamp; void createRequire;
