import { useEffect, useState } from "react";

import "../styles/leadDetails.css";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import {
  db,
} from "../../firebase/firebase.js";


// ==========================================================
// TIMELINE — MOBILE (somente leitura)
// ==========================================================
//
// Mesma consulta que LeadTimeline.jsx (Desktop) já faz —
// leads/{leadId}/eventos, ordenado por criadoEm desc — usando
// só firebase/firestore + db (src/firebase/firebase.js, não
// alterado). Nenhuma lógica de negócio nova: é uma leitura, sob
// as mesmas Firestore Rules já existentes (não alteradas).
//
// O mapeamento tipo→ícone/rótulo abaixo é só apresentação
// (nomes/emojis), reescrito aqui porque LeadTimeline.jsx é um
// componente visual do Desktop e não pode ser importado — mas
// cobre os mesmos tipos de evento já usados em todo o projeto,
// sem inventar nenhum tipo novo.
// ==========================================================

function tituloEvento(evento) {

  switch (evento.tipo) {

    case "WHATSAPP":
      return "📞 Primeiro Contato";

    case "WHATSAPP_LIVRE":
      return "💬 WhatsApp";

    case "RESPOSTA_LEAD":
      return "💬 Resposta do Lead";

    case "VISITA":
      return "📅 Visita";

    case "VISITA_CONFIRMACAO":
      return "✅ Visita Confirmada";

    case "VISITA_OBSERVACAO":
      return "📝 Observação da Visita";

    case "COMPARECIMENTO":
      return "🏋 Comparecimento";

    case "NEGOCIACAO":
      return "💰 Negociação";

    case "MATRICULA":
      return "🎓 Matrícula";

    case "MATRICULA_EDITADA":
      return "✏️ Matrícula Editada";

    case "JORNADA":
      return "🔄 Avanço na Jornada";

    case "OBSERVACAO":
      return "📝 Observação";

    case "TRANSFERENCIA":
      return "🔄 Transferência";

    case "RENOVACAO_CONTATO":
      return "📱 Contato de Renovação";

    case "RENOVACAO_RESPOSTA":
      return "💬 Resposta da Renovação";

    case "RENOVACAO_CONFIRMADA":
      return "🔄 Renovação Confirmada";

    case "RENOVACAO_RECUSADA":
      return "❌ Não Renovação";

    default:
      return "📌 Evento";

  }

}


function formatarData(timestamp) {

  if (!timestamp?.toDate) {

    return "";

  }

  return timestamp
    .toDate()
    .toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

}


export default function LeadTimelineMobile({
  leadId,
}) {

  const [eventos, setEventos] =
    useState([]);

  const [carregando, setCarregando] =
    useState(true);


  useEffect(() => {

    if (!leadId) {

      setEventos([]);

      setCarregando(false);

      return;

    }


    const consulta =
      query(

        collection(
          db,
          "leads",
          leadId,
          "eventos"
        ),

        orderBy(
          "criadoEm",
          "desc"
        )

      );


    const cancelarInscricao =
      onSnapshot(

        consulta,

        (snapshot) => {

          setEventos(
            snapshot.docs.map(
              (documento) => ({

                id:
                  documento.id,

                ...documento.data(),

              })
            )
          );

          setCarregando(false);

        },

        (erro) => {

          console.error(
            "Erro ao carregar Timeline (Mobile):",
            erro
          );

          setEventos([]);

          setCarregando(false);

        }

      );


    return () =>
      cancelarInscricao();

  }, [leadId]);


  return (

    <section className="mobileLeadDetalheSecao">

      <h2>
        📜 Timeline
      </h2>


      {carregando && (

        <p className="mobileLeadDetalheVazio">
          Carregando...
        </p>

      )}


      {!carregando &&
        eventos.length === 0 && (

        <p className="mobileLeadDetalheVazio">
          Nenhum evento registrado ainda.
        </p>

      )}


      {!carregando &&
        eventos.length > 0 && (

        <div className="mobileTimelineLista">

          {eventos.map((evento) => (

            <div
              className="mobileTimelineItem"
              key={evento.id}
            >

              <div className="mobileTimelineItemTopo">

                <strong>
                  {tituloEvento(evento)}
                </strong>

                <span>
                  {formatarData(evento.criadoEm)}
                </span>

              </div>


              {evento.descricao && (

                <p>
                  {evento.descricao}
                </p>

              )}


              <small>
                👤 {evento.usuario || "Sistema"}
              </small>

            </div>

          ))}

        </div>

      )}

    </section>

  );

}
