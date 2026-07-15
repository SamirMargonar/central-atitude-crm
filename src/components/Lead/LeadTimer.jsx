import { useEffect, useState } from "react";

export default function LeadTimer({ createdAt }) {
  const [tempo, setTempo] = useState("00:00");
  const [cor, setCor] = useState("#33cf61");

  useEffect(() => {
    if (!createdAt) return;

    const atualizarTempo = () => {
      let inicio;

      if (createdAt.seconds) {
        inicio = new Date(createdAt.seconds * 1000);
      } else {
        inicio = new Date(createdAt);
      }

      const agora = new Date();

      const diferenca = Math.floor((agora - inicio) / 1000);

      const minutos = Math.floor(diferenca / 60);
      const segundos = diferenca % 60;

      setTempo(
        `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`
      );

      if (diferenca < 120) {
        setCor("#33cf61");
      } else if (diferenca < 300) {
        setCor("#f1c40f");
      } else if (diferenca < 600) {
        setCor("#ff9800");
      } else {
        setCor("#ff3b30");
      }
    };

    atualizarTempo();

    const intervalo = setInterval(atualizarTempo, 1000);

    return () => clearInterval(intervalo);

  }, [createdAt]);

  return (
    <p
      style={{
        color: cor,
        fontWeight: "bold",
        marginTop: "8px"
      }}
    >
      ⏱️ {tempo}
    </p>
  );
}