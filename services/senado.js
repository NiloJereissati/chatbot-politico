const axios = require("axios");

async function buscarSenador(nomeBusca) {
  const res = await axios.get(
    "https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json",{
  timeout: 2000
});

  const lista = res.data.ListaParlamentarEmExercicio.Parlamentares.Parlamentar;

  const senador = lista.find((s) =>
    s.IdentificacaoParlamentar.NomeParlamentar.toLowerCase()
      .includes(nomeBusca.toLowerCase())
  );

  if (!senador) return null;

  return {
    nome: senador.IdentificacaoParlamentar.NomeParlamentar,
    partido: senador.IdentificacaoParlamentar.SiglaPartidoParlamentar,
    uf: senador.IdentificacaoParlamentar.UfParlamentar
  };
}

module.exports = {
  buscarSenador
};