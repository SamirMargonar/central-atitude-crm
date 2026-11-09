// LEADS EM TEMPO REAL + ALERTA SONORO — useLeads + NotificationCenter montados juntos como no App
// (jsdom + Vite SSR). Firestore e <audio> FALSOS: o teste "empurra" snapshots e conta play()/pause().
// Só leitura: o falso NÃO oferece nenhuma função de escrita.
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

// ---------- <audio> falso (jsdom não implementa play/pause) ----------
const audio = { tocando: false, bloqueado: false, plays: 0, pauses: 0 };
const proto = dom.window.HTMLMediaElement.prototype;
proto.play = function () { audio.plays += 1; if (audio.bloqueado) return Promise.reject(Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" })); audio.tocando = true; return Promise.resolve(); };
proto.pause = function () { audio.pauses += 1; audio.tocando = false; };
Object.defineProperty(proto, "paused", { configurable: true, get() { return !audio.tocando; } });
const zerarAudio = () => { audio.tocando = false; audio.bloqueado = false; audio.plays = 0; audio.pauses = 0; };

// ---------- módulos de apoio falsos ----------
const mk = mkdtempSync(path.join(tmpdir(), "tme-ui-leads-"));
symlinkSync(REPO + "/node_modules", mk + "/node_modules");
writeFileSync(`${mk}/firebase.js`, `export const db = {}; export const auth = {};\n`);
writeFileSync(`${mk}/auth.js`, `import { obterPermissoes } from "${REPO}/src/core/Permissions.js";
export function useAuth() { const a = globalThis.__auth; return { ...a, permissoes: obterPermissoes(a.perfilUsuario.perfil) }; }\n`);
writeFileSync(`${mk}/visita.js`, `export async function buscarVisitasPorPerfil() { return []; }\n`);
writeFileSync(`${mk}/evento.js`, `export async function atualizarLead() {}\n`);
const vite = await createServer({
  root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, ssr: { noExternal: [] },
  resolve: { alias: {
    "../firebase/firebase": `${mk}/firebase.js`,
    "../auth/AuthContext": `${mk}/auth.js`, "../../auth/AuthContext": `${mk}/auth.js`,
    "../../Agenda/VisitaEngine": `${mk}/visita.js`, "../../core/EventEngine": `${mk}/evento.js`,
  } },
});
const { default: useLeads } = await vite.ssrLoadModule("/src/hooks/useLeads.js");
const { default: NotificationCenter } = await vite.ssrLoadModule("/src/components/NotificationCenter/NotificationCenter.jsx");

// ---------- Firestore falso ----------
function criarFalso() {
  const escutas = [];
  const fs = {
    collection: (_db, nome) => ({ tipo: "colecao", caminho: nome }),
    where: (...a) => ({ a }),
    query: (col, ...restr) => ({ tipo: "consulta", caminho: col.caminho, restr, chave: restr.length === 1 ? "proprios" : "fila" }),
    onSnapshot: (ref, ok, erro) => { const e = { ref, chave: ref.chave || "todos", ok, erro, aberta: true }; escutas.push(e); return () => { e.aberta = false; }; },
    getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  };
  const abertas = (chave) => escutas.filter((e) => e.aberta && (!chave || e.chave === chave));
  const snapshot = (lista) => ({ size: lista.length, docs: lista.map((l) => ({ id: l.id, data: () => { const { id: _i, ...resto } = l; return resto; } })), metadata: { fromCache: false } });
  return {
    fs, escutas, abertas,
    emitir: (chave, lista) => { for (const e of abertas(chave)) e.ok(snapshot(lista)); },
    falhar: (chave, codigo = "unavailable") => { for (const e of abertas(chave)) e.erro({ code: codigo }); },
  };
}

const L = (id, extra = {}) => ({ id, nome: "Cliente " + id, etapa: 0, assumido: false, responsavelUid: "", cadastradoPor: "Samir", cadastradoPorUid: "adm", ...extra });
const ANA = { uid: "u-ana", nome: "Ana", perfil: "recepcionista" };

const wait = (ms = 5) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
let ultimoHook = null;
function Painel({ fonte }) {
  const { leads, chegadas, statusSincronizacao } = useLeads({ fonte });
  ultimoHook = { leads, chegadas, statusSincronizacao };
  return h("div", null, h(NotificationCenter, { leads, chegadas, setPagina: () => {} }), h("span", { id: "total" }, String(leads.length)));
}
async function montar(f, perfilUsuario = ANA, { isAdmin = false } = {}) {
  zerarAudio();
  globalThis.__auth = { usuario: { uid: perfilUsuario.uid }, isAdmin, isCoordenador: perfilUsuario.perfil === "coordenador", perfilUsuario };
  document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r"));
  const render = async () => { await act(async () => { root.render(h(Painel, { fonte: { db: {}, fs: f.fs } })); }); await wait(); };
  await render();
  return { render, desmontar: async () => { await act(async () => { root.unmount(); }); } };
}
const emitir = async (fn) => { await act(async () => { fn(); }); await wait(); };
const avisos = () => document.querySelectorAll(".notificationCard").length;
const idsLista = () => ultimoHook.leads.map((l) => l.id).sort().join();
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await wait(); };
const comecar = async (f, fila = [], proprios = []) => { await emitir(() => { f.emitir("proprios", proprios); f.emitir("fila", fila); }); };

console.log("\n=== A. Consultas e permissões da recepcionista NÃO mudaram");
{
  const f = criarFalso(); const m = await montar(f);
  const prop = f.abertas("proprios"), fila = f.abertas("fila");
  check("abre exatamente 2 escutas (próprios e fila) e nenhuma na coleção inteira", f.abertas().length === 2 && prop.length === 1 && fila.length === 1 && f.escutas.every((e) => e.chave !== "todos"));
  check("próprios: where responsavelUid == uid dela", JSON.stringify(prop[0].ref.restr.map((r) => r.a)) === JSON.stringify([["responsavelUid", "==", "u-ana"]]));
  check("fila: responsavelUid == '' , etapa == 0, assumido == false", JSON.stringify(fila[0].ref.restr.map((r) => r.a)) === JSON.stringify([["responsavelUid", "==", ""], ["etapa", "==", 0], ["assumido", "==", false]]));
  check("status inicial conectando", ultimoHook.statusSincronizacao === "conectando");
  await comecar(f, [L("f1")]);
  check("depois dos dois primeiros snapshots: status ok", ultimoHook.statusSincronizacao === "ok");
  await m.desmontar();
  check("ao sair, as duas escutas são fechadas (sem vazamento)", f.abertas().length === 0);
}

console.log("\n=== B. Abrir/atualizar o CRM com leads antigos na fila: NÃO toca (e nenhum alarme fantasma)");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, [L("v1"), L("v2"), L("v3")], [L("p1", { assumido: true, responsavelUid: "u-ana" })]);
  check("os 4 leads aparecem na tela", idsLista() === "p1,v1,v2,v3");
  check("nenhuma chegada registrada (backlog = linha de base)", ultimoHook.chegadas.length === 0);
  check("SOM: nenhum play() para o backlog antigo", audio.plays === 0 && !audio.tocando);
  check("os avisos visuais da fila continuam listados (3 pendentes)", avisos() === 3);
  await m.desmontar();
  const f2 = criarFalso(); const m2 = await montar(f2);
  await comecar(f2, [L("v1"), L("v2"), L("v3")]);
  check("'F5' (remontar com o mesmo backlog): continua mudo", audio.plays === 0);
  await m2.desmontar();
}

console.log("\n=== C. Lead novo chega: aparece sem F5, toca UMA vez, não duplica");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, [L("v1")]);
  await emitir(() => f.emitir("fila", [L("v1"), L("n1")]));
  check("o lead novo aparece na lista sozinho (sem recarregar)", idsLista() === "n1,v1");
  check("uma chegada registrada", ultimoHook.chegadas.length === 1 && ultimoHook.chegadas[0].id === "n1");
  check("o alerta sonoro toca (play chamado uma vez, áudio tocando em loop)", audio.plays === 1 && audio.tocando);
  check("aviso visual do novo lead presente (2 avisos: v1 e n1)", avisos() === 2 && /Cliente n1/.test(document.body.textContent));
  await emitir(() => f.emitir("fila", [L("v1"), L("n1", { nome: "Cliente n1 (editado)" })]));
  await emitir(() => f.emitir("fila", [L("v1"), L("n1", { nome: "Cliente n1 (editado)" })]));
  check("snapshots repetidos/alterações do mesmo lead: sem novo play(), sem nova chegada, sem duplicar", audio.plays === 1 && ultimoHook.chegadas.length === 1 && ultimoHook.leads.filter((l) => l.id === "n1").length === 1 && avisos() === 2);
  await m.desmontar();
}

console.log("\n=== D. Outra recepcionista assume: o alarme PARA aqui também (sincronizado) e o lead sai da fila");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, []);
  await emitir(() => f.emitir("fila", [L("n1")]));
  check("chegou e tocou", audio.tocando && audio.plays === 1);
  await emitir(() => f.emitir("fila", []));            // outra usuária assumiu: sai da consulta da fila
  check("lead assumido por outra sai da minha lista e o som PARA", idsLista() === "" && !audio.tocando && audio.pauses >= 1);
  check("o aviso visual também some", avisos() === 0);

  await emitir(() => f.emitir("fila", [L("a"), L("b")]));
  check("dois leads novos: um alarme só (play uma vez, tocando)", audio.tocando && audio.plays === 2);
  await emitir(() => f.emitir("fila", [L("b")]));      // 'a' assumido por outra
  check("assumido um dos dois: o outro ainda mantém o alarme", audio.tocando && idsLista() === "b");
  await emitir(() => f.emitir("fila", []));
  check("assumido o último: para", !audio.tocando);
  await emitir(() => f.emitir("fila", [L("a")]));      // lead 'a' reaparece (ex.: devolvido) — já era conhecido nesta sessão
  check("o mesmo lead voltando à fila NÃO re-dispara o alerta (nenhum alerta repetido para o mesmo lead)", !audio.tocando && audio.plays === 2);
  check("e não vira uma nova chegada (continuam as 3 de antes: n1, a, b)", ultimoHook.chegadas.length === 3);
  await m.desmontar();
}

console.log("\n=== E. Eu mesma assumo: passa da fila para 'próprios' sem tocar, sem duplicar, sem voltar");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, []);
  await emitir(() => f.emitir("fila", [L("n1")]));
  check("tocando", audio.tocando);
  await emitir(() => { f.emitir("fila", []); f.emitir("proprios", [L("n1", { assumido: true, responsavelUid: "u-ana", responsavel: "Ana" })]); });
  check("assumi: o som para, o lead continua na lista UMA vez como meu", !audio.tocando && idsLista() === "n1" && ultimoHook.leads[0].assumido === true);
  check("sem nova chegada por trocar de consulta", ultimoHook.chegadas.length === 1);
  await m.desmontar();
}

console.log("\n=== F. Ver Lead / fechar (X) silenciam e o aviso não volta com os snapshots seguintes");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, []);
  await emitir(() => f.emitir("fila", [L("n1")]));
  check("tocando", audio.tocando);
  await clicar(document.querySelector(".notificationClose"));
  check("fechar (X): o som para e o aviso some", !audio.tocando && avisos() === 0);
  await emitir(() => f.emitir("fila", [L("n1"), L("n2")]));
  check("outro snapshot: o aviso do n1 NÃO volta (só o do novo n2) e o alarme é do n2", avisos() === 1 && /Cliente n2/.test(document.body.textContent) && audio.tocando);
  const ver = [...document.querySelectorAll(".notificationButton")].find((b) => /Ver Lead/.test(b.textContent));
  await clicar(ver);
  check("Ver Lead: o som para e o aviso some", !audio.tocando && avisos() === 0);
  await m.desmontar();
}

console.log("\n=== G. Quem NÃO deve ouvir: lead cadastrado por mim, admin e coordenador");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, []);
  await emitir(() => f.emitir("fila", [L("meu", { cadastradoPorUid: "u-ana", cadastradoPor: "Ana" })]));
  check("lead cadastrado pela própria recepcionista: aparece, mas NÃO toca", idsLista() === "meu" && audio.plays === 0);
  await m.desmontar();

  for (const perfil of [{ uid: "adm", nome: "Samir", perfil: "admin" }, { uid: "coord", nome: "Nay", perfil: "coordenador" }]) {
    const g = criarFalso(); const mm = await montar(g, perfil, { isAdmin: perfil.perfil === "admin" });
    check(`${perfil.perfil}: UMA escuta na coleção inteira (como antes)`, g.abertas().length === 1 && g.abertas("todos").length === 1);
    await emitir(() => g.emitir("todos", [L("a")]));
    await emitir(() => g.emitir("todos", [L("a"), L("b")]));
    check(`${perfil.perfil}: vê o lead novo em tempo real, mas NUNCA toca`, idsLista() === "a,b" && audio.plays === 0 && ultimoHook.chegadas.length === 1);
    await mm.desmontar();
  }
}

console.log("\n=== H. Escuta cai: a lista NÃO é apagada, reabre sozinha e o lead criado durante a queda toca ao voltar");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, [L("v1")], [L("p1", { assumido: true, responsavelUid: "u-ana" })]);
  await emitir(() => f.falhar("fila"));
  check("erro na escuta da fila: lista mantida (v1 e p1 continuam na tela), status reconectando", idsLista() === "p1,v1" && ultimoHook.statusSincronizacao === "reconectando");
  check("a escuta morta foi fechada; a dos próprios segue aberta", f.abertas("fila").length === 0 && f.abertas("proprios").length === 1);
  await act(async () => { await new Promise((r) => setTimeout(r, 2200)); });
  check("reabriu sozinha (sem F5), uma só escuta da fila", f.abertas("fila").length === 1);
  await emitir(() => f.emitir("fila", [L("v1"), L("perdido")]));   // chegou enquanto estava fora
  check("o lead criado durante a queda aparece e TOCA", idsLista() === "p1,perdido,v1" && audio.tocando && audio.plays === 1);
  check("status volta a ok", ultimoHook.statusSincronizacao === "ok");
  await m.desmontar();
  check("sem vazamento: tudo fechado ao sair", f.abertas().length === 0);
}

console.log("\n=== I. Autoplay bloqueado pelo navegador: o primeiro gesto libera E já toca o alarme pendente");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, []);
  audio.bloqueado = true;
  await emitir(() => f.emitir("fila", [L("n1")]));
  check("sem gesto o navegador bloqueia: tentou tocar e não está tocando", audio.plays === 1 && !audio.tocando);
  audio.bloqueado = false;       // a usuária interage com a página
  await act(async () => { dom.window.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })); }); await wait();
  check("após o gesto o alarme pendente passa a tocar (não é desligado pelo destravamento)", audio.tocando);
  await emitir(() => f.emitir("fila", []));
  check("e para normalmente quando o lead é assumido", !audio.tocando);
  await m.desmontar();

  const g = criarFalso(); const mm = await montar(g);
  await comecar(g, []);
  await act(async () => { dom.window.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })); }); await wait();
  check("gesto SEM alarme pendente: destrava em silêncio (não deixa tocando)", !audio.tocando);
  await mm.desmontar();
}

console.log("\n=== J. Re-render com o perfil recriado (mesmo uid) não refaz escutas nem a linha de base");
{
  const f = criarFalso(); const m = await montar(f);
  await comecar(f, [L("v1")]);
  const antes = f.escutas.length;
  globalThis.__auth = { ...globalThis.__auth, perfilUsuario: { ...ANA } };   // novo objeto, mesma identidade
  await m.render();
  check("mesma identidade, objeto novo: NENHUMA escuta nova (sem releituras)", f.escutas.length === antes && f.abertas().length === 2);
  await emitir(() => f.emitir("fila", [L("v1"), L("n1")]));
  check("e a detecção de chegadas continua funcionando", audio.tocando && ultimoHook.chegadas.length === 1);
  await m.desmontar();
}

fim();
await vite.close();
