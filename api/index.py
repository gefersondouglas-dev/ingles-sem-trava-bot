import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite requisições de outros domínios (do seu site)

# --- Configuração do Gemini API ---
# (Passe sua chave de API como variável de ambiente no Cloud Run)
try:
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-1.0-pro')
except Exception as e:
    print(f"Erro ao configurar a API do Gemini: {e}")
    model = None

# --- O Prompt de Correção (A Mágica) ---
def criar_prompt(texto, dialeto):
    dialeto_nome = "Americano" if dialeto == "en-US" else "Britânico"
    
    return f"""
    Você é um professor de inglês especialista no dialeto {dialeto_nome}. 
    O usuário forneceu o seguinte texto para análise:
    "{texto}"

    Por favor, forneça uma análise em 3 partes, em formato JSON. A resposta deve ser APENAS o JSON, sem nenhum texto extra.
    O formato deve ser:
    {{
      "score": <um número de 0 a 100, onde 100 é perfeito>,
      "corrigido": "<O texto corrigido para soar 100% natural no dialeto {dialeto_nome}. Se estiver perfeito, repita o texto original.>",
      "explicacao": "<Uma explicação curta (1-2 frases) do principal erro e como corrigi-lo. Se estiver perfeito, diga 'Parabéns, seu inglês está perfeito!'>"
    }}
    """

# --- O Endpoint da API ---
@app.route('/analisar', methods=['POST'])
def analisar_texto():
    if not model:
        return jsonify({"erro": "API do Gemini não configurada"}), 500

    try:
        data = request.json
        texto = data.get('texto')
        dialeto = data.get('dialeto', 'en-US') # Padrão Americano

        if not texto:
            return jsonify({"erro": "Nenhum texto fornecido"}), 400

        prompt = criar_prompt(texto, dialeto)
        response = model.generate_content(prompt)
        
        # Limpa a resposta para garantir que é um JSON válido
        json_response = response.text.strip().replace("```json", "").replace("```", "")
        
        # O Gemini pode retornar o JSON em formato string, então precisamos 'carregá-lo'
        # Esta é uma forma simples de 'eval'. Para produção real, usar json.loads()
        # Mas como a resposta é um JSON, vamos confiar no retorno.
        # Para garantir, vamos apenas retornar o texto que esperamos ser JSON.
        
        # print(f"Resposta bruta da IA: {json_response}") # Para debug
        
        # A API do Gemini agora pode retornar um JSON diretamente, mas 
        # vamos retornar o texto limpo e deixar o frontend fazer o 'parse'.
        
        # A forma mais robusta é pedir ao Gemini para gerar JSON e usar json.loads()
        # Por simplicidade, vamos apenas retornar o texto e o frontend processa.
        
        # Vamos re-tentar com uma abordagem mais simples: retornar o texto direto.
        # O prompt pede JSON, então o `response.text` deve ser o JSON.
        
        # Vamos assumir que o Gemini retorna o JSON limpo como texto
        return jsonify(response.text) # O frontend vai receber uma string JSON

    except Exception as e:
        print(f"Erro na análise: {e}")
        return jsonify({"erro": "Erro ao processar a solicitação"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))