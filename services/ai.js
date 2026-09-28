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
  const fontesOficiais = Array.isArray(fontes) ? fontes : [];

  if (!respostaBase || !intent) {
    return null;
  }

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
            [
              "Você é um chatbot educativo sobre política brasileira.",
              "Seu escopo é exclusivamente política brasileira, instituições públicas, eleições, parlamentares, proposições legislativas, gastos públicos e dados oficiais relacionados.",
              "Responda em português do Brasil, com tom claro, neutro, didático e conversacional.",
              "Use apenas a resposta base, os dados estruturados e as fontes oficiais fornecidas pelo backend.",
              "Não use conhecimento externo, memória própria, Wikipedia, redes sociais, notícias ou suposições.",
              "Não invente autor, cargo, situação, votação, valor, data, fonte, número de proposição, resultado eleitoral ou acusação.",
              "Se a pergunta fugir do escopo político/institucional brasileiro, responda brevemente que só pode ajudar com esse tema.",
              "Se faltar dado oficial, diga que a informação não foi encontrada nas fontes consultadas.",
              "Evite opinião partidária, recomendação de voto, propaganda, ataque pessoal ou linguagem militante.",
              "Nunca remova as limitações importantes da resposta base.",
            ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            pergunta,
            intent,
            respostaBase,
            dados,
            fontes: fontesOficiais,
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
