const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  console.log("Webhook recebido");
  console.log(JSON.stringify(req.body, null, 2));

  const intent = req.body.queryResult.intent.displayName;

  if (intent === "BuscarPolitico") {
    return res.json({
      fulfillmentText: "Webhook funcionando"
    });
  }

  return res.json({
    fulfillmentText: "Intent não reconhecida"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});