# Inglês Sem Trava Bot

Webapp para brasileiros praticarem inglês. Você escreve ou fala uma frase, e o bot devolve uma nota de 0 a 100, a versão corrigida e uma explicação em português.

## Recursos

- Dialetos **americano (en-US)** e **britânico (en-GB)**
- Modo **Escrever** e modo **Falar** (o texto é transcrito enquanto você fala e só é analisado quando você toca no microfone para parar)
- Botão **Ouvir** para escutar a frase corrigida com o sotaque escolhido
- Botão **Copiar** para copiar a correção
- Tema **claro/escuro** e 4 cores de destaque (azul, verde, roxo, laranja)
- Histórico das últimas 5 análises, salvo no navegador
- Atalho `Ctrl + Enter` para analisar

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puro
- **Voz:** Web Speech API do navegador (reconhecimento de fala funciona no Chrome e no Edge)
- **Back-end:** Python com Flask, rodando como função serverless na Vercel
- **IA:** [OpenRouter](https://openrouter.ai/) com modelos gratuitos (`:free`)
- **Hospedagem:** [Vercel](https://vercel.com/)

## Estrutura

```text
ingles-sem-trava-bot/
├── api/
│   └── index.py        # Backend Flask (rotas /api/analisar e /api/saude)
├── public/
│   ├── index.html      # Página
│   ├── style.css       # Temas e estilos
│   └── script.js       # Lógica do front-end
├── .gitignore
├── requirements.txt    # Dependências Python
├── vercel.json         # Configuração da Vercel
└── README.md
```

## Como rodar localmente

Pré-requisitos: Python 3.10 ou mais novo, Git e uma chave gratuita do OpenRouter (https://openrouter.ai/keys).

```bash
git clone https://github.com/gefersondouglas-dev/ingles-sem-trava-bot.git
cd ingles-sem-trava-bot
python -m venv .venv
```

Ative o ambiente virtual:

- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- Linux/Mac: `source .venv/bin/activate`

Instale as dependências:

```bash
python -m pip install -r requirements.txt
```

Crie um arquivo `.env` na raiz com a sua chave:

```text
OPENROUTER_API_KEY=sk-or-...
```

Inicie o servidor:

```bash
python api/index.py
```

Abra http://localhost:5000. Para conferir se a chave foi lida, acesse http://localhost:5000/api/saude.

## Variáveis de ambiente

| Nome | Obrigatória | Descrição |
|---|---|---|
| `OPENROUTER_API_KEY` | Sim | Chave da API do OpenRouter |
| `MODELOS` | Não | Lista de modelos separados por vírgula, para forçar quais usar (ex.: `openrouter/free,outro/modelo:free`) |

Sem `MODELOS`, o backend usa uma lista de modelos preferidos e busca os gratuitos disponíveis no OpenRouter, com até 4 tentativas por análise.

## Deploy na Vercel

1. Envie o projeto para o GitHub.
2. Na Vercel, importe o repositório (Framework Preset: **Other**).
3. Em **Settings → Environment Variables**, adicione `OPENROUTER_API_KEY`.
4. Faça o deploy. A cada `git push` na branch `main`, a Vercel publica uma nova versão automaticamente.

Depois de alterar variáveis de ambiente, é preciso fazer um **Redeploy** para que valham.

## API

### `POST /api/analisar`

Corpo:

```json
{ "texto": "I goed to school yesterday", "dialeto": "en-US" }
```

Resposta:

```json
{
  "score": 60,
  "corrigido": "I went to school yesterday.",
  "explicacao": "O passado de \"go\" é irregular: \"went\".",
  "modelo": "nome-do-modelo-usado"
}
```

Limite de 500 caracteres por texto. Erros retornam `{ "erro": "mensagem" }`.

### `GET /api/saude`

Mostra se a chave está configurada e quais modelos serão tentados.

## Limites e problemas comuns

- **Erro 429 (`free-models-per-day`):** o limite diário de requisições gratuitas da conta do OpenRouter acabou. Contas sem crédito têm um limite baixo por dia; adicionar créditos no OpenRouter aumenta esse limite. Consulte as regras atuais no site deles.
- **Modelo indisponível (404):** modelos gratuitos mudam com frequência. O backend pula para o próximo automaticamente.
- **Modo Falar indisponível:** use Chrome ou Edge e permita o acesso ao microfone.
- **Privacidade:** alguns modelos gratuitos podem usar os textos enviados para treinamento. Não envie dados pessoais.

## Segurança

O arquivo `.env` está no `.gitignore` e nunca deve ser enviado ao GitHub. Se a chave for exposta, apague-a em https://openrouter.ai/keys e crie outra.
