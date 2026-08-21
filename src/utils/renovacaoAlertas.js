// ==========================================================
// ALERTAS DE RENOVAÇÃO — marcos de 60 / 20 / 7 dias antes
// do vencimento da matrícula.
//
// A identificação de cada alerta é única por
// leadId + dataVencimento + marco, para que:
//   - o mesmo marco nunca seja notificado duas vezes para o
//     mesmo ciclo de vencimento (deduplicação via
//     alertasJaEnviados, persistido em lead.alertasRenovacaoEnviados);
//   - uma renovação (mudança de dataVencimento) inicie um
//     novo ciclo automaticamente, já que a chave muda.
// ==========================================================

export const MARCOS_RENOVACAO = [60, 20, 7];


// ==========================================================
// CONVERTE "aaaa-mm-dd" EM Date (meia-noite local)
// ==========================================================

function criarData(data) {

  if (!data) {
    return null;
  }

  const partes =
    data.split("-");

  if (
    partes.length !== 3
  ) {

    return null;

  }

  const dataConvertida =
    new Date(
      Number(partes[0]),
      Number(partes[1]) - 1,
      Number(partes[2])
    );

  dataConvertida.setHours(0, 0, 0, 0);

  return dataConvertida;

}


// ==========================================================
// DIAS ATÉ O VENCIMENTO
// ==========================================================

export function calcularDiasParaVencimento(
  dataVencimento,
  hoje = new Date()
) {

  const vencimento =
    criarData(dataVencimento);

  if (!vencimento) {
    return null;
  }

  const hojeNormalizado =
    new Date(hoje);

  hojeNormalizado.setHours(0, 0, 0, 0);

  const diferenca =
    vencimento.getTime() -
    hojeNormalizado.getTime();

  return Math.ceil(
    diferenca / (1000 * 60 * 60 * 24)
  );

}


// ==========================================================
// MARCOS ATINGIDOS
//
// Um marco é considerado "atingido" quando dias <= marco —
// não exige acertar o dia exato, para não depender de o app
// estar aberto no dia certo. Vencido (dias < 0) e sem data
// (dias === null) ficam fora do escopo destes alertas
// "antes do vencimento".
// ==========================================================

export function identificarMarcosAtingidos(
  dias
) {

  if (
    dias === null ||
    dias === undefined ||
    dias < 0
  ) {

    return [];

  }

  return MARCOS_RENOVACAO.filter(
    (marco) => dias <= marco
  );

}


// ==========================================================
// CHAVE ÚNICA DO ALERTA
// ==========================================================

export function gerarChaveAlerta(
  leadId,
  dataVencimento,
  marco
) {

  return `${leadId}__${dataVencimento}__${marco}`;

}


// ==========================================================
// FILTRA OS MARCOS AINDA NÃO ALERTADOS
// ==========================================================

export function filtrarMarcosNaoAlertados(
  marcosAtingidos,
  leadId,
  dataVencimento,
  alertasJaEnviados
) {

  return marcosAtingidos.filter(
    (marco) =>
      !alertasJaEnviados.has(
        gerarChaveAlerta(leadId, dataVencimento, marco)
      )
  );

}


// ==========================================================
// CALCULA TODOS OS ALERTAS PENDENTES DE UM CONJUNTO DE LEADS
// ==========================================================

export function calcularAlertasRenovacao(
  leads,
  alertasJaEnviados = new Set(),
  hoje = new Date()
) {

  const alertas = [];

  leads.forEach((lead) => {

    if (
      lead?.matricula?.confirmada !== true
    ) {

      return;

    }

    const dataVencimento =
      lead.matricula.dataVencimento;

    const dias =
      calcularDiasParaVencimento(dataVencimento, hoje);

    const marcosAtingidos =
      identificarMarcosAtingidos(dias);

    const marcosNaoAlertados =
      filtrarMarcosNaoAlertados(
        marcosAtingidos,
        lead.id,
        dataVencimento,
        alertasJaEnviados
      );

    marcosNaoAlertados.forEach((marco) => {

      alertas.push({

        id: gerarChaveAlerta(lead.id, dataVencimento, marco),

        leadId: lead.id,

        dataVencimento,

        marco,

        dias,

      });

    });

  });

  return alertas;

}
