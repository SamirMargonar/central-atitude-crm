import { useState } from "react";

import {
  Timestamp,
} from "firebase/firestore";

import "../styles/leadActions.css";

import {
  atualizarLead,
  registrarEvento,
} from "../../core/EventEngine.js";

import {
  ETAPAS,
  proximaEtapa,
  nomeDaEtapa,
} from "../../core/LeadFlow.js";

import {
  construirLinkWhatsApp,
} from "../../utils/whatsapp.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";


// ==========================================================
// PRIMEIRO CONTATO — MOBILE
// ==========================================================
//
// Réplica funcional de PrimeiroContatoAction.jsx (Desktop) —
// mesma sequência de escrita (atualizarLead → registrarEvento
// "WHATSAPP" → registrarEvento "JORNADA" → abre WhatsApp) e
// mesma lógica de "não respondeu" (contador de tentativas,
// recuperação na 3ª tentativa), usando só core/EventEngine.js e
// core/LeadFlow.js (não alterados). UI própria do Mobile,
// reaproveitando o modal genérico já existente em
// leadDetails.css (.mobileModalOverlay/.mobileModalCartao).
// ==========================================================

export default function PrimeiroContatoActionMobile({
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

  const [mensagem, setMensagem] =
    useState("");

  const [enviando, setEnviando] =
    useState(false);

  const [registrandoSemResposta, setRegistrandoSemResposta] =
    useState(false);

  const [erro, setErro] =
    useState("");


  function fechar() {

    setAberto(false);

    setMensagem("");

    setErro("");

  }


  // ==========================================================
  // ENVIA PRIMEIRA MENSAGEM
  // ==========================================================

  async function enviarMensagem() {

    if (
      enviando ||
      !mensagem.trim()
    ) {

      return;

    }

    try {

      setEnviando(true);

      setErro("");


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
          "WHATSAPP",

        usuario:
          nomeResponsavel,

        descricao:
          mensagem,

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

      });


      const linkWhatsApp =
        construirLinkWhatsApp(
          lead.telefone,
          mensagem
        );


      fechar();


      window.open(
        linkWhatsApp,
        "_blank"
      );

    } catch (erroEnvio) {

      console.error(
        "Erro ao registrar primeiro contato (Mobile):",
        erroEnvio
      );

      setErro(
        "Não foi possível registrar o contato."
      );

    } finally {

      setEnviando(false);

    }

  }


  // ==========================================================
  // REGISTRAR NÃO RESPONDEU
  // ==========================================================

  async function registrarNaoRespondeu() {

    if (registrandoSemResposta) {
      return;
    }

    try {

      setRegistrandoSemResposta(true);

      setErro("");


      const tentativasAnteriores =
        Number(
          lead.tentativasSemResposta ||
          0
        );

      const novaTentativa =
        tentativasAnteriores + 1;

      const agora =
        new Date();


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

      if (proximaTentativaEm) {

        dadosAtualizacao.proximaTentativaEm =
          proximaTentativaEm;

      }


      await atualizarLead(
        lead.id,
        dadosAtualizacao
      );


      if (setLead) {

        setLead({

          ...lead,

          ...dadosAtualizacao,

        });

      }


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

          proximaTentativaEm,

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
            `${lead.nome} entrou na lista de Leads sem resposta. Próxima tentativa programada para 5 dias.`,

          dados: {

            tentativas:
              novaTentativa,

            diasParaNovaTentativa:
              5,

          },

        });

      }


      fechar();

    } catch (erroTentativa) {

      console.error(
        "Erro ao registrar não resposta (Mobile):",
        erroTentativa
      );

      setErro(
        "Não foi possível registrar a tentativa."
      );

    } finally {

      setRegistrandoSemResposta(false);

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <section className="mobileLeadDetalheSecao">

      <h2>
        📞 Primeiro Contato
      </h2>

      <button
        type="button"
        className="mobileAcaoPrimaria"
        onClick={() =>
          setAberto(true)
        }
      >

        📞 Registrar Primeiro Contato

      </button>


      {aberto && (

        <div className="mobileModalOverlay">

          <div className="mobileModalCartao">

            <div className="mobileModalHeader">

              <h2>
                Primeiro Contato
              </h2>

              <button
                type="button"
                className="mobileModalFechar"
                onClick={fechar}
                disabled={
                  enviando ||
                  registrandoSemResposta
                }
              >
                ×
              </button>

            </div>


            {erro && (

              <p className="mobileAcaoErro">
                ⚠️ {erro}
              </p>

            )}


            <label>
              Mensagem
            </label>

            <textarea
              rows={6}
              placeholder="Escreva a primeira mensagem..."
              value={mensagem}
              onChange={(evento) =>
                setMensagem(evento.target.value)
              }
              disabled={
                enviando ||
                registrandoSemResposta
              }
            />


            <div className="mobileModalBotoes">

              <button
                type="button"
                className="mobileModalBotaoSecundario"
                onClick={fechar}
                disabled={
                  enviando ||
                  registrandoSemResposta
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="mobileModalBotaoPrimario"
                onClick={enviarMensagem}
                disabled={
                  enviando ||
                  registrandoSemResposta ||
                  !mensagem.trim()
                }
              >

                {enviando
                  ? "Enviando..."
                  : "Enviar pelo WhatsApp"}

              </button>

            </div>


            <button
              type="button"
              className="mobileAcaoSecundariaPerigo"
              onClick={registrarNaoRespondeu}
              disabled={
                enviando ||
                registrandoSemResposta
              }
            >

              {registrandoSemResposta
                ? "Registrando..."
                : "❌ Não respondeu"}

            </button>


            <p className="mobileAcaoNota">
              Após 3 tentativas sem resposta, o lead
              entra automaticamente na recuperação.
            </p>

          </div>

        </div>

      )}

    </section>

  );

}
