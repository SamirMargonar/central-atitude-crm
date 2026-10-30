// PLANOS (matrícula/edição/renovação/administração), WHATSAPP e HISTÓRICO NA AGENDA — jsdom + Vite SSR.
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
globalThis.alert = (m) => { (globalThis.__alertas ||= []).push(String(m)); };
globalThis.confirm = () => true; dom.window.confirm = () => true;
const require = createRequire(REPO + "/package.json");
const React = require("react"); const { createRoot } = require("react-dom/client"); const { act } = React;
const { createServer } = await import(REPO + "/node_modules/vite/dist/node/index.js");
const { check, fim } = criarRelatorio();
const h = React.createElement;

const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-planos-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules");
const W = (n, c) => { writeFileSync(`${mk}/${n}`, c); return `${mk}/${n}`; };
const authCtx = W("auth-context.jsx", `export const useAuth = () => globalThis.__auth;\n`);
const eventEngine = W("event-engine.js", `export const atualizarLead = async (id, dados) => { (globalThis.__calls ||= []).push({ fn: "atualizarLead", id, dados }); return {}; };
export const registrarEvento = async (e) => { if (globalThis.__falharEvento) { throw new Error("evento negado"); } (globalThis.__calls ||= []).push({ fn: "registrarEvento", ...e }); return {}; };\n`);
const servicoStub = W("servico-planos.js", `const d = (n) => (...a) => globalThis.__sp[n](...a);
export const servicoPlanos = { carregarCatalogo: d("carregarCatalogo"), salvarPlano: d("salvarPlano"), definirAtivoPlano: d("definirAtivoPlano"), cargaInicial: d("cargaInicial"), criarCategoria: d("criarCategoria"), definirAtivaCategoria: d("definirAtivaCategoria") };\n`);
const visitaEngine = W("visita-engine.js", `export const atualizarVisita = async (id, dados) => { if (globalThis.__falharVisita) { throw new Error("visita negada"); } (globalThis.__calls ||= []).push({ fn: "atualizarVisita", id, dados }); await new Promise((r) => setTimeout(r, 15)); return { id, ...dados }; }; export const confirmarVisita = async () => ({}); export const registrarAtendimento = async () => ({});\n`);
const reagStub = W("reagendamento-real.js", `import { criarReagendamentoAgenda } from "${REPO}/src/Agenda/reagendamentoAgenda.js";
const rec = (x) => (globalThis.__calls ||= []).push(x);
const ref = (path) => ({ path });
const fs = {
  doc: (a, c, ...r) => (c === undefined ? ref(a.path + "/auto") : ref([c, ...r].join("/"))),
  collection: (_db, ...r) => ref(r.join("/")),
  serverTimestamp: () => "SERVER_TS",
  updateDoc: async (r, d) => { rec({ fn: "updateDoc", path: r.path, data: d }); },
  setDoc: async (r, d) => { rec({ fn: "setDoc", path: r.path, data: d }); },
  writeBatch: () => { const ops = []; return { update: (r, d) => ops.push({ op: "update", path: r.path, data: d }), set: (r, d) => ops.push({ op: "set", path: r.path, data: d }),
    commit: async () => { await new Promise((x) => setTimeout(x, 15)); if (globalThis.__negarLote) { const e = new Error("negado"); e.code = "permission-denied"; throw e; } if (globalThis.__falharLote) { const e = new Error("rede"); e.code = "unavailable"; throw e; } rec({ fn: "lote", ops }); } }; },
};
export const reagendamentoAgenda = criarReagendamentoAgenda({ db: {}, fs, auth: { get currentUser() { return { uid: globalThis.__auth.usuario.uid }; } } });\n`);
const nulo = W("nulo.jsx", `export default function N(){ return null; }\n`);
const timeline = W("timeline.jsx", `import React from "react"; export default function T(p){ (globalThis.__timelineProps ||= []).push(p.lead); return React.createElement("div", { className: "timeline-stub" }, "TIMELINE:" + (p.lead && p.lead.id)); }\n`);

const alias = {
  "../../../auth/AuthContext": authCtx, "../auth/AuthContext": authCtx, "../../auth/AuthContext": authCtx,
  "../../../core/EventEngine": eventEngine, "../core/EventEngine": eventEngine,
  "../planos/servicoPlanosReal": servicoStub, "./servicoPlanosReal": servicoStub,
  "./VisitaEngine": visitaEngine, "../core/VisitaEngine": visitaEngine,
  "./reagendamentoAgendaReal": reagStub,
  "./ConfirmarVisitaWhatsAppModal": nulo, "./WhatsAppLivreModal": nulo,
  "../components/LeadDetailsModal/LeadTimeline": timeline,
};
const vite = await createServer({ root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, resolve: { alias }, ssr: { noExternal: [] } });

const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function montar(el) { document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r")); await act(async () => { root.render(el); }); await wait(30); return async () => { await act(async () => { root.unmount(); }); document.body.innerHTML = ""; }; }
const body = () => document.body.textContent.replace(/\s+/g, " ");
const clicarTexto = async (texto, escopo = document) => { const b = [...escopo.querySelectorAll("button")].find((x) => x.textContent.includes(texto) && !x.disabled); if (!b) throw new Error("botão não encontrado: " + texto); await act(async () => { b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await wait(30); };
const preencher = async (el, valor) => { const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype; await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor); el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }); await wait(); };
const como = (uid, perfil, nome, extra = {}) => { globalThis.__auth = { usuario: { uid, displayName: nome }, perfilUsuario: { perfil, nome, id: uid, ...extra }, isAdmin: perfil === "admin", isCoordenador: perfil === "coordenador", isRecepcionista: perfil === "recepcionista", permissoes: {} }; };
const opcoes = () => [...document.querySelectorAll("select option")].map((o) => o.textContent.trim());
const grupos = () => [...document.querySelectorAll("select optgroup")].map((o) => o.label);
const chamadas = (fn) => (globalThis.__calls || []).filter((c) => c.fn === fn);

const P = await vite.ssrLoadModule("/src/utils/planos.js");
const CATS = P.CATEGORIAS_INICIAIS.map((c) => ({ ...c, ativo: true }));
const pl = (id, nome, cat, meses, extra = {}) => ({ id, nome, categoriaId: cat, duracaoMeses: meses, ativo: true, ordem: 1, valorCentavos: null, taxaAdesaoCentavos: null, descricao: "", condicoes: "", ofertaInicio: null, ofertaFim: null, ...extra });
const CATALOGO = {
  categorias: CATS,
  planos: [
    pl("MENSAL", "Plano Mensal", "convencionais", 1),
    pl("TRIMESTRAL", "Plano Trimestral", "convencionais", 3, { ativo: false }),
    pl("BF25", "Black Friday 12m", "black-friday", 12, { valorCentavos: 99900, taxaAdesaoCentavos: 0, condicoes: "Pagamento à vista", ofertaInicio: "2020-01-01", ofertaFim: "2099-12-31" }),
    pl("EXPIRADO", "Oferta Expirada", "promocionais", 2, { ofertaFim: "2020-01-31" }),
    pl("FUTURO", "Oferta Futura", "promocionais", 2, { ofertaInicio: "2099-01-01" }),
    pl("PROMO3", "Promo 3m", "promocionais", 3, { valorCentavos: 9990 }),
  ],
};
const servicoFalso = (catalogo = CATALOGO) => ({
  carregarCatalogo: async () => { (globalThis.__sp_calls ||= []).push("carregarCatalogo"); if (catalogo instanceof Error) throw catalogo; return JSON.parse(JSON.stringify(catalogo)); },
  salvarPlano: async (...a) => { (globalThis.__sp_calls ||= []).push(["salvarPlano", ...a]); if (!String(a[0].dados.nome || "").trim()) { const e = new Error("Informe o nome do plano."); e.codigo = "PLANO_INVALIDO"; throw e; } return "novo-id"; },
  definirAtivoPlano: async (...a) => { (globalThis.__sp_calls ||= []).push(["definirAtivoPlano", ...a]); },
  cargaInicial: async (...a) => { (globalThis.__sp_calls ||= []).push(["cargaInicial", ...a]); return { criadas: ["a", "b"], jaExistiam: [] }; },
  criarCategoria: async (...a) => { (globalThis.__sp_calls ||= []).push(["criarCategoria", ...a]); return "estudantes"; },
  definirAtivaCategoria: async (...a) => { (globalThis.__sp_calls ||= []).push(["definirAtivaCategoria", ...a]); },
});
const reset = (catalogo) => { globalThis.__falharEvento = false; globalThis.__falharVisita = false; globalThis.__negarLote = false; globalThis.__falharLote = false; globalThis.__calls = []; globalThis.__alertas = []; globalThis.__sp_calls = []; globalThis.__sp = servicoFalso(catalogo); };
const spCalls = (nome) => (globalThis.__sp_calls || []).filter((c) => c === nome || c[0] === nome);

const { default: MatriculaAction } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/actions/MatriculaAction.jsx");
const { default: EditarMatriculaAction } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/actions/EditarMatriculaAction.jsx");
const { default: RenovacaoAcoes } = await vite.ssrLoadModule("/src/components/RenovacaoAcoes.jsx");
const { default: GerenciamentoPlanos } = await vite.ssrLoadModule("/src/planos/GerenciamentoPlanos.jsx");
const { default: DetalhesVisita } = await vite.ssrLoadModule("/src/Agenda/DetalhesVisita.jsx");

const LEAD = { id: "L1", nome: "Maria", objetivo: "Emagrecer", etapa: 4, responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" };
const abrirMatricula = (lead = LEAD) => h(MatriculaAction, { lead, setLead: () => {}, mostrarBotao: false, abertoExterno: true, fecharExterno: () => {} });
const campoData = () => document.querySelector('input[type="date"]');

console.log("\n=== A. MATRÍCULA INICIAL — lista dinâmica de planos ativos");
{
  como("isa", "recepcionista", "Isabelle"); reset();
  let f = await montar(abrirMatricula());
  check("lê o catálogo do Firestore ao abrir (uma leitura)", spCalls("carregarCatalogo").length === 1);
  const o = opcoes();
  check("lista só planos ATIVOS e VIGENTES (Mensal, Black Friday 12m, Promo 3m)", o.includes("Plano Mensal") && o.includes("Black Friday 12m") && o.includes("Promo 3m"), o.join("|"));
  check("plano DESATIVADO não aparece (Trimestral)", !o.includes("Plano Trimestral"));
  check("oferta expirada e oferta futura não aparecem", !o.includes("Oferta Expirada") && !o.includes("Oferta Futura"));
  check("agrupado por categoria", grupos().join() === "Convencionais,Promocionais,Black Friday".split(",").sort((a, b) => P.CATEGORIAS_INICIAIS.findIndex((c) => c.nome === a) - P.CATEGORIAS_INICIAIS.findIndex((c) => c.nome === b)).join(), grupos().join());
  check("sem aviso de 'catálogo não cadastrado' (catálogo existe)", !body().includes("Catálogo de planos ainda não cadastrado"));
  await preencher(document.querySelector("select"), "BF25");
  check("escolher o plano mostra duração, valor, adesão e condições", body().includes("12 meses") && /R\$\s?999,00/.test(body()) && /Adesão: R\$\s?0,00/.test(body()) && body().includes("Pagamento à vista"), body().slice(0, 400));
  await preencher(campoData(), "2026-10-14");
  check("vencimento previsto pela DURAÇÃO do plano (12 meses => 14/10/2027)", body().includes("14/10/2027"));
  await clicarTexto("Confirmar Matrícula", document.querySelector(".leadActionButtons"));
  const lead = chamadas("atualizarLead")[0];
  const m = lead?.dados.matricula;
  check("a matrícula grava o INSTANTÂNEO do plano (id, nome, categoria, valor, adesão, duração, condições)", m && m.plano === "BF25" && m.planoId === "BF25" && m.planoNome === "Black Friday 12m" && m.planoCategoria === "Black Friday" && m.planoCategoriaId === "black-friday" && m.valorCentavos === 99900 && m.taxaAdesaoCentavos === 0 && m.duracaoMeses === 12 && m.condicoes === "Pagamento à vista", JSON.stringify(m));
  check("...e o vencimento/início corretos, status ATIVA e autoria preservadas", m.dataInicio === "2026-10-14" && m.dataVencimento === "2027-10-14" && m.status === "ATIVA" && m.confirmada === true && m.registradoPorUid === "isa" && m.consultor === "Isabelle");
  check("...e a etapa avança como antes (4 -> 5)", lead.dados.etapa === 5);
  const ev = chamadas("registrarEvento").find((e) => e.tipo === "MATRICULA");
  check("o evento MATRICULA da timeline leva o mesmo instantâneo (uma vez só)", ev && ev.dados.planoNome === "Black Friday 12m" && ev.dados.valorCentavos === 99900 && ev.dados.duracaoMeses === 12 && chamadas("registrarEvento").filter((e) => e.tipo === "MATRICULA").length === 1);
  check("e o JORNADA de avanço continua sendo registrado", chamadas("registrarEvento").some((e) => e.tipo === "JORNADA"));
  await f();
}

console.log("\n=== B. FALLBACK: catálogo vazio ou ilegível => os 4 planos de sempre (matrícula nunca trava)");
for (const [rotulo, catalogo] of [["catálogo VAZIO", { planos: [], categorias: [] }], ["ERRO de leitura (ex.: Rules ainda não publicadas)", new Error("permission-denied")]]) {
  como("isa", "recepcionista", "Isabelle"); reset(catalogo);
  const f = await montar(abrirMatricula());
  check(`${rotulo}: oferece Mensal, Trimestral, Semestral e Anual`, ["Plano Mensal", "Plano Trimestral", "Plano Semestral", "Plano Anual"].every((n) => opcoes().includes(n)), opcoes().join("|"));
  check(`${rotulo}: informa que está usando os planos padrão`, body().includes("Catálogo de planos ainda não cadastrado"));
  await preencher(document.querySelector("select"), "TRIMESTRAL"); await preencher(campoData(), "2026-10-14");
  await clicarTexto("Confirmar Matrícula", document.querySelector(".leadActionButtons"));
  const m = chamadas("atualizarLead")[0]?.dados.matricula;
  check(`${rotulo}: matrícula TRIMESTRAL idêntica ao comportamento antigo (plano, +3 meses) e sem inventar valor`, m && m.plano === "TRIMESTRAL" && m.planoNome === "Plano Trimestral" && m.duracaoMeses === 3 && m.dataVencimento === "2027-01-14" && !("valorCentavos" in m), JSON.stringify(m));
  await f();
}

console.log("\n=== C. Todos os planos DESATIVADOS (catálogo existe): nada para escolher, e não há fallback");
{
  como("isa", "recepcionista", "Isabelle"); reset({ categorias: CATS, planos: CATALOGO.planos.map((p) => ({ ...p, ativo: false })) });
  const f = await montar(abrirMatricula());
  check("lista vazia e sem aviso de fallback", opcoes().filter((x) => !/Selecione/.test(x)).length === 0 && !body().includes("Catálogo de planos ainda não cadastrado"));
  await clicarTexto("Confirmar Matrícula", document.querySelector(".leadActionButtons"));
  check("confirmar é bloqueado ('Selecione o plano') e nada é gravado", chamadas("atualizarLead").length === 0 && (globalThis.__alertas || []).some((a) => a.includes("Selecione o plano")));
  await f();
}

console.log("\n=== D. EDIÇÃO DE MATRÍCULA — contratos antigos e novos");
const abrirEdicao = async (lead) => { const f = await montar(h(EditarMatriculaAction, { lead, setLead: () => {} })); await clicarTexto("Editar Matrícula"); await wait(30); return f; };
{
  como("isa", "recepcionista", "Isabelle"); reset();
  const antiga = { ...LEAD, etapa: 5, matricula: { confirmada: true, consultor: "Isabelle", status: "ATIVA", plano: "TRIMESTRAL", dataInicio: "2026-07-01", dataVencimento: "2026-10-01", observacao: "o" } };
  let f = await abrirEdicao(antiga);
  check("matrícula ANTIGA (só `plano: TRIMESTRAL`) abre normalmente e o plano atual aparece mesmo desativado no catálogo", opcoes().some((x) => x.includes("Plano Trimestral") && x.includes("plano atual")), opcoes().join("|"));
  await preencher(campoData(), "2026-08-01");
  await clicarTexto("Salvar Alterações");
  let m = chamadas("atualizarLead")[0]?.dados.matricula;
  check("mantendo o plano: só data/vencimento mudam (3 meses do CONTRATO) e NÃO entra valor/instantâneo novo do catálogo", m && m.plano === "TRIMESTRAL" && m.dataInicio === "2026-08-01" && m.dataVencimento === "2026-11-01" && !("planoNome" in m) && !("valorCentavos" in m) && m.observacao === "o" && m.consultor === "Isabelle" && m.status === "ATIVA", JSON.stringify(m));
  const ev = chamadas("registrarEvento").find((e) => e.tipo === "MATRICULA_EDITADA");
  check("evento MATRICULA_EDITADA registra plano anterior/novo e vencimentos", ev && ev.dados.planoAnterior === "TRIMESTRAL" && ev.dados.planoNovo === "TRIMESTRAL" && ev.dados.dataVencimentoNovo === "2026-11-01");
  await f();

  reset({ categorias: CATS, planos: CATALOGO.planos.map((p) => p.id === "BF25" ? { ...p, nome: "RENOMEADO", valorCentavos: 150000, duracaoMeses: 6, condicoes: "mudou" } : p) });
  const contratada = { ...LEAD, etapa: 5, matricula: { confirmada: true, consultor: "Isabelle", status: "ATIVA", plano: "BF25", planoId: "BF25", planoNome: "Black Friday 12m", planoCategoriaId: "black-friday", planoCategoria: "Black Friday", valorCentavos: 99900, taxaAdesaoCentavos: 0, duracaoMeses: 12, condicoes: "Pagamento à vista", dataInicio: "2026-10-14", dataVencimento: "2027-10-14", observacao: "" } };
  f = await abrirEdicao(contratada);
  check("o catálogo foi ALTERADO (preço 1.500, nome, duração), mas o seletor mostra os valores do CONTRATO (R$ 999,00; 12 meses)", /R\$\s?999,00/.test(body()) && body().includes("12 meses") && !/1\.500,00/.test(body()) && opcoes().includes("Black Friday 12m") && !opcoes().includes("RENOMEADO"), body().slice(0, 300));
  await preencher(campoData(), "2026-11-01");
  await clicarTexto("Salvar Alterações");
  m = chamadas("atualizarLead")[0]?.dados.matricula;
  check("salvar mantendo o plano preserva TODO o instantâneo original (nome, valor, duração) — nada do catálogo novo", m && m.planoNome === "Black Friday 12m" && m.valorCentavos === 99900 && m.duracaoMeses === 12 && m.condicoes === "Pagamento à vista" && m.dataVencimento === "2027-11-01", JSON.stringify(m));
  await f();

  reset();
  f = await abrirEdicao(contratada);
  await preencher(document.querySelector("select"), "PROMO3");
  await clicarTexto("Salvar Alterações");
  m = chamadas("atualizarLead")[0]?.dados.matricula;
  const ev2 = chamadas("registrarEvento").find((e) => e.tipo === "MATRICULA_EDITADA");
  check("TROCAR de plano grava o instantâneo do novo (Promo 3m, R$ 99,90, 3 meses) e remove o do anterior", m && m.plano === "PROMO3" && m.planoNome === "Promo 3m" && m.valorCentavos === 9990 && m.duracaoMeses === 3 && !("taxaAdesaoCentavos" in m) && m.condicoes === "" && m.dataVencimento === "2027-01-14" && m.consultor === "Isabelle", JSON.stringify(m));
  check("o evento guarda o instantâneo ANTERIOR (histórico do contrato) e o novo", ev2.dados.snapshotAnterior.planoNome === "Black Friday 12m" && ev2.dados.snapshotAnterior.valorCentavos === 99900 && ev2.dados.snapshotNovo.planoNome === "Promo 3m");
  await f();
}

console.log("\n=== E. RENOVAÇÃO — novo contrato com a lista dinâmica");
{
  como("isa", "recepcionista", "Isabelle"); reset();
  const cliente = { ...LEAD, etapa: 5, matricula: { confirmada: true, consultor: "Isabelle", status: "ATIVA", plano: "MENSAL", dataInicio: "2026-09-14", dataVencimento: "2026-10-14", observacao: "" } };
  const f = await montar(h(RenovacaoAcoes, { cliente }));
  await clicarTexto("Renovar plano");
  check("renovação lista planos ativos do catálogo (e não o Trimestral desativado)", opcoes().includes("Promo 3m") && opcoes().includes("Black Friday 12m") && !opcoes().includes("Plano Trimestral"), opcoes().join("|"));
  await preencher(document.querySelector("select"), "PROMO3");
  await clicarTexto("Confirmar Renovação");
  const m = chamadas("atualizarLead")[0]?.dados.matricula;
  check("a renovação grava o novo instantâneo, vencimento pela duração (14/10 + 3 meses) e preserva consultor/status", m && m.plano === "PROMO3" && m.planoNome === "Promo 3m" && m.valorCentavos === 9990 && m.dataInicio === "2026-10-14" && m.dataVencimento === "2027-01-14" && m.consultor === "Isabelle" && m.status === "ATIVA", JSON.stringify(m));
  const ev = chamadas("registrarEvento").find((e) => e.tipo === "RENOVACAO_CONFIRMADA");
  check("evento RENOVACAO_CONFIRMADA guarda plano anterior/novo + instantâneos (contrato anterior não se perde)", ev && ev.dados.planoAnterior === "MENSAL" && ev.dados.planoNovo === "PROMO3" && ev.dados.snapshotAnterior.plano === "MENSAL" && ev.dados.snapshotNovo.planoNome === "Promo 3m");
  await f();
}

console.log("\n=== F. ADMINISTRAÇÃO DE PLANOS — só admin; nunca exclui");
{
  como("adm", "admin", "Samir"); reset({ categorias: CATS, planos: CATALOGO.planos.filter((p) => p.id !== "ANUAL") });
  let f = await montar(h(GerenciamentoPlanos, {}));
  check("admin vê a página, os planos e os valores formatados", body().includes("Gerenciamento de Planos") && body().includes("Black Friday 12m") && /R\$\s?999,00/.test(body()) && body().includes("Promo 3m"));
  check("indica 'Desativado' (Trimestral) e 'Fora da vigência' (oferta expirada/futura)", body().includes("Desativado") && body().includes("Fora da vigência"));
  check("NÃO existe nenhum botão de excluir/apagar/remover", ![...document.querySelectorAll("button")].some((b) => /exclu|apag|remov|delet/i.test(b.textContent)));
  check("catálogo incompleto: oferece 'Criar planos e categorias iniciais'", body().includes("Criar planos e categorias iniciais"));
  await clicarTexto("Desativar", [...document.querySelectorAll(".planoCard")].find((c) => c.textContent.includes("Promo 3m")));
  check("Desativar chama o serviço com ativo=false e o autor (uid/nome do admin)", spCalls("definirAtivoPlano").some((c) => c[1] === "PROMO3" && c[2] === false && c[3].uid === "adm" && c[3].nome === "Samir"));
  await clicarTexto("Ativar", [...document.querySelectorAll(".planoCard")].find((c) => c.textContent.includes("Plano Trimestral")));
  check("Ativar chama o serviço com ativo=true", spCalls("definirAtivoPlano").some((c) => c[1] === "TRIMESTRAL" && c[2] === true));
  await clicarTexto("Criar planos e categorias iniciais");
  check("a carga inicial só roda por clique do admin (e com confirmação)", spCalls("cargaInicial").length === 1);
  check("e informa o resultado", body().includes("Carga inicial concluída"));

  await clicarTexto("Novo plano");
  const modal = () => document.querySelector(".leadActionModal");
  const campos = () => [...modal().querySelectorAll("input, select, textarea")];
  await clicarTexto("Salvar", modal().querySelector(".leadActionButtons"));
  check("salvar com nome vazio: o serviço rejeita e a tela mostra o motivo (nada some em silêncio)", body().includes("Informe o nome do plano."));
  await preencher(campos()[0], "Plano Aniversário"); await preencher(campos()[1], "aniversario");
  await preencher(campos()[2], "abc");
  await clicarTexto("Salvar", modal().querySelector(".leadActionButtons"));
  check("valor inválido ('abc'): bloqueia ANTES de chamar o serviço", body().includes("O valor informado é inválido.") && spCalls("salvarPlano").filter((c) => c[1].dados.nome === "Plano Aniversário").length === 0);
  await preencher(campos()[2], "129,90"); await preencher(campos()[3], "49,90"); await preencher(campos()[4], "6");
  await clicarTexto("Salvar", modal().querySelector(".leadActionButtons"));
  const salvo = spCalls("salvarPlano").find((c) => c[1].dados.nome === "Plano Aniversário");
  check("plano novo: valor e adesão convertidos para CENTAVOS, duração em meses, categoria e ativo", salvo && salvo[1].dados.valorCentavos === 12990 && salvo[1].dados.taxaAdesaoCentavos === 4990 && salvo[1].dados.duracaoMeses === 6 && salvo[1].dados.categoriaId === "aniversario" && salvo[1].ativo === true && salvo[1].id === null, JSON.stringify(salvo));

  await clicarTexto("Editar", [...document.querySelectorAll(".planoCard")].find((c) => c.textContent.includes("Black Friday 12m")));
  check("editar abre o formulário preenchido (valor 999,00; adesão 0,00; condições)", campos()[0].value === "Black Friday 12m" && campos()[2].value === "999,00" && campos()[3].value === "0,00" && campos().some((c) => c.value === "Pagamento à vista"));
  await clicarTexto("Cancelar", modal().querySelector(".leadActionButtons"));

  await clicarTexto("Categorias");
  check("categorias: lista as 7 iniciais, sem botão de excluir", CATS.every((c) => body().includes(c.nome)) && ![...document.querySelectorAll("button")].some((b) => /exclu|apag|remov|delet/i.test(b.textContent)));
  await preencher([...modal().querySelectorAll("input")].pop(), "Estudantes");
  await clicarTexto("Adicionar categoria");
  check("admin cria categoria nova", spCalls("criarCategoria").some((c) => c[1] === "Estudantes" && c[2].uid === "adm"));
  await clicarTexto("Desativar", [...modal().querySelectorAll("li")].find((li) => li.textContent.includes("TotalPass")));
  check("admin desativa categoria (não exclui)", spCalls("definirAtivaCategoria").some((c) => c[1] === "totalpass" && c[2] === false));
  await f();

  for (const [rotulo, perfil] of [["coordenador", "coordenador"], ["recepcionista", "recepcionista"]]) {
    como("x-" + perfil, perfil, "Fulano"); reset();
    f = await montar(h(GerenciamentoPlanos, {}));
    check(`${rotulo}: a tela recusa (exclusivo para administradores), sem ler nem escrever nada`, body().includes("exclusivo para administradores") && spCalls("carregarCatalogo").length === 0 && !body().includes("Novo plano"));
    await f();
  }
}

console.log("\n=== G. AGENDA — botão de WhatsApp ao lado do telefone");
const visita = { id: "V1", leadId: "L9", leadNome: "Maria", data: "2026-10-14", hora: "15:00", status: "AGENDADA", consultora: "Laís", consultoraId: "lais", comparecimento: "" };
const detalhes = (lead, v = visita) => h(DetalhesVisita, { visita: v, lead, aberto: true, fechar: () => {}, onAtualizar: () => {} });
const leadTel = (telefone) => ({ id: "L9", nome: "Maria", telefone, idade: 30, objetivo: "Saúde", responsavelUid: "lais", responsavel: "Laís" });
{
  como("isa", "recepcionista", "Isabelle", { ativo: true });
  for (const [rotulo, tel, url] of [
    ["com máscara", "(41) 99706-7789", "https://wa.me/5541997067789"],
    ["só dígitos", "41997067789", "https://wa.me/5541997067789"],
    ["já com +55", "+55 41 99706-7789", "https://wa.me/5541997067789"],
    ["espaço/hífen especiais", "41 99706‑7789", "https://wa.me/5541997067789"],
  ]) {
    const f = await montar(detalhes(leadTel(tel)));
    const a = document.querySelector("a.btnWhatsAppCliente");
    check(`telefone ${rotulo}: botão aponta para ${url}, abre em nova aba com rel seguro`, a && a.getAttribute("href") === url && a.getAttribute("target") === "_blank" && /noopener/.test(a.getAttribute("rel")) && a.getAttribute("aria-label") === "Abrir conversa no WhatsApp");
    check(`telefone ${rotulo}: o número cadastrado continua visível e há exatamente um botão`, body().includes("Telefone:") && document.querySelectorAll(".btnWhatsAppCliente").length === 1);
    await f();
  }
  let f = await montar(detalhes(leadTel("99706-7789")));
  check("SEM DDD: nenhum link; botão desabilitado com orientação para corrigir o cadastro (não assume DDD 41)", !document.querySelector("a.btnWhatsAppCliente") && document.querySelector("button.btnWhatsAppClienteOff")?.disabled === true && body().includes("Sem DDD") && body().includes("corrija o telefone no cadastro") && /sem DDD.*cadastro do lead/.test(document.querySelector(".whatsAppClienteIndisponivel small").getAttribute("title")) && document.querySelector("button.btnWhatsAppClienteOff").getAttribute("title").includes("DDD"));
  await f();
  f = await montar(detalhes(leadTel("55 99706-7789")));
  check("começa com 55 e é ambíguo: indisponível com orientação (não arrisca outra pessoa)", !document.querySelector("a.btnWhatsAppCliente") && body().includes("Começa com 55") && document.querySelector(".whatsAppClienteIndisponivel small").getAttribute("title").includes("começa com 55"));
  await f();
  f = await montar(detalhes(leadTel("123")));
  check("formato irreconhecível: indisponível com orientação", !document.querySelector("a.btnWhatsAppCliente") && body().includes("Formato inválido") && document.querySelector(".whatsAppClienteIndisponivel small").getAttribute("title").includes("formato não reconhecido"));
  await f();
  f = await montar(detalhes(leadTel("")));
  check("sem telefone: nenhum botão (continua 'Não informado')", document.querySelectorAll(".btnWhatsAppCliente").length === 0 && body().includes("Não informado"));
  await f();
  f = await montar(detalhes(null));
  check("lead ainda não carregado (null): a tela abre sem quebrar e sem botão", body().includes("Informações do cliente") && document.querySelectorAll(".btnWhatsAppCliente").length === 0);
  await f();
  f = await montar(detalhes(leadTel("(41) 99706-7789")));
  check("o botão NÃO grava nada (nenhum evento, nenhuma atualização) — o 'WhatsApp livre' não foi alterado", (globalThis.__calls || []).length === 0);
  await f();
}

console.log("\n=== H. AGENDA — aba 'Histórico' (reaproveita a Timeline do lead)");
{
  como("isa", "recepcionista", "Isabelle", { ativo: true }); reset(); globalThis.__timelineProps = [];
  let f = await montar(detalhes(leadTel("(41) 99706-7789")));
  check("a aba 'Histórico' existe, fechada, sem carregar a timeline", [...document.querySelectorAll("button.abaHistorico")].length === 1 && !document.querySelector(".timeline-stub") && globalThis.__timelineProps.length === 0);
  check("e fica na mesma tela, sem remover as seções existentes (cliente, observações)", body().includes("Informações do cliente") && body().includes("O que foi conversado com o cliente"));
  await clicarTexto("Histórico");
  check("ao clicar mostra a Timeline do LEAD (id do lead, não da visita)", document.querySelector(".timeline-stub")?.textContent === "TIMELINE:L9" && document.querySelector("button.abaHistorico").getAttribute("aria-expanded") === "true");
  await clicarTexto("Histórico");
  check("clicar de novo recolhe", !document.querySelector(".timeline-stub"));
  await f();
  globalThis.__timelineProps = [];
  f = await montar(detalhes(null));
  await clicarTexto("Histórico");
  check("sem o lead carregado, usa o leadId da visita para a Timeline", document.querySelector(".timeline-stub")?.textContent === "TIMELINE:L9");
  await f();
  f = await montar(detalhes({ ...leadTel("1"), id: undefined }, { ...visita, leadId: undefined }));
  check("visita sem leadId e lead sem id: a aba não aparece (nada a consultar)", document.querySelectorAll("button.abaHistorico").length === 0);
  await f();
}


console.log("\n=== I. AGENDA — reagendar: visita + espelho lead.visita + Timeline num LOTE ATÔMICO (sem duplicar)");
{
  const ESP = { id: "V1", data: "2026-10-14", hora: "15:00", consultor: "Laís", observacao: "" };
  const leadComEspelho = (extra = {}) => ({ ...leadTel("(41) 99706-7789"), visita: { ...ESP }, ...extra });
  const reagendar = async (lead, v, { data = "2026-10-20", hora = "16:30", duplo = false } = {}) => {
    const atualizados = [];
    const f = await montar(h(DetalhesVisita, { visita: v, lead, aberto: true, fechar: () => {}, onAtualizar: (x) => atualizados.push(x) }));
    await clicarTexto("🔄 Reagendar");
    const campos = [...document.querySelectorAll(".reagendamentoCampos input")];
    await preencher(campos[0], data); await preencher(campos[1], hora);
    const botao = [...document.querySelectorAll("button.btnConfirmarVisita")].find((b) => !b.disabled);
    await act(async () => {
      botao.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      if (duplo) botao.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    await wait(80);
    return { f, atualizados };
  };
  const lotes = () => chamadas("lote");
  const op = (lote, caminho) => lote.ops.find((o) => o.path === caminho);

  // 1. recepcionista que NÃO é a titular reagenda
  como("isa", "recepcionista", "Isabelle", { ativo: true }); reset();
  let { f, atualizados } = await reagendar(leadComEspelho(), visita);
  const lote = lotes()[0];
  check("UM lote atômico com as 3 escritas (visita, espelho do lead, evento) — e nenhuma escrita solta", lotes().length === 1 && lote.ops.length === 3 && chamadas("updateDoc").length === 0 && chamadas("setDoc").length === 0, JSON.stringify(lote?.ops.map((o) => o.path)));
  const ov = op(lote, "visitas/V1").data;
  check("visita: data, hora, status AGENDADA, comparecimento limpo, consultora preservada e carimbo do servidor (sem confirmadoPor*)", ov.data === "2026-10-20" && ov.hora === "16:30" && ov.status === "AGENDADA" && ov.comparecimento === "" && ov.consultora === "Laís" && ov.atualizadoEm === "SERVER_TS" && !("confirmadoPor" in ov) && !("confirmadoPorNome" in ov) && !("confirmadoEm" in ov));
  const ol = op(lote, "leads/L9").data;
  check("espelho do lead (lead.visita) recebe a nova data/hora, mantém o id e a titular, e só toca visita/ultimoAtendimento/atualizadoEm", ol.visita.id === "V1" && ol.visita.data === "2026-10-20" && ol.visita.hora === "16:30" && ol.visita.consultor === "Laís" && Object.keys(ol.visita).sort().join() === "consultor,data,hora,id,observacao" && Object.keys(ol).sort().join() === "atualizadoEm,ultimoAtendimento,visita" && ol.atualizadoEm === "SERVER_TS");
  const oe = lote.ops.find((o) => o.path.includes("/eventos"));
  check("evento VISITA no lead da visita, com autor real e autoria do usuário logado (uid)", oe.path.startsWith("leads/L9/eventos") && oe.data.tipo === "VISITA" && oe.data.leadId === "L9" && oe.data.usuario === "Isabelle" && oe.data.usuarioUid === "isa" && oe.data.criadoEm === "SERVER_TS");
  check("descrição com visita anterior e nova (DD/MM/AAAA às HH:mm)", oe.data.descricao.includes("Isabelle reagendou a visita de Maria") && oe.data.descricao.includes("14/10/2026 às 15:00") && oe.data.descricao.includes("20/10/2026 às 16:30"), oe.data.descricao);
  check("dados no formato da Timeline + origem AGENDA, id da visita, atendimento compartilhado e titular", oe.data.dados.visitaAnterior.data === "2026-10-14" && oe.data.dados.novaVisita.hora === "16:30" && oe.data.dados.origem === "AGENDA" && oe.data.dados.visitaId === "V1" && oe.data.dados.atendimentoCompartilhado === true && oe.data.dados.titularNome === "Laís" && !("data" in oe.data.dados));
  check("a tela é atualizada (onAtualizar) e não há aviso de falha", atualizados.length === 1 && atualizados[0].data === "2026-10-20" && !(globalThis.__alertas || []).length);
  await f();

  // 2. titular
  como("lais", "recepcionista", "Laís", { ativo: true }); reset();
  ({ f } = await reagendar(leadComEspelho(), visita));
  check("titular reagendando: evento com atendimentoCompartilhado=false e autor Laís", lotes().length === 1 && lotes()[0].ops.find((o) => o.path.includes("/eventos")).data.dados.atendimentoCompartilhado === false && lotes()[0].ops.find((o) => o.path.includes("/eventos")).data.usuario === "Laís");
  await f();

  // 3. duplo clique
  como("isa", "recepcionista", "Isabelle", { ativo: true }); reset();
  ({ f } = await reagendar(leadComEspelho(), visita, { duplo: true }));
  check("DUPLO CLIQUE em confirmar: UM lote só (uma visita, um espelho, um evento)", lotes().length === 1, `lotes=${lotes().length}`);
  await f();

  // 4. mesma data/hora
  reset();
  ({ f } = await reagendar(leadComEspelho(), visita, { data: "2026-10-14", hora: "15:00" }));
  check("data/hora iguais às atuais: só a visita é salva (como antes) — sem lote, sem espelho, sem evento", lotes().length === 0 && chamadas("updateDoc").length === 1 && chamadas("updateDoc")[0].path === "visitas/V1" && chamadas("setDoc").length === 0);
  await f();

  // 5. lote negado pelas Rules: volta ao comportamento de sempre e avisa
  reset(); globalThis.__negarLote = true;
  let r = await reagendar(leadComEspelho(), visita); f = r.f;
  check("lote NEGADO: a visita é reagendada como sempre, o evento é tentado à parte e o resultado vem como parcial (a tela avisa)", lotes().length === 0 && chamadas("updateDoc").length === 1 && chamadas("updateDoc")[0].path === "visitas/V1" && chamadas("setDoc").length === 1 && chamadas("setDoc")[0].path.includes("/eventos") && r.atualizados.length === 1 && (globalThis.__alertas || []).some((a) => a.includes("cadastro do lead e/ou o histórico")));
  check("...e o espelho do lead NÃO é gravado fora do lote", ![...chamadas("updateDoc"), ...chamadas("setDoc")].some((c) => c.path === "leads/L9"));
  await f();

  // 6. falha que não é de permissão (rede)
  reset(); globalThis.__falharLote = true;
  r = await reagendar(leadComEspelho(), visita); f = r.f;
  check("falha de rede no lote: nada é gravado, a tela NÃO é atualizada e aparece a mensagem de erro de sempre", lotes().length === 0 && chamadas("updateDoc").length === 0 && chamadas("setDoc").length === 0 && r.atualizados.length === 0 && (globalThis.__alertas || []).some((a) => a.includes("Não foi possível reagendar")));
  await f();

  // 7. lead ainda não carregado
  reset();
  ({ f } = await reagendar(null, visita));
  check("lead não carregado (null): lote com visita + evento (leadId da visita), sem tocar o lead", lotes().length === 1 && lotes()[0].ops.length === 2 && !op(lotes()[0], "leads/L9") && lotes()[0].ops.some((o) => o.path.startsWith("leads/L9/eventos")));
  await f();

  // 8. o lead espelha OUTRA visita
  reset();
  ({ f } = await reagendar(leadComEspelho({ visita: { ...ESP, id: "V-OUTRA" } }), visita));
  check("lead com OUTRA visita espelhada: o espelho NÃO é sobrescrito (lote com visita + evento)", lotes().length === 1 && lotes()[0].ops.length === 2 && !op(lotes()[0], "leads/L9"));
  await f();

  // 9. visita sem lead vinculado
  reset();
  ({ f } = await reagendar({ ...leadTel("1"), id: undefined }, { ...visita, leadId: undefined }));
  check("visita sem lead vinculado: só a visita (sem lote e sem evento)", lotes().length === 0 && chamadas("updateDoc").length === 1 && chamadas("setDoc").length === 0);
  await f();
}

await vite.close();
process.exit(fim() ? 1 : 0);
