// ==========================================================
// REAGENDAMENTO PELA AGENDA — visita + espelho do lead + Timeline
// ==========================================================
//
// Reagendar uma visita pela Agenda precisa manter TRÊS coisas
// coerentes:
//   1. o documento da visita (visitas/{id}): data, hora, status;
//   2. o ESPELHO no lead (leads/{leadId}.visita): é o que o cadastro
//      do lead mostra e usa em "Reagendar"/"Comparecimento";
//   3. a Timeline do lead (leads/{leadId}/eventos): um evento VISITA.
//
// Como são 3 documentos, gravá-los um a um deixaria o sistema
// incoerente em caso de falha no meio (visita nova com espelho
// velho, ou sem histórico). Por isso tudo vai num ÚNICO lote
// atômico (writeBatch): ou grava os três, ou não grava nenhum — e
// por ser um lote único não há como gerar evento duplicado por
// retentativa parcial.
//
// As Rules avaliam cada escrita do lote com as mesmas regras de
// antes (dono, gestão, recepcionista do turno, atendimento
// compartilhado). Se ALGUMA for negada, o lote inteiro é recusado e
// NADA foi gravado; aí voltamos ao comportamento que sempre existiu
// (só a visita, que a pessoa já podia reagendar) e tentamos o evento
// à parte, informando que o resultado ficou parcial.
//
// `db`/`fs`/`auth` são injetados (testes usam o Emulator).
// ==========================================================

import { formatarDataEHoraDaAgenda } from "../utils/formatarData.js";

export function nomeDaTitular(lead) {
  return lead?.responsavel || lead?.consultora || "";
}

// Espelho novo do lead — só quando a visita reagendada É a visita
// espelhada do lead (outra visita não pode sobrescrever o espelho).
export function montarEspelho({ visita, lead, nova }) {

  const titular = nomeDaTitular(lead);

  if (
    !lead?.visita?.id ||
    lead.visita.id !== visita.id ||
    !titular
  ) {
    return null;
  }

  return {
    id: visita.id,
    data: nova.data,
    hora: nova.hora,
    consultor: titular,
    observacao: nova.observacao || "",
  };

}

// Evento da Timeline (mesmo formato do reagendamento feito pelo
// cadastro do lead: VISITA + visitaAnterior/novaVisita).
export function montarEventoReagendamento({ visita, lead, nova, autor }) {

  const nomeLead = lead?.nome || visita.leadNome || "Lead";

  const anterior = formatarDataEHoraDaAgenda(visita.data, visita.hora, " às ", "sem data");

  const novaTexto = formatarDataEHoraDaAgenda(nova.data, nova.hora, " às ");

  return {
    tipo: "VISITA",
    usuario: autor.nome,
    descricao: `${autor.nome} reagendou a visita de ${nomeLead}: de ${anterior} para ${novaTexto}.`,
    dados: {
      origem: "AGENDA",
      visitaId: visita.id,
      visitaAnterior: {
        data: visita.data || "",
        hora: visita.hora || "",
        consultor: visita.consultora || "",
      },
      novaVisita: {
        data: nova.data,
        hora: nova.hora,
        consultor: visita.consultora || "",
      },
      ...(nova.observacao ? { observacao: nova.observacao } : {}),
      atendimentoCompartilhado:
        !!lead?.responsavelUid && lead.responsavelUid !== (autor.uid || ""),
      titularNome: nomeDaTitular(lead) || visita.consultora || "",
    },
  };

}

export function criarReagendamentoAgenda({
  db,
  fs,
  auth,
  agora = () => new Date(),
}) {

  function dadosDaVisita(visita, nova) {
    return {
      data: nova.data,
      hora: nova.hora,
      // o dono do lead continua o mesmo
      consultora: visita.consultora || "",
      observacao: nova.observacao || "",
      comparecimento: "",
      status: "AGENDADA",
    };
  }

  // ATENÇÃO — não incluir confirmadoPor/confirmadoPorNome/confirmadoEm:
  // as Rules (autoriaValida) só aceitam esses campos com o valor do
  // próprio chamador, nunca null.
  function atualizarVisitaPayload(visita, nova) {
    return {
      ...dadosDaVisita(visita, nova),
      atualizadoEm: fs.serverTimestamp(),
    };
  }

  function documentoDoEvento(leadId, evento) {
    return {
      leadId,
      tipo: evento.tipo,
      usuario: evento.usuario,
      usuarioUid: auth?.currentUser?.uid || "",
      descricao: evento.descricao,
      dados: evento.dados,
      criadoEm: fs.serverTimestamp(),
    };
  }

  // visita: documento atual; lead: documento do lead (ou null se
  // ainda não carregou); nova: { data, hora, observacao };
  // autor: { uid, nome }.
  async function reagendar({ visita, lead, nova, autor }) {

    const visitaRef = fs.doc(db, "visitas", visita.id);

    const leadId = lead?.id || visita.leadId;

    const mudouAgenda =
      (visita.data || "") !== nova.data ||
      (visita.hora || "") !== nova.hora;

    const resultado = {
      visita: { id: visita.id, ...dadosDaVisita(visita, nova) },
      espelho: false,
      evento: false,
      parcial: false,
      motivo: "completo",
    };

    // Só a observação mudou (ou não há lead vinculado): não é um
    // reagendamento do cliente — mesmo comportamento de antes.
    if (!mudouAgenda || !leadId) {
      await fs.updateDoc(visitaRef, atualizarVisitaPayload(visita, nova));
      resultado.motivo = !mudouAgenda ? "sem_mudanca" : "sem_lead";
      return resultado;
    }

    const espelho = montarEspelho({ visita, lead, nova });

    const evento = montarEventoReagendamento({ visita, lead, nova, autor });

    const eventoRef = fs.doc(fs.collection(db, "leads", leadId, "eventos"));

    const lote = fs.writeBatch(db);

    lote.update(visitaRef, atualizarVisitaPayload(visita, nova));

    if (espelho) {
      lote.update(fs.doc(db, "leads", leadId), {
        visita: espelho,
        ultimoAtendimento: agora().toLocaleString("pt-BR"),
        atualizadoEm: fs.serverTimestamp(),
      });
    }

    lote.set(eventoRef, documentoDoEvento(leadId, evento));

    try {

      await lote.commit();

      resultado.espelho = !!espelho;
      resultado.evento = true;
      resultado.motivo = espelho ? "completo" : "espelho_de_outra_visita";

      return resultado;

    } catch (erro) {

      // Qualquer outra falha (rede etc.): o lote é atômico, NADA foi
      // gravado — o erro sobe e a tela mostra "não foi possível".
      if (erro?.code !== "permission-denied") {
        throw erro;
      }

    }

    // O lote foi NEGADO inteiro (nada gravado). Comportamento de
    // sempre: reagenda a visita (se isto também for negado, o erro
    // sobe como antes) e tenta o evento à parte.
    await fs.updateDoc(visitaRef, atualizarVisitaPayload(visita, nova));

    resultado.parcial = true;
    resultado.motivo = "lote_negado";

    try {
      await fs.setDoc(eventoRef, documentoDoEvento(leadId, evento));
      resultado.evento = true;
    } catch {
      resultado.evento = false;
    }

    return resultado;

  }

  return { reagendar };

}
