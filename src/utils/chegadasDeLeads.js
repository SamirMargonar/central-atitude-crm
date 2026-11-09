// ==========================================================
// RASTREADOR DE CHEGADAS DE LEADS (lógica pura, sem React/Firebase)
// ==========================================================
//
// Combina os resultados das consultas de um perfil num único
// conjunto SEM DUPLICAR por id e identifica quais leads CHEGARAM
// durante esta sessão — a base do alerta sonoro:
//
//  - Enquanto TODAS as consultas não entregaram o primeiro
//    snapshot, a lista parcial já pode ser mostrada, mas nada é
//    considerado "chegada". Quando a última entrega, o conjunto
//    existente vira a LINHA DE BASE: os leads que já estavam lá
//    (backlog) NUNCA geram alerta — nem ao abrir, nem ao dar F5.
//  - Depois da linha de base, um id nunca visto antes nesta sessão
//    é uma chegada (aparece UMA vez). Mudar de consulta (a
//    recepcionista assume um lead da fila e ele passa a "próprio")
//    ou uma consulta ser reaberta (reconexão) NÃO repete a
//    chegada: `conhecidos` guarda todo id já visto.
//  - Na reconexão os dados da consulta são mantidos até o novo
//    snapshot substituí-los; o que chegou durante a queda aparece
//    como chegada normalmente.
//
// Cada chegada recebe um `seq` crescente; quem consome guarda o
// último `seq` processado e nunca trata a mesma chegada duas vezes.
// ==========================================================

export function criarRastreadorDeChegadas(fontes, { seqInicial = 0 } = {}) {

  const dados = new Map(fontes.map((f) => [f, []]));
  const prontas = new Set();
  const conhecidos = new Set();
  let linhaDeBaseFeita = false;
  let seq = seqInicial;

  function combinar() {
    const porId = new Map();
    for (const lista of dados.values()) {
      for (const lead of lista) {
        porId.set(lead.id, lead);
      }
    }
    return [...porId.values()];
  }

  return {

    // `lista`: leads ({ id, ... }) do snapshot COMPLETO da fonte.
    atualizar(fonte, lista) {

      dados.set(fonte, lista);
      prontas.add(fonte);

      const leads = combinar();

      if (prontas.size < dados.size) {
        return { leads, chegadas: [] };
      }

      if (!linhaDeBaseFeita) {
        linhaDeBaseFeita = true;
        leads.forEach((l) => conhecidos.add(l.id));
        return { leads, chegadas: [] };
      }

      const chegadas = [];
      for (const lead of leads) {
        if (!conhecidos.has(lead.id)) {
          conhecidos.add(lead.id);
          seq += 1;
          chegadas.push({ seq, id: lead.id, lead });
        }
      }

      return { leads, chegadas };
    },

    linhaDeBaseFeita: () => linhaDeBaseFeita,
  };
}
