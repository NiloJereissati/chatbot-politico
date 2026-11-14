# IA educativa — preparação para revisão no Render

Estado: branch para revisão, sem merge, deploy, configuração de cobrança ou
teste com chave real. O contrato `/chat` continua `{ message }` →
`{ reply, intent, sources, mode }`. Node 22.18 ou superior.

## Diagnóstico do código anterior

- `dotenv.config()` carregava `.env` automaticamente. Esse arquivo já está
  rastreado no repositório público. Environment vazio no Render **não comprova**
  ausência de configuração: havia outra origem possível. Seus valores não foram
  lidos, copiados para o checkout, registrados ou usados neste trabalho.
- `deveUsarIAControlada` exigia dados e fontes. Templates educativos não tinham
  esses campos; `Fallback` também era excluído. Ativar uma chave não resolvia as
  perguntas abertas. O casamento amplo de “projeto de lei” interceptava comparações.
- A OpenAI já era chamada por `/v1/responses`. Sem chave, retornava `null`;
  `AI_ENABLED=false` desativava a etapa. Erros eram capturados, mantendo template.
  Não havia timeout explícito ou orçamento de requisições.
- O estado das variáveis privadas e o commit implantado não foram consultados.
  Não se concluiu que a chave está ausente só pela resposta `template`.

## Alterações propostas

- Perguntas educativas abertas sobre PEC, elaboração de leis e Câmara/Senado
  recebem contexto institucional revisado, fontes e uma síntese de base. A
  pergunta original é enviada ao modelo junto com esse contexto. Não há banco,
  busca vetorial, fonte inventada ou novo serviço.
- Consultas específicas a proposições mantêm prioridade. Perguntas sobre dados
  atuais, candidatos, localidades e outras integrações não usam a base educativa.
  Os serviços Câmara, Senado, TSE, IBGE e Transparência não foram modificados.
- IA é opt-in: somente `AI_ENABLED=true`, com chave configurada, pode gerar.
  Ausência, falha, saída incompleta, contexto excessivo ou orçamento esgotado
  preservam a resposta de base e suas fontes, com `mode: template`.
- `mode: ai` só acompanha texto completo retornado pelo provedor. Fontes vêm do
  backend. Links gerados fora da lista fornecida são recusados. A revisão e as
  limitações do material educativo são anexadas mesmo se o modelo as omitir.
- O `.env` legado não é carregado. Apenas em `NODE_ENV=development` pode ser
  carregado `.env.local`, que deve permanecer fora do Git. O arquivo de exemplo
  contém chave vazia e IA desativada.
- Logs usam categorias fixas e HTTP status, sem chaves, perguntas ou mensagens
  brutas do provedor. Startup registra se a IA foi explicitamente habilitada.
- O lockfile foi sincronizado com as majors já declaradas: o `npm ci` anterior
  falhava por incompatibilidade entre Express 4/dotenv 16 no manifesto e
  Express 5/dotenv 17 no lockfile. Não foi adicionado SDK nem dependência direta nova.
- Depois da sincronização, o audit identificou quatro pacotes com alertas
  (um crítico e três altos): Axios, follow-redirects, form-data e proxy-addr.
  Foram aplicadas correções compatíveis com as majors declaradas, sem `--force`;
  a auditoria seguinte informou zero vulnerabilidades. Novas dependências
  transitivas dessas versões ficam registradas no lockfile, sem nova dependência
  direta ou mudança de Express 4/dotenv 16.

## Configurações exatas que Nilo deverá conferir

Somente após revisão e autorização separada para ativação/deploy. **Não inserir
chaves no GitHub, no frontend ou em mensagens.** Preencher no painel privado do
serviço backend no Render, não no GitHub Pages.

| Configuração | Valor ou requisito |
| --- | --- |
| Runtime / versão do Node | Node 22.18+, preferencialmente linha 22; `engines` está no manifesto. |
| Build command | `npm ci --ignore-scripts --no-audit --no-fund` |
| Start command | `npm start` |
| `NODE_ENV` | `production` |
| `AI_ENABLED` | `false` durante revisão; `true` apenas quando Nilo autorizar a geração e o uso da conta. |
| `OPENAI_API_KEY` | Chave privada válida de um projeto autorizado, com acesso e quota; cadastrar somente no Render. Não usar automaticamente qualquer chave do `.env` público. |
| `OPENAI_MODEL` | Identificador de modelo compatível com Responses e autorizado na conta. O padrão legado é `gpt-5-mini`; conferir disponibilidade, depreciação e preço antes de ativar. Não houve seleção/contratação automática de outro modelo. |
| `ALLOWED_ORIGIN` | `https://elias226.github.io` (a origem não inclui `/chat-dashboard-hub/`). Sem configuração mantém `*`, como antes. |
| `AI_TIMEOUT_MS` | Opcional, padrão `20000`; inteiro de `1000` a `45000`, inclui leitura do corpo. |
| `AI_MAX_OUTPUT_TOKENS` | Opcional, padrão `800`; inteiro de `128` a `1500`. Inclui raciocínio e texto. |
| `AI_DAILY_REQUEST_LIMIT` | Opcional, padrão `20`; inteiro de `1` a `100`. Conta também chamadas com erro. |
| `PORT` | Deixar o Render fornecer; fallback local continua 3000. |

As credenciais do Portal da Transparência são independentes e permanecem com
seus nomes existentes (`PORTAL_TRANSPARENCIA_API_KEY` ou `TRANSPARENCIA_API_KEY`).
Não são necessárias para perguntas educativas. Nenhuma credencial real foi usada
nos testes. O frontend já entende `mode: ai` e `mode: template` sem alteração.

## Limites e custos

No processo: uma geração simultânea, até cinco inícios por minuto e o orçamento
diário configurado, com reinício da contagem à meia-noite UTC. Limite de mensagem
de 2.000 caracteres, contexto serializado de até 16.000 caracteres e limite de
saída acima. Não há retry automático de geração; nenhum erro amplia o orçamento.

**Contadores em memória não são um teto financeiro garantido.** Reinícios do
Render e múltiplas instâncias reiniciam/multiplicam a contagem. Nilo deve conferir
as quotas da conta do provedor; alertas de orçamento podem não interromper gastos.
Um timeout local também não garante que o provedor deixe de processar a chamada.

A [OpenAI tarifa a API](https://developers.openai.com/api/docs/pricing); o modelo
legado [gpt-5-mini não tem faixa Free](https://developers.openai.com/api/docs/models/gpt-5-mini).
Não ativar faturamento nem usar chave real sem autorização específica. Créditos
já autorizados são uma opção. Se for exigido custo zero, avaliar separadamente
um adaptador para [camada gratuita da Gemini API](https://aistudio.google.com/docs/pricing),
com quotas e termos próprios (incluindo tratamento de dados). Esse adaptador não
foi implementado. Outra opção é manter IA desligada e usar a base educativa,
identificada como `template`, até haver um provedor autorizado.

## Logs para diagnóstico

Cada tentativa elegível registra `event: ai_result` e uma categoria:

- `disabled`, `missing_key`, `invalid_configuration`: conferir configuração.
- `invalid_key`, `model_unavailable`, `quota_unavailable`, `provider_rate_limit`,
  `invalid_provider_configuration`: códigos conhecidos retornados pelo provedor.
- `provider_http_error` + `status`: falha HTTP sem código reconhecido.
- `timeout`, `provider_network_or_parse_error`: conexão/corpo/resposta inválida.
- `incomplete_output`, `empty_or_oversized_output`, `untrusted_output_link`:
  geração recusada, preservando a resposta de base.
- `input_limit`, `context_limit`, `insufficient_grounding`, `busy`, `minute_limit`,
  `daily_limit`: bloqueio local, sem nova chamada ao provedor.
- `generated`: texto completo aceito; o endpoint retorna `mode: ai`.

Não enviar logs privados integrais contendo dados de outras integrações ou
credenciais. `/health` continua sendo apenas saúde básica, não comprovação de IA.

## Fontes e escopo da base

Paráfrases revisadas em 14/11/2026, sem copiar documentos inteiros. Não informam
tramitação/votação atual, não avaliam partidos e não fazem recomendação eleitoral:

- [Como são feitas as leis — Senado](https://www12.senado.leg.br/jovemsenador/home/paginas/como-sao-feitas-as-leis).
- [Diferenças entre Senado e Câmara — Senado Verifica](https://www12.senado.leg.br/verifica/materias-especiais/2026/qual-a-diferenca-entre-o-senado-e-a-camara-dos-deputados).
- [Manual de Redação da Presidência — processo legislativo, 2018](https://www.gov.br/cvm/pt-br/assuntos/noticias/anexos/2020/20201222_Manual_Redacao_Presidencia.pdf).

Não é uma base jurídica completa. Fatos fora desses tópicos não ganham suporte
apenas porque a pergunta contém uma palavra conhecida; o prompt exige informar
falta de cobertura. Essa instrução e os filtros não garantem correção semântica
nem resistência completa a prompt injection. A qualidade real exige avaliação
após ativação autorizada. Perguntas chegam sem histórico, como no contrato atual.

## Validação e revisão

Com Node 22: `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`,
`npm test`. São verificações de sintaxe e testes unitários/HTTP locais com IA e
APIs simuladas; **não comprovam geração real**. CI da branch/PR usa apenas essas
simulações, sem secrets ou deploy. Checkout parcial exclui `.env` e os
`node_modules` versionados; o lockfile reconstrói as dependências.

Validação local concluída nesta revisão: instalação limpa pelo lockfile,
sintaxe de 14 arquivos JavaScript, 63 testes aprovados, `npm audit` e
`npm audit --omit=dev` com zero vulnerabilidades. O processo `server.js`
iniciou com ambiente isolado, `AI_ENABLED=false` e sem credenciais herdadas.
Nenhuma geração real foi executada. O resultado remoto deve ser conferido
nos checks da Pull Request; não há etapa de deploy no workflow.

O repositório já contém `.env` e `node_modules` rastreados. Não foram removidos ou
incluídos no diff desta proposta. Nilo deve verificar privadamente eventual
exposição e revogar segredos comprometidos; `.gitignore` não desfaz histórico.
As dependências instaladas geram diferenças locais em arquivos rastreados, que
ficam visíveis e **não entram no commit**. Nenhum histórico foi reescrito.

Após revisão do Nilo, merge e deploy deverão ser autorizados separadamente.
Depois, com provedor configurado e uso de chave explicitamente autorizado,
testar poucas perguntas reais: comparar PEC/PL; explicar aprovação de lei
federal; comparar deputado/senador. Conferir texto, fontes, limitações e
`mode: ai` junto com o registro `generated`/uso no provedor. Não basta HTTP 200.
