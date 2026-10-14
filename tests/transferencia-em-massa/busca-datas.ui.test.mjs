// BUSCA GLOBAL (desktop + mobile) e DATAS NA INTERFACE — jsdom + Vite SSR.
// Firebase substituído por stubs; nada toca produção.
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

const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-busca-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules");
const W = (n, c) => { writeFileSync(`${mk}/${n}`, c); return `${mk}/${n}`; };

// firestore: onSnapshot entrega os eventos de globalThis.__eventos; getDoc lê globalThis.__docs
const fsStub = W("firestore.js", `
const ts = (iso) => ({ toDate: () => new Date(iso) });
export const collection = (...a) => ({ a }); export const query = (...a) => ({ a }); export const orderBy = (...a) => ({ a });
export const doc = (_db, c, id) => ({ c, id });
export const onSnapshot = (_q, cb) => { cb({ docs: (globalThis.__eventos || []).map((e, i) => ({ id: "e" + i, data: () => ({ ...e, criadoEm: e.criadoEm ? ts(e.criadoEm) : undefined }) })) }); return () => {}; };
export const getDoc = async (ref) => { globalThis.__getDocChamadas = (globalThis.__getDocChamadas || 0) + 1; const d = (globalThis.__docs || {})[ref.id]; return { id: ref.id, exists: () => !!d, data: () => d }; };
export const getDocs = async () => ({ docs: [] });
export const where = (...a) => ({ a }); export const limit = (...a) => ({ a }); export const updateDoc = async () => {}; export const serverTimestamp = () => ({}); export const Timestamp = { now: () => ts("2026-10-14T18:00:00Z") };
`);
const fbStub = W("firebase.js", `export const db = {}; export const auth = {};\n`);
const authCtx = W("auth-context.jsx", `export const useAuth = () => globalThis.__auth;\n`);
const sessaoStub = W("sessao.js", `export const cacheBuscaLeadsSessao = { carregar: (u) => globalThis.__cache.carregar(u), buscar: (t) => globalThis.__cache.buscar(t), recarregar: (u) => globalThis.__cache.recarregar(u), estaCarregado: () => globalThis.__cache.estaCarregado(), aplicarLead: () => {} };\n`);
const aoVivo = W("ao-vivo.js", `export default function useLeadAoVivo(id) { return id ? (globalThis.__aoVivo || {})[id] || null : null; }\n`);
const stub = (nome, corpo) => W(`stub-${nome}.jsx`, `import React from "react"; ${corpo}`);
const modalStub = stub("Modal", `export default function S(p){ globalThis.__modalLead = p.lead; globalThis.__modalOnClose = p.onClose; return React.createElement("div", {className:"modal-stub"}, p.lead ? "MODAL:" + p.lead.id : ""); }`);
const boardStub = stub("Board", `export default function S(p){ return React.createElement("div", {className:"board-stub"}, "BOARD:" + p.leads.map(l => l.id).join(",")); }`);
const nadaStub = stub("Nada", `export default function S(){ return null; }`);
const visitaEngine = W("visita-engine.js", `export const buscarVisitasPorPerfil = async () => []; export const buscarVisitasDosLeadsDaTitular = async () => [];\n`);
const pontuais = W("pontuais.js", `export default function useLeadsPontuais(){ return {}; }\n`);
const useLeadsStub = W("use-leads.js", `export default function useLeads(){ return { leads: globalThis.__leadsLocais || [] }; }\n`);
const cardMobile = stub("CardMobile", `export default function S(p){ return React.createElement("button", {className:"card-mobile", onClick: p.onClick}, "CARD:" + p.lead.id); }`);
const detalheMobile = stub("DetalheMobile", `export default function S(p){ globalThis.__mobileLead = p.lead; return React.createElement("div", {className:"detalhe-mobile"}, "DETALHE:" + p.lead.id); }`);
const nada = (n) => stub(n, `export default function S(){ return null; }`);

const alias = {
  "firebase/firestore": fsStub,
  "../firebase/firebase": fbStub, "../../firebase/firebase": fbStub, "../../firebase/firebase.js": fbStub,
  "../auth/AuthContext": authCtx, "../../auth/AuthContext": authCtx, "../../auth/AuthContext.jsx": authCtx,
  "../services/buscaLeadsSessao": sessaoStub,
  "../hooks/useLeadAoVivo": aoVivo,
  "./LeadDetailsModal/LeadDetailsModal": modalStub, "./Lead/LeadBoard": boardStub, "./WhatsAppLivreModal": nadaStub,
  "../Agenda/VisitaEngine": visitaEngine, "../hooks/useLeadsPontuais": pontuais,
  "../../hooks/useLeads.js": useLeadsStub, "../components/LeadCardMobile.jsx": cardMobile, "./LeadDetailsScreen.jsx": detalheMobile,
  // detalhes do lead (mobile)
  "../components/LeadActionsMobile.jsx": nada("LA"), "../components/LeadTimelineMobile.jsx": nada("LT"), "../components/WhatsAppModalMobile.jsx": nada("WM"),
};
const vite = await createServer({ root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, resolve: { alias }, ssr: { noExternal: [] } });

const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function montar(el) { document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r")); await act(async () => { root.render(el); }); await wait(20); return async () => { await act(async () => { root.unmount(); }); document.body.innerHTML = ""; }; }
const body = () => document.body.textContent.replace(/\s+/g, " ");
const digitar = async (input, valor) => { await act(async () => { const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set; set.call(input, valor); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }); };
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };

// =============================================================
console.log("\n=== A. Timeline DESKTOP — datas em português e sem ISO");
{
  const { default: LeadTimeline } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/LeadTimeline.jsx");
  globalThis.__eventos = [
    { tipo: "VISITA", descricao: "Visita agendada.", criadoEm: "2026-10-14T18:00:00Z", dados: { data: "2026-10-14", hora: "15:00", consultor: "Laís" } },
    { tipo: "VISITA", descricao: "Visita reagendada.", criadoEm: "2026-10-14T03:00:00Z", dados: { visitaAnterior: { data: "2026-10-14", hora: "15:00" }, novaVisita: { data: "2026-10-21", hora: "16:30" } } },
    { tipo: "OBSERVACAO", descricao: "nota", criadoEm: "2026-10-14T02:59:00Z", dados: {} },
  ];
  const f = await montar(h(LeadTimeline, { lead: { id: "L", consultora: "Laís" } }));
  const t = body();
  check("data da visita: 14/10/2026 (e não 2026-10-14)", t.includes("Data: 14/10/2026") && !t.includes("2026-10-14"));
  check("visita anterior preserva ' às ': 14/10/2026 às 15:00", t.includes("Visita anterior: 14/10/2026 às 15:00"));
  check("nova visita: 21/10/2026 às 16:30", t.includes("Nova visita: 21/10/2026 às 16:30"));
  check("carimbo do evento: 14/10/2026 15:00 (sem vírgula)", t.includes("14/10/2026 15:00") && !/\d{4},\s\d{2}:\d{2}/.test(t));
  check("meia-noite: 03:00Z = 14/10/2026 00:00 e 02:59Z = 13/10/2026 23:59", t.includes("14/10/2026 00:00") && t.includes("13/10/2026 23:59"));
  check("nenhuma data ISO crua na tela", !/\d{4}-\d{2}-\d{2}/.test(t));
  await f();
}

console.log("\n=== B. Timeline MOBILE e Detalhes do lead (mobile)");
{
  const { default: LeadTimelineMobile } = await vite.ssrLoadModule("/src/mobile/components/LeadTimelineMobile.jsx");
  globalThis.__eventos = [{ tipo: "OBSERVACAO", descricao: "nota", criadoEm: "2026-10-14T18:00:00Z", dados: {} }];
  let f = await montar(h(LeadTimelineMobile, { leadId: "L" }));
  check("timeline mobile: 14/10/2026 15:00", body().includes("14/10/2026 15:00") && !/\d{4},\s\d{2}:\d{2}/.test(body()), body().slice(0, 200));
  await f();
  const { default: DetalhesMobile } = await vite.ssrLoadModule("/src/mobile/screens/LeadDetailsScreen.jsx");
  f = await montar(h(DetalhesMobile, { lead: { id: "L", nome: "Maria", etapa: 1, createdAt: { toDate: () => new Date("2026-10-14T18:00:00Z") } }, onVoltar: () => {} }));
  check("detalhes mobile: criado em 14/10/2026 15:00", body().includes("14/10/2026 15:00"));
  await f();
  f = await montar(h(DetalhesMobile, { lead: { id: "L", nome: "Maria", etapa: 1 }, onVoltar: () => {} }));
  check("detalhes mobile sem data: 'Não disponível' (valor nulo não quebra)", body().includes("Não disponível"));
  await f();
}

console.log("\n=== C. filtrarLeads (lista local)");
{
  const { filtrarLeads } = await vite.ssrLoadModule("/src/utils/leadFilters.js");
  const F = (pesquisa) => ({ pesquisa, consultora: "Todas", origem: "Todas", objetivo: "Todos", status: "Todos" });
  const L = [{ nome: "João Pereira", telefone: "(11) 98888-7766" }, { nome: "Maria Silva", telefone: "11977776666" }];
  check("sem acento", filtrarLeads(L, F("joao")).length === 1);
  check("parte do nome", filtrarLeads(L, F("silva")).length === 1);
  check("telefone com máscara", filtrarLeads(L, F("(11) 97777-6666")).length === 1);
  check("sem pesquisa: todos", filtrarLeads(L, F("")).length === 2);
}

// =============================================================
function criarCacheFalso(todos) {
  const c = { carregar: 0, buscar: 0, recarregar: 0, carregado: false };
  globalThis.__cache = {
    carregar: async () => { c.carregar++; if (!c.carregado) { c.lidos = (c.lidos || 0) + 1; c.carregado = true; } },
    recarregar: async () => { c.recarregar++; },
    buscar: (t) => { c.buscar++; const { leadCombinaComBusca } = globalThis.__U; return todos.filter((l) => leadCombinaComBusca(l, t, { minDigitos: 3 })); },
    estaCarregado: () => c.carregado,
  };
  return c;
}
globalThis.__U = await vite.ssrLoadModule("/src/utils/buscaLeads.js");
const AGORA = { seconds: Math.floor(Date.now() / 1000) }; // o quadro filtra pelo mês atual
const OUTRA = { createdAt: AGORA, id: "LA", nome: "Maria Souza Silva", telefone: "(11) 98888-7766", etapa: 3, responsavelUid: "lais", responsavel: "Laís", visita: { data: "2026-10-14", hora: "15:00" } };
const PROPRIO = { createdAt: AGORA, id: "LP", nome: "Maria Própria", telefone: "11900000000", etapa: 1, responsavelUid: "isa", responsavel: "Isabelle" };
const LOCAIS = [PROPRIO];
const comoRecep = () => { globalThis.__auth = { isAdmin: false, isCoordenador: false, isRecepcionista: true, perfilUsuario: { uid: "isa", id: "isa", perfil: "recepcionista", nome: "Isabelle" } }; };

console.log("\n=== E. Leads (DESKTOP) — campo 'Pesquisar nome ou telefone' acha lead de outra recepcionista");
{
  const { default: Leads } = await vite.ssrLoadModule("/src/components/Leads.jsx");
  comoRecep(); globalThis.__leadsLocais = LOCAIS; globalThis.__aoVivo = { LA: { ...OUTRA, nome: "Maria Souza Silva", responsavelUid: "lais", etapa: 3 } };
  const cache = criarCacheFalso([OUTRA, PROPRIO]);
  const f = await montar(h(Leads, { leads: LOCAIS }));
  const campo = document.querySelector("input.searchInput");
  check("campo de pesquisa existe", !!campo);
  check("sem digitar nada: nenhuma leitura e nenhum painel de busca global", cache.carregar === 0 && !body().includes("Leads de outras recepcionistas"));
  // digitação rápida: 1 letra por vez
  for (const v of ["s", "si", "sil", "silv", "silva"]) { await digitar(campo, v); }
  await wait(450);
  check("digitação rápida (5 teclas) = no máximo 1 carregamento (debounce) e a leitura ocorre uma vez", cache.carregar === 1 && cache.lidos === 1, JSON.stringify(cache));
  check("mostra o lead da OUTRA titular com titular, etapa e visita", body().includes("Maria Souza Silva") && body().includes("Titular: Laís") && body().includes("Visita: 14/10/2026 às 15:00"), body().slice(0, 300));
  check("sem ISO cru nos resultados", !/\d{4}-\d{2}-\d{2}/.test(body()));
  check("o lead próprio NÃO é duplicado no painel global (fica no quadro)", !/Maria Própria.*Titular/.test(body()));
  // continuar digitando não relê
  await digitar(campo, "souza silva"); await wait(450);
  check("continuar digitando NÃO relê a coleção", cache.lidos === 1 && cache.carregar === 2, JSON.stringify(cache));
  // abrir
  const botao = [...document.querySelectorAll(".buscaGlobalItem")].find((b) => b.textContent.includes("Maria Souza Silva"));
  await clicar(botao); await wait(20);
  check("abrir o resultado entrega o lead (ao vivo) ao modal de detalhes", globalThis.__modalLead?.id === "LA" && body().includes("MODAL:LA"));
  check("titularidade preservada: o objeto aberto continua com responsavelUid da Laís", globalThis.__modalLead?.responsavelUid === "lais");
  await act(async () => { globalThis.__modalOnClose(); }); await wait(10);
  check("fechar o modal limpa o lead aberto", !body().includes("MODAL:LA"));
  await digitar(campo, ""); await wait(400);
  check("limpar a pesquisa esconde o painel", !body().includes("Leads de outras recepcionistas"));
  await f();
}

console.log("\n=== F. Leads (DESKTOP) — admin/coordenador NÃO disparam a busca global (já veem todos)");
for (const perfil of ["admin", "coordenador"]) {
  const { default: Leads } = await vite.ssrLoadModule("/src/components/Leads.jsx");
  globalThis.__auth = { isAdmin: perfil === "admin", isCoordenador: perfil === "coordenador", isRecepcionista: false, perfilUsuario: { uid: "x", id: "x", perfil, nome: "G" } };
  globalThis.__leadsLocais = [PROPRIO, OUTRA];
  const cache = criarCacheFalso([OUTRA, PROPRIO]);
  const f = await montar(h(Leads, { leads: [PROPRIO, OUTRA] }));
  await digitar(document.querySelector("input.searchInput"), "silva"); await wait(450);
  check(`${perfil}: nenhuma leitura de cache e sem painel extra`, cache.carregar === 0 && !body().includes("Leads de outras recepcionistas"));
  check(`${perfil}: o quadro filtra normalmente (lista local completa)`, body().includes("BOARD:LA"), body().slice(0, 150));
  await f();
}

console.log("\n=== G. Mobile (LeadsScreen) — mesma busca; lead de outra titular abre em consulta");
{
  const { default: LeadsScreen } = await vite.ssrLoadModule("/src/mobile/screens/LeadsScreen.jsx");
  comoRecep(); globalThis.__leadsLocais = LOCAIS; globalThis.__docs = { LA: { ...OUTRA } }; globalThis.__getDocChamadas = 0;
  const cache = criarCacheFalso([OUTRA, PROPRIO]);
  const f = await montar(h(LeadsScreen, {}));
  const campo = document.querySelector(".mobileLeadsBusca input");
  for (const v of ["s", "si", "silva"]) { await digitar(campo, v); }
  await wait(450);
  check("mobile: acha o lead de outra recepcionista (1 leitura)", body().includes("Maria Souza Silva") && cache.lidos === 1, body().slice(0, 200));
  check("mobile: não mostra 'nenhum lead encontrado' quando há resultado global", !body().includes("Nenhum lead encontrado"));
  const botao = [...document.querySelectorAll(".buscaGlobalItem")][0];
  await clicar(botao); await wait(20);
  check("mobile: abrir lê o lead completo (1 getDoc) e abre os detalhes", globalThis.__getDocChamadas === 1 && body().includes("DETALHE:LA"));
  check("mobile: titularidade preservada no objeto aberto", globalThis.__mobileLead?.responsavelUid === "lais");
  await f();
  await digitar(null ?? document.createElement("input"), "");
}

console.log("\n=== H. Mobile — sem resultado em lugar nenhum");
{
  const { default: LeadsScreen } = await vite.ssrLoadModule("/src/mobile/screens/LeadsScreen.jsx");
  comoRecep(); globalThis.__leadsLocais = LOCAIS;
  criarCacheFalso([OUTRA, PROPRIO]);
  const f = await montar(h(LeadsScreen, {}));
  await digitar(document.querySelector(".mobileLeadsBusca input"), "zzzz"); await wait(450);
  check("mobile: 'Nenhum lead encontrado' + painel global vazio", body().includes('Nenhum lead encontrado para "zzzz"') && body().includes("Nenhum lead de outra recepcionista encontrado"));
  await f();
}

console.log("\n=== I. Falha na atualização: o painel mantém o cache anterior e informa o erro (sem confundir com 'vazio')");
{
  const { default: Leads } = await vite.ssrLoadModule("/src/components/Leads.jsx");
  comoRecep(); globalThis.__leadsLocais = LOCAIS;
  let chamadas = 0;
  globalThis.__cache = {
    estaCarregado: () => true,                       // já havia cache de antes
    carregar: async () => { chamadas++; throw Object.assign(new Error("rede"), { code: "unavailable" }); },
    recarregar: async () => { throw new Error("rede"); },
    buscar: () => [OUTRA],
  };
  const f = await montar(h(Leads, { leads: LOCAIS }));
  const campo = document.querySelector("input.searchInput");
  await digitar(campo, "silva"); await wait(450);
  check("falha com cache anterior: o resultado antigo CONTINUA na tela", body().includes("Maria Souza Silva") && body().includes("Titular: Laís"), body().slice(0, 250));
  check("...e o erro é informado (não fica como se estivesse atualizado)", body().includes("Não foi possível buscar"));
  check("...e NÃO aparece 'Nenhum lead de outra recepcionista encontrado' (falha != vazio)", !body().includes("Nenhum lead de outra recepcionista encontrado"));
  globalThis.__cache = {
    estaCarregado: () => false,
    carregar: async () => { throw Object.assign(new Error("rede"), { code: "unavailable" }); },
    recarregar: async () => {}, buscar: () => [],
  };
  await digitar(campo, "silvaa"); await wait(450);
  check("falha SEM cache anterior: só o aviso de erro (sem lista nem 'vazio' legítimo)", body().includes("Não foi possível buscar") && !body().includes("Nenhum lead de outra recepcionista encontrado") && !body().includes("Maria Souza Silva"));
  globalThis.__cache = { estaCarregado: () => true, carregar: async () => {}, recarregar: async () => {}, buscar: () => [] };
  await digitar(campo, "xyzxyz"); await wait(450);
  check("resultado vazio LEGÍTIMO (sem erro): mensagem de 'nenhum encontrado', sem aviso de erro", body().includes("Nenhum lead de outra recepcionista encontrado") && !body().includes("Não foi possível buscar"));
  await f();
}

await vite.close();
process.exit(fim() ? 1 : 0);
