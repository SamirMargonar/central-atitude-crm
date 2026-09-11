import { useState } from "react";

import "../styles/leadActions.css";

import {
  atualizarLead,
  registrarEvento,
} from "../../core/EventEngine.js";

import {
  ETAPAS,
  nomeDaEtapa,
} from "../../core/LeadFlow.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";


// ==========================================================
// RESPOSTA DO LEAD — MOBILE
// ==========================================================
//
// Réplica funcional de RespostaAction.jsx (Desktop) — mesma
// sequência de escrita (atualizarLead → registrarEvento
// "RESPOSTA" → registrarEvento "JORNADA" → opcionalmente
// registrarEvento "RESPOSTA_LEAD" com o texto colado) e mesma
// lógica de "não respondeu" (contador de tentativas, recuperação
// na 3ª tentativa — aqui SEM Timestamp.fromDate, igual ao
// RespostaAction.jsx original, que também grava Date puro nesse
// fluxo). Usa só core/EventEngine.js e core/LeadFlow.js (não
// alterados).
// ==========================================================

export default function RespostaActionMobile({
  lead,
  setLead,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [aberto, setAberto] =
    useState(false);

  const [registrando, setRegistrando] =
    useState(false);

  const [perguntandoTextoResposta, setPerguntandoTextoResposta] =
    useState(false);

  const [textoResposta, setTextoResposta] =
    useState("");

  const [erro, setErro] =
    useState("");


  function atualizarEstadoLocal(dados) {

    if (!setLead) {
      return;
    }

    setLead({

      ...lead,

      ...dados,

    });

  }


  function fecharModal() {

    setAberto(false);

    setPerguntandoTextoResposta(false);

    setTextoResposta("");

    setErro("");

  }


  // ==========================================================
  // LEAD RESPONDEU
  // ==========================================================

  async function registrarResposta(
    textoRespostaLead
  ) {

    if (registrando) {
      return;
    }

    try {

      setRegistrando(true);

      setErro("");


      const etapaAnterior =
        Number(
          lead?.etapa ??
          ETAPAS.CONTATO
        );

      const novaEtapa =
        ETAPAS.RESPOSTA;

      const agora =
        new Date();

      const ultimoAtendimento =
        agora.toLocaleString(
          "pt-BR"
        );


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


      atualizarEstadoLocal({

        etapa:
          novaEtapa,

        ultimoAtendimento,

        semResposta:
          false,

      });


      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "RESPOSTA",

        usuario:
          nomeResponsavel,

        descricao:
          `${lead.nome} respondeu ao contato.`,

        dados: {

          etapaAnterior,

          novaEtapa,

        },

      });


      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "JORNADA",

        usuario:
          nomeResponsavel,

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(
            novaEtapa
          )}"`,

        dados: {

          etapaAnterior,

          novaEtapa,

        },

      });


      if (
        textoRespostaLead &&
        textoRespostaLead.trim()
      ) {

        await registrarEvento({

          leadId:
            lead.id,

          tipo:
            "RESPOSTA_LEAD",

          usuario:
            nomeResponsavel,

          descricao:
            textoRespostaLead.trim(),

        });

      }


      fecharModal();

    } catch (erroResposta) {

      console.error(
        "Erro ao registrar resposta (Mobile):",
        erroResposta
      );

      setErro(
        "Não foi possível registrar a resposta."
      );

    } finally {

      setRegistrando(false);

    }

  }


  // ==========================================================
  // NÃO RESPONDEU
  // ==========================================================

  async function registrarNaoRespondeu() {

    if (registrando) {
      return;
    }

    try {

      setRegistrando(true);

      setErro("");


      const tentativasAnteriores =
        Number(
          lead?.tentativasSemResposta ||
          0
        );

      const novaTentativa =
        tentativasAnteriores + 1;

      const agora =
        new Date();


      const dadosAtualizacao = {

        tentativasSemResposta:
          novaTentativa,

        ultimaTentativaSemResposta:
          agora,

        semResposta:
          novaTentativa >= 3,

      };


      if (
        novaTentativa >= 3
      ) {

        const proximaData =
          new Date(agora);

        proximaData.setDate(
          proximaData.getDate() + 5
        );

        dadosAtualizacao.proximaTentativaEm =
          proximaData;

      }


      await atualizarLead(

        lead.id,

        dadosAtualizacao

      );


      atualizarEstadoLocal(
        dadosAtualizacao
      );


      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "SEM_RESPOSTA",

        usuario:
          nomeResponsavel,

        descricao:
          `Tentativa ${novaTentativa} de contato sem resposta.`,

        dados: {

          tentativa:
            novaTentativa,

          semResposta:
            novaTentativa >= 3,

        },

      });


      if (
        novaTentativa >= 3
      ) {

        await registrarEvento({

          leadId:
            lead.id,

          tipo:
            "RECUPERACAO",

          usuario:
            nomeResponsavel,

          descricao:
            `${lead.nome} entrou na recuperação após 3 tentativas sem resposta. Nova tentativa programada para 5 dias.`,

          dados: {

            tentativas:
              novaTentativa,

            diasParaNovaTentativa:
              5,

          },

        });

      }


      setAberto(false);

    } catch (erroTentativa) {

      console.error(
        "Erro ao registrar não resposta (Mobile):",
        erroTentativa
      );

      setErro(
        "Não foi possível registrar a tentativa."
      );

    } finally {

      setRegistrando(false);

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <section className="mobileLeadDetalheSecao">

      <h2>
        💬 Resposta do Lead
      </h2>

      <button
        type="button"
        className="mobileAcaoPrimaria"
        onClick={() =>
          setAberto(true)
        }
      >

        💬 Registrar Resposta

      </button>


      {aberto && (

        <div className="mobileModalOverlay">

          <div className="mobileModalCartao">

            <div className="mobileModalHeader">

              <h2>
                Resposta do Lead
              </h2>

              <button
                type="button"
                className="mobileModalFechar"
                onClick={fecharModal}
                disabled={registrando}
              >
                ×
              </button>

            </div>


            {erro && (

              <p className="mobileAcaoErro">
                ⚠️ {erro}
              </p>

            )}


            {perguntandoTextoResposta ? (

              <>

                <label>
                  O que o Lead respondeu? (opcional)
                </label>

                <textarea
                  rows={6}
                  placeholder='Ex.: "Oi, tenho interesse. Queria saber os valores."'
                  value={textoResposta}
                  onChange={(evento) =>
                    setTextoResposta(evento.target.value)
                  }
                  disabled={registrando}
                />

                <div className="mobileModalBotoes">

                  <button
                    type="button"
                    className="mobileModalBotaoSecundario"
                    onClick={() =>
                      registrarResposta()
                    }
                    disabled={registrando}
                  >

                    {registrando
                      ? "Registrando..."
                      : "Continuar sem registrar"}

                  </button>

                  <button
                    type="button"
                    className="mobileModalBotaoPrimario"
                    onClick={() =>
                      registrarResposta(textoResposta)
                    }
                    disabled={registrando}
                  >

                    {registrando
                      ? "Registrando..."
                      : "Salvar resposta"}

                  </button>

                </div>

              </>

            ) : (

              <>

                <p className="mobileAcaoConsulta">
                  Registre aqui o que aconteceu
                  depois do primeiro contato.
                </p>

                <button
                  type="button"
                  className="mobileAcaoPrimaria"
                  onClick={() =>
                    setPerguntandoTextoResposta(true)
                  }
                  disabled={registrando}
                >

                  🟢 Lead respondeu

                </button>

                <button
                  type="button"
                  className="mobileAcaoSecundariaPerigo"
                  onClick={registrarNaoRespondeu}
                  disabled={registrando}
                >

                  {registrando
                    ? "Registrando..."
                    : "🔴 Não respondeu"}

                </button>

                <div className="mobileAcaoContador">

                  <strong>
                    Tentativas sem resposta:{" "}
                    {Number(
                      lead?.tentativasSemResposta ||
                      0
                    )}
                  </strong>

                  <p>
                    Após 3 tentativas, o Lead entra
                    automaticamente na recuperação.
                  </p>

                </div>

                <button
                  type="button"
                  className="mobileModalBotaoSecundario"
                  onClick={() =>
                    setAberto(false)
                  }
                  disabled={registrando}
                >
                  Cancelar
                </button>

              </>

            )}

          </div>

        </div>

      )}

    </section>

  );

}
