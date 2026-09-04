import {
  useState,
} from "react";

import WhatsAppLivreModal from "./WhatsAppLivreModal";

// ==========================================================
// Cor de prioridade por categoria — só afeta a aparência do
// card (tinta de fundo + borda), nunca o fundo da seção/coluna.
// Mapeamento local, presentacional: não altera o formato das
// props recebidas (categoria.titulo continua vindo de
// Dashboard.jsx exatamente como antes).
// ==========================================================

const CORES_POR_TITULO = {

  "Sem atendimento": "azul",

  "Sem resposta": "laranja",

  "Não compareceram": "vermelho",

  "Negociação parada": "amarelo",

  "Renovação próxima": "verde",

};


export default function PrecisaAtencao({

  categorias = [],

  onAbrirLead,

}) {

  const totalGeral =
    categorias.reduce(
      (soma, categoria) =>
        soma + categoria.itens.length,
      0
    );


  const [whatsappAlvo, setWhatsappAlvo] =
    useState(null);

  return (

    <section className="dashboardBloco">

      <div className="dashboardBlocoHeader">

        <div>

          <h2>
            🎯 Precisa da sua atenção
          </h2>

          <p>
            Pendências que precisam de ação agora.
          </p>

        </div>

        <strong>
          {totalGeral}
        </strong>

      </div>


      <div className="precisaAtencaoColunas">

        {categorias.map(
          (categoria) => {

            const cor =
              CORES_POR_TITULO[categoria.titulo] ||
              "azul";

            return (

              <div
                className={`precisaAtencaoColuna precisaAtencaoColuna--${cor}`}
                key={categoria.titulo}
              >

                <div className="precisaAtencaoColunaHeader">

                  <span>
                    {categoria.icone} {categoria.titulo}
                  </span>

                  <strong>
                    {categoria.itens.length}
                  </strong>

                </div>


                <div className="precisaAtencaoColunaConteudo">

                  {categoria.itens.length === 0 ? (

                    <div className="precisaAtencaoColunaVazia">
                      Nenhuma pendência.
                    </div>

                  ) : (

                    categoria.itens.map(
                      (item) => (

                        <div
                          className="precisaAtencaoCard"
                          key={item.id}
                        >

                          <button
                            type="button"
                            className="precisaAtencaoCardInfo"
                            onClick={() =>
                              onAbrirLead(item.leadId)
                            }
                          >

                            <strong>
                              {item.nome}
                            </strong>

                            <span>
                              {item.subtitulo}
                            </span>

                          </button>

                          {item.telefone && (

                            <button
                              type="button"
                              className="precisaAtencaoWhatsApp"
                              onClick={() =>
                                setWhatsappAlvo({

                                  leadId:
                                    item.leadId,

                                  nome:
                                    item.nome,

                                  telefone:
                                    item.telefone,

                                })
                              }
                            >
                              💬 WhatsApp
                            </button>

                          )}

                        </div>

                      )
                    )

                  )}

                </div>

              </div>

            );

          }
        )}

      </div>


      <WhatsAppLivreModal

        aberto={
          !!whatsappAlvo
        }

        fechar={() =>
          setWhatsappAlvo(null)
        }

        leadId={
          whatsappAlvo?.leadId
        }

        nome={
          whatsappAlvo?.nome
        }

        telefone={
          whatsappAlvo?.telefone
        }

      />

    </section>

  );

}
