const express = require("express");
const dotenv = require("dotenv");

const { buscarDeputado, buscarProjetoLei } = require("./services/camara");
const { buscarSenador } = require("./services/senado");

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const params = req.body.queryResult.parameters;

  try {
    if (intent === "BuscarPolitico") {
      const nome = params.politico;

      let politico = await buscarDeputado(nome);

      if (!politico) {
        politico = await buscarSenador(nome);
      }

      if (!politico) {
        return res.json({
          fulfillmentText: "Político não encontrado."
        });
      }

      return res.json({
        fulfillmentText:
          `${politico.nome} é ${politico.tipo}, do partido ${politico.partido}, e representa ${politico.uf}.`
      });
    }

   if (intent === "BuscarProjetoLei") {
  const tipo = params.Tipodeprojeto || "PL";
  const numero = Array.isArray(params.numero)
    ? params.numero[0]
    : params.numero;
  const ano = params.ano;

  console.log("Projeto:", { tipo, numero, ano });

  const projeto = await buscarProjetoLei(tipo, numero, ano);

  if (!projeto) {
    return res.json({
      fulfillmentText: "Projeto de lei não encontrado."
    });
  }

  return res.json({
    fulfillmentText:
      `${projeto.tipo} ${projeto.numero}/${projeto.ano}: ${projeto.ementa}`
  });
}

    return res.json({
      fulfillmentText: "Intent não reconhecida."
    });
  } catch (error) {
    console.error(error);

    return res.json({
      fulfillmentText: "Erro ao consultar dados políticos."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});