// GERENCIAMENTO DE PLANOS — Firestore Rules reais (Emulator) + serviço real contra as Rules.
// Nada aqui toca produção: só Emulator local.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } = fs;
const { criarServicoPlanos } = await import(`${REPO}/src/services/../planos/servicoPlanos.js`);
const { montarSnapshotPlano } = await import(`${REPO}/src/utils/planos.js`);

const env = await initializeTestEnvironment({
  projectId: "demo-tme-planos",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const { t, par, check, fim } = criarRelatorio();
const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const SRV = serverTimestamp;
const NOMES = { [ADM]: "Samir", [NAY]: "Naykison", isa: "Isabelle", ana: "Ana Lara", "coord-outro": "Outro Coord", inat: "Inativa" };

async function seedBase() {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "12:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador"); await u("coord-outro", "Outro Coord", "coordenador");
    await u("isa", "Isabelle", "recepcionista"); await u("ana", "Ana Lara", "recepcionista"); await u("inat", "Inativa", "recepcionista", { ativo: false });
    await setDoc(doc(db, "leads", "LN"), { nome: "Cliente LN", telefone: "000", etapa: 4, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara" });
  });
}

const planoDoc = (uid, extra = {}) => ({
  nome: "Plano Promo 3m", categoriaId: "promocionais", duracaoMeses: 3, valorCentavos: 9990, taxaAdesaoCentavos: null,
  descricao: "", condicoes: "", ofertaInicio: null, ofertaFim: null, ativo: true, ordem: 1,
  criadoEm: SRV(), criadoPorUid: uid, criadoPorNome: NOMES[uid] || "", atualizadoEm: SRV(), atualizadoPorUid: uid, atualizadoPorNome: NOMES[uid] || "", ...extra,
});
const catDoc = (uid, extra = {}) => ({ nome: "Promocionais", ativo: true, ordem: 2, criadoEm: SRV(), criadoPorUid: uid, criadoPorNome: NOMES[uid] || "", atualizadoEm: SRV(), atualizadoPorUid: uid, atualizadoPorNome: NOMES[uid] || "", ...extra });
const editar = (uid, extra = {}) => ({ atualizadoEm: SRV(), atualizadoPorUid: uid, atualizadoPorNome: NOMES[uid] || "", ...extra });

console.log("\n=== A. PLANOS — só ADMIN escreve; todos os perfis logados leem; ninguém apaga");
await seedBase();
await t("admin CRIA plano", "ALLOW", () => setDoc(doc(as(ADM), "planos", "P1"), planoDoc(ADM)));
await t("coordenador NÃO cria plano", "DENY", () => setDoc(doc(as(NAY), "planos", "P2"), planoDoc(NAY)));
await t("recepcionista NÃO cria plano", "DENY", () => setDoc(doc(as("isa"), "planos", "P3"), planoDoc("isa")));
await t("recepcionista INATIVA NÃO cria plano", "DENY", () => setDoc(doc(as("inat"), "planos", "P4"), planoDoc("inat")));
await t("sem login NÃO cria plano", "DENY", () => setDoc(doc(anon(), "planos", "P5"), planoDoc("x")));
await t("admin EDITA plano (valor/nome)", "ALLOW", () => updateDoc(doc(as(ADM), "planos", "P1"), editar(ADM, { valorCentavos: 12990, nome: "Plano Promo 3m v2" })));
await t("admin DESATIVA plano", "ALLOW", () => updateDoc(doc(as(ADM), "planos", "P1"), editar(ADM, { ativo: false })));
await t("admin REATIVA plano", "ALLOW", () => updateDoc(doc(as(ADM), "planos", "P1"), editar(ADM, { ativo: true })));
await t("coordenador NÃO edita plano", "DENY", () => updateDoc(doc(as(NAY), "planos", "P1"), editar(NAY, { valorCentavos: 1 })));
await t("coordenador NÃO desativa plano", "DENY", () => updateDoc(doc(as(NAY), "planos", "P1"), editar(NAY, { ativo: false })));
await t("recepcionista NÃO edita plano", "DENY", () => updateDoc(doc(as("isa"), "planos", "P1"), editar("isa", { valorCentavos: 1 })));
await t("admin NÃO apaga plano (histórico não é destruído)", "DENY", () => deleteDoc(doc(as(ADM), "planos", "P1")));
await t("coordenador NÃO apaga plano", "DENY", () => deleteDoc(doc(as(NAY), "planos", "P1")));
for (const [quem, uid] of [["admin", ADM], ["coordenador", NAY], ["recepcionista", "isa"], ["recepcionista inativa", "inat"]]) {
  await t(`${quem} LÊ um plano`, "ALLOW", () => getDoc(doc(as(uid), "planos", "P1")));
  await t(`${quem} LISTA planos (formulário de matrícula)`, "ALLOW", () => getDocs(collection(as(uid), "planos")));
}
await t("sem login NÃO lê planos", "DENY", () => getDocs(collection(anon(), "planos")));

console.log("\n=== B. PLANOS — validação no servidor (cada negativo tem um CONTROLE aceito)");
async function negativoPlano(nome, extraNeg) {
  await par(nome, async () => { await seedBase(); },
    (variante) => setDoc(doc(as(ADM), "planos", "PV"), planoDoc(ADM, variante ? extraNeg : {})));
}
await negativoPlano("nome vazio", { nome: "" });
await negativoPlano("nome com mais de 80 caracteres", { nome: "x".repeat(81) });
await negativoPlano("duração 0", { duracaoMeses: 0 });
await negativoPlano("duração > 120", { duracaoMeses: 121 });
await negativoPlano("duração não inteira", { duracaoMeses: 1.5 });
await negativoPlano("valor negativo", { valorCentavos: -1 });
await negativoPlano("valor decimal", { valorCentavos: 10.5 });
await negativoPlano("valor texto", { valorCentavos: "99,90" });
await negativoPlano("taxa de adesão negativa", { taxaAdesaoCentavos: -5 });
await negativoPlano("data de oferta fora do padrão AAAA-MM-DD", { ofertaInicio: "14/10/2026" });
await negativoPlano("campo desconhecido no plano", { desconto: 50 });
await negativoPlano("ativo que não é booleano", { ativo: "sim" });
await negativoPlano("descrição gigante", { descricao: "x".repeat(501) });
await negativoPlano("condições gigantes", { condicoes: "x".repeat(1001) });
await negativoPlano("autoria forjada (criadoPorUid de outra pessoa)", { criadoPorUid: NAY });
await negativoPlano("carimbo de criação do cliente (não do servidor)", { criadoEm: new Date("2020-01-01") });
await t("preço ausente/nulo é ACEITO (admin preenche depois) e janela de oferta válida também", "ALLOW", () => setDoc(doc(as(ADM), "planos", "PN"), planoDoc(ADM, { valorCentavos: null, ofertaInicio: "2026-11-01", ofertaFim: "2026-11-30" })));
await seedBase();
await setDoc(doc(as(ADM), "planos", "PU"), planoDoc(ADM));
await t("EDIÇÃO não pode trocar o criador original", "DENY", () => updateDoc(doc(as(ADM), "planos", "PU"), editar(ADM, { criadoPorUid: NAY })));
await t("EDIÇÃO não pode reescrever criadoEm", "DENY", () => updateDoc(doc(as(ADM), "planos", "PU"), editar(ADM, { criadoEm: new Date("2020-01-01") })));
await t("EDIÇÃO sem carimbo/autoria do servidor é negada", "DENY", () => updateDoc(doc(as(ADM), "planos", "PU"), { valorCentavos: 1 }));
await t("EDIÇÃO com valor inválido é negada (nome '')", "DENY", () => updateDoc(doc(as(ADM), "planos", "PU"), editar(ADM, { nome: "" })));

console.log("\n=== C. CATEGORIAS — mesma política");
await seedBase();
await t("admin cria categoria", "ALLOW", () => setDoc(doc(as(ADM), "categoriasPlano", "promocionais"), catDoc(ADM)));
await t("coordenador NÃO cria categoria", "DENY", () => setDoc(doc(as(NAY), "categoriasPlano", "x"), catDoc(NAY)));
await t("recepcionista NÃO cria categoria", "DENY", () => setDoc(doc(as("isa"), "categoriasPlano", "x"), catDoc("isa")));
await t("admin desativa categoria", "ALLOW", () => updateDoc(doc(as(ADM), "categoriasPlano", "promocionais"), editar(ADM, { ativo: false })));
await t("coordenador NÃO desativa categoria", "DENY", () => updateDoc(doc(as(NAY), "categoriasPlano", "promocionais"), editar(NAY, { ativo: true })));
await t("admin NÃO apaga categoria", "DENY", () => deleteDoc(doc(as(ADM), "categoriasPlano", "promocionais")));
await t("recepcionista lê categorias", "ALLOW", () => getDocs(collection(as("isa"), "categoriasPlano")));
await t("sem login NÃO lê categorias", "DENY", () => getDocs(collection(anon(), "categoriasPlano")));
await t("categoria sem nome é negada", "DENY", () => setDoc(doc(as(ADM), "categoriasPlano", "vazia"), catDoc(ADM, { nome: "" })));
await t("categoria com campo desconhecido é negada", "DENY", () => setDoc(doc(as(ADM), "categoriasPlano", "estranha"), catDoc(ADM, { cor: "azul" })));

console.log("\n=== D. SERVIÇO REAL contra as Rules (carga inicial pela interface do admin)");
await seedBase();
{
  const svAdm = criarServicoPlanos({ db: as(ADM), fs });
  const r1 = await svAdm.cargaInicial({ uid: ADM, nome: "Samir" }).catch((e) => ({ erro: e }));
  check("carga inicial do ADMIN passa nas Rules: 7 categorias + 4 planos", !r1.erro && r1.criadas.length === 11, r1.erro ? String(r1.erro.message).slice(0, 120) : JSON.stringify(r1));
  const planos = (await raw((db) => getDocs(collection(db, "planos")))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const mensal = planos.find((p) => p.id === "MENSAL");
  check("os 4 códigos antigos existem, sem preço, ativos e com a duração certa", ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].every((c) => planos.some((p) => p.id === c)) && mensal.valorCentavos === null && mensal.ativo === true && planos.find((p) => p.id === "ANUAL").duracaoMeses === 12);
  const r2 = await svAdm.cargaInicial({ uid: ADM, nome: "Samir" });
  check("repetir a carga inicial não cria nem altera nada", r2.criadas.length === 0 && r2.jaExistiam.length === 11);
  const id = await svAdm.salvarPlano({ dados: { nome: "Black Friday 12m", categoriaId: "black-friday", duracaoMeses: 12, valorCentavos: 99900, taxaAdesaoCentavos: 0, descricao: "", condicoes: "À vista", ofertaInicio: "2026-11-20", ofertaFim: "2026-11-30" } }, { uid: ADM, nome: "Samir" });
  check("admin cadastra plano novo pelo serviço (payload do app aceito pelas Rules)", typeof id === "string" && id.length > 5);
  await svAdm.salvarPlano({ id, dados: { nome: "Black Friday 12m", categoriaId: "black-friday", duracaoMeses: 12, valorCentavos: 89900, taxaAdesaoCentavos: 0, descricao: "", condicoes: "À vista", ofertaInicio: "2026-11-20", ofertaFim: "2026-11-30" }, ativo: false }, { uid: ADM, nome: "Samir" });
  const salvo = (await raw((db) => getDoc(doc(db, "planos", id)))).data();
  check("edição + desativação num único update: valor novo e ativo=false", salvo.valorCentavos === 89900 && salvo.ativo === false);
  const idCat = await svAdm.criarCategoria("Estudantes", { uid: ADM, nome: "Samir" }, 8);
  await svAdm.definirAtivaCategoria(idCat, false, { uid: ADM, nome: "Samir" });
  check("categoria nova criada e depois desativada (nunca excluída)", (await raw((db) => getDoc(doc(db, "categoriasPlano", idCat)))).data().ativo === false);

  // catálogo ainda inexistente: só o admin consegue criar a carga inicial
  await seedBase();
  for (const [quem, uid] of [["coordenador", NAY], ["recepcionista", "isa"]]) {
    const sv = criarServicoPlanos({ db: as(uid), fs });
    let erro = null; try { await sv.cargaInicial({ uid, nome: quem }); } catch (e) { erro = e; }
    check(`${quem}: a carga inicial pelo MESMO serviço é negada pelas Rules (não basta esconder o botão)`, erro?.code === "permission-denied");
    erro = null; try { await sv.salvarPlano({ dados: { nome: "X", categoriaId: "c", duracaoMeses: 1 } }, { uid, nome: quem }); } catch (e) { erro = e; }
    check(`${quem}: cadastrar plano pelo serviço é negado`, erro?.code === "permission-denied");
    erro = null; try { await sv.criarCategoria("Nova", { uid, nome: quem }); } catch (e) { erro = e; }
    check(`${quem}: criar categoria pelo serviço é negado`, erro?.code === "permission-denied");
  }
  check("nada foi criado pelos não-admins", (await raw((db) => getDocs(collection(db, "planos")))).empty && (await raw((db) => getDocs(collection(db, "categoriasPlano")))).empty);
  await svAdm.cargaInicial({ uid: ADM, nome: "Samir" });
  for (const [quem, uid] of [["coordenador", NAY], ["recepcionista", "isa"]]) {
    const cat = await criarServicoPlanos({ db: as(uid), fs }).carregarCatalogo();
    check(`${quem}: consegue LER o catálogo (para a matrícula)`, cat.planos.length === 4 && cat.categorias.length === 7);
  }
}

console.log("\n=== E. EVENTO DE REAGENDAMENTO feito pela Agenda (mesmo payload do app) passa nas Rules");
const evReag = (uid, extra = {}) => ({ leadId: "LN", tipo: "VISITA", usuario: NOMES[uid], usuarioUid: uid, descricao: "reagendou a visita", dados: { origem: "AGENDA", visitaId: "V1", visitaAnterior: { data: "2026-10-14", hora: "15:00", consultor: "Ana Lara" }, novaVisita: { data: "2026-10-20", hora: "16:30", consultor: "Ana Lara" }, atendimentoCompartilhado: true, titularNome: "Ana Lara" }, criadoEm: SRV(), ...extra });
const addEv = (uid, ev) => addDoc(collection(as(uid), "leads", "LN", "eventos"), ev);
await seedBase();
await t("recepcionista ATIVA que não é a titular registra o reagendamento", "ALLOW", () => addEv("isa", evReag("isa")));
await t("a TITULAR registra o reagendamento", "ALLOW", () => addEv("ana", evReag("ana", { dados: { origem: "AGENDA", visitaId: "V1", atendimentoCompartilhado: false } })));
await t("coordenador registra o reagendamento", "ALLOW", () => addEv(NAY, evReag(NAY)));
await t("administrador registra o reagendamento", "ALLOW", () => addEv(ADM, evReag(ADM)));
await t("recepcionista INATIVA não registra (não pode atender lead alheio)", "DENY", () => addEv("inat", evReag("inat")));
await t("autoria forjada (usuarioUid de outra pessoa) é negada", "DENY", () => addEv("isa", evReag("isa", { usuarioUid: "ana" })));
await t("nome de outra pessoa no evento é negado", "DENY", () => addEv("isa", evReag("isa", { usuario: "Ana Lara" })));
await t("carimbo de tempo do cliente (não do servidor) é negado", "DENY", () => addEv("isa", evReag("isa", { criadoEm: new Date("2020-01-01") })));
await t("o evento continua append-only: não pode ser editado nem apagado", "DENY", async () => { const r = await addEv(ADM, evReag(ADM)); await updateDoc(r, { descricao: "x" }); });

console.log("\n=== F. MATRÍCULA por recepcionista em lead ALHEIO (fechamento compartilhado): campos do instantâneo do plano");
const MAT = (uid, extra = {}) => ({ confirmada: true, data: "14/10/2026", hora: "10:00", consultor: "Ana Lara", observacao: "", plano: "MENSAL", dataInicio: "2026-10-14", dataVencimento: "2026-11-14", status: "ATIVA", registradoPorUid: uid, registradoPorNome: NOMES[uid], atendimentoCompartilhado: true, ...extra });
const fechar = (uid, mat) => updateDoc(doc(as(uid), "leads", "LN"), { etapa: 5, ultimoAtendimento: "x", matricula: mat, atualizadoEm: SRV() });
const snap = (extra = {}) => ({ ...montarSnapshotPlano({ id: "BF25", nome: "Black Friday 12m", categoriaId: "black-friday", duracaoMeses: 12, valorCentavos: 99900, taxaAdesaoCentavos: 0, condicoes: "À vista" }), ...extra });
async function parMat(nome, extraMat) {
  await par(nome, async () => { await seedBase(); }, (v) => fechar("isa", MAT("isa", { ...snap(), ...(v ? extraMat : {}) })));
}
await seedBase();
await t("REGRESSÃO: matrícula LEGADA (só `plano: MENSAL`, sem instantâneo) continua aceita", "ALLOW", () => fechar("isa", MAT("isa")));
await seedBase();
await t("matrícula COM instantâneo completo do plano é aceita", "ALLOW", () => fechar("isa", MAT("isa", snap())));
await seedBase();
await t("instantâneo sem preço (plano legado do catálogo) é aceito", "ALLOW", () => fechar("isa", MAT("isa", montarSnapshotPlano({ id: "TRIMESTRAL", nome: "Plano Trimestral", categoriaId: "convencionais", duracaoMeses: 3 }))));
await parMat("valor negativo no instantâneo", { valorCentavos: -1 });
await parMat("valor decimal no instantâneo", { valorCentavos: 10.5 });
await parMat("duração 0 no instantâneo", { duracaoMeses: 0 });
await parMat("duração enorme no instantâneo", { duracaoMeses: 500 });
await parMat("nome do plano gigante", { planoNome: "x".repeat(81) });
await parMat("condições gigantes", { condicoes: "x".repeat(1001) });
await parMat("planoId diferente de plano (incoerente)", { planoId: "OUTRO" });
await parMat("campo desconhecido dentro de matricula", { descontoSecreto: 100 });
await parMat("planoNome que não é texto", { planoNome: 123 });
await seedBase();
await t("o fechamento continua exigindo autoria real: registradoPorUid de outra pessoa é negado", "DENY", () => fechar("isa", MAT("isa", { ...snap(), registradoPorUid: "ana" })));
await seedBase();
await t("recepcionista INATIVA continua sem poder fechar lead alheio", "DENY", () => fechar("inat", MAT("inat", snap())));
await seedBase();
await t("TITULAR fecha a própria matrícula com instantâneo (caminho do dono, sem lista fechada)", "ALLOW", () => updateDoc(doc(as("ana"), "leads", "LN"), { etapa: 5, ultimoAtendimento: "x", matricula: MAT("ana", { ...snap(), atendimentoCompartilhado: false }), atualizadoEm: SRV() }));
await seedBase();
await t("coordenador fecha com instantâneo (caminho de gestão)", "ALLOW", () => updateDoc(doc(as(NAY), "leads", "LN"), { etapa: 5, ultimoAtendimento: "x", matricula: MAT(NAY, { ...snap(), registradoPorNome: "Naykison" }), atualizadoEm: SRV() }));

await env.cleanup();
process.exit(fim() ? 1 : 0);
