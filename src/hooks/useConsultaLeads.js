import {
  useState,
} from "react";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import {
  filtrarLeads,
} from "../utils/leadFilters";


// ==========================================================
// CONSULTA DE LEADS ENTRE RECEPCIONISTAS
// ==========================================================
//
// Hook SEPARADO de useLeads.js (não alterado, não reutilizado
// aqui) — busca sob demanda (getDocs, não onSnapshot/tempo
// real), disparada só quando o usuário pesquisa. O Dashboard/
// Kanban continuam usando exclusivamente useLeads(), com o
// mesmo escopo de sempre. Nenhuma escrita é feita por este
// hook.
//
// BUSCA POR NOME — Firestore não tem "contém" nativo, então
// usamos o padrão padrão de prefixo (where nome >= termo &&
// nome < termo+''), que é um range query num único
// campo — não exige índice composto (coberto pelo índice
// automático de campo único do Firestore). Como o campo
// `nome` é gravado como o usuário digitou (sem normalização
// de maiúsculas/minúsculas em nenhum lugar do app — ver
// LeadModal.jsx/EditarLeadAction.jsx, não alterados), a busca
// tenta 3 variantes de capitalização (como digitado, Primeira
// Maiúscula, TUDO MAIÚSCULO) para cobrir os padrões mais
// comuns nos dados reais, sem precisar de um campo novo. Isto
// troca "contém em qualquer posição" por "começa com" — uma
// mudança de comportamento aceita para reduzir a exposição de
// dados (antes: toda a coleção "leads" era baixada a cada
// busca, para qualquer termo).
//
// BUSCA POR TELEFONE — o campo `telefone` é texto livre (sem
// máscara, sem normalização) e cada lead pode ter um formato
// diferente (com/sem espaço, com/sem hífen, DDD junto ou
// separado). Sem alterar o schema/gravação do lead (fora do
// escopo autorizado), não é possível montar uma query de
// prefixo/igualdade confiável no Firestore para "contém estes
// dígitos em qualquer posição". Por isso a busca por telefone
// mantém o comportamento anterior (busca a coleção inteira e
// filtra em memória) — comportamento preservado, não
// otimizado.
// ==========================================================

// Caractere Unicode muito alto, usado no padrão padrão de
// "busca por prefixo" do Firestore: qualquer string que
// comece com `termo` é < `termo + CARACTERE_FINAL_PREFIXO`.
const CARACTERE_FINAL_PREFIXO =
  "";

function pareceTelefone(termo) {

  const digitos =
    termo.replace(/\D/g, "");

  return digitos.length >= 3;

}

function variantesDeCapitalizacao(termo) {

  const comoDigitado =
    termo;

  const primeiraMaiuscula =
    termo.charAt(0).toUpperCase() +
    termo.slice(1).toLowerCase();

  const tudoMaiusculo =
    termo.toUpperCase();

  return [
    ...new Set([
      comoDigitado,
      primeiraMaiuscula,
      tudoMaiusculo,
    ]),
  ];

}

export default function useConsultaLeads() {

  const [
    resultados,
    setResultados,
  ] = useState([]);


  const [
    carregando,
    setCarregando,
  ] = useState(false);


  const [
    erro,
    setErro,
  ] = useState(null);


  async function consultar(termo) {

    const pesquisa =
      String(termo || "")
        .trim();


    if (!pesquisa) {

      setResultados([]);

      return;

    }


    setCarregando(true);

    setErro(null);


    try {

      let todosOsLeads;


      if (pareceTelefone(pesquisa)) {

        // --------------------------------------------------
        // TELEFONE — comportamento preservado (ver nota no
        // topo do arquivo): sem um campo normalizado, não há
        // como montar uma query de prefixo/igualdade
        // confiável, então continuamos buscando a coleção
        // inteira e filtrando em memória.
        // --------------------------------------------------

        const snapshot =
          await getDocs(
            collection(
              db,
              "leads"
            )
          );


        todosOsLeads =
          snapshot.docs.map(
            (documento) => ({

              id:
                documento.id,

              ...documento.data(),

            })
          );

      } else {

        // --------------------------------------------------
        // NOME — busca por prefixo real no Firestore, em vez
        // de baixar a coleção inteira. Tenta algumas variantes
        // de capitalização (ver nota no topo do arquivo) e
        // combina os resultados sem duplicar por id.
        // --------------------------------------------------

        const consultasPorVariante =
          variantesDeCapitalizacao(pesquisa).map(
            (variante) =>
              getDocs(
                query(
                  collection(
                    db,
                    "leads"
                  ),
                  where(
                    "nome",
                    ">=",
                    variante
                  ),
                  where(
                    "nome",
                    "<",
                    variante + CARACTERE_FINAL_PREFIXO
                  )
                )
              )
          );


        const snapshotsPorVariante =
          await Promise.all(
            consultasPorVariante
          );


        const leadsPorId =
          new Map();

        snapshotsPorVariante.forEach(
          (snapshot) => {

            snapshot.docs.forEach(
              (documento) => {

                leadsPorId.set(
                  documento.id,
                  {

                    id:
                      documento.id,

                    ...documento.data(),

                  }
                );

              }
            );

          }
        );


        todosOsLeads =
          [...leadsPorId.values()];

      }


      const filtrados =
        filtrarLeads(
          todosOsLeads,
          {

            pesquisa,

            consultora: "Todas",

            origem: "Todas",

            objetivo: "Todos",

            status: "Todos",

          }
        );


      setResultados(
        filtrados
      );

    } catch (erroConsulta) {

      console.error(
        "Erro ao consultar Leads:",
        erroConsulta
      );

      setErro(erroConsulta);

      setResultados([]);

    } finally {

      setCarregando(false);

    }

  }


  function limpar() {

    setResultados([]);

    setErro(null);

  }


  return {

    resultados,

    carregando,

    erro,

    consultar,

    limpar,

  };

}
