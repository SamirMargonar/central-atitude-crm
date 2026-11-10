// TELEFONE ÚNICO POR LEAD — Firestore Rules REAIS + SDK real + serviço do app, no Emulator.
// Prova que NÃO existem dois leads com o mesmo telefone, inclusive com gravações simultâneas, e que
// o servidor recusa mesmo quando o cliente contorna o serviço do app (cliente alterado / aba antiga).
// As escritas são do teste (Emulator). Nada toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const { chaveTelefone } = await import(`${REPO}/src/utils/telefoneLead.js`);
const { criarServicoTelefones } = await import(`${REPO}/src/services/telefonesLeads.js`);

const env = await initializeTestEnvironment({ projectId: "demo-tme-telefone", firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA } });
const { t, check, fim } = criarRelatorio();
const { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, writeBatch, serverTimestamp } = fs;
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const servico = (uid, fsx = fs) => criarServicoTelefones({ db: as(uid), fs: fsx });
const SRV = serverTimestamp;

const MESMO_NUMERO = ["(41) 99618-3695", "41996183695", "+55 41 99618-3695", "5541996183695", "41 9618-3695", "(41) 9618-3695", "041 99618-3695", "  41 - 99618.3695 ", "+55 (41) 9618-3695", "554196183695"];
const K = chaveTelefone;
const NUM_A = "(41) 99618-3695";
const K_A = "4196183695";

async function seed() {
  await env.clearFirestore();
  await raw(async (db) => {
    const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "18:00", ...extra });
    await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador"); await u("coord2", "Outro Coord", "coordenador");
    await u("ana", "Ana Lara", "recepcionista"); await u("isa", "Isabelle", "recepcionista");
  });
}
const NOMES = { [ADM]: "Samir", [NAY]: "Naykison", coord2: "Outro Coord", ana: "Ana Lara", isa: "Isabelle" };
// cadastro normal: admin/coordenador => fila; recepcionista => dela. Gerencial: o gestor, assumido.
const leadFila = (telefone, extra = {}) => ({ nome: "Cliente", telefone, idade: 30, objetivo: "", origem: "Site", etapa: 0, status: "Novo Lead", assumido: false, responsavelUid: "", responsavel: "", consultora: "", createdAt: SRV(), ...extra });
const leadProprio = (uid, telefone, extra = {}) => leadFila(telefone, { assumido: true, responsavelUid: uid, responsavel: NOMES[uid], consultora: NOMES[uid], ...extra });
const todosLeads = () => raw(async (d) => (await getDocs(collection(d, "leads"))).docs.map((x) => ({ id: x.id, ...x.data() })));
const indices = () => raw(async (d) => (await getDocs(collection(d, "telefonesLeads"))).docs.map((x) => ({ chave: x.id, ...x.data() })));
const comChave = async (k) => (await todosLeads()).filter((l) => chaveTelefone(l.telefone) === k);
// lote cru, SEM o serviço do app (simula cliente alterado / aba antiga)
const loteCru = async (uid, id, dados, chaveIndice, leadIdIndice = id, extraIndice = {}) => {
  const db = as(uid); const b = writeBatch(db);
  b.set(doc(db, "leads", id), dados);
  if (chaveIndice) b.set(doc(db, "telefonesLeads", chaveIndice), { leadId: leadIdIndice, criadoEm: SRV(), criadoPorUid: uid, ...extraIndice });
  return b.commit();
};
const ehDup = (r) => r.status === "rejected" && r.reason?.codigo === "TELEFONE_DUPLICADO";

console.log("\n=== A. A chave calculada pelas Rules é IDÊNTICA à do app (paridade JS x Rules)");
await seed();
{
  const validos = [...MESMO_NUMERO, "(41) 3333-4444", "(55) 99999-0000", "+55 (55) 99999-0000", "(11) 98765-4321", "0 41 99618 3695", "41999990000", "(41)99999-0001", "5541 3333 4444", "(99) 98765-4321", "(21) 2222-3333"];
  let n = 0;
  for (const tel of validos) {
    const k = chaveTelefone(tel); const id = "par" + n++;
    await t(`chave igual ao app (${JSON.stringify(tel)} => ${k}): lote com a chave do app é ACEITO`, "ALLOW", () => loteCru(ADM, id, leadFila(tel), k));
    await raw(async (d) => { await deleteDoc(doc(d, "leads", id)); await deleteDoc(doc(d, "telefonesLeads", k)); });
    const errada = k.slice(0, 9) + String((Number(k[9]) + 1) % 10);
    await t(`   ...e com a chave ERRADA (${errada}) é NEGADO`, "DENY", () => loteCru(ADM, id + "x", leadFila(tel), errada));
  }
  for (const tel of ["", "123", "abc", "(41) 123", "1234567", 41996183695, "99618-3695", "996183695", "9618-3695", "419618369", "41996183695512", "4199618369512", "(10) 99618-3695", "(41) 19618-3695", "(41) 1618-3695", "+1 202 555 0143", "003333-4444", "(41) 99618-36955"]) {
    await t(`telefone fora do padrão ${JSON.stringify(tel)}: não nasce lead (nem com índice qualquer)`, "DENY", () => loteCru(ADM, "inv" + n++, leadFila(tel), "4100000000"));
  }
  await t("lead sem o campo telefone: não nasce", "DENY", () => { const { telefone: _t, ...semTel } = leadFila("x"); return loteCru(ADM, "semtel", semTel, "4100000001"); });
}

console.log("\n=== B. Cadastro normal e gerencial pelo serviço do app; formatações/DDI/nono dígito bloqueados");
await seed();
{
  await t("cadastro normal — ADMIN cadastra na fila (telefone livre)", "ALLOW", () => servico(ADM).criarLead(leadFila(NUM_A), { uid: ADM }));
  check("nasceu exatamente 1 lead e 1 índice, apontando para ele", (await comChave(K_A)).length === 1 && (await indices()).length === 1 && (await indices())[0].chave === K_A && (await indices())[0].leadId === (await comChave(K_A))[0].id);
  for (const quem of [ADM, NAY, "coord2", "ana", "isa"]) {
    let bloqueados = 0;
    for (const variante of MESMO_NUMERO) {
      const r = await Promise.allSettled([servico(quem).criarLead(quem === "ana" || quem === "isa" ? leadProprio(quem, variante) : leadFila(variante), { uid: quem })]);
      if (ehDup(r[0])) bloqueados++;
    }
    check(`${NOMES[quem]}: as ${MESMO_NUMERO.length} formas do mesmo número são BLOQUEADAS pelo serviço (telefone já cadastrado)`, bloqueados === MESMO_NUMERO.length, String(bloqueados));
  }
  check("continua 1 lead e 1 índice (nada foi criado pelas tentativas)", (await comChave(K_A)).length === 1 && (await indices()).length === 1);
  const r = await servico("ana").criarLead(leadProprio("ana", "(41) 99618-3695"), { uid: "ana" }).catch((e) => e);
  check("mensagem exata do bloqueio", r.message === "Telefone já cadastrado! Este número já está vinculado a outro lead no Central Attitude." && r.codigo === "TELEFONE_DUPLICADO");
  check("o erro informa quem já tem o número (para a tela mostrar)", r.lead?.telefone === NUM_A && !!r.leadId);
  await t("cadastro normal — RECEPCIONISTA cadastra o dela (telefone livre)", "ALLOW", () => servico("ana").criarLead(leadProprio("ana", "(41) 98888-1111"), { uid: "ana" }));
  await t("cadastro gerencial — COORDENADOR cadastra sob a própria responsabilidade", "ALLOW", () => servico("coord2").criarLead(leadProprio("coord2", "(41) 97777-2222", { cadastroGerencial: true }), { uid: "coord2" }));
  await t("cadastro gerencial com número de lead que já existe (com DDI): bloqueado", "ALLOW", async () => { const r2 = await servico("coord2").criarLead(leadProprio("coord2", "+55 41 98888-1111", { cadastroGerencial: true }), { uid: "coord2" }).catch((e) => e); if (r2.codigo !== "TELEFONE_DUPLICADO") throw new Error("não bloqueou"); });
  for (const ruim of ["123", "99618-3695", "996183695", "419618369", "41996183695512", "(10) 99618-3695", "(41) 19618-3695", "abc"]) {
    check(`telefone fora do padrão ${JSON.stringify(ruim)} é recusado pelo serviço antes de gravar (cadastro normal e gerencial)`, (await servico("ana").criarLead(leadProprio("ana", ruim), { uid: "ana" }).catch((e) => e)).codigo === "TELEFONE_INVALIDO" && (await servico("coord2").criarLead(leadProprio("coord2", ruim, { cadastroGerencial: true }), { uid: "coord2" }).catch((e) => e)).codigo === "TELEFONE_INVALIDO");
  }
  check("total: 3 leads e 3 índices", (await todosLeads()).length === 3 && (await indices()).length === 3);
}

console.log("\n=== C. O SERVIDOR recusa mesmo sem o serviço do app (cliente alterado, aba antiga, outro programa)");
await seed();
{
  await servico(ADM).criarLead(leadFila(NUM_A), { uid: ADM });
  const existente = (await comChave(K_A))[0].id;
  await t("addDoc/setDoc comum (sem índice) de lead novo: NEGADO", "DENY", () => setDoc(doc(as("isa"), "leads", "semindice"), leadProprio("isa", "(41) 96666-0000")));
  await t("lead novo com o MESMO número de outro e o índice da chave: NEGADO (índice já é de outro lead)", "DENY", () => loteCru("isa", "dup1", leadProprio("isa", "+55 41 9618-3695"), K_A));
  await t("lead novo com o mesmo número tentando 'assumir' o índice do outro lead: NEGADO", "DENY", () => loteCru("isa", "dup2", leadProprio("isa", NUM_A), K_A, existente));
  await t("lead novo com índice de OUTRA chave (para não colidir): NEGADO (chave recalculada pelas Rules)", "DENY", () => loteCru("isa", "dup3", leadProprio("isa", NUM_A), "4100000099"));
  await t("lead novo com índice apontando para outro lead id: NEGADO", "DENY", () => loteCru("isa", "dup4", leadProprio("isa", "(41) 95555-0000"), K("(41) 95555-0000"), "outro-id"));
  await t("índice avulso, sem lead no lote (reservar número): NEGADO", "DENY", () => setDoc(doc(as("isa"), "telefonesLeads", "4194440000"), { leadId: "fantasma", criadoEm: SRV(), criadoPorUid: "isa" }));
  await t("índice com autoria forjada (criadoPorUid de outra pessoa): NEGADO", "DENY", () => loteCru("isa", "dup5", leadProprio("isa", "(41) 93333-0000"), K("(41) 93333-0000"), "dup5", { criadoPorUid: "ana" }));
  await t("índice com data forjada: NEGADO", "DENY", () => { const db = as("isa"); const b = writeBatch(db); b.set(doc(db, "leads", "dup6"), leadProprio("isa", "(41) 92222-0000")); b.set(doc(db, "telefonesLeads", K("(41) 92222-0000")), { leadId: "dup6", criadoEm: new Date("2020-01-01"), criadoPorUid: "isa" }); return b.commit(); });
  await t("índice com campo extra: NEGADO", "DENY", () => loteCru("isa", "dup7", leadProprio("isa", "(41) 91111-0000"), K("(41) 91111-0000"), "dup7", { extra: 1 }));
  check("nenhuma das tentativas criou lead nem índice (continua 1 e 1)", (await todosLeads()).length === 1 && (await indices()).length === 1);
  await t("o lote legítimo equivalente (número livre, índice correto) é ACEITO — controle", "ALLOW", () => loteCru("isa", "ok1", leadProprio("isa", "(41) 90000-1111"), K("(41) 90000-1111")));
  await t("cadastro sem login: NEGADO", "DENY", () => { const db = env.unauthenticatedContext().firestore(); const b = writeBatch(db); b.set(doc(db, "leads", "anon"), leadFila("(41) 94444-0000")); b.set(doc(db, "telefonesLeads", K("(41) 94444-0000")), { leadId: "anon", criadoEm: SRV(), criadoPorUid: "x" }); return b.commit(); });
}

console.log("\n=== D. Edição do lead");
await seed();
{
  await servico("ana").criarLead(leadProprio("ana", NUM_A, { nome: "Maria", etapa: 2 }), { uid: "ana" });
  await servico("isa").criarLead(leadProprio("isa", "(41) 98888-1111", { nome: "João" }), { uid: "isa" });
  const idMaria = (await comChave(K_A))[0].id, idJoao = (await comChave(K("(41) 98888-1111")))[0].id;
  const antes = await raw(async (d) => (await getDoc(doc(d, "leads", idMaria))).data());
  const eventosAntes = await raw(async (d) => (await getDocs(collection(d, "leads", idMaria, "eventos"))).size);

  await t("dona edita mantendo o MESMO telefone (texto idêntico): ACEITO", "ALLOW", () => servico("ana").editarLead(idMaria, { nome: "Maria S.", telefone: NUM_A, idade: 31, objetivo: "Viva Leve", origem: "Site" }, { uid: "ana" }));
  await t("dona reescreve o MESMO número em outro formato (+55, sem nono dígito): ACEITO", "ALLOW", () => servico("ana").editarLead(idMaria, { telefone: "+55 41 9618-3695" }, { uid: "ana" }));
  await t("admin edita o telefone do lead da Ana mantendo o número: ACEITO", "ALLOW", () => servico(ADM).editarLead(idMaria, { telefone: "(41)99618 3695" }, { uid: ADM }));
  check("nada mudou no índice nem na quantidade de leads", (await indices()).length === 2 && (await todosLeads()).length === 2);

  const r1 = await Promise.allSettled([servico("ana").editarLead(idMaria, { telefone: "(41) 8888-1111" }, { uid: "ana" })]);
  check("editar para o telefone de OUTRO lead (sem nono dígito): BLOQUEADO com a mensagem", ehDup(r1[0]));
  const r2 = await Promise.allSettled([servico(ADM).editarLead(idMaria, { telefone: "+55 (41) 8888-1111" }, { uid: ADM })]);
  check("...inclusive pelo admin, e com outra forma do número (+55, sem nono dígito)", ehDup(r2[0]));
  check("o lead não foi alterado pela tentativa", (await raw(async (d) => (await getDoc(doc(d, "leads", idMaria))).data())).telefone === "(41)99618 3695");
  await t("servidor: updateDoc direto para o telefone de outro lead (sem índice): NEGADO", "DENY", () => updateDoc(doc(as("ana"), "leads", idMaria), { telefone: "(41) 98888-1111", atualizadoEm: SRV() }));
  await t("servidor: updateDoc direto para telefone LIVRE sem criar o índice: NEGADO", "DENY", () => updateDoc(doc(as("ana"), "leads", idMaria), { telefone: "(41) 91212-3434", atualizadoEm: SRV() }));
  await t("servidor: lote que move para o telefone de outro lead (índice 'roubado'): NEGADO", "DENY", () => { const db = as("ana"); const b = writeBatch(db); b.update(doc(db, "leads", idMaria), { telefone: "(41) 98888-1111" }); b.set(doc(db, "telefonesLeads", K("(41) 98888-1111")), { leadId: idMaria, criadoEm: SRV(), criadoPorUid: "ana" }); return b.commit(); });
  await t("servidor: telefone novo INVÁLIDO: NEGADO", "DENY", () => updateDoc(doc(as("ana"), "leads", idMaria), { telefone: "123" }));
  for (const ruim of ["abc", "99618-3695", "419618369", "41996183695512", "(41) 19618-3695"]) {
    const rInv = await servico("ana").editarLead(idMaria, { telefone: ruim }, { uid: "ana" }).catch((e) => e);
    check(`serviço: trocar o telefone para ${JSON.stringify(ruim)} (fora do padrão) é recusado antes de gravar`, rInv.codigo === "TELEFONE_INVALIDO");
    await t(`servidor: updateDoc direto para ${JSON.stringify(ruim)} (fora do padrão): NEGADO`, "DENY", () => updateDoc(doc(as("ana"), "leads", idMaria), { telefone: ruim }));
  }

  await t("editar para um telefone LIVRE: ACEITO (e o índice se move)", "ALLOW", () => servico("ana").editarLead(idMaria, { telefone: "(41) 97777-0000" }, { uid: "ana" }));
  const idx = await indices();
  check("índice antigo removido, índice novo criado apontando para o lead", !idx.some((i) => i.chave === K_A) && idx.find((i) => i.chave === K("(41) 97777-0000"))?.leadId === idMaria && idx.length === 2);
  await t("o número ANTIGO ficou livre: outro lead pode usá-lo agora", "ALLOW", () => servico("isa").editarLead(idJoao, { telefone: NUM_A }, { uid: "isa" }));
  check("Maria e João trocaram de número sem duplicar", (await comChave(K("(41) 97777-0000"))).length === 1 && (await comChave(K_A)).length === 1 && (await indices()).length === 2);

  const depois = await raw(async (d) => (await getDoc(doc(d, "leads", idMaria))).data());
  check("a edição só mexeu nos campos editados: etapa, responsável, assumido, status e createdAt intactos", depois.etapa === antes.etapa && depois.responsavelUid === antes.responsavelUid && depois.responsavel === antes.responsavel && depois.consultora === antes.consultora && depois.assumido === antes.assumido && depois.status === antes.status && depois.createdAt.isEqual(antes.createdAt));
  check("nenhum evento foi criado/alterado na timeline", (await raw(async (d) => (await getDocs(collection(d, "leads", idMaria, "eventos"))).size)) === eventosAntes);
  await t("recepcionista que não é dona NÃO edita o telefone do lead de outra (regra de dono preservada)", "DENY", () => servico("isa").editarLead(idMaria, { telefone: "(41) 96000-0001" }, { uid: "isa" }));
}

console.log("\n=== E. Gravações SIMULTÂNEAS do mesmo número");
await seed();
{
  const usuarios = [ADM, NAY, "coord2", "ana", "isa"];
  let rodadasOk = 0, totalRodadas = 6;
  for (let r = 0; r < totalRodadas; r++) {
    const numero = `(41) 9${5000 + r}-${1000 + r}`; const k = chaveTelefone(numero);
    const variantes = [numero, numero.replace(/\D/g, ""), "+55 " + numero, "55" + numero.replace(/\D/g, ""), numero.replace("(41) 9", "(41) "), numero.replace(/[()\s-]/g, ""), "041" + numero.replace(/\D/g, "").slice(2)];
    const resultados = await Promise.allSettled(variantes.map((v, i) => { const uid = usuarios[i % usuarios.length]; return servico(uid).criarLead(uid === "ana" || uid === "isa" ? leadProprio(uid, v) : leadFila(v), { uid }); }));
    const ok = resultados.filter((x) => x.status === "fulfilled").length;
    const dups = resultados.filter(ehDup).length;
    const gravados = (await comChave(k)).length;
    if (ok === 1 && dups === variantes.length - 1 && gravados === 1) rodadasOk++;
    else console.log("   rodada", r, { ok, dups, gravados, outros: resultados.filter((x) => x.status === "rejected" && !ehDup(x)).map((x) => x.reason?.code || x.reason?.message) });
  }
  check(`${totalRodadas} rodadas de 8 cadastros simultâneos do mesmo número (formatos/usuários diferentes): em TODAS exatamente 1 gravou e 7 receberam 'telefone já cadastrado'`, rodadasOk === totalRodadas);

  // sem o serviço (nenhuma checagem prévia): só as Rules decidem
  let rodadasCruas = 0;
  for (let r = 0; r < totalRodadas; r++) {
    const numero = `(41) 9${6000 + r}-${2000 + r}`; const k = chaveTelefone(numero);
    const resultados = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => { const uid = usuarios[i % usuarios.length]; const tel = i % 2 ? numero : "+55 " + numero; return loteCru(uid, `c${r}_${i}`, uid === "ana" || uid === "isa" ? leadProprio(uid, tel) : leadFila(tel), k); }));
    const ok = resultados.filter((x) => x.status === "fulfilled").length;
    const negados = resultados.filter((x) => x.status === "rejected" && x.reason?.code === "permission-denied").length;
    if ((await comChave(k)).length === 1 && ok <= 1 && ok + negados === 8) rodadasCruas++;
  }
  check(`${totalRodadas} rodadas de 8 lotes CRUS simultâneos (sem checagem prévia do app): nunca mais de 1 lead com o número`, rodadasCruas === totalRodadas);

  // números diferentes ao mesmo tempo: ninguém é bloqueado à toa
  const distintos = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => servico(ADM).criarLead(leadFila(`(41) 9${7000 + i}-${3000 + i}`), { uid: ADM })));
  check("12 cadastros simultâneos de números DIFERENTES: todos gravam (sem falso bloqueio)", distintos.every((x) => x.status === "fulfilled"));

  // edições simultâneas para o mesmo número novo
  await servico("ana").criarLead(leadProprio("ana", "(41) 98100-0001"), { uid: "ana" });
  await servico("ana").criarLead(leadProprio("ana", "(41) 98100-0002"), { uid: "ana" });
  await servico("ana").criarLead(leadProprio("ana", "(41) 98100-0003"), { uid: "ana" });
  const ids = [(await comChave(K("(41) 98100-0001")))[0].id, (await comChave(K("(41) 98100-0002")))[0].id, (await comChave(K("(41) 98100-0003")))[0].id];
  const edicoes = await Promise.allSettled(ids.map((id, i) => servico(i % 2 ? ADM : "ana").editarLead(id, { telefone: ["(41) 98999-9999", "+55 41 8999-9999", "41989999999"][i] }, { uid: i % 2 ? ADM : "ana" })));
  check("3 edições simultâneas para o mesmo telefone novo: só 1 vence e as outras viram 'telefone já cadastrado'", edicoes.filter((x) => x.status === "fulfilled").length === 1 && edicoes.filter(ehDup).length === 2 && (await comChave(K("(41) 98999-9999"))).length === 1);

  // cadastro x edição disputando o mesmo número
  const corrida = await Promise.allSettled([
    servico(ADM).criarLead(leadFila("(41) 98555-5555"), { uid: ADM }),
    servico("ana").editarLead(ids[0], { telefone: "(41) 98555-5555" }, { uid: "ana" }).catch((e) => { throw e; }),
  ]);
  check("cadastro novo x edição disputando o mesmo número: exatamente 1 vence", corrida.filter((x) => x.status === "fulfilled").length >= 1 && (await comChave(K("(41) 98555-5555"))).length === 1);
  const todos = await todosLeads(); const porChave = new Map();
  for (const l of todos) { const k = chaveTelefone(l.telefone); if (k) porChave.set(k, (porChave.get(k) || 0) + 1); }
  check("INVARIANTE FINAL: depois de tudo, nenhuma chave de telefone se repete entre os leads", [...porChave.values()].every((n) => n === 1), `${todos.length} leads`);
}

console.log("\n=== F. Leads ANTIGOS: telefones repetidos (inclusive COMPARTILHADOS) e telefones fora do padrão");
await seed();
{
  const ts = (iso) => new Date(iso);
  const L = (d, id, nome, telefone, criado, extra = {}) => setDoc(doc(d, "leads", id), { nome, telefone, etapa: 2, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", status: "Novo Lead", createdAt: ts(criado), ...extra });
  await raw(async (d) => {
    await L(d, "L1", "Dup 1", "(41) 98888-1111", "2026-02-01T10:00:00Z");
    await L(d, "L2", "Dup 2 (mais antigo)", "+55 41 8888-1111", "2026-01-01T10:00:00Z");
    await L(d, "L3", "Dup 3", "41988881111", "2026-03-01T10:00:00Z");
    await L(d, "L4", "Único", "(41) 97777-2222", "2026-01-15T10:00:00Z");
    await L(d, "L5", "Pai", "(41) 96666-3333", "2026-01-20T10:00:00Z");
    await L(d, "L6", "Filha (número compartilhado)", "+55 41 96666-3333", "2026-01-21T10:00:00Z", { responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" });
    await L(d, "L9", "Vai assumir índice órfão", "(41) 95555-0000", "2026-01-24T10:00:00Z");
    await setDoc(doc(d, "telefonesLeads", K("(41) 95555-0000")), { leadId: "excluido", criadoEm: ts("2026-01-01T10:00:00Z"), criadoPorUid: ADM });  // índice órfão
    // ---- fora do padrão
    await L(d, "L7", "Sem dígitos", "abc", "2026-01-22T10:00:00Z");
    await setDoc(doc(d, "leads", "L8"), { nome: "Sem campo", etapa: 2, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", status: "Novo Lead", createdAt: ts("2026-01-23T10:00:00Z") });
    await L(d, "L10", "Incompleto A", "419618369", "2026-01-25T10:00:00Z");
    await L(d, "L11", "Incompleto B (mesmos dígitos)", "41 9618-369", "2026-01-26T10:00:00Z");
    await L(d, "L12", "Número gravado como número", 41996183695, "2026-01-27T10:00:00Z");
    await L(d, "L13", "Sem DDD", "99618-3695", "2026-01-28T10:00:00Z");
    await L(d, "L14", "Dígitos a mais", "41996183695512", "2026-01-29T10:00:00Z");
    await L(d, "L15", "DDD inválido", "(10) 99618-3695", "2026-01-30T10:00:00Z");
    await L(d, "L16", "Sem o 9", "(41) 19618-3695", "2026-01-31T10:00:00Z");
  });

  await t("lead antigo repetido: a titular edita OUTROS campos (nome/idade/origem), telefone intocado: ACEITO", "ALLOW", () => servico("ana").editarLead("L1", { nome: "Dup 1 editado", telefone: "(41) 98888-1111", idade: 40, objetivo: "", origem: "Site" }, { uid: "ana" }));
  await t("lead antigo repetido: etapa/status mudam como sempre (updateDoc sem telefone): ACEITO", "ALLOW", () => updateDoc(doc(as("ana"), "leads", "L3"), { etapa: 3, atualizadoEm: SRV() }));
  await t("lead antigo repetido: o admin edita sem tocar no telefone: ACEITO", "ALLOW", () => updateDoc(doc(as(ADM), "leads", "L2"), { observacaoInterna: "x", atualizadoEm: SRV() }));
  await t("lead antigo repetido: reescrever o MESMO número em outro formato: ACEITO (não cria índice)", "ALLOW", () => servico("ana").editarLead("L3", { telefone: "(41) 98888-1111" }, { uid: "ana" }));
  for (const [id, uid] of [["L7", "ana"], ["L8", "ana"], ["L10", "ana"], ["L12", "ana"], ["L13", "ana"], ["L14", "ana"], ["L15", "ana"], ["L16", "ana"]]) {
    const atual = await raw(async (d) => (await getDoc(doc(d, "leads", id))).data());
    await t(`lead antigo fora do padrão (${id}): editar OUTROS campos, mantendo o telefone como está: ACEITO`, "ALLOW", () => servico(uid).editarLead(id, { nome: "Editado " + id, ...(typeof atual.telefone === "string" ? { telefone: atual.telefone } : {}) }, { uid }));
    await t(`lead antigo fora do padrão (${id}): updateDoc de etapa sem telefone: ACEITO`, "ALLOW", () => updateDoc(doc(as(ADM), "leads", id), { etapa: 3, atualizadoEm: SRV() }));
  }

  const fotoAntes = JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id)));
  const svc = servico(ADM);
  const analise = await svc.analisar();
  check("análise: 16 leads; 2 grupos repetidos (3 e 2 leads); 9 telefones fora do padrão", analise.totalLeads === 16 && analise.grupos.length === 2 && analise.grupos.map((g) => g.leads.length).sort().join() === "2,3" && analise.foraDoPadrao.length === 9);
  check("o titular de cada número repetido é o lead MAIS ANTIGO (L2 e L5)", analise.grupos.find((g) => g.leads.length === 3).titularId === "L2" && analise.grupos.find((g) => g.leads.length === 2).titularId === "L5");
  check("número COMPARTILHADO por pessoas diferentes (pai/filha) aparece como repetido, com os dois leads", analise.grupos.find((g) => g.leads.length === 2).leads.map((l) => l.id).sort().join() === "L5,L6");
  const motivos = Object.fromEntries(analise.foraDoPadrao.map((x) => [x.id, x.motivo]));
  check("cada telefone fora do padrão vem com o MOTIVO certo (nenhum ignorado em silêncio)", JSON.stringify(motivos) === JSON.stringify({ L7: "SEM_DIGITOS", L8: "AUSENTE", L10: "CURTO", L11: "CURTO", L12: "NAO_TEXTO", L13: "CURTO", L14: "LONGO", L15: "DDD_INVALIDO", L16: "NUMERO_INVALIDO" }) || (() => { const e = { L7: "SEM_DIGITOS", L8: "AUSENTE", L10: "CURTO", L11: "CURTO", L12: "NAO_TEXTO", L13: "CURTO", L14: "LONGO", L15: "DDD_INVALIDO", L16: "NUMERO_INVALIDO" }; return Object.keys(e).every((k) => motivos[k] === e[k]); })(), JSON.stringify(motivos));
  check("cada item traz nome, telefone como está gravado, responsável e texto do motivo", analise.foraDoPadrao.every((x) => x.nome && x.motivoTexto && "telefone" in x && "responsavel" in x) && analise.foraDoPadrao.find((x) => x.id === "L12").telefone === "41996183695" && analise.foraDoPadrao.find((x) => x.id === "L8").telefone === "");
  check("fora do padrão IGUAIS entre si são sinalizados como repetidos (L10 e L11), os demais não", analise.foraDoPadrao.filter((x) => x.repetidoEmOutroLead).map((x) => x.id).sort().join() === "L10,L11");
  check("pendentes: 1 por número válido livre (L2, L4, L5, L9); nenhum fora do padrão vira índice; repetidos não duplicam índice", analise.pendentes.map((p) => p.lead.id).sort().join() === "L2,L4,L5,L9");
  check("a análise acusa o índice órfão", analise.orfaos.includes(K("(41) 95555-0000")));

  const rIdx = await svc.indexar(analise, { uid: ADM });
  check("indexação: 4 índices criados, nenhuma falha (inclui assumir o índice órfão); nenhum índice para telefone fora do padrão", rIdx.criados === 4 && rIdx.falhas.length === 0 && (await indices()).length === 4 && (await indices()).find((i) => i.chave === K("(41) 95555-0000")).leadId === "L9");
  check("NENHUM lead foi alterado, apagado ou mesclado pela indexação (16 leads idênticos)", JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id))) === fotoAntes);
  check("os 11 leads de telefone repetido/compartilhado (L1, L2, L3, L5, L6 + fora do padrão repetidos) continuam todos lá, com o telefone original", ["L1", "L2", "L3", "L5", "L6", "L10", "L11"].every((id) => !!(JSON.parse(fotoAntes).find((l) => l.id === id))) && (await todosLeads()).find((l) => l.id === "L6").telefone === "+55 41 96666-3333" && (await todosLeads()).find((l) => l.id === "L11").telefone === "41 9618-369");
  const analise2 = await svc.analisar();
  check("depois: 0 pendentes, os repetidos continuam listados, os fora do padrão continuam listados, sem órfãos", analise2.pendentes.length === 0 && analise2.grupos.length === 2 && analise2.foraDoPadrao.length === 9 && analise2.orfaos.length === 0);

  const novoDup = await Promise.allSettled(["(41) 98888-1111", "+55 41 8888-1111", "41988881111"].map((v) => servico("isa").criarLead(leadProprio("isa", v), { uid: "isa" })));
  check("depois de indexar, NOVO cadastro com o número do legado é bloqueado em qualquer formato", novoDup.every(ehDup));
  const compart = await Promise.allSettled([servico("isa").criarLead(leadProprio("isa", "(41) 96666-3333", { nome: "Mãe (mesmo telefone da família)" }), { uid: "isa" })]);
  check("número compartilhado: um TERCEIRO lead com o telefone da família é bloqueado", ehDup(compart[0]));
  const rNaoTit = await Promise.allSettled([servico("ana").editarLead("L1", { telefone: "(41) 97777-2222" }, { uid: "ana" })]);
  check("lead antigo repetido não pode passar para o número de OUTRO lead", ehDup(rNaoTit[0]));
  const rComp = await Promise.allSettled([servico("isa").editarLead("L6", { telefone: "(41) 97777-2222" }, { uid: "isa" })]);
  check("a 'filha' (L6) também não pode ir para o número de um terceiro lead", ehDup(rComp[0]));
  await t("lead antigo repetido (não titular) resolve a duplicidade mudando para um número LIVRE: ACEITO", "ALLOW", () => servico("ana").editarLead("L1", { telefone: "(41) 94444-0001" }, { uid: "ana" }));
  check("o titular segue com o índice; L1 ganhou o dele; o grupo ficou com 2 leads", (await servico(ADM).analisar()).grupos.find((g) => g.chave === K("(41) 98888-1111")).leads.length === 2 && (await indices()).some((i) => i.chave === K("(41) 94444-0001") && i.leadId === "L1") && (await indices()).find((i) => i.chave === K("(41) 98888-1111")).leadId === "L2");

  // fora do padrão: nada é corrigido sozinho; corrigir manualmente só com telefone válido e livre
  for (const ruim of ["abc", "99618-3695", "4196183", "(41) 19618-3695"]) {
    const r = await servico("ana").editarLead("L10", { telefone: ruim }, { uid: "ana" }).catch((e) => e);
    check(`lead fora do padrão não aceita trocar para outro telefone inválido (${JSON.stringify(ruim)})`, r.codigo === "TELEFONE_INVALIDO");
  }
  await t("servidor: lead fora do padrão trocando para outro telefone inválido por updateDoc: NEGADO", "DENY", () => updateDoc(doc(as("ana"), "leads", "L10"), { telefone: "41 96183 69" }));
  const rJa = await Promise.allSettled([servico("ana").editarLead("L10", { telefone: "(41) 97777-2222" }, { uid: "ana" })]);
  check("lead fora do padrão corrigido para o número de OUTRO lead: bloqueado", ehDup(rJa[0]));
  await t("lead fora do padrão corrigido para um número válido e LIVRE: ACEITO (e passa a ser protegido)", "ALLOW", () => servico("ana").editarLead("L10", { telefone: "(41) 93333-0001" }, { uid: "ana" }));
  const analise3 = await servico(ADM).analisar();
  check("L10 saiu da lista de fora do padrão; L11 já não é mais 'repetido'; os outros 7 continuam listados", analise3.foraDoPadrao.length === 8 && !analise3.foraDoPadrao.some((x) => x.id === "L10") && analise3.foraDoPadrao.find((x) => x.id === "L11").repetidoEmOutroLead === false && (await indices()).some((i) => i.chave === K("(41) 93333-0001") && i.leadId === "L10"));
  check("nenhum lead foi excluído em todo o processo (16 leads)", (await todosLeads()).length === 16);
}

console.log("\n=== G. Exclusão, índice órfão e índice vencido");
await seed();
{
  await servico("ana").criarLead(leadProprio("ana", NUM_A, { nome: "A" }), { uid: "ana" });
  const idA = (await comChave(K_A))[0].id;
  await t("Samir exclui o lead (regra existente)", "ALLOW", () => deleteDoc(doc(as(ADM), "leads", idA)));
  check("índice ficou órfão (lead excluído)", (await indices()).length === 1);
  await t("com o lead excluído, outro lead pode usar o número (assume o índice órfão)", "ALLOW", () => servico("isa").criarLead(leadProprio("isa", "+55 41 9618-3695", { nome: "B" }), { uid: "isa" }));
  const idB = (await comChave(K_A))[0].id;
  check("agora só o lead B tem o número e o índice aponta para B", (await comChave(K_A)).length === 1 && (await indices()).find((i) => i.chave === K_A).leadId === idB);
  await t("exclusão + liberação do telefone (fluxo do app)", "ALLOW", async () => { await deleteDoc(doc(as(ADM), "leads", idB)); const ok = await servico(ADM).liberarTelefone(idB, "+55 41 9618-3695"); if (!ok) throw new Error("não liberou"); });
  check("índice removido pela liberação", (await indices()).length === 0);

  await servico("ana").criarLead(leadProprio("ana", "(41) 98000-0001"), { uid: "ana" });
  const idC = (await comChave(K("(41) 98000-0001")))[0].id;
  // cliente antigo troca o telefone criando o índice novo mas NÃO apaga o antigo => índice vencido
  await t("troca de telefone deixando o índice antigo para trás (cliente antigo)", "ALLOW", () => { const db = as("ana"); const b = writeBatch(db); b.update(doc(db, "leads", idC), { telefone: "(41) 98000-0002" }); b.set(doc(db, "telefonesLeads", K("(41) 98000-0002")), { leadId: idC, criadoEm: SRV(), criadoPorUid: "ana" }); return b.commit(); });
  check("o índice antigo ficou 'vencido' (aponta para lead que já não tem o número)", (await indices()).some((i) => i.chave === K("(41) 98000-0001") && i.leadId === idC));
  await t("o número antigo está LIVRE: outro lead pode assumir o índice vencido", "ALLOW", () => servico("isa").criarLead(leadProprio("isa", "(41) 98000-0001"), { uid: "isa" }));
  check("sem duplicar: um lead por número", (await comChave(K("(41) 98000-0001"))).length === 1 && (await comChave(K("(41) 98000-0002"))).length === 1);

  await t("recepcionista NÃO remove índice de lead que ainda tem o número", "DENY", () => deleteDoc(doc(as("isa"), "telefonesLeads", K("(41) 98000-0001"))));
  await t("admin também NÃO remove índice de lead que ainda tem o número", "DENY", () => deleteDoc(doc(as(ADM), "telefonesLeads", K("(41) 98000-0001"))));
  await t("ninguém troca o dono do índice por updateDoc", "DENY", () => updateDoc(doc(as(ADM), "telefonesLeads", K("(41) 98000-0001")), { leadId: "outro" }));
  await raw(async (d) => { await deleteDoc(doc(d, "leads", idC)); });
  await t("índice de lead que não existe mais: qualquer perfil do sistema pode limpar", "ALLOW", () => deleteDoc(doc(as("isa"), "telefonesLeads", K("(41) 98000-0002"))));
}

console.log("\n=== H. Permissões do índice");
await seed();
{
  await servico("ana").criarLead(leadProprio("ana", NUM_A), { uid: "ana" });
  await t("recepcionista consulta um número (get pontual)", "ALLOW", () => getDoc(doc(as("isa"), "telefonesLeads", K_A)));
  await t("recepcionista NÃO lista os telefones", "DENY", () => getDocs(collection(as("isa"), "telefonesLeads")));
  await t("admin lista os índices (ferramenta de indexação)", "ALLOW", () => getDocs(collection(as(ADM), "telefonesLeads")));
  await t("coordenador lista os índices", "ALLOW", () => getDocs(collection(as("coord2"), "telefonesLeads")));
  await t("sem login: NÃO lê o índice", "DENY", () => getDoc(doc(env.unauthenticatedContext().firestore(), "telefonesLeads", K_A)));
  await t("usuário autenticado SEM cadastro no sistema: NÃO lê o índice", "DENY", () => getDoc(doc(as("fantasma"), "telefonesLeads", K_A)));
  await t("usuário autenticado SEM cadastro no sistema: NÃO cria lead", "DENY", () => loteCru("fantasma", "fx", leadFila("(41) 99111-0000"), K("(41) 99111-0000")));
}

console.log("\n=== I. Números COMPARTILHADOS (família/casal/pessoas diferentes) não são aceitos — concorrência incluída");
await seed();
{
  const NUM = "(41) 99111-2222";
  await servico("ana").criarLead(leadProprio("ana", NUM, { nome: "Maria (mãe)" }), { uid: "ana" });
  const filhos = ["João (filho)", "Pedro (marido)", "Clara (irmã)"];
  for (const quem of ["ana", "isa"]) {
    for (const nome of filhos) {
      const r = await Promise.allSettled([servico(quem).criarLead(leadProprio(quem, "+55 41 99111-2222", { nome }), { uid: quem })]);
      check(`${NOMES[quem]} cadastra "${nome}" com o telefone da família: BLOQUEADO`, ehDup(r[0]));
    }
  }
  const rg = await Promise.allSettled([servico("coord2").criarLead(leadProprio("coord2", "41991112222", { nome: "Cadastro gerencial da família", cadastroGerencial: true }), { uid: "coord2" })]);
  check("cadastro gerencial com o telefone de outra pessoa da família: BLOQUEADO", ehDup(rg[0]));
  await t("servidor: lote cru de outro lead (nome diferente) com o mesmo telefone: NEGADO", "DENY", () => loteCru("isa", "familia1", leadProprio("isa", NUM, { nome: "Outra pessoa" }), K(NUM)));
  await servico("isa").criarLead(leadProprio("isa", "(41) 99333-4444", { nome: "Fulano" }), { uid: "isa" });
  const idF = (await comChave(K("(41) 99333-4444")))[0].id;
  const re = await Promise.allSettled([servico("isa").editarLead(idF, { telefone: NUM }, { uid: "isa" })]);
  check("editar o lead de OUTRA pessoa para o telefone da família: BLOQUEADO", ehDup(re[0]));
  check("o bloqueio informa o lead que já tem o número (para a tela mostrar quem é)", (await re[0].reason?.lead?.nome) === "Maria (mãe)");
  // concorrência: 6 pessoas da mesma família cadastradas ao mesmo tempo
  let ok = 0, tot = 4;
  for (let r = 0; r < tot; r++) {
    const num = `(41) 9${8000 + r}-${5000 + r}`;
    const res = await Promise.allSettled([ADM, NAY, "coord2", "ana", "isa", ADM].map((uid, i) => servico(uid).criarLead(uid === "ana" || uid === "isa" ? leadProprio(uid, i % 2 ? num : "+55 " + num, { nome: "Pessoa " + i }) : leadFila(i % 2 ? num : "+55 " + num, { nome: "Pessoa " + i }), { uid })));
    if (res.filter((x) => x.status === "fulfilled").length === 1 && res.filter(ehDup).length === 5 && (await comChave(K(num))).length === 1) ok++;
  }
  check(`${tot} rodadas com 6 pessoas da mesma família cadastradas AO MESMO TEMPO: em todas só 1 lead existe com o telefone`, ok === tot);
}

console.log("\n=== J. Indexação INTERROMPIDA e retomada");
await seed();
{
  await raw(async (d) => { for (let i = 0; i < 17; i++) await setDoc(doc(d, "leads", "leg" + i), leadProprio("ana", `(41) 93${String(i).padStart(2, "0")}0-${1000 + i}`, { createdAt: new Date(2026, 0, 1 + i) })); await setDoc(doc(d, "leads", "ruim"), leadProprio("ana", "99618-3695")); });
  const fotoLeads = JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id)));
  let n = 0;
  const fsFalha = { ...fs, writeBatch: (db) => { const b = fs.writeBatch(db); return { set: (...a) => b.set(...a), commit: () => { n++; if (n >= 2 && n <= 9) return Promise.reject(Object.assign(new Error("rede"), { code: "unavailable" })); return b.commit(); } }; } };
  const an = await servico(ADM).analisar();
  check("antes: 17 pendentes e 1 fora do padrão", an.pendentes.length === 17 && an.foraDoPadrao.length === 1);
  const r1 = await servico(ADM, fsFalha).indexar(an, { uid: ADM, aoProgresso: () => {} });
  const parcial = (await indices()).length;
  check("interrompida no meio (rede cai em vários lotes): indexou parte, registrou as falhas e NÃO tocou em nenhum lead", r1.falhas.length > 0 && parcial > 0 && parcial < 17 && JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id))) === fotoLeads, `${parcial}/17, falhas ${r1.falhas.length}`);
  check("o que já foi indexado já protege (a retomada não refaz nem duplica)", (await indices()).every((i) => i.leadId.startsWith("leg")));
  const an2 = await servico(ADM).analisar();
  check("nova análise mostra exatamente o que falta (17 - já indexados)", an2.pendentes.length === 17 - parcial && an2.jaIndexados === parcial);
  const r2 = await servico(ADM).indexar(an2, { uid: ADM });
  check("RETOMADA conclui sem falhas e sem duplicar: 17 índices, 0 pendentes", r2.falhas.length === 0 && (await indices()).length === 17 && (await servico(ADM).analisar()).pendentes.length === 0);
  const r3 = await servico(ADM).indexar(await servico(ADM).analisar(), { uid: ADM });
  check("rodar de novo é inofensivo (idempotente)", r3.criados === 0 && r3.falhas.length === 0 && (await indices()).length === 17);
  check("o telefone fora do padrão continua listado e SEM índice; nenhum lead foi alterado ou excluído", (await servico(ADM).analisar()).foraDoPadrao.map((x) => x.id).join() === "ruim" && JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id))) === fotoLeads);
  // um lead muda de telefone ENTRE a análise e a indexação: o servidor recusa só aquele, os demais seguem
  const an3 = await servico(ADM).analisar();
  await raw(async (d) => { await setDoc(doc(d, "leads", "novoLeg"), leadProprio("ana", "(41) 92222-7777")); });
  const an4 = await servico(ADM).analisar();
  await raw(async (d) => { await updateDoc(doc(d, "leads", "novoLeg"), { telefone: "(41) 92222-8888" }); });
  const r4 = await servico(ADM).indexar(an4, { uid: ADM });
  check("lead que mudou de telefone depois da análise: só ele falha (listado), nada é corrompido", r4.falhas.length === 1 && r4.falhas[0].leadId === "novoLeg" && (await indices()).length === 17);
  check("a análise seguinte o enxerga de novo como pendente", (await servico(ADM).analisar()).pendentes.map((p) => p.lead.id).join() === "novoLeg" && an3.pendentes.length === 0);
}

console.log("\n=== K. Ferramenta x oráculo independente (500 leads, formatos aleatórios, com telefones fora do padrão)");
await seed();
{
  let sv = 987654; const rnd = (n) => { sv = (sv * 1103515245 + 12345) & 0x7fffffff; return sv % n; };
  const fm = [(d, t8) => `(${d}) 9${t8.slice(0, 4)}-${t8.slice(4)}`, (d, t8) => `${d}9${t8}`, (d, t8) => `+55 ${d} 9${t8.slice(0, 4)}-${t8.slice(4)}`, (d, t8) => `55${d}9${t8}`, (d, t8) => `${d} ${t8.slice(0, 4)}-${t8.slice(4)}`, (d, t8) => `(${d})${t8}`, (d, t8) => `0${d} 9 ${t8}`, (d, t8) => ` ${d}-9${t8} `];
  const verdade = new Map(), docs = [], ruins = new Map(); let nl = 0;
  for (let g = 0; g < 150; g++) {
    const ddd = ["41", "11", "21", "55", "61"][rnd(5)]; const t8 = String(30000000 + g * 7919 + rnd(1000)).slice(0, 8); const kv = ddd + t8;
    for (let j = 0, tam = [1, 1, 1, 2, 2, 3, 4][rnd(7)]; j < tam; j++) { const id = "o" + nl++; docs.push({ id, tel: fm[rnd(fm.length)](ddd, t8), criado: new Date(2026, 0, 1 + rnd(200)) }); verdade.set(kv, (verdade.get(kv) || []).concat(id)); }
    if (rnd(4) === 0) { const id = "o" + nl++; const t8b = t8.slice(0, 7) + String((Number(t8[7]) + 1) % 10); docs.push({ id, tel: fm[0](ddd, t8b), criado: new Date(2026, 0, 2) }); verdade.set(ddd + t8b, (verdade.get(ddd + t8b) || []).concat(id)); }
    if (rnd(5) === 0) { const id = "o" + nl++; const d2 = ddd === "41" ? "42" : "41"; docs.push({ id, tel: fm[0](d2, t8), criado: new Date(2026, 0, 3) }); verdade.set(d2 + t8, (verdade.get(d2 + t8) || []).concat(id)); }
    if (rnd(3) === 0) { const id = "o" + nl++; const ruim = [`${t8.slice(0, 4)}-${t8.slice(4)}`, `9${t8}`, `${ddd}9${t8}5`, `${ddd}${t8.slice(0, 5)}`, "", "n/d"][rnd(6)]; docs.push({ id, tel: ruim, criado: new Date(2026, 0, 4) }); ruins.set(id, ruim); }
  }
  await raw(async (d) => { for (const x of docs) await setDoc(doc(d, "leads", x.id), { nome: "N" + x.id, telefone: x.tel, etapa: 1, assumido: true, responsavelUid: "ana", responsavel: "Ana Lara", consultora: "Ana Lara", createdAt: x.criado }); });
  const foto = JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id)));
  const an = await servico(ADM).analisar();
  const esperados = [...verdade.values()].filter((v) => v.length > 1).map((v) => [...v].sort().join("+")).sort();
  const obtidos = an.grupos.map((g) => g.leads.map((l) => l.id).sort().join("+")).sort();
  console.log(`   ${docs.length} leads; ${verdade.size} números válidos distintos; ${esperados.length} repetidos; ${ruins.size} fora do padrão (oráculo)`);
  check("acha EXATAMENTE os mesmos grupos de repetidos do oráculo (nenhum a mais, nenhum a menos)", JSON.stringify(esperados) === JSON.stringify(obtidos), `${obtidos.length} x ${esperados.length}`);
  check("acha EXATAMENTE os mesmos telefones fora do padrão do oráculo (nenhum ignorado)", JSON.stringify([...ruins.keys()].sort()) === JSON.stringify(an.foraDoPadrao.map((x) => x.id).sort()));
  check("pendentes = 1 por número válido distinto; fora do padrão nunca viram índice", an.pendentes.length === verdade.size && an.pendentes.every((p) => !ruins.has(p.lead.id)));
  check("titular de cada grupo = lead mais antigo", an.grupos.every((g) => { const ms = g.leads.map((l) => docs.find((x) => x.id === l.id).criado.getTime()); return docs.find((x) => x.id === g.titularId).criado.getTime() === Math.min(...ms); }));
  const r = await servico(ADM).indexar(an, { uid: ADM });
  check("indexação cria 1 índice por número válido distinto, sem falhas", r.falhas.length === 0 && (await indices()).length === verdade.size);
  check("os leads originais ficaram BYTE A BYTE idênticos (nada modificado, apagado ou 'corrigido')", JSON.stringify((await todosLeads()).sort((a, b) => a.id.localeCompare(b.id))) === foto);
  const an2 = await servico(ADM).analisar();
  check("segunda análise: 0 pendentes, mesmos repetidos, mesmos fora do padrão, 0 órfãos", an2.pendentes.length === 0 && an2.orfaos.length === 0 && JSON.stringify(an2.grupos.map((g) => g.leads.map((l) => l.id).sort().join("+")).sort()) === JSON.stringify(esperados) && an2.foraDoPadrao.length === ruins.size);
  const bloqueados = await Promise.allSettled(docs.filter((x, i) => !ruins.has(x.id) && i % 9 === 0).map((x) => servico("isa").criarLead(leadProprio("isa", x.tel), { uid: "isa" })));
  check("depois de indexar, cadastrar de novo QUALQUER número existente é bloqueado", bloqueados.length > 20 && bloqueados.every((x) => x.status === "rejected" && x.reason.codigo === "TELEFONE_DUPLICADO"));
  const invalidos = await Promise.allSettled([...ruins.values()].filter((v) => v !== "").slice(0, 20).map((v) => servico("isa").criarLead(leadProprio("isa", v), { uid: "isa" })));
  check("cadastrar um número fora do padrão (como os do legado) é recusado como inválido", invalidos.every((x) => x.status === "rejected" && x.reason.codigo === "TELEFONE_INVALIDO"));
}

await env.cleanup();
fim();
