// ==========================================================
// TRANSFERÊNCIA EM MASSA DE LEADS — SERVIÇO
// ==========================================================
//
// Este módulo NÃO importa o Firebase: recebe `db` e as funções do
// Firestore (`fs`) por parâmetro (criarServicoTransferencia). Assim o
// MESMO código roda no app (com "firebase/firestore") e nos testes do
// Emulator.
//
// LIMITES DE CONSISTÊNCIA (leia antes de mexer):
//
// - Cada LEAD é processado numa transação própria que grava, tudo
//   ou nada: o lead, as visitas elegíveis, o evento da timeline e o
//   item de auditoria.
// - A OPERAÇÃO INTEIRA NÃO É ATÔMICA: são várias transações
//   independentes. Se a aba fechar ou a rede cair no meio, parte dos
//   leads terá sido transferida e parte não. Nunca declare sucesso
//   sem conferir `pendentes`. A operação só vira "concluida" quando
//   TODOS os leads selecionados têm item de auditoria.
// - Retomar é seguro e idempotente: o que já tem item é pulado, e a
//   transação de cada lead confere o dono atual antes de gravar.
//
// QUEM PODE: a autorização é aplicada pelas Firestore Rules
// (somente os UIDs de src/config/transferenciaEmMassa.js). Nada
// aqui substitui isso.
// ==========================================================


export const TIPO_OPERACAO = Object.freeze({
  TRANSFERENCIA: "transferencia",
  REVERSAO: "reversao",
});

export const STATUS_OPERACAO = Object.freeze({
  EM_ANDAMENTO: "em_andamento",
  CONCLUIDA: "concluida",
  CONCLUIDA_COM_PENDENCIAS: "concluida_com_pendencias",
});

export const RESULTADO_LEAD = Object.freeze({
  OK: "OK",
  JA_PROCESSADO: "JA_PROCESSADO",
  PULADO_DONO_MUDOU: "PULADO_DONO_MUDOU",
  PULADO_ANALISE: "PULADO_ANALISE",
  PULADO_INEXISTENTE: "PULADO_INEXISTENTE",
  // Reversão: o lead NÃO volta sozinho quando foi trabalhado depois
  // da transferência (vai para análise manual, com o motivo).
  PULADO_OUTRA_TRANSFERENCIA: "PULADO_OUTRA_TRANSFERENCIA",
  PULADO_ETAPA_MUDOU: "PULADO_ETAPA_MUDOU",
  PULADO_ALTERADO_APOS: "PULADO_ALTERADO_APOS",
  PULADO_EVENTOS_APOS: "PULADO_EVENTOS_APOS",
  FALHA: "FALHA",
});

export const MOTIVO_ANALISE = Object.freeze({
  ETAPA_0_NAO_ASSUMIDO: "ETAPA_0_NAO_ASSUMIDO",
  NOMES_DIVERGENTES: "NOMES_DIVERGENTES",
  SEM_UID_COM_NOME: "SEM_UID_COM_NOME",
  UID_DE_OUTRO_COM_NOME: "UID_DE_OUTRO_COM_NOME",
});

const COMPARECIMENTOS_REALIZADOS = ["COMPARECEU", "NAO_COMPARECEU"];


// ==========================================================
// FUNÇÕES PURAS
// ==========================================================

// Data de hoje (AAAA-MM-DD) no fuso de Brasília — mesmo formato de
// visitas.data.
export function hojeBrasilia(agora = new Date()) {

  return agora.toLocaleDateString(
    "sv-SE",
    { timeZone: "America/Sao_Paulo" }
  );

}


export function normalizarNome(nome) {

  return String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

}


// Decide o que fazer com UMA visita de um lead que será transferido.
//
// "Realizada" = comparecimento COMPARECEU/NAO_COMPARECEU (o campo
// atendidoEm não é confiável: há visitas com COMPARECEU sem ele).
export function classificarVisita(visita, { origemId, hoje }) {

  if (COMPARECIMENTOS_REALIZADOS.includes(visita?.comparecimento || "")) {
    return { acao: "manter_realizada" };
  }

  if (!visita?.data) {
    return { acao: "analise", motivo: "SEM_DATA" };
  }

  if (visita.data < hoje) {
    return { acao: "analise", motivo: "PASSADA_SEM_BAIXA" };
  }

  if (visita.consultoraId && visita.consultoraId !== origemId) {
    return { acao: "analise", motivo: "OUTRO_DONO" };
  }

  return { acao: "atualizar" };

}


// Separa os leads encontrados para a origem em grupos.
//
// `daOrigem`: leads com responsavelUid == origem.id.
// `porNome`: leads cujo consultora/responsavel == nome da origem
// (podem repetir os de cima; os que já têm responsavelUid == origem
// são ignorados aqui).
export function classificarLeads({ daOrigem, porNome, origem }) {

  const nomeOrigem = normalizarNome(origem.nome);

  const elegiveis = [];
  const gerenciais = [];
  const analise = [];

  for (const lead of daOrigem) {

    if (lead.etapa === 0 && lead.assumido !== true) {
      analise.push({ lead, motivo: MOTIVO_ANALISE.ETAPA_0_NAO_ASSUMIDO });
      continue;
    }

    const nomesDivergentes = ["consultora", "responsavel"].some(
      (campo) =>
        lead[campo] &&
        normalizarNome(lead[campo]) !== nomeOrigem
    );

    if (nomesDivergentes) {
      analise.push({ lead, motivo: MOTIVO_ANALISE.NOMES_DIVERGENTES });
      continue;
    }

    if (lead.cadastroGerencial === true) {
      gerenciais.push(lead);
    } else {
      elegiveis.push(lead);
    }

  }

  const jaVistos = new Set(daOrigem.map((lead) => lead.id));

  for (const lead of porNome) {

    if (jaVistos.has(lead.id) || lead.responsavelUid === origem.id) {
      continue;
    }

    jaVistos.add(lead.id);

    analise.push({
      lead,
      motivo: lead.responsavelUid
        ? MOTIVO_ANALISE.UID_DE_OUTRO_COM_NOME
        : MOTIVO_ANALISE.SEM_UID_COM_NOME,
    });

  }

  const resumoPorEtapa = {};

  for (const lead of elegiveis) {
    const chave = lead.etapa ?? "sem_etapa";
    resumoPorEtapa[chave] = (resumoPorEtapa[chave] || 0) + 1;
  }

  return { elegiveis, gerenciais, analise, resumoPorEtapa };

}


// Dois Timestamps do Firestore representam o MESMO instante? Usado para
// saber se o lead não foi tocado depois da transferência: o
// atualizadoEm gravado na transferência e o criadoEm do item de
// auditoria são serverTimestamp() da MESMA transação (mesmo instante).
export function mesmoInstante(a, b) {

  if (!a || !b) {
    return false;
  }

  if (
    typeof a.seconds === "number" &&
    typeof b.seconds === "number"
  ) {
    return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
  }

  if (
    typeof a.toMillis === "function" &&
    typeof b.toMillis === "function"
  ) {
    return a.toMillis() === b.toMillis();
  }

  return false;

}


function emBlocos(lista, tamanho) {

  const blocos = [];

  for (let i = 0; i < lista.length; i += tamanho) {
    blocos.push(lista.slice(i, i + tamanho));
  }

  return blocos;

}


// ==========================================================
// FÁBRICA DO SERVIÇO
// ==========================================================

export function criarServicoTransferencia({
  db,
  fs,
  agora = () => new Date(),
}) {

  const {
    doc,
    collection,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    setDoc,
    updateDoc,
    runTransaction,
    serverTimestamp,
  } = fs;

  const colOperacoes = () => collection(db, "transferenciasEmMassa");
  const refOperacao = (opId) => doc(db, "transferenciasEmMassa", opId);
  const colItens = (opId) => collection(db, "transferenciasEmMassa", opId, "itens");
  const refItem = (opId, leadId) => doc(db, "transferenciasEmMassa", opId, "itens", leadId);


  // ========================================================
  // USUÁRIOS (id = ID real do documento, SEMPRE)
  // ========================================================

  async function carregarUsuarios() {

    const snapshot = await getDocs(collection(db, "usuarios"));

    const usuarios = snapshot.docs.map((d) => ({
      ...d.data(),
      id: d.id,
      ativo: d.data().ativo !== false,
    }));

    const recepcionistas = usuarios
      .filter((u) => u.perfil === "recepcionista" && u.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return {
      origens: recepcionistas,
      destinos: recepcionistas.filter((u) => u.ativo),
    };

  }


  async function lerUsuario(uid) {

    const snap = await getDoc(doc(db, "usuarios", uid));

    if (!snap.exists()) {
      return null;
    }

    return { ...snap.data(), id: snap.id, ativo: snap.data().ativo !== false };

  }


  // ========================================================
  // PRÉVIA (somente leitura)
  // ========================================================

  async function buscarVisitasDosLeads(leadIds) {

    const porLead = {};

    for (const bloco of emBlocos(leadIds, 10)) {

      const snap = await getDocs(
        query(collection(db, "visitas"), where("leadId", "in", bloco))
      );

      for (const d of snap.docs) {
        const visita = { ...d.data(), id: d.id };
        (porLead[visita.leadId] ||= []).push(visita);
      }

    }

    return porLead;

  }


  async function montarPrevia({ origem, destino }) {

    if (!origem?.id || !destino?.id || origem.id === destino.id) {
      throw new Error("Origem e destino precisam ser pessoas diferentes.");
    }

    const hoje = hojeBrasilia(agora());

    const [porUid, porConsultora, porResponsavel] = await Promise.all([
      getDocs(query(collection(db, "leads"), where("responsavelUid", "==", origem.id))),
      getDocs(query(collection(db, "leads"), where("consultora", "==", origem.nome))),
      getDocs(query(collection(db, "leads"), where("responsavel", "==", origem.nome))),
    ]);

    const daOrigem = porUid.docs.map((d) => ({ ...d.data(), id: d.id }));

    const porNomeMapa = new Map();

    for (const d of [...porConsultora.docs, ...porResponsavel.docs]) {
      porNomeMapa.set(d.id, { ...d.data(), id: d.id });
    }

    const grupos = classificarLeads({
      daOrigem,
      porNome: [...porNomeMapa.values()],
      origem,
    });

    const candidatos = [...grupos.elegiveis, ...grupos.gerenciais];

    const visitasPorLead = await buscarVisitasDosLeads(
      candidatos.map((lead) => lead.id)
    );

    const totais = { atualizar: 0, realizadas: 0, analise: 0 };

    const resumir = (lead) => {

      const visitas = (visitasPorLead[lead.id] || []).map((visita) => ({
        visita,
        ...classificarVisita(visita, { origemId: origem.id, hoje }),
      }));

      const contagem = {
        atualizar: visitas.filter((v) => v.acao === "atualizar").length,
        realizadas: visitas.filter((v) => v.acao === "manter_realizada").length,
        analise: visitas.filter((v) => v.acao === "analise").length,
      };

      totais.atualizar += contagem.atualizar;
      totais.realizadas += contagem.realizadas;
      totais.analise += contagem.analise;

      return { ...lead, visitasResumo: contagem };

    };

    return {
      origem,
      destino,
      hoje,
      geradaEm: agora().toISOString(),
      elegiveis: grupos.elegiveis.map(resumir),
      gerenciais: grupos.gerenciais.map(resumir),
      analise: grupos.analise,
      resumoPorEtapa: grupos.resumoPorEtapa,
      visitas: totais,
    };

  }


  // ========================================================
  // INICIAR OPERAÇÃO
  // ========================================================

  async function iniciarOperacao({ previa, leadIds, motivo, executor }) {

    const { origem, destino } = previa;

    if (!executor?.uid) {
      throw new Error("Executor não identificado.");
    }

    if (!String(motivo || "").trim()) {
      throw new Error("Informe o motivo da transferência.");
    }

    if (!leadIds?.length) {
      throw new Error("Nenhum lead selecionado.");
    }

    const permitidos = new Set(
      [...previa.elegiveis, ...previa.gerenciais].map((lead) => lead.id)
    );

    const indevidos = leadIds.filter((id) => !permitidos.has(id));

    if (indevidos.length) {
      throw new Error(
        "Há leads selecionados que não são elegíveis para esta transferência."
      );
    }

    // Releitura do destino e da origem no momento de iniciar (a tela
    // pode ter ficado aberta enquanto o cadastro mudava).
    const [destinoAtual, origemAtual] = await Promise.all([
      lerUsuario(destino.id),
      lerUsuario(origem.id),
    ]);

    if (
      !destinoAtual ||
      destinoAtual.perfil !== "recepcionista" ||
      !destinoAtual.ativo
    ) {
      throw new Error("O destino precisa ser uma recepcionista ativa.");
    }

    if (!origemAtual || origemAtual.perfil !== "recepcionista") {
      throw new Error("A origem precisa ser uma recepcionista cadastrada.");
    }

    const opId = doc(colOperacoes()).id;

    await setDoc(refOperacao(opId), {
      tipo: TIPO_OPERACAO.TRANSFERENCIA,
      status: STATUS_OPERACAO.EM_ANDAMENTO,
      executadoPorUid: executor.uid,
      executadoPorNome: executor.nome || "",
      origemUid: origemAtual.id,
      origemNome: origemAtual.nome,
      origemAtiva: origemAtual.ativo,
      destinoUid: destinoAtual.id,
      destinoNome: destinoAtual.nome,
      motivo: String(motivo).trim(),
      leadIds: [...leadIds],
      totalPrevisto: leadIds.length,
      criadoEm: serverTimestamp(),
    });

    return opId;

  }


  // ========================================================
  // PROCESSAMENTO DE UM LEAD (1 transação)
  // ========================================================

  async function processarLead({
    op,
    opId,
    leadId,
    executor,
  }) {

    const hoje = hojeBrasilia(agora());
    const reversao = op.tipo === TIPO_OPERACAO.REVERSAO;

    try {

      // Visitas candidatas são listadas ANTES (transação do cliente
      // não faz query); a transação relê e revalida cada uma. Na
      // reversão a lista também serve para achar visitas criadas
      // DEPOIS da transferência (que nunca são mexidas: vão para
      // análise).
      let visitaIds = [];

      // Reversão: o lead teve eventos novos depois da transferência
      // (foi trabalhado)? Query fora da transação (o cliente não faz
      // query dentro dela).
      let eventosApos = false;

      const lista = await buscarVisitasDosLeads([leadId]);
      visitaIds = (lista[leadId] || []).map((v) => v.id);

      if (reversao) {

        const itemOriginalPre = await getDoc(
          refItem(op.reverteOpId, leadId)
        );

        if (itemOriginalPre.exists() && itemOriginalPre.data().criadoEm) {

          const novos = await getDocs(
            query(
              collection(db, "leads", leadId, "eventos"),
              where("criadoEm", ">", itemOriginalPre.data().criadoEm),
              limit(1)
            )
          );

          eventosApos = !novos.empty;

        }

      }

      const resultado = await runTransaction(db, async (tx) => {

        const leadRef = doc(db, "leads", leadId);
        const itemRef = refItem(opId, leadId);

        const [leadSnap, itemSnap] = await Promise.all([
          tx.get(leadRef),
          tx.get(itemRef),
        ]);

        if (itemSnap.exists()) {
          return { resultado: RESULTADO_LEAD.JA_PROCESSADO };
        }

        if (!leadSnap.exists()) {
          return { resultado: RESULTADO_LEAD.PULADO_INEXISTENTE };
        }

        const lead = leadSnap.data();

        if (lead.responsavelUid !== op.origemUid) {
          return {
            resultado: RESULTADO_LEAD.PULADO_DONO_MUDOU,
            detalhe: `dono atual: ${lead.responsavelUid || "(vazio)"}`,
          };
        }

        if (!reversao && lead.etapa === 0 && lead.assumido !== true) {
          return { resultado: RESULTADO_LEAD.PULADO_ANALISE };
        }

        const eventoRef = doc(collection(db, "leads", leadId, "eventos"));

        const baseItem = {
          executadoPorUid: executor.uid,
          deUid: op.origemUid,
          deNome: op.origemNome,
          paraUid: op.destinoUid,
          paraNome: op.destinoNome,
          etapa: lead.etapa ?? null,
          eventoId: eventoRef.id,
          anterior: {
            responsavelUid: lead.responsavelUid ?? null,
            responsavel: lead.responsavel ?? null,
            consultora: lead.consultora ?? null,
          },
          criadoEm: serverTimestamp(),
        };

        const patchLead = {
          responsavelUid: op.destinoUid,
          responsavel: op.destinoNome,
          consultora: op.destinoNome,
          ultimaTransferenciaEmMassaId: opId,
          atualizadoEm: serverTimestamp(),
        };

        // ------------------------------------------------------
        // TRANSFERÊNCIA — visitas elegíveis passam a nova dona
        // ------------------------------------------------------

        if (!reversao) {

          const snaps = await Promise.all(
            visitaIds.map((id) => tx.get(doc(db, "visitas", id)))
          );

          const visitasAtualizadas = [];

          for (const s of snaps) {

            if (!s.exists()) continue;

            const visita = s.data();

            if (visita.leadId !== leadId) continue;

            const decisao = classificarVisita(visita, {
              origemId: op.origemUid,
              hoje,
            });

            if (decisao.acao !== "atualizar") continue;

            visitasAtualizadas.push({
              id: s.id,
              consultoraIdAnterior: visita.consultoraId ?? null,
              consultoraAnterior: visita.consultora ?? null,
            });

          }

          const embutida =
            lead.visita?.id &&
            visitasAtualizadas.some((v) => v.id === lead.visita.id)
              ? { id: lead.visita.id, consultorAnterior: lead.visita.consultor ?? null }
              : null;

          if (embutida) {
            patchLead["visita.consultor"] = op.destinoNome;
          }

          // A MARCA na própria visita (ultimaTransferenciaEmMassaId) é o que a
          // reversão usa para saber quais visitas a transferência mexeu.
          // Só os autorizados conseguem gravá-la (Rules); a lista
          // visitasAtualizadas do item é informativa e NÃO é usada para
          // decidir nada (o cliente a grava e as Rules não conseguem
          // conferi-la).
          for (const v of visitasAtualizadas) {
            tx.update(doc(db, "visitas", v.id), {
              consultoraId: op.destinoUid,
              consultora: op.destinoNome,
              ultimaTransferenciaEmMassaId: opId,
              atualizadoEm: serverTimestamp(),
            });
          }

          tx.update(leadRef, patchLead);

          tx.set(eventoRef, {
            leadId,
            tipo: "TRANSFERENCIA",
            usuario: executor.nome || "Sistema",
            descricao:
              `Lead transferido de ${op.origemNome} para ${op.destinoNome} ` +
              `(transferência em massa). Motivo: ${op.motivo}`,
            dados: {
              origem: "massa",
              operacaoId: opId,
              responsavelAnterior: op.origemNome,
              responsavelAnteriorUid: op.origemUid,
              novoResponsavel: op.destinoNome,
              novoResponsavelUid: op.destinoUid,
              motivo: op.motivo,
              visitasAtualizadas: visitasAtualizadas.map((v) => v.id),
            },
            criadoEm: serverTimestamp(),
          });

          tx.set(itemRef, {
            ...baseItem,
            visitasAtualizadas,
            visitaEmbutidaAjustada: embutida,
          });

          return {
            resultado: RESULTADO_LEAD.OK,
            visitasAtualizadas: visitasAtualizadas.length,
          };

        }

        // ------------------------------------------------------
        // REVERSÃO — devolve ao dono registrado no item original
        // ------------------------------------------------------

        const itemOriginalSnap = await tx.get(refItem(op.reverteOpId, leadId));

        if (!itemOriginalSnap.exists()) {
          return {
            resultado: RESULTADO_LEAD.PULADO_ANALISE,
            detalhe: "sem item da operação original",
          };
        }

        const original = itemOriginalSnap.data();

        // --------------------------------------------------
        // O LEAD FOI TRABALHADO DEPOIS DA TRANSFERÊNCIA?
        //
        // Reverter só é seguro se nada relevante mudou. Qualquer
        // dos sinais abaixo manda o lead para ANÁLISE MANUAL (nunca
        // é revertido automaticamente), com o motivo.
        // --------------------------------------------------

        if (lead.ultimaTransferenciaEmMassaId !== op.reverteOpId) {
          return {
            resultado: RESULTADO_LEAD.PULADO_OUTRA_TRANSFERENCIA,
            detalhe: "foi movido por outra operação depois desta",
          };
        }

        if ((lead.etapa ?? null) !== (original.etapa ?? null)) {
          return {
            resultado: RESULTADO_LEAD.PULADO_ETAPA_MUDOU,
            detalhe: `etapa ${original.etapa ?? "?"} → ${lead.etapa ?? "?"}`,
          };
        }

        if (!mesmoInstante(lead.atualizadoEm, original.criadoEm)) {
          return {
            resultado: RESULTADO_LEAD.PULADO_ALTERADO_APOS,
            detalhe: "o lead foi alterado depois da transferência",
          };
        }

        if (eventosApos) {
          return {
            resultado: RESULTADO_LEAD.PULADO_EVENTOS_APOS,
            detalhe: "há eventos na timeline depois da transferência",
          };
        }

        // --------------------------------------------------
        // VISITAS
        //
        // O que decide QUAIS visitas voltam é a MARCA gravada na própria
        // visita pela transferência (ultimaTransferenciaEmMassaId ==
        // operação original) — nunca a lista do item de auditoria nem a
        // lista da operação, que o cliente grava e as Rules não conseguem
        // conferir (B3). O valor restaurado vem da OPERAÇÃO (UID e nome
        // validados pelas Rules), não de um "valor anterior" informado.
        //
        // Restaura só as visitas marcadas que AINDA estão com a
        // destinatária e sem comparecimento. Visitas criadas DEPOIS da
        // transferência (sem a marca) nunca são alteradas: ficam em
        // visitasParaAnalise. Nenhuma visita é criada ou excluída.
        // --------------------------------------------------

        const snapsVisitas = await Promise.all(
          visitaIds.map((id) => tx.get(doc(db, "visitas", id)))
        );

        const visitasRestauradas = [];
        const visitasNaoRestauradas = [];
        const visitasParaAnalise = [];

        snapsVisitas.forEach((snapVisita, i) => {

          const id = visitaIds[i];
          const visita = snapVisita.exists() ? snapVisita.data() : null;

          if (!visita || visita.leadId !== leadId) {
            return;
          }

          const comDestinataria = visita.consultoraId === op.origemUid;
          const realizada = COMPARECIMENTOS_REALIZADOS.includes(
            visita.comparecimento || ""
          );
          const marcadaPelaTransferencia =
            visita.ultimaTransferenciaEmMassaId === op.reverteOpId;

          if (marcadaPelaTransferencia) {

            if (!comDestinataria || realizada) {
              visitasNaoRestauradas.push({
                id,
                motivo: realizada
                  ? "já realizada depois da transferência"
                  : "responsável da visita mudou depois da transferência",
              });
              return;
            }

            tx.update(snapVisita.ref, {
              consultoraId: op.destinoUid,
              consultora: op.destinoNome,
              ultimaTransferenciaEmMassaId: opId,
              atualizadoEm: serverTimestamp(),
            });

            visitasRestauradas.push({
              id,
              consultoraIdAnterior: visita.consultoraId ?? null,
              consultoraAnterior: visita.consultora ?? null,
            });

            return;

          }

          // Visita que a transferência NÃO mexeu e que está com a
          // destinataria, pendente: é posterior à transferência.
          if (
            comDestinataria &&
            classificarVisita(visita, { origemId: op.origemUid, hoje }).acao === "atualizar"
          ) {
            visitasParaAnalise.push({
              id,
              data: visita.data ?? null,
              hora: visita.hora ?? null,
              status: visita.status ?? null,
            });
          }

        });

        // Espelho da visita dentro do lead: se a visita espelhada voltou,
        // o nome do consultor volta junto (a Rule só permite mexer em
        // visita.consultor aqui).
        if (
          lead.visita?.id &&
          visitasRestauradas.some((v) => v.id === lead.visita.id)
        ) {
          patchLead["visita.consultor"] = op.destinoNome;
        }

        tx.update(leadRef, patchLead);

        tx.set(eventoRef, {
          leadId,
          tipo: "TRANSFERENCIA",
          usuario: executor.nome || "Sistema",
          descricao:
            `Transferência em massa revertida: lead devolvido de ${op.origemNome} ` +
            `para ${op.destinoNome}.`,
          dados: {
            origem: "massa",
            reversao: true,
            operacaoId: opId,
            reverteOperacaoId: op.reverteOpId,
            responsavelAnterior: op.origemNome,
            responsavelAnteriorUid: op.origemUid,
            novoResponsavel: op.destinoNome,
            novoResponsavelUid: op.destinoUid,
            visitasRestauradas: visitasRestauradas.map((v) => v.id),
            visitasNaoRestauradas: visitasNaoRestauradas.map((v) => v.id),
            visitasParaAnalise: visitasParaAnalise.map((v) => v.id),
          },
          criadoEm: serverTimestamp(),
        });

        tx.set(itemRef, {
          ...baseItem,
          visitasAtualizadas: visitasRestauradas,
          visitasNaoRestauradas,
          visitasParaAnalise,
          visitaEmbutidaAjustada: null,
        });

        return {
          resultado: RESULTADO_LEAD.OK,
          visitasAtualizadas: visitasRestauradas.length,
        };

      });

      return { leadId, ...resultado };

    } catch (erro) {

      return {
        leadId,
        resultado: RESULTADO_LEAD.FALHA,
        detalhe: erro?.code || erro?.message || String(erro),
      };

    }

  }


  // ========================================================
  // VARREDURA FINAL DE VISITAS (somente transferência)
  //
  // Visitas criadas entre a listagem e a transação (ou depois)
  // para um lead já transferido ainda apontam para a origem.
  // ========================================================

  async function varrerVisitasTardias({ op, opId, leadIdsOk }) {

    const hoje = hojeBrasilia(agora());
    const tardias = [];

    const porLead = await buscarVisitasDosLeads(leadIdsOk);

    for (const leadId of leadIdsOk) {

      for (const visita of porLead[leadId] || []) {

        if (visita.consultoraId === op.destinoUid) continue;

        const decisao = classificarVisita(visita, {
          origemId: op.origemUid,
          hoje,
        });

        if (decisao.acao !== "atualizar") continue;

        await updateDoc(doc(db, "visitas", visita.id), {
          consultoraId: op.destinoUid,
          consultora: op.destinoNome,
          ultimaTransferenciaEmMassaId: opId,
          atualizadoEm: serverTimestamp(),
        });

        tardias.push({
          visitaId: visita.id,
          leadId,
          consultoraIdAnterior: visita.consultoraId ?? null,
          consultoraAnterior: visita.consultora ?? null,
        });

      }

    }

    return tardias;

  }


  // ========================================================
  // EXECUTAR / RETOMAR
  //
  // Mesma função para a primeira execução, para retomar uma
  // operação interrompida e para tentar de novo as pendências.
  // ========================================================

  async function executarOperacao({
    opId,
    executor,
    concorrencia = 5,
    aoProgredir = () => {},
    deveParar = () => false,
  }) {

    const opSnap = await getDoc(refOperacao(opId));

    if (!opSnap.exists()) {
      throw new Error("Operação não encontrada.");
    }

    const op = opSnap.data();

    if (op.status !== STATUS_OPERACAO.EM_ANDAMENTO) {
      throw new Error("Esta operação já foi encerrada e não pode ser executada de novo.");
    }

    const feitosAntes = new Set(
      (await getDocs(colItens(opId))).docs.map((d) => d.id)
    );

    const pendentesIniciais = op.leadIds.filter((id) => !feitosAntes.has(id));

    const resultados = [];
    let indice = 0;
    let concluidosNestaExecucao = 0;

    async function trabalhador() {

      while (indice < pendentesIniciais.length && !deveParar()) {

        const leadId = pendentesIniciais[indice++];

        const r = await processarLead({
          op,
          opId,
          leadId,
          executor,
        });

        resultados.push(r);

        if (
          r.resultado === RESULTADO_LEAD.OK ||
          r.resultado === RESULTADO_LEAD.JA_PROCESSADO
        ) {
          concluidosNestaExecucao++;
        }

        aoProgredir({
          opId,
          total: op.leadIds.length,
          concluidos: feitosAntes.size + concluidosNestaExecucao,
          ultimo: r,
        });

      }

    }

    await Promise.all(
      Array.from(
        { length: Math.max(1, Math.min(concorrencia, pendentesIniciais.length || 1)) },
        trabalhador
      )
    );

    // Fonte da verdade = itens gravados, nunca contadores em memória.
    const itensDocs = (await getDocs(colItens(opId))).docs;

    const itensFinais = new Set(itensDocs.map((d) => d.id));

    // Visitas posteriores à transferência, que a reversão NÃO mexeu:
    // precisam de análise manual.
    const visitasParaAnalise = itensDocs.flatMap((d) =>
      (d.data().visitasParaAnalise || []).map((v) => ({ leadId: d.id, ...v }))
    );

    const pendentes = op.leadIds.filter((id) => !itensFinais.has(id));

    const detalhePorLead = Object.fromEntries(
      resultados.map((r) => [r.leadId, r])
    );

    const pendenciasDetalhadas = pendentes.map((leadId) => ({
      leadId,
      resultado: detalhePorLead[leadId]?.resultado || "NAO_PROCESSADO",
      detalhe: detalhePorLead[leadId]?.detalhe || "",
    }));

    const interrompida = deveParar();

    if (pendentes.length === 0) {

      let visitasTardias = [];

      if (op.tipo === TIPO_OPERACAO.TRANSFERENCIA) {
        visitasTardias = await varrerVisitasTardias({
          op,
          opId,
          leadIdsOk: op.leadIds,
        });
      }

      await updateDoc(refOperacao(opId), {
        status: STATUS_OPERACAO.CONCLUIDA,
        totalConcluido: itensFinais.size,
        totalFalhas: 0,
        totalPulados: 0,
        falhas: [],
        pulados: [],
        visitasTardias,
        finalizadoEm: serverTimestamp(),
        finalizadoPorUid: executor.uid,
      });

      return {
        opId,
        estado: "concluida",
        totalPrevisto: op.leadIds.length,
        totalConcluido: itensFinais.size,
        pendentes: [],
        visitasTardias,
        visitasParaAnalise,
      };

    }

    // Há pendências ou foi interrompida: a operação CONTINUA em
    // andamento (retomável). Só vira "concluida_com_pendencias" por
    // decisão explícita (encerrarComPendencias).
    //
    // Os motivos ficam gravados na operação (continua em andamento),
    // para não se perderem se a janela for fechada.
    try {

      await updateDoc(refOperacao(opId), {
        totalConcluido: itensFinais.size,
        totalFalhas: pendenciasDetalhadas.filter(
          (p) => p.resultado === RESULTADO_LEAD.FALHA
        ).length,
        totalPulados: pendenciasDetalhadas.filter(
          (p) => p.resultado !== RESULTADO_LEAD.FALHA
        ).length,
        falhas: pendenciasDetalhadas.filter(
          (p) => p.resultado === RESULTADO_LEAD.FALHA
        ),
        pulados: pendenciasDetalhadas.filter(
          (p) => p.resultado !== RESULTADO_LEAD.FALHA
        ),
      });

    } catch (erroRegistro) {

      console.error(
        "Não foi possível registrar as pendências na operação:",
        erroRegistro
      );

    }

    return {
      opId,
      estado: interrompida ? "interrompida" : "pendencias",
      totalPrevisto: op.leadIds.length,
      totalConcluido: itensFinais.size,
      pendentes: pendenciasDetalhadas,
      visitasTardias: [],
      visitasParaAnalise,
    };

  }


  // ========================================================
  // ENCERRAR COM PENDÊNCIAS (decisão explícita de quem opera)
  // ========================================================

  async function encerrarComPendencias({ opId, executor, pendentes = [] }) {

    const opSnap = await getDoc(refOperacao(opId));

    if (!opSnap.exists()) {
      throw new Error("Operação não encontrada.");
    }

    const op = opSnap.data();

    if (op.status !== STATUS_OPERACAO.EM_ANDAMENTO) {
      throw new Error("Esta operação já foi encerrada.");
    }

    const itens = new Set((await getDocs(colItens(opId))).docs.map((d) => d.id));

    const faltantes = op.leadIds.filter((id) => !itens.has(id));

    const porLead = Object.fromEntries(pendentes.map((p) => [p.leadId, p]));

    const lista = faltantes.map((leadId) => ({
      leadId,
      resultado: porLead[leadId]?.resultado || "NAO_PROCESSADO",
      detalhe: porLead[leadId]?.detalhe || "",
    }));

    const falhas = lista.filter((p) => p.resultado === RESULTADO_LEAD.FALHA);
    const pulados = lista.filter((p) => p.resultado !== RESULTADO_LEAD.FALHA);

    let visitasTardias = [];

    if (op.tipo === TIPO_OPERACAO.TRANSFERENCIA) {
      visitasTardias = await varrerVisitasTardias({
        op,
        opId,
        leadIdsOk: op.leadIds.filter((id) => itens.has(id)),
      });
    }

    await updateDoc(refOperacao(opId), {
      status:
        faltantes.length === 0
          ? STATUS_OPERACAO.CONCLUIDA
          : STATUS_OPERACAO.CONCLUIDA_COM_PENDENCIAS,
      totalConcluido: itens.size,
      totalFalhas: falhas.length,
      totalPulados: pulados.length,
      falhas,
      pulados,
      visitasTardias,
      finalizadoEm: serverTimestamp(),
      finalizadoPorUid: executor.uid,
    });

    return { opId, totalConcluido: itens.size, falhas, pulados };

  }


  // ========================================================
  // REVERSÃO
  // ========================================================

  async function iniciarReversao({ opIdOriginal, executor }) {

    const originalSnap = await getDoc(refOperacao(opIdOriginal));

    if (!originalSnap.exists()) {
      throw new Error("Operação original não encontrada.");
    }

    const original = originalSnap.data();

    if (original.tipo !== TIPO_OPERACAO.TRANSFERENCIA) {
      throw new Error("Só é possível reverter uma transferência.");
    }

    if (original.status === STATUS_OPERACAO.EM_ANDAMENTO) {
      throw new Error("Encerre a operação original antes de revertê-la.");
    }

    // UMA reversão por operação. O ID é fixo ('rev-<operação>') e as
    // Firestore Rules recusam qualquer outro ID e qualquer recriação,
    // então isto vale mesmo contra chamadas diretas ao Firestore.
    const opId = `rev-${opIdOriginal}`;

    const existente = await getDoc(refOperacao(opId));

    if (existente.exists()) {

      if (existente.data().status === STATUS_OPERACAO.EM_ANDAMENTO) {
        return opId;   // retoma a reversão já aberta
      }

      throw new Error(
        "Esta operação já foi revertida (reversão " +
        (existente.data().status === STATUS_OPERACAO.CONCLUIDA
          ? "concluída"
          : "encerrada com pendências") +
        "). Só é permitida uma reversão por operação; trate os leads " +
        "pendentes manualmente."
      );

    }

    const itens = (await getDocs(colItens(opIdOriginal))).docs.map((d) => d.id);

    if (!itens.length) {
      throw new Error("A operação original não tem leads transferidos para reverter.");
    }

    // O destino da reversão é a origem original — pode estar INATIVA
    // (exceção válida SOMENTE aqui; as Rules só aceitam com o item
    // da operação original). Nome atual vem do cadastro.
    const [origemOriginal, destinataria] = await Promise.all([
      lerUsuario(original.origemUid),
      lerUsuario(original.destinoUid),
    ]);

    if (!origemOriginal || origemOriginal.perfil !== "recepcionista") {
      throw new Error("A consultora de origem não está mais cadastrada como recepcionista.");
    }

    await setDoc(refOperacao(opId), {
      tipo: TIPO_OPERACAO.REVERSAO,
      status: STATUS_OPERACAO.EM_ANDAMENTO,
      reverteOpId: opIdOriginal,
      executadoPorUid: executor.uid,
      executadoPorNome: executor.nome || "",
      origemUid: original.destinoUid,
      origemNome: destinataria?.nome || original.destinoNome,
      destinoUid: original.origemUid,
      destinoNome: origemOriginal.nome,
      destinoAtiva: origemOriginal.ativo,
      motivo: `Reversão da operação ${opIdOriginal}`,
      leadIds: itens,
      totalPrevisto: itens.length,
      criadoEm: serverTimestamp(),
    });

    return opId;

  }


  // ========================================================
  // CONSULTAS
  // ========================================================

  async function listarOperacoes({ limite = 20 } = {}) {

    const snap = await getDocs(
      query(colOperacoes(), orderBy("criadoEm", "desc"), limit(limite))
    );

    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));

  }


  async function carregarRelatorio(opId) {

    const [opSnap, itensSnap] = await Promise.all([
      getDoc(refOperacao(opId)),
      getDocs(colItens(opId)),
    ]);

    if (!opSnap.exists()) {
      throw new Error("Operação não encontrada.");
    }

    const op = { ...opSnap.data(), id: opSnap.id };
    const itens = itensSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const feitos = new Set(itens.map((i) => i.id));

    // Os contadores e o estado final da operação são DECLARAÇÕES do
    // executor (as Rules não conseguem contar os itens). Aqui comparamos
    // com os itens realmente gravados e sinalizamos qualquer divergência.
    const finalizada = op.status !== STATUS_OPERACAO.EM_ANDAMENTO;

    const divergencia =
      finalizada &&
      (
        (op.totalConcluido ?? 0) !== itens.length ||
        (op.status === STATUS_OPERACAO.CONCLUIDA &&
          itens.length !== (op.leadIds || []).length)
      )
        ? {
            declarado: op.totalConcluido ?? 0,
            gravado: itens.length,
            previsto: (op.leadIds || []).length,
          }
        : null;

    return {
      operacao: op,
      itens,
      divergencia,
      pendentes: (op.leadIds || []).filter((id) => !feitos.has(id)),
      visitasParaAnalise: itens.flatMap((item) =>
        (item.visitasParaAnalise || []).map((v) => ({ leadId: item.id, ...v }))
      ),
    };

  }


  async function situacaoDeReversao(opIdOriginal) {

    const snap = await getDocs(
      query(colOperacoes(), where("reverteOpId", "==", opIdOriginal))
    );

    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));

  }


  return {
    carregarUsuarios,
    montarPrevia,
    iniciarOperacao,
    executarOperacao,
    encerrarComPendencias,
    iniciarReversao,
    listarOperacoes,
    carregarRelatorio,
    situacaoDeReversao,
  };

}
