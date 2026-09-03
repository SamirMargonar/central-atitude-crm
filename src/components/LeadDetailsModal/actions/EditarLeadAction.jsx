import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
} from "../../../core/EventEngine";

import {
  useAuth,
} from "../../../auth/AuthContext";


export default function EditarLeadAction({
  lead,
  setLead,
}) {

  const {
    permissoes,
  } = useAuth();


  const [aberto, setAberto] =
    useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [nome, setNome] =
    useState(lead?.nome || "");

  const [telefone, setTelefone] =
    useState(lead?.telefone || "");

  const [idade, setIdade] =
    useState(lead?.idade || "");

  const [objetivo, setObjetivo] =
    useState(lead?.objetivo || "");

  const [origem, setOrigem] =
    useState(lead?.origem || "");


  // ==========================================================
  // ABRIR — sempre parte dos valores atuais do Lead
  // ==========================================================

  function abrir() {

    setNome(lead?.nome || "");

    setTelefone(lead?.telefone || "");

    setIdade(lead?.idade || "");

    setObjetivo(lead?.objetivo || "");

    setOrigem(lead?.origem || "");

    setAberto(true);

  }


  // ==========================================================
  // SALVAR
  //
  // updateDoc() no documento existente (via atualizarLead()),
  // somente nos 5 campos abaixo + atualizadoEm (injetado
  // automaticamente pelo próprio atualizarLead()). Nunca cria
  // um novo Lead, nunca toca em etapa, responsavelUid,
  // responsavel, consultora, assumido ou eventos/Timeline —
  // nenhum desses campos é enviado, então nenhum deles é
  // alterado no documento.
  // ==========================================================

  async function salvar() {

    if (!nome.trim()) {

      alert(
        "Informe o nome do Lead."
      );

      return;

    }


    try {

      setSalvando(true);


      const dadosAtualizados = {

        nome:
          nome.trim(),

        telefone,

        idade:
          idade ?
            Number(idade) :
            "",

        objetivo,

        origem,

      };


      await atualizarLead(
        lead.id,
        dadosAtualizados
      );


      if (setLead) {

        setLead({

          ...lead,

          ...dadosAtualizados,

        });

      }


      setAberto(false);


    } catch (erro) {

      console.error(
        "Erro ao editar Lead:",
        erro
      );

      alert(
        "Não foi possível salvar as alterações do Lead."
      );

    } finally {

      setSalvando(false);

    }

  }


  if (!permissoes.editarLead) {
    return null;
  }


  return (

    <>

      <button
        type="button"
        className="leadHeaderEditar"
        onClick={abrir}
      >
        ✏️ Editar
      </button>


      <LeadActionModal
        aberto={aberto}
        titulo="Editar Lead"
      >

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >

          {/* ================================================
              NOME
          ================================================ */}

          <div>

            <label>
              Nome
            </label>

            <input
              type="text"
              value={nome}
              onChange={(e) =>
                setNome(
                  e.target.value
                )
              }
              placeholder="Nome completo"
              disabled={salvando}
            />

          </div>


          {/* ================================================
              TELEFONE
          ================================================ */}

          <div>

            <label>
              Telefone
            </label>

            <input
              type="tel"
              value={telefone}
              onChange={(e) =>
                setTelefone(
                  e.target.value
                )
              }
              placeholder="(41) 99999-9999"
              disabled={salvando}
            />

          </div>


          {/* ================================================
              IDADE
          ================================================ */}

          <div>

            <label>
              Idade
            </label>

            <select
              value={idade}
              onChange={(e) =>
                setIdade(
                  e.target.value
                )
              }
              disabled={salvando}
            >

              <option value="">
                Selecione a idade
              </option>

              {Array.from(
                {
                  length: 90,
                },
                (_, index) => {

                  const valor =
                    index + 1;

                  return (

                    <option
                      key={valor}
                      value={valor}
                    >
                      {valor} anos
                    </option>

                  );

                }
              )}

            </select>

          </div>


          {/* ================================================
              OBJETIVO
          ================================================ */}

          <div>

            <label>
              Objetivo
            </label>

            <select
              value={objetivo}
              onChange={(e) =>
                setObjetivo(
                  e.target.value
                )
              }
              disabled={salvando}
            >

              <option value="">
                Objetivo ainda não definido
              </option>

              <option value="Viva Forma">
                Viva Forma
              </option>

              <option value="Viva Leve">
                Viva Leve
              </option>

              <option value="Viva Saúde">
                Viva Saúde
              </option>

              <option value="Viva Movimento">
                Viva Movimento
              </option>

            </select>

          </div>


          {/* ================================================
              ORIGEM
          ================================================ */}

          <div>

            <label>
              Origem
            </label>

            <select
              value={origem}
              onChange={(e) =>
                setOrigem(
                  e.target.value
                )
              }
              disabled={salvando}
            >

              <option value="">
                Selecione a origem
              </option>

              <option value="Site">
                Site
              </option>

              <option value="Instagram">
                Instagram
              </option>

              <option value="Espontânea">
                Espontânea
              </option>

              <option value="Indicação">
                Indicação
              </option>

              <option value="Campanha">
                Campanha
              </option>

            </select>

          </div>


          {/* ================================================
              BOTÕES
          ================================================ */}

          <div className="leadActionButtons">

            <button
              type="button"
              className="btnCancelar"
              onClick={() =>
                setAberto(false)
              }
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btnSalvar"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando
                ? "Salvando..."
                : "Salvar"}
            </button>

          </div>

        </div>

      </LeadActionModal>

    </>

  );

}
