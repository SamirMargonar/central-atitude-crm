// REAGENDAMENTO PELA AGENDA — visita + espelho lead.visita + Timeline num lote atômico, contra as Rules REAIS (Emulator).
// Usa o código real (src/Agenda/reagendamentoAgenda.js). Para cada perfil compara com o comportamento ANTIGO (só a visita):
// quem já conseguia reagendar continua conseguindo. Nada aqui toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const { criarReagendamentoAgenda } = await import(`${REPO}/src/Agenda/reagendamentoAgenda.js`);
const env = await initializeTestEnvironment({
  projectId: "demo-tme-reagendamento",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const { check, fim } = criarRelatorio();
const { doc, setDoc, getDoc, getDocs, updateDoc, collection, serverTimestamp } = fs;
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const NOMES = { [ADM]: "Samir", [NAY]: "Naykison", ana: "Ana Lara", isa: "Isabelle", inat: "Inativa", lari: "Larissa", dona: "Dona Inativa" };

const VISITA = { leadId: "LA", consultora: "Ana Lara", consultoraId: "ana", data: "2026-10-20", hora: "15:00", status: "CONFIRMADA", comparecimento: "", observacao: "" };
const ESPELHO = { id: "vA", data: "2026-10-20", hora: "15:00", consultor: "Ana Lara", observacao: "" };

async function seed({ visita = {}, lead = {} } = {}) {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "14:00", horaSaida: "18:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador");
    await u("ana", "Ana Lara", "recepcionista", { horaEntrada: "08:00", horaSaida: "12:00" });      // titular; a visita das 15:00 está FORA do turno dela
    await u("isa", "Isabelle", "recepcionista");                                                    // 14–18: a visita das 15:00 está NO turno
    await u("inat", "Inativa", "recepcionista", { ativo: false });                                  // 14–18, conta inativa
    await u("lari", "Larissa", "recepcionista", { horaEntrada: "08:00", horaSaida: "12:00" });      // ativa, fora do turno
    await u("dona", "Dona Inativa", "recepcionista", { ativo: false, horaEntrada: "08:00", horaSaida: "12:00" }); // inativa, fora do turno, dona da visita
    await setDoc(doc(db, "leads", "LA"), { nome: "Maria", telefone: "000", etapa: 3, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", visita: { ...ESPELHO }, ...lead });
    await setDoc(doc(db, "visitas", "vA"), { ...VISITA, ...visita });
  });
}
const leadDoc = async () => (await raw((db) => getDoc(doc(db, "leads", "LA")))).data();
const visitaDoc = async () => (await raw((db) => getDoc(doc(db, "visitas", "vA")))).data();
const eventos = async () => (await raw((db) => getDocs(collection(db, "leads", "LA", "eventos")))).docs.map((d) => d.data());

const NOVA = { data: "2026-10-27", hora: "16:30", observacao: "pediu para remarcar" };
const visitaDoApp = () => ({ id: "vA", ...VISITA, ...(globalThis.__visitaExtra || {}) });
const leadDoApp = (extra = {}) => ({ id: "LA", nome: "Maria", responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", visita: { ...ESPELHO }, ...extra });
const novoReag = (uid, over = {}) => criarReagendamentoAgenda({ db: as(uid), fs, auth: { currentUser: { uid } }, ...over });
const autor = (uid) => ({ uid, nome: NOMES[uid] });

// comportamento ANTIGO da Agenda: só a visita (mesmo payload de antes)
async function antigo(uid) {
  try { await updateDoc(doc(as(uid), "visitas", "vA"), { data: NOVA.data, hora: NOVA.hora, consultora: "Ana Lara", observacao: NOVA.observacao, comparecimento: "", status: "AGENDADA", atualizadoEm: serverTimestamp() }); return true; } catch { return false; }
}
async function novo(uid, { lead = leadDoApp(), visita = visitaDoApp(), nova = NOVA } = {}) {
  try { return { ok: true, r: await novoReag(uid).reagendar({ visita, lead, nova, autor: autor(uid) }) }; } catch (e) { return { ok: false, erro: e }; }
}

console.log("\n=== A. Cada perfil: o que já podia reagendar CONTINUA podendo; e agora o resultado é completo (visita + espelho + Timeline)");
const casos = [
  ["administrador", ADM, {}, "completo"],
  ["coordenador", NAY, {}, "completo"],
  ["titular (fora do turno dela, dona da visita)", "ana", {}, "completo"],
  ["recepcionista ATIVA, visita NO turno, lead de outra titular", "isa", {}, "completo"],
  ["recepcionista INATIVA, visita no turno, lead de outra titular", "inat", {}, "completo"],
  ["recepcionista ATIVA fora do turno, visita JÁ com pendência resolvida (atendimento compartilhado)", "lari", { visita: { pendenciaResolvida: true } }, "completo"],
  ["recepcionista ATIVA fora do turno, sem permissão na visita (antes já negado)", "lari", {}, "negado"],
  ["recepcionista INATIVA, dona da visita fora do turno (lote negado => só a visita, como antes)", "dona", { visita: { consultoraId: "dona" } }, "parcial"],
];
for (const [rotulo, uid, cfg, esperado] of casos) {
  await seed(cfg); const antes = await antigo(uid);
  await seed(cfg);
  globalThis.__visitaExtra = cfg.visita || {};
  const r = await novo(uid);
  const obtido = !r.ok ? "negado" : r.r.parcial ? "parcial" : "completo";
  check(`${rotulo}: antes ${antes ? "ALLOW" : "DENY"} -> agora ${obtido}`, obtido === esperado && (!antes || r.ok), r.ok ? JSON.stringify(r.r) : String(r.erro?.code));
  if (esperado === "completo") {
    const v = await visitaDoc(), l = await leadDoc(), ev = await eventos();
    check(`   ${rotulo}: visita nova, espelho do lead novo e UM evento`, v.data === NOVA.data && v.hora === NOVA.hora && v.status === "AGENDADA" && l.visita.data === NOVA.data && l.visita.hora === NOVA.hora && l.visita.id === "vA" && l.visita.consultor === "Ana Lara" && ev.length === 1 && ev[0].tipo === "VISITA" && ev[0].usuarioUid === uid && ev[0].usuario === NOMES[uid], JSON.stringify({ l: l.visita, ev: ev.length }));
    check(`   ${rotulo}: titularidade intacta (responsavelUid/responsavel/consultora) e ultimoAtendimento gravado`, l.responsavelUid === "ana" && l.responsavel === "Ana Lara" && l.consultora === "Ana Lara" && typeof l.ultimoAtendimento === "string" && l.ultimoAtendimento.length > 0);
  }
  if (esperado === "parcial") {
    const v = await visitaDoc(), l = await leadDoc(), ev = await eventos();
    check(`   ${rotulo}: a visita foi reagendada; espelho NÃO mexido; resultado marcado como parcial`, v.data === NOVA.data && l.visita.data === ESPELHO.data && r.r.parcial === true && r.r.espelho === false && ev.length === (r.r.evento ? 1 : 0));
  }
  if (esperado === "negado") {
    const v = await visitaDoc(), l = await leadDoc(), ev = await eventos();
    check(`   ${rotulo}: nada foi gravado`, v.data === VISITA.data && l.visita.data === ESPELHO.data && ev.length === 0);
  }
}
globalThis.__visitaExtra = {};

console.log("\n=== B. Atomicidade: falha parcial NÃO deixa dados incoerentes");
{
  // Lote NEGADO pelas Rules: recepcionista inativa, dona da visita, fora do turno (a visita sozinha ela pode; o espelho e o evento não).
  // Para provar que o LOTE não gravou nada, a tentativa de "só a visita" (fallback) também é derrubada.
  await seed({ visita: { consultoraId: "dona" } });
  const fsSemFallback = { ...fs, updateDoc: async () => { const e = new Error("fallback derrubado de propósito"); e.code = "unavailable"; throw e; } };
  const r = criarReagendamentoAgenda({ db: as("dona"), fs: fsSemFallback, auth: { currentUser: { uid: "dona" } } });
  let erro = null; try { await r.reagendar({ visita: { ...visitaDoApp(), consultoraId: "dona" }, lead: leadDoApp(), nova: NOVA, autor: autor("dona") }); } catch (e) { erro = e; }
  const v = await visitaDoc(), l = await leadDoc(), ev = await eventos();
  check("lote negado + fallback indisponível: o erro sobe e NADA foi gravado (visita, espelho e Timeline como antes)", !!erro && v.data === VISITA.data && v.hora === VISITA.hora && v.status === "CONFIRMADA" && l.visita.data === ESPELHO.data && l.visita.hora === ESPELHO.hora && ev.length === 0, String(erro?.message));

  // falha que não é de permissão (rede): nada gravado e SEM tentativa de fallback
  await seed();
  let chamadasFallback = 0;
  const fsRede = { ...fs, writeBatch: (...a) => { const b = fs.writeBatch(...a); return { update: b.update.bind(b), set: b.set.bind(b), commit: async () => { const e = new Error("rede"); e.code = "unavailable"; throw e; } }; }, updateDoc: async (...a) => { chamadasFallback++; return fs.updateDoc(...a); }, setDoc: async (...a) => { chamadasFallback++; return fs.setDoc(...a); } };
  erro = null;
  try { await criarReagendamentoAgenda({ db: as(ADM), fs: fsRede, auth: { currentUser: { uid: ADM } } }).reagendar({ visita: visitaDoApp(), lead: leadDoApp(), nova: NOVA, autor: autor(ADM) }); } catch (e) { erro = e; }
  check("falha de rede no lote: erro sobe, nenhuma gravação de 'consolação' (sem fallback) e dados intactos", erro?.code === "unavailable" && chamadasFallback === 0 && (await visitaDoc()).data === VISITA.data && (await leadDoc()).visita.data === ESPELHO.data && (await eventos()).length === 0);
}

console.log("\n=== C. Casos de borda");
{
  await seed();
  let r = await novo(ADM, { lead: leadDoApp({ visita: { ...ESPELHO, id: "outraVisita" } }) });
  check("lead com OUTRA visita espelhada: reagenda a visita e grava o evento, sem sobrescrever o espelho", r.ok && r.r.espelho === false && r.r.evento === true && r.r.motivo === "espelho_de_outra_visita" && (await leadDoc()).visita.data === ESPELHO.data && (await eventos()).length === 1);
  await seed();
  r = await novo(ADM, { lead: null });
  check("lead ainda não carregado (null): visita + evento (usa o leadId da visita), sem espelho", r.ok && r.r.espelho === false && r.r.evento === true && (await visitaDoc()).data === NOVA.data && (await eventos()).length === 1);
  await seed();
  r = await novo(ADM, { nova: { data: VISITA.data, hora: VISITA.hora, observacao: "só a observação" } });
  check("mesma data e hora: só a visita é salva; nenhum evento e nenhum espelho", r.ok && r.r.motivo === "sem_mudanca" && (await visitaDoc()).observacao === "só a observação" && (await eventos()).length === 0 && (await leadDoc()).visita.data === ESPELHO.data);
  await seed();
  r = await novo(ADM, { visita: { ...visitaDoApp(), leadId: undefined }, lead: null });
  check("visita sem lead vinculado: só a visita", r.ok && r.r.motivo === "sem_lead" && (await eventos()).length === 0);
  await seed();
  const a = await novo(ADM); const b = await novo(ADM, { visita: { ...visitaDoApp(), data: NOVA.data, hora: NOVA.hora }, lead: leadDoApp({ visita: { ...ESPELHO, data: NOVA.data, hora: NOVA.hora } }), nova: { data: "2026-11-03", hora: "10:00", observacao: "" } });
  const ev = await eventos();
  check("dois reagendamentos DIFERENTES = dois eventos (um por ação); espelho acompanha o último", a.ok && b.ok && ev.length === 2 && (await leadDoc()).visita.data === "2026-11-03" && ev.every((e) => e.tipo === "VISITA"));
  await seed();
  const ev1 = await (async () => { await novo(ADM); return (await eventos())[0]; })();
  check("evento: dados no formato da Timeline (visitaAnterior/novaVisita), origem AGENDA, autor e titular; criadoEm do servidor", ev1.dados.origem === "AGENDA" && ev1.dados.visitaId === "vA" && ev1.dados.visitaAnterior.data === "2026-10-20" && ev1.dados.novaVisita.hora === "16:30" && ev1.dados.titularNome === "Ana Lara" && ev1.dados.atendimentoCompartilhado === true && ev1.criadoEm?.toDate && !("data" in ev1.dados) && /Samir reagendou a visita de Maria: de 20\/10\/2026 às 15:00 para 27\/10\/2026 às 16:30\./.test(ev1.descricao), JSON.stringify(ev1.dados));
}

await env.cleanup();
process.exit(fim() ? 1 : 0);
