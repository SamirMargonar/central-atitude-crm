// BUSCA GLOBAL — integração com as Firestore Rules REAIS (Emulator). Usa o cache de verdade
// (src/services/cacheBuscaLeads.js) com o SDK do Firestore contra o Emulator. Nada toca produção.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import * as fs from "firebase/firestore";
import { REPO, ADM, NAY, PORTA, criarRelatorio } from "./helpers.mjs";

const { criarCacheBuscaLeads } = await import(`${REPO}/src/services/cacheBuscaLeads.js`);
const env = await initializeTestEnvironment({
  projectId: "demo-tme-busca",
  firestore: { rules: readFileSync(`${REPO}/firestore.rules`, "utf8"), host: "127.0.0.1", port: PORTA },
});
const { t, check, fim } = criarRelatorio();
const as = (uid) => env.authenticatedContext(uid).firestore();
const raw = async (fn) => { let out; await env.withSecurityRulesDisabled(async (c) => { out = await fn(c.firestore()); }); return out; };
const { doc, setDoc, getDoc, getDocs, updateDoc, addDoc, collection, serverTimestamp } = fs;

await env.clearFirestore();
await raw(async (db) => {
  const u = (id, nome, perfil, extra = {}) => setDoc(doc(db, "usuarios", id), { nome, perfil, ativo: true, horaEntrada: "08:00", horaSaida: "12:00", ...extra });
  await u("isa", "Isabelle", "recepcionista"); await u("lais", "Laís", "recepcionista"); await u("inat", "Inativa", "recepcionista", { ativo: false });
  await u(ADM, "Samir", "admin"); await u(NAY, "Naykison", "coordenador");
  await setDoc(doc(db, "leads", "LA"), { nome: "Maria Souza Silva", telefone: "(11) 98888-7766", etapa: 3, assumido: true, responsavelUid: "lais", responsavel: "Laís", consultora: "Laís", visita: { id: "vA", data: "2026-10-14", hora: "15:00", consultor: "Laís", observacao: "" }, email: "privado@x", obsInterna: "SEGREDO" });
  await setDoc(doc(db, "leads", "LB"), { nome: "João Pereira", telefone: "11977776666", etapa: 1, assumido: true, responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle" });
  await setDoc(doc(db, "leads", "LF"), { nome: "Fila Aberta", telefone: "11911112222", etapa: 0, assumido: false, responsavelUid: "", responsavel: "", consultora: "" });
  await setDoc(doc(db, "visitas", "vA"), { leadId: "LA", consultora: "Laís", consultoraId: "lais", data: "2026-10-14", hora: "15:00", status: "AGENDADA", comparecimento: "" });
});

let leituras = 0;
const contado = { ...fs, getDocs: async (...a) => { leituras++; return fs.getDocs(...a); } };

console.log("\n=== A. Isabelle (recepcionista ativa) busca leads de outras titulares com as Rules reais");
{
  const cache = criarCacheBuscaLeads({ db: as("isa"), fs: contado });
  await cache.carregar("isa");
  check("carregou com UMA leitura da coleção", leituras === 1, `leituras=${leituras}`);
  for (const termo of ["ma", "mar", "maria", "souza", "silva", "maria silva"]) cache.buscar(termo);
  await cache.carregar("isa");
  check("digitar e recarregar o cache não leem de novo", leituras === 1);
  check("acha 'Maria Souza Silva' (titular Laís) por parte do nome", cache.buscar("souza")[0]?.id === "LA");
  check("acha por 'joao' sem acento", cache.buscar("joao")[0]?.id === "LB");
  check("acha por telefone com máscara", cache.buscar("(11) 98888-7766")[0]?.id === "LA");
  check("acha por telefone só com dígitos", cache.buscar("11988887766")[0]?.id === "LA");
  check("o resultado traz a titular e a visita (espelho lead.visita)", cache.buscar("maria")[0]?.responsavel === "Laís" && cache.buscar("maria")[0]?.visita?.hora === "15:00");
  const cru = JSON.stringify(cache.buscar("maria"));
  check("e-mail e campos internos do lead NÃO ficam no cache", !cru.includes("privado@x") && !cru.includes("SEGREDO"));
}

console.log("\n=== B. Abrir e atender lead de outra titular: titularidade e autoria preservadas");
{
  await t("Isabelle abre o lead da Laís (getDoc ao vivo)", "ALLOW", () => getDoc(doc(as("isa"), "leads", "LA")));
  await t("...e lê o histórico (eventos)", "ALLOW", () => fs.getDocs(collection(as("isa"), "leads", "LA", "eventos")));
  await t("Isabelle registra uma observação com a autoria dela", "ALLOW", () => addDoc(collection(as("isa"), "leads", "LA", "eventos"), { leadId: "LA", tipo: "OBSERVACAO", usuario: "Isabelle", usuarioUid: "isa", descricao: "cliente chegou antes do horário", dados: { atendimentoCompartilhado: true }, criadoEm: serverTimestamp() }));
  await t("...mas NÃO consegue se passar por outra pessoa no evento", "DENY", () => addDoc(collection(as("isa"), "leads", "LA", "eventos"), { leadId: "LA", tipo: "OBSERVACAO", usuario: "Laís", usuarioUid: "lais", descricao: "falso", dados: {}, criadoEm: serverTimestamp() }));
  await t("...nem tomar a titularidade do lead", "DENY", () => updateDoc(doc(as("isa"), "leads", "LA"), { responsavelUid: "isa", responsavel: "Isabelle", consultora: "Isabelle", atualizadoEm: serverTimestamp() }));
  const lead = (await raw((db) => getDoc(doc(db, "leads", "LA")))).data();
  check("titularidade intacta após o atendimento (responsavelUid/responsavel/consultora)", lead.responsavelUid === "lais" && lead.responsavel === "Laís" && lead.consultora === "Laís");
  const evs = (await raw((db) => getDocs(collection(db, "leads", "LA", "eventos")))).docs.map((d) => d.data());
  check("evento registrado com a autoria da Isabelle", evs.length === 1 && evs[0].usuarioUid === "isa" && evs[0].usuario === "Isabelle");
}

console.log("\n=== C. Outros perfis e limites");
{
  await t("recepcionista INATIVA também lista (leitura existente), mas a interface só libera ações a ativas", "ALLOW", () => fs.getDocs(collection(as("inat"), "leads")));
  await t("coordenador lista todos", "ALLOW", () => fs.getDocs(collection(as(NAY), "leads")));
  await t("usuário SEM login não lista", "DENY", () => fs.getDocs(collection(env.unauthenticatedContext().firestore(), "leads")));
  const cacheFalha = criarCacheBuscaLeads({ db: env.unauthenticatedContext().firestore(), fs: contado });
  let erro = null; try { await cacheFalha.carregar("x"); } catch (e) { erro = e; }
  check("sem permissão, o cache falha com erro de permissão e fica vazio (a interface mostra aviso)", erro?.code === "permission-denied" && cacheFalha.buscar("maria").length === 0);
}

await env.cleanup();
process.exit(fim() ? 1 : 0);
