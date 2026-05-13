const express = require("express");
const dotenv = require("dotenv");
const { buscarDeputado } = require("./services/camara");

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("Webhook recebido");

  const intent = req.body.queryResult.intent.displayName;

  try {
    if (intent === "BuscarPolitico") {

      const nome =
        req.body.queryResult.parameters.politico;

      console.log("Buscando:", nome);

      const politico = await buscarDeputado(nome);

      if (!politico) {
        return res.json({
          fulfillmentText: "Político não encontrado."
        });
      }

      return res.json({
        fulfillmentText:
          `${politico.nome} é do partido ${politico.partido} e representa ${politico.uf}.`
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