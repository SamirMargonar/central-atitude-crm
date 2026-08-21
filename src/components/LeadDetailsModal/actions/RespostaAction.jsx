import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  ETAPAS,
  nomeDaEtapa,
} from "../../../core/LeadFlow";


export default function RespostaAction({
  lead,
  setLead,
}) {

  const [aberto, setAberto] =
    useState(false);

  const [registrando, setRegistrando] =
    useState(false);


  // ==========================================================
  // ATUALIZA LEAD LOCALMENTE
  // ==========================================================

  function atualizarEstadoLocal(
    dados
  ) {

    if (!setLead) {
      return;
    }

    setLead({

      ...lead,

      ...dados,

    });

  }


  // ==========================================================
  // LEAD RESPONDEU
  // ==========================================================

  async function registrarResposta() {

    if (registrando) {
      return;
    }


    try {

      setRegistrando(true);


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


      // ========================================================
      // REGISTRA RESPOSTA
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "RESPOSTA",

        usuario:
          "Samir",

        descricao:
          `${lead.nome} respondeu ao contato.`,

        dados: {

          etapaAnterior,

          novaEtapa,

        },

      });


      // ========================================================
      // REGISTRA JORNADA
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "JORNADA",

        usuario:
          "Samir",

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(
            novaEtapa
          )}"`,

        dados: {

          etapaAnterior,

          novaEtapa,

        },

      });


      setAberto(false);


    } catch (erro) {

      console.error(
        "Erro ao registrar resposta:",
        erro
      );


      alert(
        "❌ Não foi possível registrar a resposta."
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


      const tentativasAnteriores =
        Number(
          lead?.tentativasSemResposta ||
          0
        );


      const novaTentativa =
        tentativasAnteriores + 1;


      const agora =
        new Date();


      // ========================================================
      // ATUALIZA CONTADOR
      // ========================================================

      const dadosAtualizacao = {

        tentativasSemResposta:
          novaTentativa,

        ultimaTentativaSemResposta:
          agora,

        semResposta:
          novaTentativa >= 3,

      };


      // ========================================================
      // 3ª TENTATIVA
      // ========================================================

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


      // ========================================================
      // REGISTRA TENTATIVA
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "SEM_RESPOSTA",

        usuario:
          "Samir",

        descricao:
          `Tentativa ${novaTentativa} de contato sem resposta.`,

        dados: {

          tentativa:
            novaTentativa,

          semResposta:
            novaTentativa >= 3,

        },

      });


      // ========================================================
      // ENTROU EM RECUPERAÇÃO
      // ========================================================

      if (
        novaTentativa >= 3
      ) {

        await registrarEvento({

          leadId:
            lead.id,

          tipo:
            "RECUPERACAO",

          usuario:
            "Samir",

          descricao:
            `${lead.nome} entrou na recuperação após 3 tentativas sem resposta. Nova tentativa programada para 5 dias.`,

          dados: {

            tentativas:
              novaTentativa,

            diasParaNovaTentativa:
              5,

          },

        });


        alert(

          `📵 ${lead.nome} entrou em "Sem Resposta".\n\n` +

          `Foram registradas ${novaTentativa} tentativas.\n\n` +

          `📅 Nova tentativa programada para daqui 5 dias.`

        );

      }

      else {

        const restantes =
          3 - novaTentativa;


        alert(

          `❌ Tentativa ${novaTentativa} registrada.\n\n` +

          `Ainda faltam ${restantes} tentativa(s) para entrar na recuperação.`

        );

      }


      setAberto(false);


    } catch (erro) {

      console.error(
        "Erro ao registrar não resposta:",
        erro
      );


      alert(
        "❌ Não foi possível registrar a tentativa."
      );


    } finally {

      setRegistrando(false);

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      <button

        className="btnAcaoPrincipal"

        onClick={() =>
          setAberto(true)
        }

      >

        💬 Registrar Resposta

      </button>


      <LeadActionModal

        aberto={aberto}

        titulo="Resposta do Lead"

      >

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >

          {/* ================================================
              EXPLICAÇÃO
          ================================================ */}

          <p>

            Registre aqui o que aconteceu
            depois do primeiro contato.

          </p>


          {/* ================================================
              RESPONDEU
          ================================================ */}

          <button

            type="button"

            onClick={
              registrarResposta
            }

            disabled={
              registrando
            }

            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: "none",
              background: "#33cf61",
              color: "#fff",
              fontWeight: "700",
              fontSize: "15px",
              cursor: registrando
                ? "not-allowed"
                : "pointer",
            }}

          >

            {registrando
              ? "Registrando..."
              : "🟢 Lead respondeu"}

          </button>


          {/* ================================================
              NÃO RESPONDEU
          ================================================ */}

          <button

            type="button"

            onClick={
              registrarNaoRespondeu
            }

            disabled={
              registrando
            }

            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #ff3b30",
              background: "#fff",
              color: "#ff3b30",
              fontWeight: "700",
              fontSize: "15px",
              cursor: registrando
                ? "not-allowed"
                : "pointer",
            }}

          >

            {registrando
              ? "Registrando..."
              : "🔴 Não respondeu"}

          </button>


          {/* ================================================
              CONTADOR
          ================================================ */}

          <div
            style={{
              padding: "14px",
              borderRadius: "10px",
              background: "#f7f7f7",
              textAlign: "center",
            }}
          >

            <strong>

              Tentativas sem resposta:{" "}

              {Number(
                lead?.tentativasSemResposta ||
                0
              )}

            </strong>


            <p
              style={{
                margin: "6px 0 0",
                fontSize: "12px",
                color: "#777",
              }}
            >

              Após 3 tentativas,
              o Lead entra automaticamente
              na recuperação.

            </p>

          </div>


          {/* ================================================
              CANCELAR
          ================================================ */}

          <button

            type="button"

            className="btnCancelar"

            onClick={() =>
              setAberto(false)
            }

            disabled={
              registrando
            }

          >

            Cancelar

          </button>

        </div>

      </LeadActionModal>

    </>

  );

}