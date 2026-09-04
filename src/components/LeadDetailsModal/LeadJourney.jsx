import { useState } from "react";

import "./LeadDetailsModal.css";

import {
  ETAPAS,
  JORNADA,
  nomeDaEtapa,
} from "../../core/LeadFlow";

import {
  atualizarLead,
  registrarEvento,
} from "../../core/EventEngine";

import {
  useAuth,
} from "../../auth/AuthContext";

import AgendarVisitaAction from "./actions/AgendarVisitaAction";
import MatriculaAction from "./actions/MatriculaAction";


// ==========================================================
// JORNADA DO CLIENTE — bolinhas clicáveis
// ==========================================================
//
// Atalho manual para reposicionar o lead na etapa correta,
// sem obrigar a passar por todas as etapas intermediárias
// (ex.: ex-aluno que já quer negociar a volta). O botão
// "Próximo passo" (LeadActions.jsx) continua sendo o fluxo
// padrão, sem nenhuma alteração — isto aqui é só o atalho.
//
// Visita e Matrícula NUNCA fazem um salto "cru" de etapa: elas
// abrem os formulários já existentes (AgendarVisitaAction /
// MatriculaAction), reaproveitados tal como são, para nunca
// deixar o lead numa dessas etapas sem o registro que elas
// normalmente exigem (visita agendada / matrícula confirmada).
// As outras 4 etapas usam atualizarLead()+registrarEvento()
// (tipo "JORNADA"), o mesmo padrão já usado em toda a jornada.
// ==========================================================

export default function LeadJourney({
  lead,
  setLead,
}) {

  const {
    usuario,
    perfilUsuario,
    permissoes,
  } = useAuth();

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [salvando, setSalvando] =
    useState(false);

  const [abrirAgendarVisita, setAbrirAgendarVisita] =
    useState(false);

  const [abrirMatricula, setAbrirMatricula] =
    useState(false);


  const etapaAtual =
    Number(
      lead?.etapa ?? 0
    );


  const podeEditar =
    permissoes?.editarLead === true;


  // ==========================================================
  // SALTO MANUAL DE ETAPA
  //
  // Só para Recebido/Contato/Resposta/Negociação — Visita e
  // Matrícula são tratadas à parte, abrindo o formulário
  // existente (ver clicarEtapa()).
  // ==========================================================

  async function moverParaEtapa(novaEtapa) {

    if (
      novaEtapa === etapaAtual ||
      salvando
    ) {

      return;

    }


    const diferenca =
      Math.abs(
        novaEtapa -
        etapaAtual
      );


    if (diferenca > 1) {

      const confirmado =
        window.confirm(

          `Alterar etapa?\n\nVocê está movendo este lead de "${nomeDaEtapa(etapaAtual)}" para "${nomeDaEtapa(novaEtapa)}".\nAs etapas intermediárias serão puladas.`

        );

      if (!confirmado) {

        return;

      }

    }


    try {

      setSalvando(true);


      const ultimoAtendimento =
        new Date().toLocaleString(
          "pt-BR"
        );


      // Mesmo padrão de payload mínimo já usado em toda a
      // jornada: nunca toca responsavelUid/consultora/
      // responsavel/status — só etapa e o registro de
      // atendimento. semResposta é zerado pelo mesmo motivo
      // que PrimeiroContatoAction.jsx já zera hoje: evitar que
      // o lead continue preso no alerta "Sem resposta" do
      // Dashboard depois de mover a etapa manualmente.

      await atualizarLead(
        lead.id,
        {

          etapa:
            novaEtapa,

          ultimoAtendimento,

          semResposta:
            false,

        }
      );


      if (setLead) {

        setLead({

          ...lead,

          etapa:
            novaEtapa,

          ultimoAtendimento,

          semResposta:
            false,

        });

      }


      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "JORNADA",

        usuario:
          nomeResponsavel,

        descricao:
          `${nomeResponsavel} moveu manualmente ${lead?.nome || "o lead"} de "${nomeDaEtapa(etapaAtual)}" para "${nomeDaEtapa(novaEtapa)}".`,

        dados: {

          etapaAnterior:
            etapaAtual,

          novaEtapa,

          ajusteManual:
            true,

        },

      });


    } catch (erro) {

      console.error(
        "Erro ao mover etapa manualmente:",
        erro
      );

      alert(
        "Não foi possível alterar a etapa do lead."
      );

    } finally {

      setSalvando(false);

    }

  }


  function clicarEtapa(etapaId) {

    if (
      !podeEditar ||
      salvando ||
      etapaId === etapaAtual
    ) {

      return;

    }


    // ------------------------------------------------------
    // VISITA — reaproveita o agendamento existente, nunca
    // cria a etapa sem uma visita real.
    // ------------------------------------------------------

    if (etapaId === ETAPAS.VISITA) {

      setAbrirAgendarVisita(true);

      return;

    }


    // ------------------------------------------------------
    // MATRÍCULA — reaproveita a confirmação existente, nunca
    // cria a etapa sem os dados da matrícula.
    // ------------------------------------------------------

    if (etapaId === ETAPAS.MATRICULA) {

      setAbrirMatricula(true);

      return;

    }


    moverParaEtapa(etapaId);

  }


  return (

    <section className="leadJourney">

      <h3>
        📊 Jornada do Cliente
      </h3>


      <div className="journeySteps">

        {JORNADA.map(
          (etapa) => {

            const concluida =
              etapa.id < etapaAtual;


            const atual =
              etapa.id === etapaAtual;


            return (

              <div
                key={etapa.id}
                className={`journeyItem ${
                  atual
                    ? "current"
                    : ""
                } ${
                  concluida
                    ? "completed"
                    : ""
                }`}
                onClick={() =>
                  clicarEtapa(etapa.id)
                }
                style={{
                  cursor:
                    podeEditar &&
                    !atual &&
                    !salvando
                      ? "pointer"
                      : "default",
                }}
                title={
                  podeEditar && !atual
                    ? `Mover para "${etapa.nome}"`
                    : undefined
                }
              >

                <div
                  className={`journeyCircle ${
                    concluida ||
                    atual
                      ? "active"
                      : ""
                  }`}
                >

                  {concluida
                    ? "✓"
                    : etapa.id + 1}

                </div>


                <span>

                  {etapa.nome}

                </span>


                {atual && (

                  <small>
                    Em andamento
                  </small>

                )}

              </div>

            );

          }
        )}

      </div>


      {/* Reaproveita os formulários existentes — não cria
          nenhuma segunda lógica de agendamento/matrícula. Os
          botões próprios (usados normalmente em LeadActions)
          ficam ocultos aqui; só o modal é aberto pelo clique
          na bolinha. */}

      <AgendarVisitaAction
        lead={lead}
        setLead={setLead}
        mostrarBotao={false}
        abertoExterno={abrirAgendarVisita}
        fecharExterno={() =>
          setAbrirAgendarVisita(false)
        }
      />

      <MatriculaAction
        lead={lead}
        setLead={setLead}
        mostrarBotao={false}
        abertoExterno={abrirMatricula}
        fecharExterno={() =>
          setAbrirMatricula(false)
        }
      />

    </section>

  );

}
