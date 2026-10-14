// ==========================================================
// CACHE DE BUSCA DE LEADS (por sessão, em memória)
// ==========================================================
//
// Permite que a recepcionista ache leads de OUTRAS recepcionistas
// pelo campo de pesquisa, sem uma leitura completa a cada
// digitação:
//
//  - UMA leitura da coleção `leads` (as Rules já permitem a
//    recepcionista listar) quando a busca é usada pela primeira
//    vez; depois a busca é 100% em memória.
//  - Guarda só os campos necessários para listar/ordenar o
//    resultado (não o documento inteiro). O lead completo é
//    lido por id, ao vivo, quando a usuária o abre.
//  - Chaveado pelo UID: trocar de usuária descarta o cache.
//  - Atualização: expira em `ttlMs` (padrão 5 min) e é
//    refeito na próxima busca; `atualizarLead(id)` relê só um
//    documento; `recarregar()` refaz a leitura (no máximo uma a
//    cada `intervaloMinimoRecargaMs`). Leituras simultâneas são
//    compartilhadas.
//  - Falhas: o cache anterior só é substituído quando a NOVA
//    leitura termina com sucesso (se falhar, os dados antigos
//    continuam disponíveis e o erro é propagado). Depois de uma
//    falha, nenhuma nova leitura é feita por `esperaAposFalhaMs`
//    (padrão 30 s) — o erro guardado é relançado sem consultar o
//    Firestore — e ao fim da espera uma nova tentativa é permitida.
//    Um resultado vazio legítimo (coleção sem leads) é SUCESSO.
//  - Nenhuma escrita, nenhum campo novo no Firestore.
//
// `db`/`fs` são injetados (testes usam o Emulator/contador).
// ==========================================================

import { leadCombinaComBusca, normalizarTexto } from "../utils/buscaLeads.js";

export const TTL_PADRAO_MS = 5 * 60 * 1000;
export const INTERVALO_MINIMO_RECARGA_MS = 30 * 1000;
export const ESPERA_APOS_FALHA_MS = 30 * 1000;
export const LIMITE_RESULTADOS = 50;

// Campos mantidos em memória (sem dados de contato além do telefone
// que a própria busca precisa, nem históricos).
function enxugar(id, dados) {

  return {
    id,
    nome: dados.nome || "",
    telefone: dados.telefone || "",
    etapa: dados.etapa ?? 0,
    status: dados.status || "",
    responsavelUid: dados.responsavelUid || "",
    responsavel: dados.responsavel || "",
    consultora: dados.consultora || "",
    visita: dados.visita
      ? { data: dados.visita.data || "", hora: dados.visita.hora || "" }
      : null,
    createdAt: dados.createdAt || null,
  };

}


export function criarCacheBuscaLeads({
  db,
  fs,
  agora = () => Date.now(),
  ttlMs = TTL_PADRAO_MS,
  intervaloMinimoRecargaMs = INTERVALO_MINIMO_RECARGA_MS,
  esperaAposFalhaMs = ESPERA_APOS_FALHA_MS,
}) {

  let uid = null;
  let leads = null;          // Map id -> lead enxuto
  let carregadoEm = 0;
  let emAndamento = null;    // Promise compartilhada
  let leituras = 0;          // getDocs da coleção (para teste/diagnóstico)
  let falhouEm = 0;          // instante da última leitura que falhou
  let ultimoErro = null;     // erro dessa falha (null = a última leitura deu certo)
  let epoca = 0;             // muda a cada troca de usuária: leituras de outra época são descartadas

  function limpar() {
    epoca += 1;
    uid = null;
    leads = null;
    carregadoEm = 0;
    emAndamento = null;
    falhouEm = 0;
    ultimoErro = null;
  }

  function fresco() {
    return leads !== null && agora() - carregadoEm < ttlMs;
  }

  function emEsperaAposFalha() {
    return ultimoErro !== null && agora() - falhouEm < esperaAposFalhaMs;
  }

  // O cache só é trocado DEPOIS que a leitura inteira deu certo.
  async function lerColecao() {

    leituras += 1;

    // Isolamento por usuária: se a usuária ativa mudar enquanto esta
    // leitura está em andamento (limpar() troca a época), o resultado
    // — sucesso OU falha — pertence à usuária anterior e NÃO pode
    // preencher o cache da atual nem colocá-la em espera por falha.
    const minhaEpoca = epoca;

    try {

      const snapshot = await fs.getDocs(fs.collection(db, "leads"));

      if (minhaEpoca !== epoca) {
        return;
      }

      const mapa = new Map();

      snapshot.docs.forEach((d) => mapa.set(d.id, enxugar(d.id, d.data())));

      leads = mapa;
      carregadoEm = agora();
      falhouEm = 0;
      ultimoErro = null;

    } catch (erro) {

      // mantém `leads`/`carregadoEm` anteriores; só registra a falha
      // se a leitura ainda for da usuária ativa
      if (minhaEpoca === epoca) {
        falhouEm = agora();
        ultimoErro = erro;
      }

      throw erro;

    }

  }

  // Garante o cache da usuária. Sem custo se já estiver fresco.
  // `forcar`: ignora o TTL (usado pela recarga manual).
  // Em caso de falha propaga o erro; durante a espera após falha,
  // relança o erro guardado SEM nova leitura.
  async function carregar(uidAtual, { forcar = false } = {}) {

    if (!uidAtual) {
      throw new Error("Usuária não identificada para a busca.");
    }

    if (uid !== uidAtual) {
      limpar();
      uid = uidAtual;
    }

    if (!forcar && fresco()) {
      return;
    }

    if (!emAndamento) {

      if (emEsperaAposFalha()) {
        throw ultimoErro;
      }

      const minha = lerColecao().finally(() => {
        if (emAndamento === minha) {
          emAndamento = null;
        }
      });
      emAndamento = minha;

    }

    await emAndamento;

  }

  // Releitura completa pedida pela usuária ("atualizar busca").
  // Respeita o intervalo mínimo para não virar leitura por clique.
  async function recarregar(uidAtual) {

    if (uid !== uidAtual) {
      limpar();
      uid = uidAtual;
    } else if (
      leads !== null &&
      ultimoErro === null &&
      agora() - carregadoEm < intervaloMinimoRecargaMs
    ) {
      return;
    }

    // não zera `leads`: se a leitura falhar, os dados antigos ficam
    await carregar(uidAtual, { forcar: true });

  }

  // Busca 100% em memória.
  function buscar(termo) {

    if (!leads) {
      return [];
    }

    const texto = normalizarTexto(termo);

    if (texto.length < 2) {
      return [];
    }

    const achados = [];

    for (const lead of leads.values()) {
      if (leadCombinaComBusca(lead, termo, { minDigitos: 3 })) {
        achados.push(lead);
      }
    }

    achados.sort((a, b) =>
      String(a.nome).localeCompare(String(b.nome), "pt-BR")
    );

    return achados.slice(0, LIMITE_RESULTADOS);

  }

  // Atualiza UM lead no cache a partir de dados já lidos
  // (ex.: snapshot ao vivo do modal).
  function aplicarLead(id, dados) {

    if (!leads || !id) {
      return;
    }

    if (dados) {
      leads.set(id, enxugar(id, dados));
    } else {
      leads.delete(id);
    }

  }

  // Relê um único documento (1 leitura) e atualiza o cache.
  async function atualizarLead(id) {

    if (!leads || !id) {
      return;
    }

    const minhaEpoca = epoca;

    const snap = await fs.getDoc(fs.doc(db, "leads", id));

    if (minhaEpoca !== epoca) {
      return;
    }

    aplicarLead(id, snap.exists() ? snap.data() : null);

  }

  return {
    carregar,
    recarregar,
    buscar,
    aplicarLead,
    atualizarLead,
    limpar,
    estaCarregado: () => leads !== null,
    ultimaFalha: () => ultimoErro,
    totalLeituras: () => leituras,
  };

}
