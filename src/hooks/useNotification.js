import { useEffect } from "react";

export default function useNotification(leads, audioRef) {
  useEffect(() => {
    if (!audioRef.current) return;

    const notificados = JSON.parse(
      localStorage.getItem("leadsNotificados") || "[]"
    );

    let tocar = false;
    const novosNotificados = [...notificados];

    leads.forEach((lead) => {
      if (
        lead.status === "Novo Lead" &&
        !notificados.includes(lead.id)
      ) {
        tocar = true;
        novosNotificados.push(lead.id);
      }
    });

    if (tocar) {
      audioRef.current.play().catch(() => {});
    }

    localStorage.setItem(
      "leadsNotificados",
      JSON.stringify(novosNotificados)
    );
  }, [leads, audioRef]);
}