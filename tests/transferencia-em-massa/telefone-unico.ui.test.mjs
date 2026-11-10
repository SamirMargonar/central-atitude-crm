// TELEFONE ÚNICO — telas (jsdom + Vite SSR): cadastro normal, cadastro gerencial e edição do lead.
// O serviço de telefones é SUBSTITUÍDO por um falso que devolve o erro que o servidor devolveria; o foco aqui é a tela:
// mensagem exata, salvamento BLOQUEADO, sem "cadastrar mesmo assim", edição do próprio telefone não bloqueada.
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

const alertas = []; globalThis.alert = (m) => alertas.push(String(m)); dom.window.alert = globalThis.alert;

const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-tel-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules");
writeFileSync(`${mk}/firebase.js`, `export const db = {}; export const auth = {};\n`);
writeFileSync(`${mk}/auth.js`, `export function useAuth() { return globalThis.__auth; }\n`);
writeFileSync(`${mk}/evento.js`, `export async function registrarEvento(e) { globalThis.__eventos.push(e); return { id: "ev1" }; }\n`);
writeFileSync(`${mk}/servico.js`, `export function criarServicoTelefones() { return { criarLead: (...a) => globalThis.__servico.criarLead(...a), editarLead: (...a) => globalThis.__servico.editarLead(...a), liberarTelefone: (...a) => globalThis.__servico.liberarTelefone(...a), analisar: (...a) => globalThis.__servico.analisar(...a), indexar: (...a) => globalThis.__servico.indexar(...a) }; }\n`);
writeFileSync(`${mk}/detalhes.jsx`, `export default function LeadDetailsModal({ lead }) { return null; }\n`);
const vite = await createServer({
  root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, ssr: { noExternal: [] },
  resolve: { alias: [
    { find: /^(\.\.\/)+firebase\/firebase$/, replacement: `${mk}/firebase.js` },
    { find: /^(\.\.\/)+auth\/AuthContext$/, replacement: `${mk}/auth.js` },
    { find: /^(\.\.\/)+core\/EventEngine$/, replacement: `${mk}/evento.js` },
    { find: /^(\.\.\/)+services\/telefonesLeads$/, replacement: `${mk}/servico.js` },
    { find: /^\.\/LeadDetailsModal\/LeadDetailsModal$/, replacement: `${mk}/detalhes.jsx` },
  ] },
});
const { default: LeadModal } = await vite.ssrLoadModule("/src/components/LeadModal.jsx");
const { default: EditarLeadAction } = await vite.ssrLoadModule("/src/components/LeadDetailsModal/actions/EditarLeadAction.jsx");
const { default: TelefonesLeadsModal } = await vite.ssrLoadModule("/src/components/TelefonesLeads/TelefonesLeadsModal.jsx");

const MSG = "Telefone já cadastrado! Este número já está vinculado a outro lead no Central Attitude.";
const wait = (ms = 5) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
function novoServico(comportamento = {}) {
  const s = { criar: [], editar: [], liberar: [] };
  globalThis.__servico = {
    criarLead: async (dados, o) => { s.criar.push({ dados, o }); if (comportamento.criar) await comportamento.criar(dados); return { id: "novoId" }; },
    editarLead: async (id, dados, o) => { s.editar.push({ id, dados, o }); if (comportamento.editar) await comportamento.editar(id, dados); },
    liberarTelefone: async (...a) => { s.liberar.push(a); return true; },
    analisar: async () => { s.analises = (s.analises || 0) + 1; return comportamento.analise; },
    indexar: async (analise, o) => { s.indexacoes = (s.indexacoes || []).concat([{ analise, o }]); return { criados: analise.pendentes.length, falhas: [] }; },
  };
  globalThis.__eventos = [];
  return s;
}
const dup = (lead = { id: "L0", nome: "Maria Existente", responsavel: "Ana Lara" }) => Object.assign(new Error(MSG), { codigo: "TELEFONE_DUPLICADO", lead });

function setValor(el, valor) {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
  el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
const clicarTexto = async (re) => { const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent)); if (!b) throw new Error("botão não encontrado: " + re); await act(async () => { b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await wait(); };
const textoDaPagina = () => document.body.textContent.replace(/\s+/g, " ");
async function montar(el) { document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r")); await act(async () => { root.render(el); }); await wait(); return { desmontar: async () => { await act(async () => { root.unmount(); }); } }; }
async function preencher(telefone) {
  const campos = document.querySelectorAll(".leadModal .campo");
  const q = (i, sel) => campos[i].querySelector(sel);
  await act(async () => {
    setValor(q(0, "input"), "Cliente Teste"); setValor(q(1, "input"), telefone);
    for (const sel of document.querySelectorAll(".leadModal select")) {
      const opcoes = [...sel.options].filter((o) => o.value); if (opcoes.length) setValor(sel, opcoes[0].value);
    }
  });
  await wait();
}

const ADMIN = { usuario: { uid: "adm", displayName: "Samir" }, perfilUsuario: { uid: "adm", nome: "Samir", perfil: "admin" }, permissoes: { editarLead: true } };
const RECEP = { usuario: { uid: "ana", displayName: "Ana" }, perfilUsuario: { uid: "ana", nome: "Ana Lara", perfil: "recepcionista" }, permissoes: { editarLead: true } };

console.log("\n=== A. Cadastro NORMAL");
{
  globalThis.__auth = ADMIN;
  let s = novoServico(); alertas.length = 0;
  let fechou = 0;
  let m = await montar(h(LeadModal, { aberto: true, fechar: () => { fechou++; }, modoGerencial: false }));
  await preencher("(41) 99618-3695"); await clicarTexto(/^Cadastrar Lead$/);
  check("telefone livre: o lead é gravado pelo serviço (lote lead + índice) e o modal fecha", s.criar.length === 1 && s.criar[0].dados.telefone === "(41) 99618-3695" && s.criar[0].o.uid === "adm" && fechou === 1);
  check("admin continua cadastrando na fila (sem responsável, não assumido)", s.criar[0].dados.assumido === false && s.criar[0].dados.responsavelUid === "" && s.criar[0].dados.etapa === 0);
  await m.desmontar();

  s = novoServico({ criar: async () => { throw dup(); } }); alertas.length = 0; fechou = 0;
  m = await montar(h(LeadModal, { aberto: true, fechar: () => { fechou++; }, modoGerencial: false }));
  await preencher("+55 41 9618-3695"); await clicarTexto(/^Cadastrar Lead$/);
  const aviso = document.querySelector(".avisoTelefone");
  check("telefone de outro lead: mensagem EXATA na tela", aviso && aviso.textContent.includes(MSG), aviso?.textContent);
  check("o modal NÃO fecha, o formulário não é limpo e nenhum alerta de sucesso aparece", fechou === 0 && document.querySelectorAll(".leadModal input")[1].value === "+55 41 9618-3695" && alertas.length === 0);
  check("nenhum evento da timeline foi registrado (lead não existe)", globalThis.__eventos.length === 0);
  check("NÃO existe opção 'Cadastrar mesmo assim'", !/mesmo assim/i.test(textoDaPagina()));
  check("mostra quem já tem o número (nome e responsável), sem botão de consulta no cadastro normal", /Maria Existente/.test(aviso.textContent) && /Ana Lara/.test(aviso.textContent) && ![...aviso.querySelectorAll("button")].length);
  await act(async () => { setValor(document.querySelectorAll(".leadModal input")[1], "(41) 90000-0000"); }); await wait();
  check("ao mexer no telefone o aviso some", !document.querySelector(".avisoTelefone"));
  await m.desmontar();

  s = novoServico(); alertas.length = 0;
  m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: false }));
  await preencher("123"); await clicarTexto(/^Cadastrar Lead$/);
  check("telefone inválido: bloqueia na tela com a mensagem de telefone inválido, sem chamar o serviço", s.criar.length === 0 && /telefone brasileiro válido/i.test(document.querySelector(".avisoTelefone")?.textContent || ""));
  await m.desmontar();

  for (const ruim of ["99618-3695", "996183695", "419618369", "41996183695512", "(41) 19618-3695", "(10) 99618-3695"]) {
    s = novoServico(); globalThis.__auth = ADMIN;
    m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: false }));
    await preencher(ruim); await clicarTexto(/^Cadastrar Lead$/);
    const aviso = document.querySelector(".avisoTelefone")?.textContent || "";
    check(`cadastro normal: telefone fora do padrão ${JSON.stringify(ruim)} é bloqueado na tela (10 ou 11 dígitos com DDD), sem chamar o serviço`, s.criar.length === 0 && /10 ou 11 dígitos/.test(aviso) && /DDD/.test(aviso));
    await m.desmontar();
  }
  s = novoServico(); globalThis.__auth = ADMIN;
  m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: true }));
  await preencher("99618-3695"); await clicarTexto(/^Cadastrar Lead Gerencial$/);
  check("cadastro gerencial: telefone sem DDD também é bloqueado na tela", s.criar.length === 0 && /10 ou 11 dígitos/.test(document.querySelector(".avisoTelefone")?.textContent || ""));
  await m.desmontar();

  globalThis.__auth = RECEP; s = novoServico({ criar: async () => { throw dup(); } });
  m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: false }));
  await preencher("41996183695"); await clicarTexto(/^Cadastrar Lead$/);
  check("recepcionista: também é bloqueada com a mesma mensagem", document.querySelector(".avisoTelefone")?.textContent.includes(MSG));
  await m.desmontar();

  globalThis.__auth = RECEP; s = novoServico();
  m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: false }));
  await preencher("(41) 98888-7777"); await clicarTexto(/^Cadastrar Lead$/);
  check("recepcionista: lead livre é gravado já como dela (assumido, responsavelUid dela)", s.criar.length === 1 && s.criar[0].dados.assumido === true && s.criar[0].dados.responsavelUid === "ana");
  await m.desmontar();

  globalThis.__auth = ADMIN; s = novoServico({ criar: async () => { throw Object.assign(new Error("permission-denied"), { code: "permission-denied" }); } }); alertas.length = 0;
  m = await montar(h(LeadModal, { aberto: true, fechar: () => {}, modoGerencial: false }));
  await preencher("(41) 99999-0000"); await clicarTexto(/^Cadastrar Lead$/);
  check("outro erro qualquer continua com o aviso genérico de sempre (não é confundido com duplicidade)", alertas.some((a) => /Não foi possível cadastrar o Lead/.test(a)) && !document.querySelector(".avisoTelefone"));
  await m.desmontar();
}

console.log("\n=== B. Cadastro GERENCIAL");
{
  globalThis.__auth = ADMIN;
  let s = novoServico(); alertas.length = 0; let fechou = 0;
  let m = await montar(h(LeadModal, { aberto: true, fechar: () => { fechou++; }, modoGerencial: true }));
  await preencher("(41) 97777-2222"); await clicarTexto(/^Cadastrar Lead Gerencial$/);
  check("telefone livre: grava sob responsabilidade do gestor, com cadastroGerencial", s.criar.length === 1 && s.criar[0].dados.cadastroGerencial === true && s.criar[0].dados.assumido === true && s.criar[0].dados.responsavelUid === "adm");
  check("o evento CADASTRO_GERENCIAL é registrado (sem o antigo campo duplicidadeIgnorada) e o modal fecha", globalThis.__eventos.length === 1 && globalThis.__eventos[0].tipo === "CADASTRO_GERENCIAL" && !("duplicidadeIgnorada" in globalThis.__eventos[0].dados) && fechou === 1);
  await m.desmontar();

  s = novoServico({ criar: async () => { throw dup(); } }); alertas.length = 0; fechou = 0;
  m = await montar(h(LeadModal, { aberto: true, fechar: () => { fechou++; }, modoGerencial: true }));
  await preencher("5541972222222".slice(0, 4) + "97777-2222"); await clicarTexto(/^Cadastrar Lead Gerencial$/);
  const aviso = document.querySelector(".avisoTelefone");
  check("duplicado: mensagem exata e salvamento bloqueado", aviso?.textContent.includes(MSG) && fechou === 0 && globalThis.__eventos.length === 0);
  check("NÃO existe 'Cadastrar mesmo assim' (a confirmação que permitia duplicar foi removida)", !/mesmo assim/i.test(textoDaPagina()) && ![...document.querySelectorAll("button")].some((b) => /mesmo assim/i.test(b.textContent)));
  check("no gerencial há 'Consultar cadastro' do lead existente", [...aviso.querySelectorAll("button")].some((b) => /Consultar cadastro/.test(b.textContent)));
  await m.desmontar();
}

console.log("\n=== C. Edição do lead");
{
  globalThis.__auth = RECEP;
  const lead = { id: "L1", nome: "Maria", telefone: "(41) 99618-3695", idade: 30, objetivo: "", origem: "Site" };
  let s = novoServico(); let atual = null;
  let m = await montar(h(EditarLeadAction, { lead, setLead: (l) => { atual = l; } }));
  await clicarTexto(/Editar/);
  await clicarTexto(/^Salvar$/);
  check("editar SEM mexer no telefone: salva normalmente (não bloqueia o próprio telefone)", s.editar.length === 1 && s.editar[0].id === "L1" && s.editar[0].dados.telefone === "(41) 99618-3695" && atual?.telefone === "(41) 99618-3695");
  check("a edição envia o uid real de quem está logado", s.editar[0].o.uid === "ana");
  check("o modal de edição fechou", !document.querySelector(".leadActionModal"));
  await m.desmontar();

  {
    const antigo = { id: "L7", nome: "Antigo", telefone: "419618369", idade: 30, objetivo: "", origem: "Site" };
    s = novoServico(); atual = null;
    m = await montar(h(EditarLeadAction, { lead: antigo, setLead: (l) => { atual = l; } }));
    await clicarTexto(/Editar/);
    await act(async () => { setValor(document.querySelector(".leadActionModal input[type=text]"), "Antigo Renomeado"); }); await wait();
    await clicarTexto(/^Salvar$/);
    check("lead ANTIGO com telefone fora do padrão: editar o nome (telefone intocado) NÃO é bloqueado pela tela e o telefone original segue como estava", s.editar.length === 1 && s.editar[0].dados.telefone === "419618369" && s.editar[0].dados.nome === "Antigo Renomeado" && atual?.telefone === "419618369" && !document.querySelector(".avisoTelefone"));
    await m.desmontar();
  }

  s = novoServico({ editar: async () => { throw dup({ id: "L9", nome: "Outra Pessoa", responsavel: "Isa" }); } }); atual = null;
  m = await montar(h(EditarLeadAction, { lead, setLead: (l) => { atual = l; } }));
  await clicarTexto(/Editar/);
  await act(async () => { setValor(document.querySelector(".leadActionModal input[type=tel]"), "(41) 98888-1111"); }); await wait();
  await clicarTexto(/^Salvar$/);
  const aviso = document.querySelector(".leadActionModal .avisoTelefone");
  check("alterar para telefone de outro lead: mensagem exata, nada é salvo e o modal continua aberto", aviso?.textContent.includes(MSG) && !!document.querySelector(".leadActionModal") && atual === null);
  await act(async () => { setValor(document.querySelector(".leadActionModal input[type=tel]"), "(41) 97777-0000"); }); await wait();
  check("ao corrigir o telefone o aviso some", !document.querySelector(".avisoTelefone"));
  await m.desmontar();

  s = novoServico({ editar: async () => { throw Object.assign(new Error("x"), { codigo: "TELEFONE_INVALIDO" }); } });
  m = await montar(h(EditarLeadAction, { lead, setLead: () => {} }));
  await clicarTexto(/Editar/);
  await act(async () => { setValor(document.querySelector(".leadActionModal input[type=tel]"), "abc"); }); await wait();
  await clicarTexto(/^Salvar$/);
  check("telefone novo inválido: aviso próprio, modal aberto", /telefone brasileiro válido/i.test(document.querySelector(".leadActionModal .avisoTelefone")?.textContent || "") && !!document.querySelector(".leadActionModal"));
  await m.desmontar();
}

console.log("\n=== D. Ferramenta 'Telefones dos Leads': repetidos e 'Telefones fora do padrão'");
{
  const analise = {
    totalLeads: 20, jaIndexados: 3,
    pendentes: [{ chave: "4196183695", lead: { id: "A" } }, { chave: "4133334444", lead: { id: "B" } }],
    grupos: [{ chave: "4196183695", titularId: "A", leads: [{ id: "A", nome: "Maria Mãe", telefone: "(41) 99618-3695", responsavel: "Ana", titular: true }, { id: "C", nome: "João Filho", telefone: "+55 41 9618-3695", responsavel: "Isa", titular: false }] }],
    foraDoPadrao: [
      { id: "X1", nome: "Sem DDD", telefone: "99618-3695", responsavel: "Ana", motivo: "CURTO", motivoTexto: "poucos dígitos (provavelmente sem DDD ou incompleto)", digitos: "996183695", repetidoEmOutroLead: false },
      { id: "X2", nome: "Incompleto A", telefone: "419618369", responsavel: "Isa", motivo: "CURTO", motivoTexto: "poucos dígitos (provavelmente sem DDD ou incompleto)", digitos: "419618369", repetidoEmOutroLead: true },
      { id: "X3", nome: "Incompleto B", telefone: "41 9618-369", responsavel: "Isa", motivo: "CURTO", motivoTexto: "poucos dígitos (provavelmente sem DDD ou incompleto)", digitos: "419618369", repetidoEmOutroLead: true },
      { id: "X4", nome: "Sem telefone", telefone: "", responsavel: "", motivo: "AUSENTE", motivoTexto: "sem telefone", digitos: "", repetidoEmOutroLead: false },
    ],
    semTelefoneValido: undefined, orfaos: [],
  };
  globalThis.__auth = ADMIN; let s = novoServico(); s.analises = 0;
  globalThis.__servico.analisar = async () => analise;
  let m = await montar(h(TelefonesLeadsModal, { aberto: true, fechar: () => {} }));
  check("antes de analisar não mostra seções", !document.querySelector("[data-secao='fora-do-padrao']"));
  await clicarTexto(/Analisar leads/);
  const secao = document.querySelector("[data-secao='fora-do-padrao']");
  check("seção 'Telefones fora do padrão' aparece com a contagem (4)", !!secao && /Telefones fora do padrão \(4\)/.test(secao.textContent));
  check("cada telefone fora do padrão é listado com nome, telefone como gravado e MOTIVO (nenhum omitido)", ["Sem DDD", "Incompleto A", "Incompleto B", "Sem telefone"].every((n) => secao.textContent.includes(n)) && secao.textContent.includes("99618-3695") && secao.textContent.includes("41 9618-369") && (secao.textContent.match(/poucos dígitos/g) || []).length === 3 && /sem telefone/.test(secao.textContent) && secao.textContent.includes("(vazio)"));
  check("os iguais entre si são sinalizados ('mesmo número digitado em outro lead')", (secao.textContent.match(/mesmo número digitado em outro lead/g) || []).length === 2);
  check("a tela avisa que nada foi alterado e como corrigir", /Nada foi alterado/.test(secao.textContent) && /Editar/.test(secao.textContent));
  check("o resumo mostra os 4 fora do padrão e o grupo repetido com titular e o compartilhado", /Telefones fora do padrão: 4/.test(textoDaPagina()) && /Maria Mãe/.test(textoDaPagina()) && /João Filho/.test(textoDaPagina()) && /um telefone só pode\s+pertencer a um lead/i.test(textoDaPagina().replace(/\s+/g, " ")) || /um telefone só pode pertencer a um lead/.test(textoDaPagina()));
  check("o botão de indexar mostra só os pendentes válidos (2)", [...document.querySelectorAll("button")].some((b) => /Indexar telefones \(2\)/.test(b.textContent)));
  await clicarTexto(/Indexar telefones/);
  check("indexar usa só a lista de pendentes (os fora do padrão NUNCA vão para o índice)", s.indexacoes?.length === 1 && s.indexacoes[0].analise.pendentes.length === 2 && s.indexacoes[0].analise.pendentes.every((p) => !["X1", "X2", "X3", "X4"].includes(p.lead.id)) && s.indexacoes[0].o.uid === "adm");
  await m.desmontar();

  globalThis.__auth = RECEP; s = novoServico(); globalThis.__servico.analisar = async () => analise;
  m = await montar(h(TelefonesLeadsModal, { aberto: true, fechar: () => {} }));
  check("recepcionista não vê a ferramenta", !document.querySelector(".leadModal"));
  await m.desmontar();

  globalThis.__auth = ADMIN; s = novoServico(); globalThis.__servico.analisar = async () => ({ ...analise, foraDoPadrao: [] });
  m = await montar(h(TelefonesLeadsModal, { aberto: true, fechar: () => {} }));
  await clicarTexto(/Analisar leads/);
  check("sem telefones fora do padrão a seção diz isso (e continua visível)", /Nenhum lead com telefone fora do padrão/.test(document.querySelector("[data-secao='fora-do-padrao']")?.textContent || ""));
  await m.desmontar();
}

await vite.close();
fim();
