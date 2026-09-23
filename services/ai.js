const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function extrairTextoResposta(data) {
  if (data?.output_text) {
    return data.output_text;
  }

  const partes = [];

  for (const item of data?.output || []) {
    for (const content of item.content || []) {
      if (content.text) {
        partes.push(content.text);
      }
    }
  }

  return partes.join("\n").trim();
}

async function gerarRespostaComIA({ pergunta, intent, respostaBase, dados, fontes }) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Você é um chatbot educativo sobre política brasileira. Responda em português do Brasil, com tom claro e conversacional. Use apenas os dados fornecidos. Não invente autor, situação, votação, fonte, número de proposição ou cargo político. Se faltar informação, diga que a informação não foi encontrada nos dados consultados. Evite opinião partidária.",
        },
        {
          role: "user",
          content: JSON.stringify({
            pergunta,
            intent,
            respostaBase,
            dados,
            fontes,
          }),
        },
      ],
      max_output_tokens: 450,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return extrairTextoResposta(data);
}

module.exports = { gerarRespostaComIA };
