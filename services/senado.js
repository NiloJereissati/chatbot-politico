const axios = require("axios");

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function buscarSenador(nomeBusca) {
  const response = await axios.get(
    "https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json",
    { timeout: 3000 }
  );

  const senadores =
    response.data.ListaParlamentarEmExercicio.Parlamentares.Parlamentar;

  const busca = normalizarTexto(nomeBusca);

  const senador = senadores.find((s) => {
    const nome = normalizarTexto(
      s.IdentificacaoParlamentar.NomeParlamentar
    );

    return nome.includes(busca) || busca.includes(nome);
  });

  if (!senador) return null;

  const dados = senador.IdentificacaoParlamentar;

  return {
    tipo: "Senador",
    nome: dados.NomeParlamentar,
    partido: dados.SiglaPartidoParlamentar,
    uf: dados.UfParlamentar
  };
}

module.exports = { buscarSenador };