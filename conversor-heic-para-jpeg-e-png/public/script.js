document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scanBtn');
    const convertBtn = document.getElementById('convertBtn');
    const folderInput = document.getElementById('folderPath');
    const scanStats = document.getElementById('scanStats');
    const fileCountSpan = document.getElementById('fileCount');
    const qualityInput = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const form = document.getElementById('converterForm');
    const progressArea = document.getElementById('progressArea');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatus = document.getElementById('progressStatus');
    const progressLogs = document.getElementById('progressLogs');
    const radioCards = document.querySelectorAll('.radio-card');

    let totalFiles = 0;
    let convertedCount = 0;

    // Quality slider update
    qualityInput.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
    });

    // Radio selection styling
    radioCards.forEach(card => {
        card.addEventListener('click', () => {
            radioCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
        });
    });

    // Scan Directory
    scanBtn.addEventListener('click', async () => {
        const path = folderInput.value.trim();
        if (!path) {
            alert('Por favor insira um caminho de pasta válido.');
            return;
        }

        scanBtn.textContent = 'Verificando...';
        scanBtn.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/api/scan-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: path })
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            totalFiles = data.count;
            fileCountSpan.textContent = totalFiles;
            scanStats.style.display = 'block';

            if (totalFiles > 0) {
                convertBtn.disabled = false;
                progressStatus.textContent = `${totalFiles} arquivos prontos para conversão.`;
            } else {
                convertBtn.disabled = true;
                progressStatus.textContent = 'Nenhum arquivo .HEIC encontrado nesta pasta.';
            }

        } catch (error) {
            alert('Erro ao escanear pasta: ' + error.message);
        } finally {
            scanBtn.textContent = 'Escanear Pasta';
            scanBtn.disabled = false;
        }
    });

    // Convert Files (Streaming)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const path = folderInput.value.trim();
        const format = document.querySelector('input[name="format"]:checked').value;
        const quality = qualityInput.value;

        if (!path) return;

        // Reset State
        convertBtn.disabled = true;
        convertBtn.classList.add('loading');
        progressArea.style.display = 'block';
        progressLogs.innerHTML = '';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressStatus.textContent = 'Iniciando conversão...';
        convertedCount = 0;

        // Setup EventSource for SSE
        const params = new URLSearchParams({
            folderPath: path,
            outputFormat: format,
            quality: quality
        });

        const eventSource = new EventSource(`http://localhost:3000/api/convert-stream?${params.toString()}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'start') {
                addLogItem(data.file, 'converting', 'Convertendo...');
            }
            else if (data.type === 'success') {
                updateLogItem(data.file, 'success', 'Concluído');
                updateProgress();
            }
            else if (data.type === 'error') {
                updateLogItem(data.file, 'error', 'Erro');
                updateProgress(); // Count even errors as processed for bar
                console.error('File Error:', data.error);
            }
            else if (data.type === 'complete') {
                eventSource.close();
                finishConversion(data.result);
            }
            else if (data.type === 'fatal_error') {
                eventSource.close();
                alert('Erro fatal: ' + data.error);
                finishConversion(null);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            // If connection drops without complete message
            if (convertedCount < totalFiles) {
                progressStatus.textContent = 'Conexão encerrada (fim do fluxo ou erro).';
                finishConversion(null);
            }
        };
    });

    function updateProgress() {
        convertedCount++;
        const percent = Math.round((convertedCount / totalFiles) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressStatus.textContent = `Processando: ${convertedCount}/${totalFiles}`;
    }

    function addLogItem(filename, status, statusText) {
        const item = document.createElement('div');
        item.className = `log-item ${status}`;
        item.id = `log-${filename.replace(/\W/g, '_')}`; // Safe ID

        item.innerHTML = `
            <div class="status-icon"></div>
            <span class="log-filename">${filename}</span>
            <span class="log-status">${statusText}</span>
        `;

        progressLogs.prepend(item); // Add to top
    }

    function updateLogItem(filename, status, statusText) {
        const safeId = `log-${filename.replace(/\W/g, '_')}`;
        const item = document.getElementById(safeId);
        if (item) {
            item.className = `log-item ${status}`;
            item.querySelector('.log-status').textContent = statusText;
        }
    }

    function finishConversion(result) {
        convertBtn.disabled = false;
        convertBtn.classList.remove('loading');

        if (result) {
            progressStatus.textContent = `Concluído! ${result.converted} arquivos salvos em ${result.outputDir}`;
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            alert(`Conversão Concluída! Sucesso: ${result.converted}`);
        } else {
            // Already handled by partial updates or error
        }
    }
});
