// ==========================================================
// TELEFONE ÚNICO POR LEAD — serviço (Firebase Client SDK)
// ==========================================================
//
// REGRA: não pode existir dois leads com o mesmo telefone.
//
// COMO É GARANTIDA (sem Admin SDK, sem servidor próprio):
//
//   Existe uma coleção-índice `telefonesLeads`, em que o ID do
//   documento É a chave do telefone (ver utils/telefoneLead.js) e o
//   conteúdo diz de qual lead ele é. O Firestore garante, por
//   construção, um único documento por ID — e as Firestore Rules
//   (firestore.rules) só deixam criar/editar um lead se, NO MESMO
//   LOTE ATÔMICO, o documento-índice da chave do telefone dele for
//   criado apontando para esse lead. Se o índice já pertence a outro
//   lead que ainda existe, o lote inteiro é recusado: o lead não é
//   criado. Duas pessoas cadastrando o mesmo número ao mesmo tempo
//   disputam o MESMO documento; só uma grava (a outra recebe a
//   recusa e vira "telefone duplicado").
//
//   A chave é recalculada pelas Rules a partir do campo `telefone`
//   do lead (nunca confiam na que o cliente envia), então um
//   cliente alterado ou uma aba antiga não contornam a regra.
//
// ESTE ARQUIVO faz a parte do cliente: monta o lote certo, faz a
// checagem amigável ANTES (para dar a mensagem sem gastar um
// commit) e traduz a recusa do servidor em "telefone duplicado".
// A checagem prévia é só conveniência; quem garante é o servidor.
//
// LEADS ANTIGOS: leads criados antes desta regra não têm
// documento-índice (e podem ter telefones repetidos entre si ou
// fora do padrão: sem DDD, curtos, com dígito a mais...). Eles
// continuam funcionando — editar OUTROS campos nunca exige índice.
// A ferramenta de indexação (analisar/indexar) cria o índice dos
// que têm telefone válido e livre e LISTA, para resolução manual,
// (a) os telefones repetidos e (b) os telefones fora do padrão —
// nenhum é ignorado em silêncio. Nada é apagado, mesclado ou
// alterado nos leads: nenhum telefone é "corrigido" sozinho.
//
// `db` e `fs` são injetados (testes usam o Emulator).
// ==========================================================

import {
  MENSAGEM_TELEFONE_DUPLICADO,
  MENSAGEM_TELEFONE_INVALIDO,
  TEXTO_MOTIVO_TELEFONE,
  chaveTelefone,
  diagnosticarTelefone,
} from "../utils/telefoneLead.js";

export const COLECAO_INDICE = "telefonesLeads";

// Um lote com N documentos-índice faz N leituras de Rules (getAfter
// do lead de cada um); o limite do Firestore é 20 por lote.
export const TAMANHO_LOTE_INDEXACAO = 5;


export class TelefoneDuplicadoError extends Error {

  constructor(dono) {
    super(MENSAGEM_TELEFONE_DUPLICADO);
    this.name = "TelefoneDuplicadoError";
    this.codigo = "TELEFONE_DUPLICADO";
    this.leadId = dono?.leadId || null;
    this.lead = dono?.lead || null;
  }

}


export class TelefoneInvalidoError extends Error {

  constructor() {
    super(MENSAGEM_TELEFONE_INVALIDO);
    this.name = "TelefoneInvalidoError";
    this.codigo = "TELEFONE_INVALIDO";
  }

}


function milissegundos(valor) {

  if (valor && typeof valor.toMillis === "function") return valor.toMillis();
  if (valor && typeof valor.seconds === "number") return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();
  return Number.POSITIVE_INFINITY;

}


export function criarServicoTelefones({ db, fs }) {

  const refIndice = (chave) => fs.doc(db, COLECAO_INDICE, chave);

  const refLead = (id) => fs.doc(db, "leads", id);


  function exigirChave(telefone) {

    const chave = chaveTelefone(telefone);

    if (!chave) {
      throw new TelefoneInvalidoError();
    }

    return chave;

  }


  // ----------------------------------------------------------
  // Quem é o dono atual desta chave? (null = livre)
  //
  // O índice só vale se o lead apontado AINDA existe e AINDA tem
  // essa chave. Índice de lead excluído (órfão) ou de lead que
  // trocou de telefone (vencido) é ignorado — e as Rules deixam o
  // próximo cadastro assumi-lo.
  // ----------------------------------------------------------

  async function localizarDono(telefone, { ignorarLeadId = null } = {}) {

    const chave = exigirChave(telefone);

    const indice = await fs.getDoc(refIndice(chave));

    if (!indice.exists()) {
      return null;
    }

    const leadId = indice.data()?.leadId;

    if (!leadId || leadId === ignorarLeadId) {
      return null;
    }

    const lead = await fs.getDoc(refLead(leadId));

    if (!lead.exists()) {
      return null;
    }

    if (chaveTelefone(lead.data().telefone) !== chave) {
      return null;
    }

    return {
      chave,
      leadId,
      lead: { id: leadId, ...lead.data() },
    };

  }


  // O servidor recusou o lote. Se foi porque o número já é de outro
  // lead (corrida perdida ou checagem prévia desatualizada), vira
  // "duplicado"; qualquer outra causa continua sendo o erro original.
  async function traduzirRecusa(erro, telefone, ignorarLeadId) {

    const recusa =
      erro?.code === "permission-denied" ||
      erro?.code === "aborted" ||
      erro?.code === "failed-precondition";

    if (recusa) {

      let dono = null;

      try {
        dono = await localizarDono(telefone, { ignorarLeadId });
      } catch {
        dono = null;
      }

      if (dono) {
        throw new TelefoneDuplicadoError(dono);
      }

    }

    throw erro;

  }


  // ----------------------------------------------------------
  // CRIAR LEAD (cadastro normal e gerencial) — lead + índice no
  // mesmo lote atômico. Devolve a referência do lead criado.
  // ----------------------------------------------------------

  async function criarLead(dadosDoLead, { uid }) {

    const chave = exigirChave(dadosDoLead?.telefone);

    const dono = await localizarDono(dadosDoLead.telefone);

    if (dono) {
      throw new TelefoneDuplicadoError(dono);
    }

    const leadRef = fs.doc(fs.collection(db, "leads"));

    const lote = fs.writeBatch(db);

    lote.set(leadRef, dadosDoLead);

    lote.set(refIndice(chave), {
      leadId: leadRef.id,
      criadoEm: fs.serverTimestamp(),
      criadoPorUid: uid,
    });

    try {
      await lote.commit();
    } catch (erro) {
      await traduzirRecusa(erro, dadosDoLead.telefone, null);
    }

    return leadRef;

  }


  // ----------------------------------------------------------
  // EDITAR LEAD — grava os campos e, se o telefone mudou de
  // verdade (outra chave), move o índice no mesmo lote.
  //
  // - mesmo telefone (ou só outra formatação do mesmo número):
  //   atualização comum, nunca bloqueada;
  // - telefone novo de outro lead: TelefoneDuplicadoError, nada
  //   é gravado;
  // - não mexe em etapa/responsável/histórico: só os campos
  //   recebidos + atualizadoEm.
  // ----------------------------------------------------------

  async function editarLead(leadId, dados, { uid }) {

    if (!leadId) {
      throw new Error("ID do Lead não informado.");
    }

    const leadRef = refLead(leadId);

    const carga = {
      ...dados,
      atualizadoEm: fs.serverTimestamp(),
    };

    if (!("telefone" in dados)) {
      await fs.updateDoc(leadRef, carga);
      return;
    }

    const atual = await fs.getDoc(leadRef);

    if (!atual.exists()) {
      throw new Error("Lead não encontrado.");
    }

    const telefoneAtual = atual.data().telefone;

    if (dados.telefone === telefoneAtual) {
      await fs.updateDoc(leadRef, carga);
      return;
    }

    const chaveNova = exigirChave(dados.telefone);
    const chaveAtual = chaveTelefone(telefoneAtual);

    if (chaveNova === chaveAtual) {
      // mesmo número, escrito de outro jeito
      await fs.updateDoc(leadRef, carga);
      return;
    }

    const dono = await localizarDono(dados.telefone, { ignorarLeadId: leadId });

    if (dono) {
      throw new TelefoneDuplicadoError(dono);
    }

    const lote = fs.writeBatch(db);

    lote.update(leadRef, carga);

    lote.set(refIndice(chaveNova), {
      leadId,
      criadoEm: fs.serverTimestamp(),
      criadoPorUid: uid,
    });

    if (chaveAtual) {

      const antigo = await fs.getDoc(refIndice(chaveAtual));

      if (antigo.exists() && antigo.data()?.leadId === leadId) {
        lote.delete(refIndice(chaveAtual));
      }

    }

    try {
      await lote.commit();
    } catch (erro) {
      await traduzirRecusa(erro, dados.telefone, leadId);
    }

  }


  // ----------------------------------------------------------
  // LEAD EXCLUÍDO — libera o telefone (melhor esforço). Se falhar,
  // o índice vira "órfão" e o próximo cadastro do número o assume.
  // ----------------------------------------------------------

  async function liberarTelefone(leadId, telefone) {

    const chave = chaveTelefone(telefone);

    if (!chave) {
      return false;
    }

    try {

      const indice = await fs.getDoc(refIndice(chave));

      if (indice.exists() && indice.data()?.leadId === leadId) {
        await fs.deleteDoc(refIndice(chave));
        return true;
      }

    } catch (erro) {
      console.warn("Não foi possível liberar o índice do telefone:", erro);
    }

    return false;

  }


  // ----------------------------------------------------------
  // LEGADO — análise e indexação
  // ----------------------------------------------------------

  async function analisar() {

    const [leadsSnap, indicesSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, "leads")),
      fs.getDocs(fs.collection(db, COLECAO_INDICE)),
    ]);

    const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const indices = new Map(indicesSnap.docs.map((d) => [d.id, d.data()]));

    const porChave = new Map();
    const foraDoPadrao = [];

    for (const lead of leads) {

      const diagnostico = diagnosticarTelefone(lead.telefone);

      if (!diagnostico.valido) {

        foraDoPadrao.push({
          id: lead.id,
          nome: lead.nome || "",
          telefone:
            typeof lead.telefone === "string"
              ? lead.telefone
              : lead.telefone === undefined || lead.telefone === null
                ? ""
                : String(lead.telefone),
          responsavel: lead.responsavel || lead.consultora || "",
          etapa: lead.etapa ?? null,
          motivo: diagnostico.motivo,
          motivoTexto: TEXTO_MOTIVO_TELEFONE[diagnostico.motivo],
          digitos: diagnostico.digitos,
          repetidoEmOutroLead: false,
        });

        continue;

      }

      if (!porChave.has(diagnostico.chave)) {
        porChave.set(diagnostico.chave, []);
      }

      porChave.get(diagnostico.chave).push(lead);

    }

    // telefones fora do padrão que são IGUAIS entre si (mesmos dígitos)
    // também são repetição: sinalizados, nunca ignorados.
    const porDigitos = new Map();

    for (const item of foraDoPadrao) {
      if (item.digitos) {
        porDigitos.set(item.digitos, (porDigitos.get(item.digitos) || 0) + 1);
      }
    }

    for (const item of foraDoPadrao) {
      item.repetidoEmOutroLead = item.digitos !== "" && porDigitos.get(item.digitos) > 1;
    }

    const pendentes = [];       // { chave, lead }: telefone livre, falta só o índice
    const grupos = [];          // telefones repetidos entre leads existentes
    let jaIndexados = 0;

    for (const [chave, membros] of porChave) {

      membros.sort((a, b) =>
        milissegundos(a.createdAt) - milissegundos(b.createdAt) ||
        String(a.id).localeCompare(String(b.id))
      );

      const indice = indices.get(chave);

      let titular = indice
        ? membros.find((m) => m.id === indice.leadId)
        : undefined;

      if (titular) {
        jaIndexados += 1;
      } else {
        titular = membros[0];
        pendentes.push({ chave, lead: titular });
      }

      if (membros.length > 1) {

        grupos.push({
          chave,
          titularId: titular.id,
          leads: membros.map((m) => ({
            id: m.id,
            nome: m.nome || "",
            telefone: m.telefone || "",
            responsavel: m.responsavel || m.consultora || "",
            etapa: m.etapa ?? null,
            titular: m.id === titular.id,
          })),
        });

      }

    }

    // índices cujo lead não existe mais, ou não tem mais aquela chave
    const idsDosLeads = new Map(leads.map((l) => [l.id, l]));
    const orfaos = [];

    for (const [chave, indice] of indices) {

      const dono = idsDosLeads.get(indice?.leadId);

      if (!dono || chaveTelefone(dono.telefone) !== chave) {
        orfaos.push(chave);
      }

    }

    return {
      totalLeads: leads.length,
      foraDoPadrao,
      jaIndexados,
      pendentes,
      grupos,
      orfaos,
    };

  }


  // Cria o índice dos leads pendentes (um titular por telefone).
  // Em lotes pequenos; se um lote for recusado, tenta um a um para
  // não perder os demais. Não toca em nenhum lead.
  async function indexar(analise, { uid, aoProgresso = () => {} } = {}) {

    let criados = 0;
    const falhas = [];

    const fila = [...analise.pendentes];

    while (fila.length > 0) {

      const parte = fila.splice(0, TAMANHO_LOTE_INDEXACAO);

      const gravar = (itens) => {
        const lote = fs.writeBatch(db);
        for (const { chave, lead } of itens) {
          lote.set(refIndice(chave), {
            leadId: lead.id,
            criadoEm: fs.serverTimestamp(),
            criadoPorUid: uid,
          });
        }
        return lote.commit();
      };

      try {
        await gravar(parte);
        criados += parte.length;
      } catch {
        for (const item of parte) {
          try {
            await gravar([item]);
            criados += 1;
          } catch (erro) {
            falhas.push({ leadId: item.lead.id, chave: item.chave, erro: erro?.code || String(erro?.message || erro) });
          }
        }
      }

      aoProgresso({ criados, falhas: falhas.length, restantes: fila.length });

    }

    return { criados, falhas };

  }


  return {
    localizarDono,
    criarLead,
    editarLead,
    liberarTelefone,
    analisar,
    indexar,
  };

}
