document.addEventListener('DOMContentLoaded', () => {

    // --- IMPORTANTE: Insira a URL do seu Cloud Run aqui ---
    const BACKEND_URL = '/analisar';
    // ----------------------------------------------------

    // Elementos do DOM
    const themeToggle = document.getElementById('theme-toggle');
    const btnEscrever = document.getElementById('btn-escrever');
    const btnFalar = document.getElementById('btn-falar');
    const inputAreaText = document.getElementById('input-area-text');
    const inputAreaSpeech = document.getElementById('input-area-speech');
    const analyzeTextBtn = document.getElementById('analyze-text-btn');
    const recordBtn = document.getElementById('record-btn');
    const micText = recordBtn.querySelector('.mic-text');
    const textInput = document.getElementById('text-input');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result-container');
    const scoreEl = document.getElementById('score');
    const corrigidoEl = document.getElementById('corrigido');
    const explicacaoEl = document.getElementById('explicacao');

    // --- Lógica do Modo Escuro ---
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggle.textContent = isDarkMode ? '🌙' : '☀️';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });

    // Checa preferência salva
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '🌙';
    }

    // --- Lógica de Alternar Modo (Escrever/Falar) ---
    btnEscrever.addEventListener('click', () => {
        inputAreaText.style.display = 'block';
        inputAreaSpeech.style.display = 'none';
        btnEscrever.classList.add('active');
        btnFalar.classList.remove('active');
    });

    btnFalar.addEventListener('click', () => {
        inputAreaText.style.display = 'none';
        inputAreaSpeech.style.display = 'block';
        btnFalar.classList.add('active');
        btnEscrever.classList.remove('active');
    });

    // --- Lógica de Análise (Texto) ---
    analyzeTextBtn.addEventListener('click', () => {
        const texto = textInput.value;
        const dialeto = document.querySelector('input[name="dialeto"]:checked').value;
        if (texto.trim()) {
            analisarTexto(texto, dialeto);
        }
    });

    // --- Lógica de Gravação (Falar) - Web Speech API ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isRecording = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Só captura uma vez
        recognition.interimResults = false;

        recordBtn.addEventListener('click', () => {
            if (!isRecording) {
                // Começar a gravar
                const dialeto = document.querySelector('input[name="dialeto"]:checked').value;
                recognition.lang = dialeto; // 'en-US' ou 'en-GB'
                
                recognition.start();
                isRecording = true;
                recordBtn.classList.add('recording');
                micText.textContent = 'Gravando... (Clique para parar)';
                resultContainer.style.display = 'none';
            } else {
                // Parar de gravar (o evento 'result' será disparado)
                recognition.stop();
                isRecording = false;
                recordBtn.classList.remove('recording');
                micText.textContent = 'Clique para Falar';
            }
        });

        // Quando a fala é reconhecida
        recognition.onresult = (event) => {
            const transcribedText = event.results[0][0].transcript;
            const dialeto = recognition.lang;
            // Transcreveu. Agora, mande analisar.
            analisarTexto(transcribedText, dialeto);
        };

        // Lida com o fim da gravação
        recognition.onend = () => {
            if (isRecording) { // Se parou sozinho (ex: silêncio)
                isRecording = false;
                recordBtn.classList.remove('recording');
                micText.textContent = 'Clique para Falar';
            }
        };

        // Lida com erros
        recognition.onerror = (event) => {
            console.error("Erro no SpeechRecognition: ", event.error);
            micText.textContent = 'Erro ao gravar. Tente novamente.';
            isRecording = false;
            recordBtn.classList.remove('recording');
        };

    } else {
        // Navegador não suporta a API
        btnFalar.disabled = true;
        btnFalar.textContent = 'Modo Fala indisponível';
        console.warn('Web Speech API não suportada neste navegador.');
    }

    // --- Função Principal de Análise (Chama o Backend) ---
    async function analisarTexto(texto, dialeto) {
        loading.style.display = 'block';
        resultContainer.style.display = 'none';

        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ texto, dialeto })
            });

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }

            // O backend retorna uma string JSON, precisamos fazer 'parse' duas vezes.
            // 1. O 'await response.json()' lê a string enviada pelo Flask.
            // 2. O 'JSON.parse()' converte essa string no objeto JSON real.
            const responseDataString = await response.json();
            const data = JSON.parse(responseDataString);
            
            // Exibe os resultados
            scoreEl.textContent = `${data.score}%`;
            corrigidoEl.textContent = data.corrigido;
            explicacaoEl.textContent = data.explicacao;

            loading.style.display = 'none';
            resultContainer.style.display = 'block';

        } catch (error) {
            console.error('Erro ao analisar:', error);
            loading.style.display = 'none';
            resultContainer.style.display = 'block';
            corrigidoEl.textContent = 'Ocorreu um erro ao analisar seu texto. Tente novamente.';
            explicacaoEl.textContent = '';
            scoreEl.textContent = 'Erro';
        }
    }
});