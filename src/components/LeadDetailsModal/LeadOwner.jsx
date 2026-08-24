import { useState } from "react";

import {
  atualizarLead,
} from "../../core/EventEngine";

import "./LeadDetailsModal.css";

export default function LeadOwner({ lead, setLead }) {

  const [objetivoSelecionado, setObjetivoSelecionado] =
    useState("");

  const [salvandoObjetivo, setSalvandoObjetivo] =
    useState(false);


  async function definirObjetivo() {

    if (!objetivoSelecionado) {

      alert(
        "Selecione um objetivo."
      );

      return;

    }

    try {

      setSalvandoObjetivo(true);

      await atualizarLead(
        lead.id,
        {
          objetivo: objetivoSelecionado,
        }
      );

      if (setLead) {

        setLead({
          ...lead,
          objetivo: objetivoSelecionado,
        });

      }

      setObjetivoSelecionado("");

    } catch (erro) {

      console.error(
        "Erro ao definir objetivo do Lead:",
        erro
      );

      alert(
        "Não foi possível salvar o objetivo."
      );

    } finally {

      setSalvandoObjetivo(false);

    }

  }


  return (

    <section className="leadOwner">

      <div className="ownerCard">

        <span className="ownerLabel">
          👤 Responsável Comercial
        </span>

        <h3>
          {lead?.responsavel || "Não definido"}
        </h3>

      </div>

      <div className="ownerCard">

        <span className="ownerLabel">
          🕒 Último Atendimento
        </span>

        <h3>
          {lead?.ultimoAtendimento || "Nenhum atendimento"}
        </h3>

      </div>

      <div className="ownerCard">

        <span className="ownerLabel">
          🎯 Objetivo
        </span>

        <h3>
          {lead?.objetivo || "Não definido"}
        </h3>

        {!lead?.objetivo && (

          <div className="ownerObjetivoForm">

            <select
              value={objetivoSelecionado}
              onChange={(e) =>
                setObjetivoSelecionado(
                  e.target.value
                )
              }
              disabled={salvandoObjetivo}
            >

              <option value="">
                Selecione...
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

            <button
              type="button"
              onClick={definirObjetivo}
              disabled={salvandoObjetivo}
            >

              {salvandoObjetivo
                ? "Salvando..."
                : "Definir objetivo"}

            </button>

          </div>

        )}

      </div>

    </section>

  );

}
