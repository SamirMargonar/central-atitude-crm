import { useEffect, useRef } from "react";

export default function NotificationCenter({ leads }) {
  const audio = useRef(null);
  const idsNotificados = useRef(new Set());

  useEffect(() => {
    if (!audio.current) return;

    // Verifica se existe algum lead novo
    const existeNovoLead = leads.some(
      (lead) => lead.status === "Novo Lead"
    );

    // Se não existir, para o som
    if (!existeNovoLead) {
      audio.current.pause();
      audio.current.currentTime = 0;
      return;
    }

    // Toca somente para leads realmente novos
    leads.forEach((lead) => {
      if (
        lead.status === "Novo Lead" &&
        !idsNotificados.current.has(lead.id)
      ) {
        idsNotificados.current.add(lead.id);

        audio.current.currentTime = 0;

        audio.current.play().catch((erro) => {
          console.error("Erro ao tocar áudio:", erro);
        });
      }
    });

  }, [leads]);

  return (
    <audio
      ref={audio}
      src="/notification.mp3"
      preload="auto"
      loop
    />
  );
}