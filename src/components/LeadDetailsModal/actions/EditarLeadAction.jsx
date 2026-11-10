import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import * as firestore from "firebase/firestore";

import {
  db,
} from "../../../firebase/firebase";

import {
  useAuth,
} from "../../../auth/AuthContext";

import {
  criarServicoTelefones,
} from "../../../services/telefonesLeads";

import {
  MENSAGEM_TELEFONE_DUPLICADO,
  MENSAGEM_TELEFONE_INVALIDO,
} from "../../../utils/telefoneLead";


// Telefone único: ao trocar o telefone, o lead e o índice do telefone
// são gravados no MESMO lote atômico; telefone de outro lead => nada
// é salvo (ver services/telefonesLeads.js e firestore.rules).
const servicoTelefones =
  criarServicoTelefones({
    db,
    fs: firestore,
  });


export default function EditarLeadAction({
  lead,
  setLead,
}) {

  const {
    permissoes,
    usuario,
  } = useAuth();


  // { mensagem } quando o telefone é duplicado/inválido
  const [erroTelefone, setErroTelefone] =
    useState(null);


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

    setErroTelefone(null);

    setAberto(true);

  }


  // ==========================================================
  // SALVAR
  //
  // updateDoc() no documento existente (via servicoTelefones.editarLead()),
  // somente nos 5 campos abaixo + atualizadoEm. Se o telefone mudou
  // para OUTRO número, o índice único do telefone é movido no mesmo
  // lote; se for o MESMO número (igual ou só formatado diferente), é
  // uma atualização comum, nunca bloqueada. Nunca cria
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


      setErroTelefone(null);


      await servicoTelefones.editarLead(
        lead.id,
        dadosAtualizados,
        {
          uid:
            usuario?.uid || "",
        }
      );


      if (setLead) {

        setLead({

          ...lead,

          ...dadosAtualizados,

        });

      }


      setAberto(false);


    } catch (erro) {

      if (erro?.codigo === "TELEFONE_DUPLICADO") {

        setErroTelefone({
          mensagem:
            MENSAGEM_TELEFONE_DUPLICADO,
        });

        return;

      }

      if (erro?.codigo === "TELEFONE_INVALIDO") {

        setErroTelefone({
          mensagem:
            MENSAGEM_TELEFONE_INVALIDO,
        });

        return;

      }

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
              onChange={(e) => {
                setTelefone(
                  e.target.value
                );
                setErroTelefone(null);
              }}
              placeholder="(41) 99999-9999"
              disabled={salvando}
            />

            {erroTelefone && (

              <div
                role="alert"
                className="avisoTelefone"
                style={{
                  marginTop:
                    "8px",
                  padding:
                    "10px 12px",
                  borderRadius:
                    "10px",
                  background:
                    "#fef2f2",
                  border:
                    "1px solid #fecaca",
                  color:
                    "#991b1b",
                  fontSize:
                    "13px",
                  fontWeight:
                    "600",
                }}
              >
                {erroTelefone.mensagem}
              </div>

            )}

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
