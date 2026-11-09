// ==========================================================
// ALERTA SONORO DE NOVO LEAD — regras puras
// ==========================================================
//
// O alarme é por EVENTO (um lead que CHEGOU nesta sessão), não
// por estado (existir lead pendente). Fica ativo enquanto houver
// ao menos um lead de chegada ainda "pendente"; cada lead entra
// no alarme uma única vez (por `seq`).
//
// Um lead de chegada deixa de manter o alarme quando:
//   - alguém o ASSUMIU (assumido = true) — qualquer usuária,
//     sincronizado em tempo real;
//   - saiu da fila Recebidos (mudou de etapa) ou sumiu da lista;
//   - a recepcionista o abriu ("Ver Lead") ou fechou o aviso (X).
// ==========================================================

import { ETAPAS } from "../core/LeadFlow.js";

const norm = (v) => String(v ?? "").trim();

// Quem cadastrou é a própria usuária (por uid ou, na falta dele,
// por nome — compatibilidade com leads antigos)?
export function cadastradoPelaPropriaUsuaria(lead, perfilUsuario) {

  const uidUsuario = norm(perfilUsuario?.uid || perfilUsuario?.id);
  const uidCadastro = norm(lead?.cadastradoPorUid);

  if (uidUsuario && uidCadastro && uidUsuario === uidCadastro) {
    return true;
  }

  const nomeUsuario = norm(perfilUsuario?.nome).toLowerCase();
  const nomeCadastro = norm(lead?.cadastradoPor).toLowerCase();

  return Boolean(nomeUsuario && nomeCadastro && nomeUsuario === nomeCadastro);
}

// O lead ainda é um "novo lead pendente" para esta usuária?
export function leadPendenteParaAlarme(lead, perfilUsuario) {

  if (!lead) {
    return false;
  }

  const etapa = Number(lead.etapa ?? ETAPAS.RECEBIDO);

  return (
    etapa === ETAPAS.RECEBIDO &&
    !lead.assumido &&
    !cadastradoPelaPropriaUsuaria(lead, perfilUsuario)
  );
}

// Aplica as chegadas ainda não processadas (seq > ultimoSeq) ao
// conjunto de ids em alarme. Devolve { ids, ultimoSeq }.
export function aplicarChegadas({
  chegadas,
  ultimoSeq,
  idsAtuais,
  perfilUsuario,
  podeOuvir,
  dispensados = new Set(),
}) {

  let maior = ultimoSeq;
  const ids = new Set(idsAtuais);

  for (const chegada of chegadas || []) {

    if (!(chegada.seq > ultimoSeq)) {
      continue;
    }

    maior = Math.max(maior, chegada.seq);

    if (
      podeOuvir &&
      !dispensados.has(chegada.id) &&
      leadPendenteParaAlarme(chegada.lead, perfilUsuario)
    ) {
      ids.add(chegada.id);
    }
  }

  return { ids, ultimoSeq: maior };
}

// Mantém no alarme só os ids cujo lead (versão ao vivo) ainda é
// pendente. Quem foi assumido/movido/removido sai e NÃO volta.
export function podarAlarme({ ids, leads, perfilUsuario }) {

  const porId = new Map((leads || []).map((l) => [l.id, l]));
  const restantes = new Set();

  for (const id of ids) {
    if (leadPendenteParaAlarme(porId.get(id), perfilUsuario)) {
      restantes.add(id);
    }
  }

  return restantes;
}
