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

    // Select Elements
    const inputTypeSelect = document.getElementById('inputType');
    const outputFormatSelect = document.getElementById('outputFormat');

    let totalFiles = 0;
    let convertedCount = 0;

    // Quality slider update
    qualityInput.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
    });

    // Scan Directory
    scanBtn.addEventListener('click', async () => {
        const path = folderInput.value.trim();
        const inputType = inputTypeSelect.value;

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
                body: JSON.stringify({ folderPath: path, inputType })
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            totalFiles = data.count;
            fileCountSpan.textContent = totalFiles;
            scanStats.style.display = 'block';

            if (totalFiles > 0) {
                convertBtn.disabled = false;
                progressStatus.textContent = `${totalFiles} arquivos encontrados (${inputType === 'all' ? 'HEIC/CR2' : inputType.toUpperCase()}) prontos para conversão.`;
            } else {
                convertBtn.disabled = true;
                progressStatus.textContent = 'Nenhum arquivo encontrado para o tipo selecionado.';
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
        const format = outputFormatSelect.value;
        const inputType = inputTypeSelect.value;
        const quality = qualityInput.value;

        if (!path) return;

        // Reset State
        convertBtn.disabled = true;
        convertBtn.classList.add('btn--loading');
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
            quality: quality,
            inputType: inputType
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
        item.className = `log-item log-item--${status}`;
        item.id = `log-${filename.replace(/\W/g, '_')}`; // Safe ID

        item.innerHTML = `
            <div class="log-item__icon"></div>
            <span class="log-item__filename">${filename}</span>
            <span class="log-item__status">${statusText}</span>
        `;

        progressLogs.prepend(item); // Add to top
    }

    function updateLogItem(filename, status, statusText) {
        const safeId = `log-${filename.replace(/\W/g, '_')}`;
        const item = document.getElementById(safeId);
        if (item) {
            item.className = `log-item log-item--${status}`;
            item.querySelector('.log-item__status').textContent = statusText;
        }
    }

    function finishConversion(result) {
        convertBtn.disabled = false;
        convertBtn.classList.remove('btn--loading');

        if (result) {
            progressStatus.textContent = `Concluído! ${result.converted} arquivos salvos em ${result.outputDir}`;
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            alert(`Conversão Concluída! Sucesso: ${result.converted}`);
        } else {
            // Already handled by partial updates or error
        }
    }
    // --- Navigation Logic ---
    const navItems = document.querySelectorAll('.sidebar__nav-item');
    const toolViews = document.querySelectorAll('.tool-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');

            // Toggle active nav
            navItems.forEach(i => i.classList.remove('sidebar__nav-item--active'));
            item.classList.add('sidebar__nav-item--active');

            // Toggle active view
            toolViews.forEach(v => v.classList.remove('tool-view--active'));
            document.getElementById(targetView).classList.add('tool-view--active');
        });
    });

    // --- Redação Module Logic ---
    const redacaoText = document.getElementById('redacaoText');
    const wordCountSpan = document.getElementById('wordCount');
    const charCountSpan = document.getElementById('charCount');
    const slugOutput = document.getElementById('slugOutput');
    const copySlugBtn = document.getElementById('copySlug');

    if (redacaoText) {
        redacaoText.addEventListener('input', () => {
            const text = redacaoText.value.trim();

            // Stats
            const words = text ? text.split(/\s+/).length : 0;
            const chars = text.length;

            wordCountSpan.textContent = words;
            charCountSpan.textContent = chars;

            // Simple Slug generator
            const slug = text.slice(0, 100)
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s-]/g, "")
                .trim()
                .replace(/\s+/g, '-');

            slugOutput.value = slug;
        });
    }

    if (copySlugBtn) {
        copySlugBtn.addEventListener('click', () => {
            slugOutput.select();
            document.execCommand('copy');
            copySlugBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copySlugBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        });
    }
});
