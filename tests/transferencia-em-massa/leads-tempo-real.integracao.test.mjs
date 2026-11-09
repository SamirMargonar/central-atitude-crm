// LEADS EM TEMPO REAL — SDK REAL do Firestore contra as Rules REAIS no Emulator, usando o mesmo módulo de
// assinatura resiliente e o mesmo rastreador de chegadas do app. Prova de ponta a ponta:
// admin cadastra -> todas as recepcionistas recebem sozinhas; uma assume -> a outra vê a mudança;
// o backlog não vira "chegada"; as consultas de contagem do vigia são permitidas pelas Rules.
// As escritas são do teste (Emulator). Nada toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const { criarAssinaturaResiliente } = await import(`${REPO}/src/hooks/assinaturaResiliente.js`);
const { criarRastreadorDeChegadas } = await import(`${REPO}/src/utils/chegadasDeLeads.js`);
const { aplicarChegadas, podarAlarme } = await import(`${REPO}/src/utils/alertaNovoLead.js`);

const env = await initializeTestEnvironment({ projectId: "demo-tme-leads-rt", firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA } });
const { t, check, fim } = criarRelatorio();
const { doc, setDoc, updateDoc, collection, query, where, serverTimestamp, getCountFromServer } = fs;
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const esperar = async (cond, ms = 6000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return cond(); };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Mesmas consultas do useLeads para recepcionista
const consultasDe = (db, uid) => ({
  proprios: query(collection(db, "leads"), where("responsavelUid", "==", uid)),
  fila: query(collection(db, "leads"), where("responsavelUid", "==", ""), where("etapa", "==", 0), where("assumido", "==", false)),
});

// "Cliente" do app: o que o useLeads faz, sem React
function abrirRecepcionista(uid, nome) {
  const db = as(uid);
  const q = consultasDe(db, uid);
  const rast = criarRastreadorDeChegadas(["proprios", "fila"]);
  const perfilUsuario = { uid, nome, perfil: "recepcionista" };
  const estado = { leads: [], chegadas: [], alarme: new Set(), ultimoSeq: 0, snapshots: 0 };
  const subs = Object.keys(q).map((chave) => criarAssinaturaResiliente({
    nome: `${uid}/${chave}`, consulta: q[chave], fs, log: { warn() {}, error() {} },
    aoSnapshot: (snap) => {
      estado.snapshots += 1;
      const r = rast.atualizar(chave, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      estado.leads = r.leads; estado.chegadas.push(...r.chegadas);
      const ap = aplicarChegadas({ chegadas: r.chegadas, ultimoSeq: estado.ultimoSeq, idsAtuais: new Set(), perfilUsuario, podeOuvir: true });
      estado.ultimoSeq = ap.ultimoSeq; ap.ids.forEach((id) => estado.alarme.add(id));
      estado.alarme = podarAlarme({ ids: estado.alarme, leads: r.leads, perfilUsuario });
    },
  }));
  return { estado, db, q, fechar: () => subs.forEach((s) => s.parar()) };
}
const ids = (e) => e.leads.map((l) => l.id).sort().join();

async function seed() {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "18:00" });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador"); await u("ana", "Ana Lara", "recepcionista"); await u("isa", "Isabelle", "recepcionista");
    // backlog: 2 leads na fila (antigos) + 1 lead assumido pela Ana
    for (const id of ["antigo1", "antigo2"]) await setDoc(doc(db, "leads", id), { nome: id, etapa: 0, assumido: false, responsavelUid: "", cadastradoPor: "Samir", cadastradoPorUid: ADM });
    await setDoc(doc(db, "leads", "daAna"), { nome: "daAna", etapa: 0, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", cadastradoPor: "Ana Lara", cadastradoPorUid: "ana" });
    await setDoc(doc(db, "leads", "daIsa"), { nome: "daIsa (outra)", etapa: 1, assumido: true, responsavelUid: "isa", responsavel: "Isabelle" });
  });
}

console.log("\n=== A. As consultas do app (e as contagens do vigia) são permitidas pelas Rules reais");
await seed();
{
  const q = consultasDe(as("ana"), "ana");
  await t("recepcionista: escuta/lê a consulta dos próprios (A)", "ALLOW", () => fs.getDocs(q.proprios));
  await t("recepcionista: lê a fila Recebidos (B)", "ALLOW", () => fs.getDocs(q.fila));
  await t("recepcionista: contagem no servidor dos próprios (vigia)", "ALLOW", () => getCountFromServer(q.proprios));
  await t("recepcionista: contagem no servidor da fila (vigia)", "ALLOW", () => getCountFromServer(q.fila));
  const c = await getCountFromServer(q.fila);
  check("a contagem da fila bate com a leitura (2)", c.data().count === 2);
  await t("admin: contagem da coleção inteira", "ALLOW", () => getCountFromServer(collection(as(ADM), "leads")));
  await t("coordenador: contagem da coleção inteira", "ALLOW", () => getCountFromServer(collection(as(NAY), "leads")));
  await t("sem login: contagem negada pelas Rules", "DENY", () => getCountFromServer(consultasDe(env.unauthenticatedContext().firestore(), "x").fila));
}

console.log("\n=== B. Duas recepcionistas com o CRM aberto: backlog não é chegada; lead novo chega nas duas sozinho");
await seed();
{
  const ana = abrirRecepcionista("ana", "Ana Lara"), isa = abrirRecepcionista("isa", "Isabelle");
  check("carga inicial das duas", await esperar(() => ana.estado.snapshots >= 2 && isa.estado.snapshots >= 2));
  check("Ana vê a fila (antigo1, antigo2) + o lead dela; não vê o lead da Isa", ids(ana.estado) === "antigo1,antigo2,daAna");
  check("Isa vê a fila + o lead dela (que o filtro da etapa não tira da consulta 'próprios')", ids(isa.estado) === "antigo1,antigo2,daIsa");
  check("backlog antigo: NENHUMA chegada e nenhum alarme em nenhuma das duas", ana.estado.chegadas.length === 0 && isa.estado.chegadas.length === 0 && ana.estado.alarme.size === 0 && isa.estado.alarme.size === 0);

  // o admin cadastra (fila, sem responsável) — sem recarregar nada
  const admDb = as(ADM);
  await setDoc(doc(admDb, "leads", "novo1"), { nome: "Novo 1", etapa: 0, assumido: false, responsavelUid: "", cadastradoPor: "Samir", cadastradoPorUid: ADM, createdAt: serverTimestamp() });
  check("o lead novo chega para a Ana e para a Isa AUTOMATICAMENTE", await esperar(() => ids(ana.estado).includes("novo1") && ids(isa.estado).includes("novo1")));
  check("as duas recebem exatamente uma chegada e o alarme fica armado nas duas", ana.estado.chegadas.length === 1 && isa.estado.chegadas.length === 1 && ana.estado.alarme.has("novo1") && isa.estado.alarme.has("novo1"));

  // a Ana assume (mesmos campos do app, pelas Rules reais)
  await t("Ana assume o lead (updateDoc com os campos do app, Rules reais)", "ALLOW", () => updateDoc(doc(ana.db, "leads", "novo1"), { assumido: true, responsavel: "Ana Lara", responsavelUid: "ana", consultora: "Ana Lara", assumidoPor: "Ana Lara", assumidoPorUid: "ana", assumidoEm: serverTimestamp() }));
  check("a Isa vê o lead SAIR da fila dela (sincronizado) e o alarme dela para", await esperar(() => !ids(isa.estado).includes("novo1") && isa.estado.alarme.size === 0));
  check("a Ana vê o lead como dela (assumido), uma única vez na lista, e o alarme dela para", await esperar(() => ana.estado.alarme.size === 0 && ana.estado.leads.filter((l) => l.id === "novo1").length === 1 && ana.estado.leads.find((l) => l.id === "novo1")?.assumido === true));
  check("a Ana NÃO recebeu uma segunda chegada ao passar o lead da fila para 'próprios'", ana.estado.chegadas.length === 1);

  // dois leads em sequência rápida: sem perda e sem duplicata
  await Promise.all(["rap1", "rap2", "rap3"].map((id) => setDoc(doc(admDb, "leads", id), { nome: id, etapa: 0, assumido: false, responsavelUid: "", cadastradoPor: "Samir", cadastradoPorUid: ADM })));
  check("3 leads em rajada: as duas recebem os 3, sem duplicar", await esperar(() => ["rap1", "rap2", "rap3"].every((i) => ids(ana.estado).includes(i) && ids(isa.estado).includes(i))) && ana.estado.chegadas.length === 4 && new Set(ana.estado.leads.map((l) => l.id)).size === ana.estado.leads.length);

  // lead criado pela própria Ana (já assumido por ela): aparece, mas não vira alarme para ela
  await t("Ana cadastra um lead próprio", "ALLOW", () => setDoc(doc(ana.db, "leads", "meu1"), { nome: "Meu 1", etapa: 0, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", cadastradoPor: "Ana Lara", cadastradoPorUid: "ana" }));
  check("o lead dela aparece para ela e NÃO entra no alarme; a Isa nem o vê (não é da fila dela)", await esperar(() => ids(ana.estado).includes("meu1")) && !ana.estado.alarme.has("meu1") && !ids(isa.estado).includes("meu1"));
  ana.fechar(); isa.fechar();
}

console.log("\n=== C. Abrir/atualizar o CRM depois: o backlog continua sem alarme (nada de som ao abrir)");
{
  const ana2 = abrirRecepcionista("ana", "Ana Lara");
  check("nova sessão da Ana carrega tudo", await esperar(() => ana2.estado.snapshots >= 2 && ids(ana2.estado).includes("rap1")));
  check("leads pendentes antigos (rap1..3) estão na tela, mas sem chegada e sem alarme", ana2.estado.chegadas.length === 0 && ana2.estado.alarme.size === 0);
  ana2.fechar();
}

console.log("\n=== D. Reconexão real: derrubar a escuta e confirmar que o lead criado depois chega sem F5");
{
  await seed();
  const ana = abrirRecepcionista("ana", "Ana Lara");
  await esperar(() => ana.estado.snapshots >= 2);
  // rede do Firestore desligada e religada (equivale a queda de conexão do navegador)
  await fs.disableNetwork(ana.db);
  await setDoc(doc(as(ADM), "leads", "durante"), { nome: "Durante a queda", etapa: 0, assumido: false, responsavelUid: "", cadastradoPor: "Samir", cadastradoPorUid: ADM });
  await pausa(300);
  check("com a rede cortada o lead ainda não chegou", !ids(ana.estado).includes("durante"));
  await fs.enableNetwork(ana.db);
  check("rede de volta: o lead aparece sozinho e vira alarme (sem F5)", await esperar(() => ids(ana.estado).includes("durante") && ana.estado.alarme.has("durante")));
  ana.fechar();
}

await env.cleanup();
fim();
