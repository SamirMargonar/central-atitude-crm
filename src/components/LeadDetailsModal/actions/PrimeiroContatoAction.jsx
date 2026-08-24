import { useState } from "react";

import {
  Timestamp,
} from "firebase/firestore";

import LeadActionModal from "../LeadActionModal";
import PrimeiroContatoForm from "../forms/PrimeiroContatoForm";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  ETAPAS,
  proximaEtapa,
  nomeDaEtapa,
} from "../../../core/LeadFlow";

import {
  useAuth,
} from "../../../auth/AuthContext";


export default function PrimeiroContatoAction({
  lead,
  setLead,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();


  // ==========================================================
  // RESPONSÁVEL — usuário autenticado que está registrando o
  // Primeiro Contato (não é mais um nome fixo/default).
  // ==========================================================

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [aberto, setAberto] =
    useState(false);

  const [registrandoSemResposta, setRegistrandoSemResposta] =
    useState(false);


  // ==========================================================
  // ENVIA PRIMEIRA MENSAGEM
  // ==========================================================

  async function enviarMensagem(mensagem) {

    try {

      const novaEtapa =
        proximaEtapa(
          ETAPAS.RECEBIDO
        );


      const ultimoAtendimento =
        new Date().toLocaleString(
          "pt-BR"
        );


      await atualizarLead(
        lead.id,
        {

          etapa:
            novaEtapa,

          ultimoAtendimento,

          // Caso o lead responda,
          // deixa de ser considerado
          // sem resposta.

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


      // ========================================================
      // REGISTRA WHATSAPP
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "WHATSAPP",

        usuario:
          nomeResponsavel,

        descricao:
          mensagem,

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
          nomeResponsavel,

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(
            novaEtapa
          )}"`,

      });


      setAberto(false);


      // ========================================================
      // ABRE WHATSAPP
      // ========================================================

      const telefone =
        String(
          lead.telefone
        ).replace(
          /\D/g,
          ""
        );


      window.open(

        `https://wa.me/55${telefone}?text=${encodeURIComponent(
          mensagem
        )}`,

        "_blank"

      );

    } catch (erro) {

      console.error(
        "Erro ao registrar primeiro contato:",
        erro
      );

      alert(
        "❌ Não foi possível registrar o contato."
      );

    }

  }


  // ==========================================================
  // REGISTRAR NÃO RESPOSTA
  // ==========================================================

  async function registrarNaoRespondeu() {

    if (registrandoSemResposta) {
      return;
    }


    try {

      setRegistrandoSemResposta(
        true
      );


      // ========================================================
      // NÚMERO DA TENTATIVA
      // ========================================================

      const tentativasAnteriores =
        Number(
          lead.tentativasSemResposta ||
          0
        );


      const novaTentativa =
        tentativasAnteriores + 1;


      const agora =
        new Date();


      // ========================================================
      // PRÓXIMA TENTATIVA
      //
      // Depois da 3ª tentativa:
      // aguarda 5 dias.
      //
      // ========================================================

      let proximaTentativaEm =
        null;


      if (
        novaTentativa >= 3
      ) {

        const proximaData =
          new Date(agora);


        proximaData.setDate(
          proximaData.getDate() + 5
        );


        proximaTentativaEm =
          Timestamp.fromDate(
            proximaData
          );

      }


      // ========================================================
      // ATUALIZA LEAD
      // ========================================================

      const dadosAtualizacao = {

        tentativasSemResposta:
          novaTentativa,

        ultimaTentativaSemResposta:
          Timestamp.fromDate(
            agora
          ),

        semResposta:
          novaTentativa >= 3,

      };


      if (
        proximaTentativaEm
      ) {

        dadosAtualizacao.proximaTentativaEm =
          proximaTentativaEm;

      }


      await atualizarLead(

        lead.id,

        dadosAtualizacao

      );


      // ========================================================
      // ATUALIZA ESTADO LOCAL
      // ========================================================

      if (setLead) {

        setLead({

          ...lead,

          ...dadosAtualizacao,

        });

      }


      // ========================================================
      // REGISTRA TENTATIVA NO HISTÓRICO
      // ========================================================

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

          proximaTentativaEm:
            proximaTentativaEm,

        },

      });


      // ========================================================
      // SE CHEGOU NA 3ª TENTATIVA
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
            nomeResponsavel,

          descricao:
            `${lead.nome} entrou na lista de Leads sem resposta. Próxima tentativa programada para 5 dias.`,

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

          `O sistema programou uma nova tentativa para daqui 5 dias.`

        );

      }

      else {

        alert(

          `❌ Tentativa ${novaTentativa} registrada.\n\n` +

          `Ainda faltam ${
            3 - novaTentativa
          } tentativa(s) para entrar em "Sem Resposta".`

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

      setRegistrandoSemResposta(
        false
      );

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

        📞 Registrar Primeiro Contato

      </button>


      <LeadActionModal

        aberto={aberto}

        titulo="Primeiro Contato"

      >

        <PrimeiroContatoForm

          lead={lead}

          nomeResponsavel={
            nomeResponsavel
          }

          onCancelar={() =>
            setAberto(false)
          }

          onEnviar={
            enviarMensagem
          }

        />


        {/* ==================================================
            NÃO RESPONDEU
        ================================================== */}

        <div
          style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #e5e5e5",
          }}
        >

          <button

            type="button"

            onClick={
              registrarNaoRespondeu
            }

            disabled={
              registrandoSemResposta
            }

            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #ff3b30",
              background: "#fff",
              color: "#ff3b30",
              fontWeight: "600",
              cursor: registrandoSemResposta
                ? "not-allowed"
                : "pointer",
            }}

          >

            {registrandoSemResposta
              ? "Registrando..."
              : "❌ Não respondeu"}

          </button>


          <p
            style={{
              fontSize: "12px",
              color: "#777",
              textAlign: "center",
              marginTop: "8px",
              marginBottom: 0,
            }}
          >

            Após 3 tentativas sem resposta,
            o lead entra automaticamente
            na recuperação.

          </p>

        </div>

      </LeadActionModal>

    </>

  );

}