const cameraSelect = document.getElementById('camera');
const cameraFeed = document.getElementById('camera-feed');
const toggleTheme = document.getElementById('toggle-theme');
const popupContainer = document.getElementById('popup-container');

let statusAnterior = {}; // Salva status anterior das câmeras

// Começa no modo escuro
document.body.classList.add('dark');

// Alterna tema claro/escuro
toggleTheme.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

// Atualiza o feed da câmera
function atualizarCamera() {
  const codigo = cameraSelect.value;
  if (codigo) {
    const timestamp = Date.now();
    cameraFeed.src = `/proxy/camera?code=${codigo}&nocache=${timestamp}`;
  }
}

// Carrega câmeras online e faz popups de mudança
async function carregarCamerasOnline() {
  try {
    const res = await fetch('/status-cameras');
    const cameras = await res.json();

    const camerasOnline = cameras.filter(cam => cam.status === 'online');

    // Verifica mudanças e gera popups
    cameras.forEach(cam => {
      const anterior = statusAnterior[cam.codigo];
      if (anterior && anterior !== cam.status) {
        if (cam.status === 'online') {
          showPopup(`🟢 Câmera ${cam.codigo} voltou online!`, 'online');
        } else {
          showPopup(`🔴 Câmera ${cam.codigo} ficou offline!`, 'offline');
        }
      }
      statusAnterior[cam.codigo] = cam.status;
    });

    if (camerasOnline.length === 0) {
      cameraSelect.innerHTML = '<option disabled>Nenhuma câmera online</option>';
      cameraFeed.src = '';
      return;
    }

    const selected = cameraSelect.value;

    cameraSelect.innerHTML = camerasOnline
      .map(cam => `<option value="${cam.codigo}">Câmera ${cam.codigo}</option>`)
      .join('');

    if (camerasOnline.find(c => c.codigo === selected)) {
      cameraSelect.value = selected;
    }

    atualizarCamera();
  } catch (err) {
    console.error('Erro ao carregar câmeras:', err);
    cameraSelect.innerHTML = '<option disabled>Erro ao carregar</option>';
    cameraFeed.src = '';
  }
}

// Evento ao trocar câmera
cameraSelect.addEventListener('change', atualizarCamera);

// Atualiza o feed da câmera a cada 1 segundo
setInterval(atualizarCamera, 500);

// Atualiza status das câmeras a cada 1 minuto
setInterval(carregarCamerasOnline, 60000);

// Executa na abertura
carregarCamerasOnline();


// ---------------- POPUP ----------------
function showPopup(message, status) {
  const popup = document.createElement('div');
  popup.classList.add('popup', status);
  popup.innerText = message;

  popupContainer.appendChild(popup);

  setTimeout(() => {
    popup.classList.add('show');
  }, 100); // animação de entrada

  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 300);
  }, 5000); // popup some após 5 segundos
}

async function atualizarContagemOnline() {
  try {
    const res = await fetch('/status-cameras');
    const cameras = await res.json();

    const online = cameras.filter(c => c.status === 'online').length;
    const contador = document.getElementById('contador-online');
    contador.textContent = `Online: ${online}`;
  } catch (e) {
    console.error('Erro ao obter status das câmeras:', e);
  }
}

// Atualiza ao carregar a página
atualizarContagemOnline();

// E atualiza a cada 60 segundos
setInterval(atualizarContagemOnline, 60000);
