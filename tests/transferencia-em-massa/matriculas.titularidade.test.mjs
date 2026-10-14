// MÉTRICA DE MATRÍCULAS — a matrícula conta para a consultora TITULAR do lead; a autoria do fechamento é outra informação.
// Testa as funções puras, o Relatório de Matrículas (jsdom + Vite SSR), a agregação por consultora dos Relatórios e (estático) que
// Dashboard/Relatórios não usam quem fechou como critério. Nada toca produção.
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { REPO, criarRelatorio } from "./helpers.mjs";

const dom = new JSDOM("<!doctype html><body><div id='r'></div></body>", { url: "http://localhost/" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(REPO + "/package.json");
const React = require("react"); const { createRoot } = require("react-dom/client"); const { act } = React; const h = React.createElement;
const { createServer } = await import(REPO + "/node_modules/vite/dist/node/index.js");
const { check, fim } = criarRelatorio();
const vite = await createServer({ root: REPO, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, ssr: { noExternal: [] } });
const F = await vite.ssrLoadModule("/src/utils/matriculasFilters.js");
const { default: Relatorio } = await vite.ssrLoadModule("/src/components/RelatorioMatriculas.jsx");
const C = await vite.ssrLoadModule("/src/core/RelatoriosCalculos.js");

const MAT = (extra = {}) => ({ confirmada: true, plano: "MENSAL", status: "ATIVA", data: "14/10/2026", dataInicio: "2026-10-14", dataVencimento: "2026-11-14", ...extra });
// A: titular Ana, fechada por Isabelle (UID diferente)  B: titular Ana, fechada por ela mesma  C: matrícula ANTIGA (sem registradoPor)
// D: antiga confirmada por ADMIN (matricula.consultor = Samir) em lead da Carla  E: titular trocada por transferência (Larissa) — fechada por Isabelle
const A = { id: "A", nome: "Cliente A", etapa: 5, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", matricula: MAT({ consultor: "Ana Lara", registradoPorUid: "isa", registradoPorNome: "Isabelle", atendimentoCompartilhado: true }) };
const B = { id: "B", nome: "Cliente B", etapa: 5, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", matricula: MAT({ consultor: "Ana Lara", registradoPorUid: "ana", registradoPorNome: "Ana Lara", atendimentoCompartilhado: false }) };
const Cc = { id: "C", nome: "Cliente C", etapa: 5, responsavelUid: "bia", responsavel: "Bia", consultora: "Bia", matricula: MAT({ consultor: "Bia" }) };
const D = { id: "D", nome: "Cliente D", etapa: 5, responsavelUid: "carla", responsavel: "Carla", consultora: "Carla", matricula: MAT({ consultor: "Samir" }) };
const E = { id: "E", nome: "Cliente E", etapa: 5, responsavelUid: "lari", responsavel: "Larissa", consultora: "Larissa", matricula: MAT({ consultor: "Larissa", registradoPorUid: "isa", registradoPorNome: "Isabelle", atendimentoCompartilhado: true }) };
const SEM = { id: "S", nome: "Sem matrícula", etapa: 4, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara" };

console.log("\n=== A. Funções puras");
check("titular = responsável do lead (não quem fechou)", F.consultoraTitularDaMatricula(A) === "Ana Lara" && F.consultoraTitularDaMatricula(E) === "Larissa");
check("matrícula antiga confirmada por admin (matricula.consultor='Samir') conta para a titular do lead (Carla)", F.consultoraTitularDaMatricula(D) === "Carla");
check("sem responsável no lead, cai no matricula.consultor (legado)", F.consultoraTitularDaMatricula({ matricula: MAT({ consultor: "Bia" }) }) === "Bia" && F.consultoraTitularDaMatricula({}) === "");
check("'fechada por outra pessoa': só quando o autor (UID) é diferente da titular", F.fechamentoPorOutraPessoa(A) === "Isabelle" && F.fechamentoPorOutraPessoa(B) === "" && F.fechamentoPorOutraPessoa(E) === "Isabelle");
check("matrícula antiga (sem registradoPor): sem 'fechada por'", F.fechamentoPorOutraPessoa(Cc) === "" && F.fechamentoPorOutraPessoa(D) === "");
check("sem UID de um dos lados compara por nome normalizado (maiúsculas/acentos)", F.fechamentoPorOutraPessoa({ responsavel: "Ana Lara", matricula: MAT({ registradoPorNome: "ANA LARA" }) }) === "" && F.fechamentoPorOutraPessoa({ responsavel: "Ana Lara", matricula: MAT({ registradoPorNome: "Isabelle" }) }) === "Isabelle");
check("o UID decide: mesmo UID com nome diferente = a própria titular; UID diferente com o mesmo nome (homônima) = outra pessoa", F.fechamentoPorOutraPessoa({ responsavelUid: "ana", responsavel: "Ana Lara", matricula: MAT({ registradoPorUid: "ana", registradoPorNome: "Ana L." }) }) === "" && F.fechamentoPorOutraPessoa({ responsavelUid: "ana", responsavel: "Ana Lara", matricula: MAT({ registradoPorUid: "outra", registradoPorNome: "Ana Lara" }) }) === "Ana Lara");
const todos = [A, B, Cc, D, E, SEM];
check("filtrarMatriculados ignora lead sem matrícula confirmada", F.filtrarMatriculados(todos).length === 5);
const mat = F.filtrarMatriculados(todos);
check("filtro por consultora usa a TITULAR: 'Ana Lara' = A e B (inclui a fechada por Isabelle)", F.filtrarRelatorioMatriculas(mat, { consultor: "Ana Lara" }).map((l) => l.id).sort().join() === "A,B");
check("filtro por quem fechou NÃO existe como critério: 'Isabelle' não devolve nada", F.filtrarRelatorioMatriculas(mat, { consultor: "Isabelle" }).length === 0);
check("filtro 'Carla' devolve a matrícula antiga confirmada pelo admin; 'Samir' nada", F.filtrarRelatorioMatriculas(mat, { consultor: "Carla" }).map((l) => l.id).join() === "D" && F.filtrarRelatorioMatriculas(mat, { consultor: "Samir" }).length === 0);

console.log("\n=== B. Relatório de Matrículas (tela)");
const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function montar(el) { document.body.innerHTML = "<div id='r'></div>"; const root = createRoot(document.getElementById("r")); await act(async () => { root.render(el); }); await wait(20); return async () => { await act(async () => { root.unmount(); }); document.body.innerHTML = ""; }; }
const itens = () => [...document.body.querySelectorAll(".relatorioMatriculasItem")];
{
  const fechar = await montar(h(Relatorio, { leads: todos, aberto: true, fechar: () => {} }));
  const selects = [...document.body.querySelectorAll("select")]; const opcoesConsultor = selects.map((s) => [...s.options].map((o) => o.textContent)).find((o) => o.includes("Todos os consultores") || o.includes("Ana Lara")) || [];
  check("a lista de consultoras do filtro é a das TITULARES (Ana Lara, Bia, Carla, Larissa) — nunca quem fechou nem o admin", ["Ana Lara", "Bia", "Carla", "Larissa"].every((n) => opcoesConsultor.includes(n)) && !opcoesConsultor.includes("Isabelle") && !opcoesConsultor.includes("Samir"), JSON.stringify(opcoesConsultor));
  check("5 matrículas listadas", itens().length === 5, String(itens().length));
  const doLead = (nome) => itens().find((i) => i.textContent.includes(nome));
  check("matrícula fechada por Isabelle: Consultor = Ana Lara e aparece 'Fechada por Isabelle'", /Consultor\s*Ana Lara/.test(doLead("Cliente A").textContent) && /Fechada por\s*Isabelle/.test(doLead("Cliente A").textContent));
  check("fechada pela própria titular: sem 'Fechada por'", !doLead("Cliente B").textContent.includes("Fechada por"));
  check("matrícula antiga: Consultor = titular do lead (Carla), sem 'Fechada por' e sem 'Samir'", /Consultor\s*Carla/.test(doLead("Cliente D").textContent) && !doLead("Cliente D").textContent.includes("Samir") && !doLead("Cliente D").textContent.includes("Fechada por"));
  check("lead transferido (titular atual Larissa) fechado por Isabelle: Consultor = Larissa; 'Fechada por Isabelle'", /Consultor\s*Larissa/.test(doLead("Cliente E").textContent) && /Fechada por\s*Isabelle/.test(doLead("Cliente E").textContent));
  await fechar();
}

console.log("\n=== C. Relatórios/Dashboard: o crédito é da titular (agregação por consultora e leitura estática)");
{
  const g = C.calcularDesempenhoPorConsultora([A, B, Cc, D, E], [], { ana: { nome: "Ana Lara" }, isa: { nome: "Isabelle" }, bia: { nome: "Bia" }, carla: { nome: "Carla" }, lari: { nome: "Larissa" } });
  const porNome = Object.fromEntries(g.map((x) => [x.nome, x]));
  const quant = (x) => x?.indicadores?.matriculas ?? x?.matriculas ?? x?.total ?? 0;
  check("agregação por consultora credita 2 matrículas à Ana Lara (uma fechada por Isabelle) e nenhuma à Isabelle", !porNome["Isabelle"] && quant(porNome["Ana Lara"]) === 2, JSON.stringify(g.map((x) => [x.nome, quant(x)])));
  check("a matrícula fechada por Isabelle em lead da Larissa conta para a Larissa", quant(porNome["Larissa"]) === 1);
  const indic = C.calcularIndicadores([A, B, Cc, D, E, SEM], []);
  check("indicador geral de matrículas continua contando 5 leads em etapa de matrícula (nada muda no total)", indic.matriculas === 5, String(indic.matriculas));
}
const leitura = (f) => readFileSync(`${REPO}/${f}`, "utf8");
for (const f of ["src/components/Dashboard.jsx", "src/core/RelatoriosCalculos.js", "src/components/Relatorios/Relatorios.jsx", "src/hooks/useLeads.js"]) {
  const src = leitura(f);
  check(`${f}: não usa matricula.consultor nem registradoPor* como critério de métrica`, !/matricula\??\.consultor|registradoPor|atendimentoCompartilhado/.test(src));
}
check("Dashboard conta matrículas pelos leads do escopo (etapa), não por quem fechou", /const matriculas =\s*leads\.filter/.test(leitura("src/components/Dashboard.jsx").replace(/\s+/g, " ").replace("const matriculas = leads.filter", "const matriculas =\nleads.filter")) || /matriculas\s*=\s*leads\.filter/.test(leitura("src/components/Dashboard.jsx").replace(/\s+/g, " ")));
check("MatriculaAction grava no mapa da matrícula consultor = titular e registradoPor* = quem fechou", (() => { const f = leitura("src/components/LeadDetailsModal/actions/MatriculaAction.jsx"); const ini = f.indexOf("const dadosMatricula = {"); const bloco = f.slice(ini, f.indexOf("};", ini)).split("\n").filter((l) => !l.trim().startsWith("//")).join(" ").replace(/\s+/g, " "); return ini > 0 && /consultor: titularNome/.test(bloco) && /registradoPorUid: usuario\?\.uid/.test(bloco) && /registradoPorNome: nomeResponsavel/.test(bloco); })());
check("EditarMatriculaAction preserva o consultor e a autoria da matrícula (só troca plano/datas/observação)", (() => { const src = leitura("src/components/LeadDetailsModal/actions/EditarMatriculaAction.jsx").replace(/\s+/g, " "); return /\.\.\.matriculaAnterior, plano, dataInicio, dataVencimento, observacao,/.test(src) && !/consultor\s*:/.test(src) && !/registradoPor/.test(src); })());

await vite.close();
process.exit(fim() ? 1 : 0);
