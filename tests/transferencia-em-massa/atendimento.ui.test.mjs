// ATENDIMENTO COMPARTILHADO — interface (jsdom + Vite SSR). O Firebase é substituído por stubs; nada toca produção.
// Verifica o que cada perfil VÊ (a autoridade de segurança são as Firestore Rules, testadas em atendimento.rules.test.mjs).
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO, criarRelatorio } from "./helpers.mjs";

const dom = new JSDOM("<!doctype html><body><div id='r'></div></body>", { url: "http://localhost/" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(REPO + "/package.json");
const React = require("react"); const { createRoot } = require("react-dom/client"); const { act } = React;
const { createServer } = await import(REPO + "/node_modules/vite/dist/node/index.js");
const { check, fim } = criarRelatorio();
const h = React.createElement;

const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-at-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules");
const nomesF = ["Timestamp", "addDoc", "arrayUnion", "collection", "deleteDoc", "deleteField", "doc", "getDoc", "getDocs", "getFirestore", "onSnapshot", "orderBy", "limit", "query", "serverTimestamp", "setDoc", "updateDoc", "where", "writeBatch", "runTransaction"];
writeFileSync(`${mk}/firestore.js`, nomesF.map((n) => `export const ${n} = (...a) => ({ __stub: "${n}", a });`).join("\n") + "\n");
writeFileSync(`${mk}/auth.js`, `export const signOut = async () => {}; export const getAuth = () => ({}); export const onAuthStateChanged = () => () => {};\n`);
writeFileSync(`${mk}/firebase.js`, `export const db = {}; export const auth = {};\n`);
writeFileSync(`${mk}/auth-context.jsx`, `export const useAuth = () => globalThis.__auth;\n`);
// stub nomeado: renderiza um marcador com o nome e as props simples (para conferir o que o pai repassa)
const stubNomeado = (nome) => { const f = `${mk}/stub-${nome}.jsx`; writeFileSync(f, `import React from "react"; export default function S(p){ const simples = Object.fromEntries(Object.entries(p).filter(([,v]) => ["boolean","string","number"].includes(typeof v))); return React.createElement("div", {className:"acao acao-${nome}", "data-props": JSON.stringify(simples)}, "${nome}"); }\n`); return f; };
const ACOES = ["PrimeiroContatoAction", "RespostaAction", "AgendarVisitaAction", "ReagendarVisitaAction", "ComparecimentoAction", "MatriculaAction", "EditarMatriculaAction", "NaoFechamentoAction"];
const MODAL = ["LeadHeader", "LeadOwner", "LeadJourney", "LeadActions", "LeadNotes", "LeadTimeline", "LeadTransfer"];
const alias = {
  "firebase/firestore": `${mk}/firestore.js`, "firebase/auth": `${mk}/auth.js`,
  "../firebase/firebase": `${mk}/firebase.js`, "../../firebase/firebase": `${mk}/firebase.js`,
  "../auth/AuthContext": `${mk}/auth-context.jsx`, "../../auth/AuthContext": `${mk}/auth-context.jsx`,
  "../../../auth/AuthContext": `${mk}/auth-context.jsx`,
  "../../core/EventEngine": `${mk}/stub-EventEngine.jsx`,
};
writeFileSync(`${mk}/stub-EventEngine.jsx`, `export const registrarEvento = async () => ({}); export const atualizarLead = async () => ({});\n`);
for (const n of ACOES) alias[`./actions/${n}`] = stubNomeado(n);
for (const n of MODAL) alias[`./${n}`] = stubNomeado(n);
alias["./actions/ReativarLeadAction"] = stubNomeado("ReativarLeadAction"); alias["./actions/ExcluirLeadAction"] = stubNomeado("ExcluirLeadAction");
alias["./LeadActionModal"] = stubNomeado("LeadActionModal");
const vite = await createServer({ root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, resolve: { alias }, ssr: { noExternal: [] } });

const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function montar(el) { document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r")); await act(async () => { root.render(el); }); await wait(20); return async () => { await act(async () => { root.unmount(); }); document.body.innerHTML = ""; }; }
const body = () => document.body.textContent.replace(/\s+/g, " ");
const tem = (n) => document.body.querySelector(`.acao-${n}`) !== null;
const props = (n) => JSON.parse(document.body.querySelector(`.acao-${n}`)?.getAttribute("data-props") || "{}");
const como = (uid, perfil, nome, extra = {}) => { globalThis.__auth = { usuario: { uid, displayName: nome }, perfilUsuario: { perfil, nome, id: uid, ...extra }, isAdmin: perfil === "admin", isCoordenador: perfil === "coordenador", isRecepcionista: perfil === "recepcionista", permissoes: { transferirLead: perfil !== "recepcionista" } }; };

const { default: LeadActions } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/LeadActions.jsx");
const { default: DetalhesModal } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/LeadDetailsModal.jsx");

console.log("\n=== A. LeadActions — o que a recepcionista vê ao atender lead alheio (modo compartilhado)");
const acoes = (lead, p) => h(LeadActions, { lead, setLead: () => {}, ...p });
const COMP = { podeAgir: false, modoCompartilhado: true };
const LID = (etapa, extra = {}) => ({ id: "L", nome: "x", etapa, responsavelUid: "ana", responsavel: "Ana Lara", ...extra });
{
  let f = await montar(acoes(LID(3), COMP));
  check("etapa VISITA: aparecem Reagendar e Registrar Comparecimento", tem("ReagendarVisitaAction") && tem("ComparecimentoAction"));
  check("etapa VISITA: NÃO aparecem Matrícula, Não Fechamento nem ações de contato/agendamento", !tem("MatriculaAction") && !tem("NaoFechamentoAction") && !tem("PrimeiroContatoAction") && !tem("RespostaAction") && !tem("AgendarVisitaAction") && !tem("EditarMatriculaAction"));
  await f();
  f = await montar(acoes(LID(4), COMP));
  check("etapa NEGOCIAÇÃO: aparecem Confirmar Matrícula (fluxo oficial) e Não Fechamento", tem("MatriculaAction") && tem("NaoFechamentoAction"));
  check("etapa NEGOCIAÇÃO: NÃO aparecem Reagendar/Comparecimento nem EditarMatrícula", !tem("ReagendarVisitaAction") && !tem("ComparecimentoAction") && !tem("EditarMatriculaAction"));
  await f();
  for (const etapa of [0, 1, 2, 5]) {
    f = await montar(acoes(LID(etapa), COMP));
    check(`etapa ${etapa}: nenhuma ação compartilhada (só mensagem; observações ficam em LeadNotes)`, ACOES.every((n) => !tem(n)) && body().includes("Atendimento compartilhado"));
    await f();
  }
  f = await montar(acoes(LID(4, { status: "REATIVACAO" }), COMP)); check("lead em REATIVAÇÃO: nenhuma ação compartilhada", ACOES.every((n) => !tem(n))); await f();
  f = await montar(acoes(LID(4), { podeAgir: false, modoCompartilhado: false })); check("sem modo compartilhado (conta inativa/outro perfil): só 'Modo consulta', nenhuma ação", ACOES.every((n) => !tem(n)) && body().includes("Modo consulta")); await f();
  f = await montar(acoes(LID(4), { podeAgir: true })); check("TITULAR na negociação: Matrícula e Não Fechamento (fluxo normal preservado)", tem("MatriculaAction") && tem("NaoFechamentoAction")); await f();
  f = await montar(acoes(LID(3), { podeAgir: true })); check("TITULAR na visita: Reagendar e Comparecimento preservados", tem("ReagendarVisitaAction") && tem("ComparecimentoAction")); await f();
  f = await montar(acoes(LID(5), { podeAgir: true })); check("TITULAR matriculada: Editar Matrícula preservado (só para quem pode agir)", tem("EditarMatriculaAction")); await f();
}

console.log("\n=== B. LeadDetailsModal — banner e repasse de permissões por perfil");
const detalhes = (lead) => h(DetalhesModal, { lead, onClose: () => {} });
const LEAD_ANA = { id: "L", nome: "x", etapa: 4, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara" };
{
  como("isa", "recepcionista", "Isabelle");
  let f = await montar(detalhes(LEAD_ANA));
  check("recepcionista ATIVA de outra consultora: banner 'Atendimento compartilhado' com o nome da titular", body().includes("Atendimento compartilhado") && body().includes("Ana Lara") && !body().includes("Modo consulta"));
  check("...LeadActions recebe modoCompartilhado=true e podeAgir=false (a propriedade não é dela)", props("LeadActions").modoCompartilhado === true && props("LeadActions").podeAgir === false);
  check("...LeadNotes pode registrar (podeAgir=true)", props("LeadNotes").podeAgir === true);
  check("...Header/Owner/Journey continuam em consulta (podeAgir=false): não edita dados, dono nem jornada", props("LeadHeader").podeAgir === false && props("LeadOwner").podeAgir === false && props("LeadJourney").podeAgir === false);
  check("...sem Reativar, sem Transferir, sem Excluir", !tem("ReativarLeadAction") && !tem("LeadTransfer") && !tem("ExcluirLeadAction"));
  await f();
  como("inat", "recepcionista", "Inativa", { ativo: false });
  f = await montar(detalhes(LEAD_ANA));
  check("recepcionista INATIVA: só 'Modo consulta' (sem modo compartilhado, sem registrar observação)", body().includes("Modo consulta") && !body().includes("Atendimento compartilhado") && props("LeadActions").modoCompartilhado === false && props("LeadNotes").podeAgir === false);
  await f();
  como("ana", "recepcionista", "Ana Lara");
  f = await montar(detalhes(LEAD_ANA));
  check("TITULAR: sem banner de consulta nem de atendimento compartilhado; ações normais", !body().includes("Modo consulta") && !body().includes("Atendimento compartilhado") && props("LeadActions").podeAgir === true && props("LeadActions").modoCompartilhado === false);
  await f();
  como("coord-qualquer", "coordenador", "Coord");
  f = await montar(detalhes(LEAD_ANA));
  check("coordenador/admin (não autorizado a transferir): continua podendo agir; sem Transferir nem Excluir", props("LeadActions").podeAgir === true && !tem("LeadTransfer") && !tem("ExcluirLeadAction"));
  await f();
}

await vite.close();
process.exit(fim() ? 1 : 0);
