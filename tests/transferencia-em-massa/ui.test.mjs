// ETAPA 3 — Interface (jsdom + Vite SSR): tela, Sidebar e bloco de transferência individual.
// O Firebase é substituído por stubs; o serviço é um dublê injetado na tela.
// Não mede layout (jsdom não calcula CSS): a responsividade é conferida na regra @media.
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO, ADM, NAY, criarRelatorio } from "./helpers.mjs";

const dom = new JSDOM("<!doctype html><body><div id='r'></div></body>", { url: "http://localhost/" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(REPO + "/package.json");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { createServer } = await import(REPO + "/node_modules/vite/dist/node/index.js");
const { act } = React;
const { check, fim } = criarRelatorio();

// ---------- stubs ----------
const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules"); // stubs resolvem react do projeto
const nomes = ["Timestamp", "addDoc", "arrayUnion", "collection", "deleteDoc", "deleteField", "doc", "getDoc", "getDocs", "getFirestore", "onSnapshot", "orderBy", "limit", "query", "serverTimestamp", "setDoc", "updateDoc", "where", "runTransaction"];
writeFileSync(`${mk}/firestore.js`, nomes.map((n) => `export const ${n} = (...a) => ({ __stub: "${n}", a });`).join("\n") + "\n");
writeFileSync(`${mk}/auth.js`, `export const signOut = async () => {}; export const getAuth = () => ({}); export const onAuthStateChanged = () => () => {};\n`);
writeFileSync(`${mk}/firebase.js`, `export const db = {}; export const auth = {};\n`);
writeFileSync(`${mk}/auth-context.jsx`, `export const useAuth = () => globalThis.__auth;\n`);
writeFileSync(`${mk}/stub.jsx`, `import React from "react"; export default function Stub(){ return React.createElement("i", {className:"stub"}); }\n`);
writeFileSync(`${mk}/excluir-stub.jsx`, `import React from "react"; export default function E(){ return React.createElement("div", {className:"excluirLeadAcao"}, "EXCLUIR_LEAD"); }\n`);
writeFileSync(`${mk}/transfer-stub.jsx`, `import React from "react"; export default function T(){ return React.createElement("div", {className:"transferenciaIndividual"}, "TRANSFERIR_INDIVIDUAL"); }\n`);
const stubs = ["./LeadHeader", "./LeadOwner", "./LeadJourney", "./LeadActions", "./LeadNotes", "./LeadTimeline", "./actions/ReativarLeadAction", "./ConsultaLeadModal", "./LeadModal"];
const alias = {
  "firebase/firestore": `${mk}/firestore.js`, "firebase/auth": `${mk}/auth.js`,
  "../firebase/firebase": `${mk}/firebase.js`, "../../firebase/firebase": `${mk}/firebase.js`,
  "../auth/AuthContext": `${mk}/auth-context.jsx`, "../../auth/AuthContext": `${mk}/auth-context.jsx`,
  "./LeadTransfer": `${mk}/transfer-stub.jsx`,
  "./actions/ExcluirLeadAction": `${mk}/excluir-stub.jsx`,
  ...Object.fromEntries(stubs.map((s) => [s, `${mk}/stub.jsx`])),
};
const vite = await createServer({
  root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } },
  resolve: { alias }, ssr: { noExternal: [] },
});

// ---------- utilitários de DOM ----------
const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function ate(cond, ms = 2000) { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timeout aguardando condição"); await wait(); } }
const body = () => document.body.textContent.replace(/\s+/g, " ");
const botao = (texto) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(texto));
const clicar = async (texto) => { const b = botao(texto); if (!b) throw new Error("botão não encontrado: " + texto); await act(async () => { b.click(); }); await wait(); };
function setar(el, valor) {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
  el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
const mudar = async (el, v) => { await act(async () => { setar(el, v); }); await wait(); };
const selects = () => [...document.body.querySelectorAll(".tmeModal select")];
const opcoes = (sel) => [...sel.options].map((o) => o.textContent);
async function montar(elemento) {
  document.body.innerHTML = "<div id='r'></div>";
  const root = createRoot(document.getElementById("r"));
  await act(async () => { root.render(elemento); });
  await wait(30);
  return async () => { await act(async () => { root.unmount(); }); document.body.innerHTML = ""; };
}
const como = (uid, perfil, nome = "X") => { globalThis.__auth = { usuario: { uid }, perfilUsuario: { perfil, nome, id: uid }, isAdmin: perfil === "admin", isCoordenador: perfil === "coordenador", isRecepcionista: perfil === "recepcionista", permissoes: { transferirLead: perfil !== "recepcionista", acessarRelatorios: true, acessarUsuarios: true, configuracoesEstruturais: perfil === "admin" } }; };

const { default: Modal } = await vite.ssrLoadModule("/src/components/TransferenciaEmMassa/TransferenciaEmMassaModal.jsx");
const { default: Sidebar } = await vite.ssrLoadModule("/src/components/Sidebar.jsx");
const { default: DetalhesModal } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/LeadDetailsModal.jsx");
const h = React.createElement;

// ---------- dublê do serviço ----------
const USERS = [
  { id: "isa", nome: "Isadora", email: "isa@x.com", ativo: false, perfil: "recepcionista" },
  { id: "lari", nome: "Larissa", email: "lari@x.com", ativo: true, perfil: "recepcionista" },
  { id: "outra", nome: "Outra", email: "outra@x.com", ativo: true, perfil: "recepcionista" },
];
const lead = (id, etapa, extra = {}) => ({ id, nome: `Cliente ${id}`, etapa, visitasResumo: { atualizar: 0, realizadas: 0, analise: 0 }, ...extra });
const PREVIA = ({ origem, destino }) => ({
  origem, destino, hoje: "2026-10-10",
  elegiveis: [lead("L1", 3, { visitasResumo: { atualizar: 2, realizadas: 1, analise: 0 } }), lead("L2", 2), lead("L3", 4)],
  gerenciais: [lead("G1", 3, { cadastroGerencial: true })],
  analise: [{ lead: lead("A1", 0), motivo: "ETAPA_0_NAO_ASSUMIDO" }, { lead: lead("A2", 2), motivo: "NOMES_DIVERGENTES" }],
  resumoPorEtapa: { 2: 1, 3: 1, 4: 1 },
  visitas: { atualizar: 2, realizadas: 1, analise: 0 },
});
function fake({ resultados = [], historico = [], falhaPrevia = false, executarImpl, divergencia = null } = {}) {
  const chamadas = [];
  return {
    chamadas,
    carregarUsuarios: async () => ({ origens: USERS, destinos: USERS.filter((u) => u.ativo) }),
    montarPrevia: async (x) => { chamadas.push(["montarPrevia", x]); if (falhaPrevia) throw new Error("permission-denied"); return PREVIA(x); },
    iniciarOperacao: async (x) => { chamadas.push(["iniciar", x]); return "op-1"; },
    executarOperacao: async (x) => { chamadas.push(["executar", x.opId]); x.aoProgredir?.({ concluidos: 1, total: 3 }); if (executarImpl) return executarImpl(x); return resultados.shift(); },
    encerrarComPendencias: async (x) => { chamadas.push(["encerrar", x.opId]); return {}; },
    iniciarReversao: async (x) => { chamadas.push(["reverter", x.opIdOriginal]); return `rev-${x.opIdOriginal}`; },
    listarOperacoes: async () => historico,
    carregarRelatorio: async () => ({ operacao: { origemNome: "Isadora", destinoNome: "Larissa", status: "concluida", totalPrevisto: 3 }, itens: [{ id: "L1", visitasAtualizadas: [] }], pendentes: [], divergencia }),
  };
}
const aberta = (servico) => h(Modal, { aberto: true, fechar: () => {}, servico });
async function ateAPrevia() {
  const [selOrigem, selDestino] = selects();
  await mudar(selOrigem, "isa"); await mudar(selDestino, "lari");
  await mudar(document.body.querySelector(".tmeModal textarea"), "Saída da consultora");
  await clicar("Buscar leads"); await ate(() => body().includes("elegíveis"));
}

// =============================================================
console.log("\n=== A. QUEM VÊ A TELA");
for (const [rotulo, uid, perfil] of [
  ["coordenador NÃO autorizado", "uid-coord-qualquer", "coordenador"],
  ["outro administrador", "uid-admin-qualquer", "admin"],
  ["recepcionista", "uid-recep", "recepcionista"],
  ["UID autorizado mas com perfil de recepcionista (perfil rebaixado)", NAY, "recepcionista"],
  ["sem usuário carregado", undefined, undefined],
]) {
  como(uid, perfil);
  const fechar = await montar(aberta(fake()));
  check(`${rotulo}: a tela NÃO renderiza nada`, document.body.querySelector(".tmeOverlay") === null);
  await fechar();
}
for (const [rotulo, uid, perfil] of [["Samir (admin)", ADM, "admin"], ["Naykison (coordenador)", NAY, "coordenador"]]) {
  como(uid, perfil, rotulo);
  const fechar = await montar(aberta(fake()));
  check(`${rotulo}: a tela renderiza`, !!document.body.querySelector(".tmeOverlay") && body().includes("Transferência em Massa de Leads"));
  await fechar();
}
como(NAY, "coordenador", "Naykison");
{
  const fechar = await montar(h(Modal, { aberto: false, fechar: () => {}, servico: fake() }));
  check("aberto=false: nada renderizado", document.body.querySelector(".tmeOverlay") === null);
  await fechar();
}

console.log("\n=== B. SELEÇÃO DE ORIGEM E DESTINO");
{
  const s = fake(); const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  const [selOrigem, selDestino] = selects();
  check("origem lista ativas E inativas, com e-mail", opcoes(selOrigem).some((o) => o.includes("Isadora (inativa)") && o.includes("isa@x.com")) && opcoes(selOrigem).some((o) => o.includes("Larissa")));
  check("destino lista SÓ recepcionistas ativas", !opcoes(selDestino).some((o) => o.includes("Isadora")) && opcoes(selDestino).some((o) => o.includes("Larissa")));
  await mudar(selOrigem, "lari");
  check("a origem escolhida some da lista de destino", !opcoes(selects()[1]).some((o) => o.includes("Larissa")));
  await mudar(selects()[1], "outra"); await mudar(selects()[0], "outra");
  check("trocar a origem para o destino já escolhido limpa o destino (nunca origem == destino)", selects()[1].value === "");
  await mudar(selects()[0], "isa");
  await clicar("Buscar leads");
  check("sem destino: erro e NENHUMA consulta ao serviço", body().includes("Escolha a consultora de origem e a de destino") && s.chamadas.length === 0);
  await mudar(selects()[1], "lari");
  await clicar("Buscar leads");
  check("sem motivo: erro e NENHUMA consulta ao serviço", body().includes("Informe o motivo") && s.chamadas.length === 0);
  await fechar();
}

console.log("\n=== C. PRÉVIA E CONFIRMAÇÃO");
{
  const s = fake({ resultados: [{ opId: "op-1", estado: "concluida", totalPrevisto: 3, totalConcluido: 3, pendentes: [], visitasTardias: [] }] });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await ateAPrevia(s);
  check("mostra contagens (3 elegíveis, 1 gerencial, 2 para análise)", /3\s*elegíveis/.test(body()) && /1\s*gerenciais/.test(body()) && /2\s*para análise/.test(body()));
  check("resumo por etapa lista Resposta, Visita e Negociação", ["Resposta", "Visita", "Negociação"].every((n) => body().includes(n)));
  const caixas = [...document.body.querySelectorAll(".tmeLista input[type=checkbox]")];
  check("elegíveis vêm marcados; gerencial vem DESMARCADO", caixas.slice(0, 3).every((c) => c.checked) && caixas[3].checked === false);
  check("leads em análise listados SEM caixa de seleção e com o motivo", body().includes("Para análise") && body().includes("Etapa 0 ainda não assumido") && body().includes("Nome do responsável diverge") && caixas.length === 4);
  check("visitas: a atualizar, realizadas e em análise informadas", /2\s*visitas a atualizar/.test(body()) && /1\s*visitas realizadas/.test(body()));
  const confirmar = () => botao("Confirmar e transferir");
  check("botão de executar DESABILITADO antes da confirmação explícita", confirmar().disabled === true);
  await clicar("Confirmar e transferir");
  check("clicar no botão desabilitado não inicia nada", s.chamadas.every((c) => c[0] === "montarPrevia"));
  await act(async () => { document.body.querySelector(".tmeConfirmacao input").click(); }); await wait();
  check("após confirmar, botão habilitado e mostra a quantidade (3)", confirmar().disabled === false && confirmar().textContent.includes("3"));
  await act(async () => { caixas[3].click(); }); await wait();
  check("marcar o gerencial exige NOVA confirmação (a caixa é limpa)", document.body.querySelector(".tmeConfirmacao input").checked === false && confirmar().disabled === true);
  await act(async () => { caixas[3].click(); }); await wait();
  await act(async () => { document.body.querySelector(".tmeConfirmacao input").click(); }); await wait();
  await clicar("Confirmar e transferir");
  await ate(() => body().includes("Operação concluída"));
  const ini = s.chamadas.find((c) => c[0] === "iniciar")[1];
  check("serviço recebe SÓ os 3 elegíveis marcados (nem gerenciais, nem análise)", JSON.stringify(ini.leadIds.sort()) === JSON.stringify(["L1", "L2", "L3"]) && ini.motivo === "Saída da consultora" && ini.executor.uid === NAY);
  check("concluída sem pendências: mensagem de sucesso só aqui", body().includes("3 de 3") && body().includes("sem pendências"));
  await fechar();
}
{
  const s = fake({ falhaPrevia: true }); como(ADM, "admin", "Samir");
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  const [a, b] = selects(); await mudar(a, "isa"); await mudar(b, "lari"); await mudar(document.body.querySelector(".tmeModal textarea"), "x");
  await clicar("Buscar leads"); await ate(() => body().includes("Não foi possível montar a prévia"));
  check("erro ao montar a prévia aparece em alerta e não avança", !!document.body.querySelector("[role=alert]") && !body().includes("elegíveis"));
  await fechar();
}

console.log("\n=== D. FALHA PARCIAL, INTERRUPÇÃO, RETOMADA E ENCERRAMENTO (nunca declarar sucesso indevido)");
como(NAY, "coordenador", "Naykison");
{
  const pend = [{ leadId: "L2", resultado: "FALHA", detalhe: "unavailable" }, { leadId: "L3", resultado: "PULADO_DONO_MUDOU", detalhe: "dono atual: outra" }];
  const s = fake({ resultados: [
    { opId: "op-1", estado: "pendencias", totalPrevisto: 3, totalConcluido: 1, pendentes: pend },
    { opId: "op-1", estado: "concluida", totalPrevisto: 3, totalConcluido: 3, pendentes: [], visitasTardias: [] },
  ] });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await ateAPrevia(s);
  await act(async () => { document.body.querySelector(".tmeConfirmacao input").click(); }); await wait();
  await clicar("Confirmar e transferir"); await ate(() => body().includes("NÃO concluída"));
  check("falha parcial: banner 'NÃO concluída' com 1 de 3 e 2 pendências", body().includes("1 de 3") && body().includes("2 pendente(s)"));
  check("NÃO aparece mensagem de sucesso", !body().includes("Operação concluída") && !body().includes("sem pendências"));
  check("cada pendência explica o motivo (falha / responsável mudou)", body().includes("Falha") && body().includes("Responsável mudou depois da prévia"));
  check("oferece 'Tentar novamente' e 'Encerrar com pendências'", !!botao("Tentar novamente") && !!botao("Encerrar com pendências"));
  await clicar("Tentar novamente"); await ate(() => body().includes("Operação concluída"));
  check("tentar de novo reexecuta a MESMA operação (op-1), sem abrir outra, e só então conclui", s.chamadas.filter((c) => c[0] === "executar").map((c) => c[1]).join() === "op-1,op-1" && s.chamadas.filter((c) => c[0] === "iniciar").length === 1);
  await fechar();
}
{
  const pend = [{ leadId: "L3", resultado: "PULADO_DONO_MUDOU", detalhe: "" }];
  const s = fake({ resultados: [{ opId: "op-1", estado: "pendencias", totalPrevisto: 3, totalConcluido: 2, pendentes: pend }] });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await ateAPrevia(s);
  await act(async () => { document.body.querySelector(".tmeConfirmacao input").click(); }); await wait();
  await clicar("Confirmar e transferir"); await ate(() => body().includes("NÃO concluída"));
  await clicar("Encerrar com pendências");
  check("encerrar pede confirmação e avisa que não poderá mais retomar", body().includes("não poderá mais ser retomada") && !s.chamadas.some((c) => c[0] === "encerrar"));
  const confirmar = [...document.body.querySelectorAll(".tmeBanner button")].find((b) => b.textContent.includes("Encerrar com pendências"));
  await act(async () => { confirmar.click(); }); await wait(20);
  check("após confirmar, registra o encerramento e mostra 'COM PENDÊNCIAS' (nunca 'concluída')", s.chamadas.some((c) => c[0] === "encerrar") && body().includes("COM PENDÊNCIAS") && !body().includes("Operação concluída"));
  await fechar();
}
{
  const s = fake({ executarImpl: async (x) => { await ate(() => x.deveParar()); return { opId: "op-1", estado: "interrompida", totalPrevisto: 3, totalConcluido: 1, pendentes: [{ leadId: "L2", resultado: "NAO_PROCESSADO", detalhe: "" }] }; } });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await ateAPrevia(s);
  await act(async () => { document.body.querySelector(".tmeConfirmacao input").click(); }); await wait();
  botao("Confirmar e transferir").click(); await ate(() => !!botao("Parar"));
  check("durante a execução: barra de progresso, contagem e botão Parar", !!document.body.querySelector("[role=progressbar]") && body().includes("1 de 3"));
  botao("Parar").click(); await ate(() => body().includes("NÃO concluída"));
  check("Parar → estado 'interrompida', oferece Retomar e NÃO declara sucesso", body().includes("Você interrompeu a execução") && !!botao("Retomar") && !body().includes("Operação concluída"));
  await fechar();
}

console.log("\n=== E. HISTÓRICO, RETOMADA E REVERSÃO (M2: uma reversão por operação)");
{
  const op = (id, extra) => ({ id, tipo: "transferencia", status: "concluida", origemNome: "Isadora", destinoNome: "Larissa", executadoPorNome: "Naykison", totalPrevisto: 3, totalConcluido: 3, ...extra });
  const hist = [
    op("f1", {}),                                                                                                  // nunca revertida
    op("a1", { status: "em_andamento", totalConcluido: 2, origemNome: "Anna", destinoNome: "Outra" }),
    op("r9", { tipo: "reversao", reverteOpId: "f2", origemNome: "Larissa", destinoNome: "Isadora" }),            // reversão concluída de f2
    op("f2", { origemNome: "Isabelle", destinoNome: "Lais" }),                                                    // JÁ revertida (r9)
    op("p1", { status: "concluida_com_pendencias", totalConcluido: 0, origemNome: "Anna", destinoNome: "Bia" }),  // sem nenhum lead movido
    op("f3", { origemNome: "Carla", destinoNome: "Dani" }),                                                       // reversão em andamento
    op("rev-f3", { tipo: "reversao", reverteOpId: "f3", status: "em_andamento", origemNome: "Dani", destinoNome: "Carla" }),
    op("f4", { origemNome: "Edu", destinoNome: "Fabi" }),                                                         // revertida COM pendências
    op("rev-f4", { tipo: "reversao", reverteOpId: "f4", status: "concluida_com_pendencias", origemNome: "Fabi", destinoNome: "Edu" }),
  ];
  const s = fake({ historico: hist, resultados: [{ opId: "rev-f1", estado: "concluida", totalPrevisto: 3, totalConcluido: 3, pendentes: [], visitasTardias: [], visitasParaAnalise: [{ leadId: "L1", id: "vNova", data: "2026-10-25", hora: "15:00", status: "AGENDADA" }] }] });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await clicar("Histórico e reversão"); await ate(() => body().includes("Isadora → Larissa"));
  const linha = (id) => [...document.body.querySelectorAll(".tmeHistorico li")][hist.findIndex((o) => o.id === id)];
  const tem = (id, texto) => [...linha(id).querySelectorAll("button")].some((b) => b.textContent.includes(texto));
  check("transferência concluída e ainda NÃO revertida: tem 'Reverter'", tem("f1", "Reverter"));
  check("em andamento: tem 'Retomar' e NÃO tem 'Reverter'", tem("a1", "Retomar") && !tem("a1", "Reverter"));
  check("uma reversão não pode ser revertida", !tem("r9", "Reverter"));
  check("operação sem nenhum lead transferido não oferece reversão", !tem("p1", "Reverter"));
  check("M2: operação JÁ REVERTIDA não oferece 'Reverter' e mostra 'Revertida'", !tem("f2", "Reverter") && linha("f2").textContent.includes("Revertida"));
  check("M2: reversão em andamento: sem 'Reverter' e com aviso para retomar", !tem("f3", "Reverter") && linha("f3").textContent.includes("Reversão em andamento"));
  check("M2: revertida com pendências também não oferece nova reversão", !tem("f4", "Reverter") && linha("f4").textContent.includes("Revertida com pendências"));
  check("status exibido em português ('Em andamento / pendente', 'Encerrada com pendências')", body().includes("Em andamento / pendente") && body().includes("Encerrada com pendências"));
  await act(async () => { [...linha("f1").querySelectorAll("button")].find((b) => b.textContent.includes("Reverter")).click(); }); await wait();
  check("reverter pede confirmação antes de qualquer gravação", body().includes("Devolver os leads para Isadora?") && !s.chamadas.some((c) => c[0] === "reverter"));
  await act(async () => { [...linha("f1").querySelectorAll("button")].find((b) => b.textContent.includes("Confirmar reversão")).click(); }); await ate(() => body().includes("Operação concluída"));
  check("confirmar reversão abre a reversão da operação certa e a executa", s.chamadas.some((c) => c[0] === "reverter" && c[1] === "f1") && s.chamadas.some((c) => c[0] === "executar" && c[1] === "rev-f1"));
  check("M1: visitas posteriores à transferência aparecem para ANÁLISE MANUAL, sem declarar que foram alteradas", body().includes("Visitas para análise manual (1)") && body().includes("vNova") && body().includes("Nada foi alterado nelas"));
  check("M1: data/hora da visita em análise no padrão brasileiro (25/10/2026 15:00, não 2026-10-25)", body().includes("25/10/2026 15:00") && !body().includes("2026-10-25"));
  await fechar();
}
{
  const pend = [
    { leadId: "L2", resultado: "PULADO_ALTERADO_APOS", detalhe: "o lead foi alterado depois da transferência" },
    { leadId: "L3", resultado: "PULADO_ETAPA_MUDOU", detalhe: "etapa 2 → 4" },
    { leadId: "L4", resultado: "PULADO_EVENTOS_APOS", detalhe: "" },
    { leadId: "L5", resultado: "PULADO_OUTRA_TRANSFERENCIA", detalhe: "" },
  ];
  const hist = [{ id: "f1", tipo: "transferencia", status: "concluida", origemNome: "Isadora", destinoNome: "Larissa", executadoPorNome: "N", totalPrevisto: 6, totalConcluido: 6 }];
  const s = fake({ historico: hist, resultados: [{ opId: "rev-f1", estado: "pendencias", totalPrevisto: 6, totalConcluido: 2, pendentes: pend, visitasTardias: [], visitasParaAnalise: [] }] });
  const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
  await clicar("Histórico e reversão"); await ate(() => body().includes("Isadora → Larissa"));
  await clicar("Reverter"); await clicar("Confirmar reversão"); await ate(() => body().includes("NÃO concluída"));
  check("M2: leads trabalhados depois da transferência ficam como PENDÊNCIA com o motivo, sem sucesso", body().includes("Avançou no funil") && body().includes("Foi alterado depois") && body().includes("há eventos novos") && body().includes("Movido por outra operação") && !body().includes("Operação concluída"));
  check("M2: o motivo detalhado (etapa 2 → 4) é mostrado", body().includes("etapa 2 → 4"));
  await fechar();
}

console.log("\n=== E2. B3 — divergência entre o que a operação declara e os itens de auditoria");
{
  const hist = [{ id: "f1", tipo: "transferencia", status: "concluida", origemNome: "Isadora", destinoNome: "Larissa", executadoPorNome: "N", totalPrevisto: 3, totalConcluido: 3 }];
  for (const [rotulo, divergencia, esperado] of [["com divergência", { declarado: 3, gravado: 1, previsto: 3 }, true], ["sem divergência", null, false]]) {
    const s = fake({ historico: hist, divergencia });
    const fechar = await montar(aberta(s)); await ate(() => selects()[0]?.options.length > 1);
    await clicar("Histórico e reversão"); await ate(() => body().includes("Isadora → Larissa"));
    await clicar("Relatório"); await ate(() => body().includes("Relatório da operação"));
    check(`relatório ${rotulo}: ${esperado ? "alerta com declarado 3, itens gravados 1 e a regra 'vale a contagem dos itens'" : "nenhum alerta de divergência"}`, esperado ? (body().includes("Divergência") && body().includes("declara 3") && body().includes("1 item(ns) de auditoria") && body().includes("Vale a contagem dos itens")) : !body().includes("Divergência"));
    await fechar();
  }
}

console.log("\n=== F. SIDEBAR e TRANSFERÊNCIA INDIVIDUAL");
const sidebar = () => h(Sidebar, { pagina: "dashboard", setPagina: () => {} });
for (const [rotulo, uid, perfil, esperado] of [
  ["Samir (admin)", ADM, "admin", true], ["Naykison (coordenador)", NAY, "coordenador", true],
  ["outro coordenador", "uid-coord-qualquer", "coordenador", false], ["outro administrador", "uid-admin-qualquer", "admin", false],
  ["recepcionista", "uid-recep", "recepcionista", false],
]) {
  como(uid, perfil, rotulo);
  const fechar = await montar(sidebar());
  check(`Sidebar — ${rotulo}: botão de transferência em massa ${esperado ? "VISÍVEL" : "ausente"}`, body().includes("Transferência em Massa de Leads") === esperado);
  await fechar();
}
{
  como(ADM, "admin", "Samir");
  const fechar = await montar(sidebar());
  check("Sidebar: botões existentes (Consultar Lead / Cadastro Gerencial) continuam como antes para o admin", body().includes("Cadastro Gerencial de Leads") && !body().includes("Consultar Lead"));
  await fechar();
  como(NAY, "coordenador", "Naykison");
  const f2 = await montar(sidebar());
  check("Sidebar: coordenador autorizado também mantém Consultar Lead e Cadastro Gerencial", body().includes("Consultar Lead") && body().includes("Cadastro Gerencial de Leads"));
  await f2();
}
const detalhes = () => h(DetalhesModal, { lead: { id: "L1", nome: "x", responsavelUid: "isa", consultora: "Isadora" }, onClose: () => {} });
for (const [rotulo, uid, perfil, esperado] of [
  ["Samir", ADM, "admin", true], ["Naykison", NAY, "coordenador", true],
  ["outro coordenador", "uid-coord-qualquer", "coordenador", false], ["outro administrador", "uid-admin-qualquer", "admin", false],
]) {
  como(uid, perfil, rotulo);
  const fechar = await montar(detalhes());
  check(`Transferência individual — ${rotulo}: ${esperado ? "VISÍVEL" : "oculta"}`, (document.body.querySelector(".transferenciaIndividual") !== null) === esperado);
  await fechar();
}
{
  como("uid-recep", "recepcionista", "Isadora");
  const fechar = await montar(detalhes());
  check("Transferência individual — recepcionista dona do lead: oculta", document.body.querySelector(".transferenciaIndividual") === null);
  await fechar();
}
for (const [rotulo, uid, perfil, esperado] of [
  ["Samir", ADM, "admin", true], ["Naykison", NAY, "coordenador", true],
  ["outro coordenador", "uid-coord-qualquer", "coordenador", false], ["outro administrador", "uid-admin-qualquer", "admin", false],
]) {
  como(uid, perfil, rotulo);
  const fechar = await montar(detalhes());
  check(`A1 — Excluir lead — ${rotulo}: ${esperado ? "VISÍVEL" : "oculto (as Rules negam a exclusão)"}`, (document.body.querySelector(".excluirLeadAcao") !== null) === esperado);
  await fechar();
}

console.log("\n=== G. RESPONSIVIDADE (regras de CSS) e MOBILE INTACTO");
const css = readFileSync(`${REPO}/src/components/TransferenciaEmMassa/transferenciaEmMassa.css`, "utf8");
check("CSS tem regra @media para telas estreitas", /@media\s*\(max-width:\s*700px\)/.test(css));
check("em tela estreita: grade vira 1 coluna, modal ocupa a tela e botões empilham", /\.tmeGrade\{\s*grid-template-columns:1fr/.test(css) && /\.tmeModal\{[^}]*width:100%/.test(css) && /\.tmeBotoes\{\s*flex-direction:column-reverse/.test(css));
check("o CSS novo não mexe em nenhuma classe global (todas com prefixo tme)", [...css.matchAll(/^\s*\.([A-Za-z0-9_-]+)/gm)].every((m) => m[1].startsWith("tme")));
import { execSync } from "node:child_process";
const tocados = execSync("git status --porcelain", { cwd: REPO }).toString().split("\n").filter(Boolean).map((l) => l.slice(3));
// Autorizado (busca global + datas, 14/10/2026): só estes 3 arquivos mobile podem mudar.
const MOBILE_AUTORIZADOS = ["src/mobile/screens/LeadsScreen.jsx", "src/mobile/screens/LeadDetailsScreen.jsx", "src/mobile/components/LeadTimelineMobile.jsx"];
check("nenhum arquivo de src/mobile foi alterado além dos 3 autorizados (busca global e datas)", !tocados.some((f) => f.startsWith("src/mobile") && !MOBILE_AUTORIZADOS.includes(f)));

await vite.close();
const f = fim();
process.exit(f ? 1 : 0);
