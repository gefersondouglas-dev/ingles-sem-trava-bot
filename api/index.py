import os
import json
import time
import urllib.request
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")

# Preferidos (gratuitos em set/2026). Se algum sumir, o código só pula para o próximo.
PREFERIDOS = [
    "openrouter/free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "openai/gpt-oss-120b:free",
]
MAX_TENTATIVAS = 4
LIMITE_CARACTERES = 500

_cache = {"t": 0, "ids": []}


def modelos_gratuitos():
    """Busca no OpenRouter os modelos :free atuais (cache de 1 hora)."""
    if _cache["ids"] and time.time() - _cache["t"] < 3600:
        return _cache["ids"]
    try:
        with urllib.request.urlopen("https://openrouter.ai/api/v1/models", timeout=8) as r:
            dados = json.load(r)["data"]
        ids = [m["id"] for m in dados if m["id"].endswith(":free")]
        if ids:
            _cache.update(t=time.time(), ids=ids)
        return ids
    except Exception as e:
        print(f"Não consegui listar modelos: {e}")
        return _cache["ids"]


def lista_de_modelos():
    # MODELOS no .env (separados por vírgula) tem prioridade total
    manual = [m.strip() for m in os.environ.get("MODELOS", "").split(",") if m.strip()]
    if manual:
        return manual[:MAX_TENTATIVAS]
    achados = modelos_gratuitos()
    extras = [m for m in achados if m not in PREFERIDOS]
    # Só mantém preferidos que existem na lista atual (openrouter/free é sempre válido)
    validos = [m for m in PREFERIDOS if m == "openrouter/free" or not achados or m in achados]
    return (validos + extras)[:MAX_TENTATIVAS]


def get_client():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return None
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)


def criar_prompt(texto, dialeto):
    nome = "American English" if dialeto == "en-US" else "British English"
    return f"""You are an expert English teacher specializing in {nome}.
You are a JSON-only output engine: reply with one valid JSON object and nothing else.

A Brazilian student wrote this text:
\"\"\"{texto}\"\"\"

Return exactly this JSON schema (no markdown, no backticks):
{{
  "score": <integer 0-100 for grammar and naturalness>,
  "corrigido": "<corrected version in {nome}; identical if already natural>",
  "explicacao": "<1-2 sentences in Brazilian Portuguese explaining the mistakes, or confirming it is natural>"
}}"""


def extrair_json(texto):
    inicio, fim = texto.find("{"), texto.rfind("}")
    if inicio == -1 or fim == -1:
        raise ValueError("A IA não retornou JSON")
    return json.loads(texto[inicio:fim + 1])


@app.route("/")
def home():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.route("/api/saude")
def saude():
    return jsonify({
        "ok": True,
        "chave_configurada": bool(os.environ.get("OPENROUTER_API_KEY")),
        "modelos_que_serao_tentados": lista_de_modelos(),
    })


@app.route("/api/analisar", methods=["POST"])
def analisar():
    client = get_client()
    if client is None:
        return jsonify({"erro": "OPENROUTER_API_KEY não configurada"}), 500

    dados = request.get_json(silent=True) or {}
    texto = str(dados.get("texto", "")).strip()
    dialeto = dados.get("dialeto", "en-US")
    if dialeto not in ("en-US", "en-GB"):
        dialeto = "en-US"

    if not texto:
        return jsonify({"erro": "Nenhum texto fornecido"}), 400
    if len(texto) > LIMITE_CARACTERES:
        return jsonify({"erro": f"Texto muito longo (máximo {LIMITE_CARACTERES} caracteres)"}), 400

    prompt = criar_prompt(texto, dialeto)
    erros = []

    for modelo in lista_de_modelos():
        try:
            resposta = client.chat.completions.create(
                model=modelo,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                timeout=12,
                extra_headers={
                    "HTTP-Referer": "https://ingles-sem-trava-bot.vercel.app",
                    "X-Title": "Ingles Sem Trava Bot",
                },
            )
            resultado = extrair_json((resposta.choices[0].message.content or "").strip())

            if not all(k in resultado for k in ("score", "corrigido", "explicacao")):
                raise ValueError("JSON incompleto")
            resultado["score"] = max(0, min(100, int(resultado["score"])))
            resultado["modelo"] = modelo
            return jsonify(resultado)

        except Exception as e:
            msg = str(e)[:150]
            erros.append(f"{modelo}: {msg}")
            print(f"Falha com {modelo}: {msg}")

    return jsonify({"erro": "Todos os modelos falharam. " + " | ".join(erros)}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)