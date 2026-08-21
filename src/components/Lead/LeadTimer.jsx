import { useEffect, useState } from "react";

export default function LeadTimer({ createdAt }) {

  const [tempo, setTempo] =
    useState("0 minutos");

  const [cor, setCor] =
    useState("#33cf61");


  useEffect(() => {

    if (!createdAt) {
      return;
    }


    // ==========================================
    // OBTÉM DATA DE CRIAÇÃO
    // ==========================================

    function obterInicio() {

      // Firebase Timestamp
      if (
        typeof createdAt?.toMillis ===
        "function"
      ) {

        return createdAt.toMillis();

      }


      // Firebase Timestamp em formato bruto
      if (createdAt?.seconds) {

        return (
          createdAt.seconds *
          1000
        );

      }


      // Data normal
      const data =
        new Date(createdAt);


      if (
        !isNaN(
          data.getTime()
        )
      ) {

        return data.getTime();

      }


      return null;

    }


    const inicio =
      obterInicio();


    if (!inicio) {

      setTempo("0 minutos");

      return;

    }


    // ==========================================
    // FORMATA TEMPO
    // ==========================================

    function formatarTempo(
      diferenca
    ) {

      const minutosTotais =
        Math.floor(
          diferenca / 60000
        );


      // ========================================
      // MENOS DE 1 HORA
      // ========================================

      if (
        minutosTotais < 60
      ) {

        return (
          minutosTotais === 1
            ? "1 minuto"
            : `${minutosTotais} minutos`
        );

      }


      // ========================================
      // MENOS DE 1 DIA
      // ========================================

      const horas =
        Math.floor(
          minutosTotais / 60
        );


      if (horas < 24) {

        return (
          horas === 1
            ? "1 hora"
            : `${horas} horas`
        );

      }


      // ========================================
      // DIAS
      // ========================================

      const dias =
        Math.floor(
          horas / 24
        );


      if (dias < 30) {

        return (
          dias === 1
            ? "1 dia"
            : `${dias} dias`
        );

      }


      // ========================================
      // MESES
      // ========================================

      const meses =
        Math.floor(
          dias / 30
        );


      return (
        meses === 1
          ? "1 mês"
          : `${meses} meses`
      );

    }


    // ==========================================
    // ATUALIZA TEMPO
    // ==========================================

    function atualizarTempo() {

      const agora =
        Date.now();


      const diferenca =
        Math.max(
          0,
          agora - inicio
        );


      setTempo(
        formatarTempo(
          diferenca
        )
      );


      // ========================================
      // COR DO CRONÔMETRO
      // ========================================

      const segundos =
        Math.floor(
          diferenca / 1000
        );


      if (
        segundos < 120
      ) {

        setCor("#33cf61");

      }

      else if (
        segundos < 300
      ) {

        setCor("#f1c40f");

      }

      else if (
        segundos < 600
      ) {

        setCor("#ff9800");

      }

      else {

        setCor("#ff3b30");

      }

    }


    // Atualiza imediatamente
    atualizarTempo();


    // ==========================================
    // ATUALIZAÇÃO
    // ==========================================
    //
    // Não precisamos atualizar a cada segundo,
    // pois não mostramos segundos.
    //
    // Atualizamos a cada minuto.
    //

    const intervalo =
      setInterval(
        atualizarTempo,
        60000
      );


    // ==========================================
    // QUANDO VOLTAR PARA A ABA
    // ==========================================

    function quandoVoltarParaPagina() {

      if (
        document.visibilityState ===
        "visible"
      ) {

        atualizarTempo();

      }

    }


    document.addEventListener(
      "visibilitychange",
      quandoVoltarParaPagina
    );


    // ==========================================
    // LIMPEZA
    // ==========================================

    return () => {

      clearInterval(
        intervalo
      );

      document.removeEventListener(
        "visibilitychange",
        quandoVoltarParaPagina
      );

    };

  }, [createdAt]);


  return (

    <p
      style={{
        color: cor,
        fontWeight: "bold",
        marginTop: "8px",
      }}
    >

      ⏱️ {tempo}

    </p>

  );

}