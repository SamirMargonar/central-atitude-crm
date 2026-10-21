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
writeFileSync(`${mk}/firestore.js`, nomesF.map((n) => `export const ${n} = (...a) => { (globalThis.__fsCalls ||= []).push("${n}"); return { __stub: "${n}", a }; };`).join("\n") + "\n");
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

console.log("\n=== C. Lead DISPONÍVEL NA FILA (etapa 0, não assumido, sem responsável) — o modal não o trata como de outra consultora");
{
  const FILA = { id: "F", nome: "x", telefone: "000", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "" };
  const MSG_FILA = "Este lead está disponível na fila. Para iniciar o atendimento, utilize o botão Assumir Lead no cartão.";
  const semMensagemDeOutra = () => !body().includes("pertence a") && !body().includes("outra consultora") && !body().includes("Atendimento compartilhado") && !body().includes("Modo consulta —");
  const WRITES = ["updateDoc", "setDoc", "addDoc", "deleteDoc", "writeBatch", "runTransaction", "arrayUnion", "deleteField"];

  // A. recepcionista ATIVA abre lead da fila
  como("isa", "recepcionista", "Isabelle");
  globalThis.__fsCalls = []; let leadObj = JSON.stringify(FILA); let f = await montar(detalhes(FILA));
  check("A. fila + recepcionista ativa: mensagem clara de 'disponível na fila' (usar Assumir Lead no cartão)", body().includes(MSG_FILA), body().slice(0, 200));
  check("A. ...sem afirmar que pertence a outra consultora e sem banner de atendimento compartilhado / modo consulta", semMensagemDeOutra());
  check("A. ...LeadActions: podeAgir=false e modoCompartilhado=false (nenhuma ação de lead alheio)", props("LeadActions").podeAgir === false && props("LeadActions").modoCompartilhado === false);
  check("A. ...LeadNotes não grava (não é lead dela nem compartilhado) e Header/Owner/Journey em consulta", props("LeadNotes").podeAgir === false && props("LeadHeader").podeAgir === false && props("LeadJourney").podeAgir === false);
  check("A. ...sem Transferir, Excluir nem Reativar; o modal não oferece 'assumir' (continua só no cartão)", !tem("LeadTransfer") && !tem("ExcluirLeadAction") && !tem("ReativarLeadAction") && !body().includes("🤝 Assumir"));
  check("A. abrir o modal NÃO grava: nenhuma escrita no Firestore e o lead (titularidade, assumido, etapa) fica idêntico", globalThis.__fsCalls.filter((c) => WRITES.includes(c)).length === 0 && JSON.stringify(FILA) === leadObj && FILA.assumido === false && FILA.responsavelUid === "" && FILA.etapa === 0);
  await f();

  // A'. recepcionista INATIVA também não vê a mensagem enganosa
  como("inat", "recepcionista", "Inativa", { ativo: false });
  f = await montar(detalhes(FILA));
  check("A'. fila + recepcionista INATIVA: mesma mensagem de fila, sem 'modo consulta' de outro responsável", body().includes(MSG_FILA) && semMensagemDeOutra() && props("LeadActions").modoCompartilhado === false);
  await f();

  // B. lead assumido pela própria recepcionista (etapa 0 continua em Recebidos)
  como("isa", "recepcionista", "Isabelle");
  const MEU = { id: "M", nome: "x", etapa: 0, assumido: true, responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" };
  f = await montar(detalhes(MEU));
  check("B. assumido por ela: modo normal (podeAgir) — nem fila, nem compartilhado, nem consulta", props("LeadActions").podeAgir === true && props("LeadActions").modoCompartilhado === false && !body().includes("disponível na fila") && semMensagemDeOutra());
  check("B. ...Header/Notes/Journey liberados para ela", props("LeadHeader").podeAgir === true && props("LeadNotes").podeAgir === true && props("LeadJourney").podeAgir === true);
  await f();
  const MEU_NOME = { id: "M2", nome: "x", etapa: 0, assumido: true, responsavelUid: "", responsavel: "Isabelle", consultora: "Isabelle" };
  f = await montar(detalhes(MEU_NOME));
  check("B'. dona só pelo nome (como as Rules aceitam): modo normal", props("LeadActions").podeAgir === true && !body().includes("disponível na fila"));
  await f();

  // C. lead de OUTRA recepcionista continua em atendimento compartilhado
  const DE_OUTRA = { id: "O", nome: "x", etapa: 0, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara" };
  f = await montar(detalhes(DE_OUTRA));
  check("C. lead de outra recepcionista (etapa 0 assumido): atendimento compartilhado com o nome da titular, sem mensagem de fila", body().includes("Atendimento compartilhado") && body().includes("Ana Lara") && !body().includes("disponível na fila") && props("LeadActions").modoCompartilhado === true && props("LeadActions").podeAgir === false);
  await f();
  const DE_OUTRA_PARCIAL = { id: "O2", nome: "x", etapa: 0, assumido: false, responsavelUid: "ana", responsavel: "", consultora: "" };
  f = await montar(detalhes(DE_OUTRA_PARCIAL));
  check("C'. etapa 0 com responsavelUid de outra pessoa NÃO é 'da fila' (basta um campo de dono): segue compartilhado", props("LeadActions").modoCompartilhado === true && !body().includes("disponível na fila"));
  await f();
  const ETAPA3_SEM_DONO = { id: "E3", nome: "x", etapa: 3, assumido: false, responsavelUid: "", responsavel: "", consultora: "" };
  f = await montar(detalhes(ETAPA3_SEM_DONO));
  check("C''. fila só vale para etapa 0 (etapa 3 sem dono não recebe a mensagem de fila)", !body().includes("disponível na fila"));
  await f();

  // D. administrador e coordenador abrindo o lead da fila: nada muda
  for (const perfil of ["admin", "coordenador"]) {
    como(perfil + "-x", perfil, "Gestor");
    globalThis.__fsCalls = []; f = await montar(detalhes(FILA));
    check(`D. ${perfil}: continua podendo agir (ações normais), sem mensagem de fila nem de compartilhado`, props("LeadActions").podeAgir === true && props("LeadActions").modoCompartilhado === false && !body().includes("disponível na fila") && semMensagemDeOutra());
    check(`D. ${perfil}: Header/Notes/Journey e Reativar preservados; abrir não grava`, props("LeadHeader").podeAgir === true && props("LeadNotes").podeAgir === true && tem("ReativarLeadAction") && globalThis.__fsCalls.filter((c) => WRITES.includes(c)).length === 0);
    await f();
  }

  // E. garantia estática: o modal não tem nenhum caminho de escrita nem importa o Firestore
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(`${REPO}/src/components/LeadDetailsModal/LeadDetailsModal.jsx`, "utf8");
  check("E. LeadDetailsModal.jsx não importa o Firestore nem contém escrita (updateDoc/setDoc/addDoc/deleteDoc/assumir)", !/firebase\/firestore/.test(fonte) && !/\b(updateDoc|setDoc|addDoc|deleteDoc|writeBatch|runTransaction|assumirLead|assumirLeadMobile)\b/.test(fonte));
}

console.log("\n=== D. Cartão e quadro: o fluxo de assumir continua como era (lead assumido permanece em Recebidos)");
{
  const { default: LeadCard } = await vite.ssrLoadModule("/src/components/Lead/LeadCard.jsx");
  const { default: LeadBoard } = await vite.ssrLoadModule("/src/components/Lead/LeadBoard.jsx");
  como("isa", "recepcionista", "Isabelle");
  const FILA = { id: "F", nome: "Cliente Fila", telefone: "000", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "", origem: "x" };
  const ASS = { ...FILA, id: "A", nome: "Cliente Assumido", assumido: true, responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" };
  let assumidos = [];
  let f = await montar(h(LeadCard, { lead: FILA, onAssumir: (id) => assumidos.push(id), onVerHistorico: () => {} }));
  const botoes = () => [...document.querySelectorAll("button")].map((b) => b.textContent.trim());
  check("cartão da fila: mostra 'Assumir Lead'", botoes().some((t) => t.includes("Assumir Lead")));
  await act(async () => { [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Assumir Lead")).click(); }); await wait();
  check("clicar em 'Assumir Lead' chama onAssumir com o id do lead (fluxo do cartão intacto)", assumidos.join() === "F");
  await f();
  f = await montar(h(LeadCard, { lead: ASS, onAssumir: (id) => assumidos.push(id), onVerHistorico: () => {} }));
  check("cartão do lead assumido: 'Registrar Primeiro Contato' e SEM 'Assumir Lead'", botoes().some((t) => t.includes("Registrar Primeiro Contato")) && !botoes().some((t) => t.includes("Assumir Lead")));
  await f();
  f = await montar(h(LeadBoard, { leads: [FILA, ASS], onAssumir: () => {}, onVerHistorico: () => {} }));
  check("quadro: lead assumido com etapa 0 PERMANECE em Recebidos (comportamento preservado)", /Recebidos\s*\(2\)/.test(body()), body().slice(0, 120));
  await f();
}

await vite.close();
process.exit(fim() ? 1 : 0);
