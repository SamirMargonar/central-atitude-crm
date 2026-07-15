import { useEffect, useState } from "react";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

import "./LeadDetailsModal.css";

export default function LeadTimeline({ lead }) {

  const [historico, setHistorico] = useState([]);

  useEffect(() => {

    if (!lead?.id) return;

    const q = query(
      collection(
        db,
        "leads",
        lead.id,
        "historico"
      ),
      orderBy("criadoEm", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {

      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setHistorico(lista);

    });

    return () => unsubscribe();

  }, [lead]);

  function formatarData(timestamp) {

    if (!timestamp?.toDate) return "";

    return timestamp
      .toDate()
      .toLocaleString("pt-BR");

  }

  return (

    <section className="leadTimeline">

      <h3>📜 Timeline</h3>

      {historico.length === 0 ? (

        <p className="timelineEmpty">

          Nenhum evento registrado.

        </p>

      ) : (

        historico.map((evento) => (

          <div
            key={evento.id}
            className="timelineItem"
          >

            <div className="timelineHeader">

              <strong>

                {evento.tipo}

              </strong>

              <span>

                {formatarData(evento.criadoEm)}

              </span>

            </div>

            <p>

              {evento.descricao}

            </p>

            <small>

              👤 {evento.usuario}

            </small>

          </div>

        ))

      )}

    </section>

  );

}