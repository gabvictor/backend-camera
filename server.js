const express = require('express');
const request = require('request');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy da câmera
app.get('/proxy/camera', (req, res) => {
    const code = req.query.code;
    const url = `https://cameras.riobranco.ac.gov.br/api/camera?code=${code}`;
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    request(url).pipe(res);
});

function codigoJaExiste(codigo, callback) {
    fs.readFile('codigos-validos.txt', 'utf8', (err, data) => {
        if (err) return callback(false);
        const codigos = data.split('\n').filter(Boolean);
        callback(codigos.includes(`Código: ${codigo}`));
    });
}

function lerUltimoCodigo(callback) {
    fs.readFile('ultimo-codigo.txt', 'utf8', (err, data) => {
        if (err) return callback(1000);
        callback(Number(data.trim()) || 1000);
    });
}

app.post('/save-code', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).send('Código não enviado.');

    codigoJaExiste(code, (existe) => {
        if (existe) {
            return res.status(200).send('Código já existe no arquivo.');
        }

        fs.appendFile('codigos-validos.txt', `Código: ${code}\n`, (err) => {
            if (err) return res.status(500).send('Erro ao salvar o código.');

            fs.writeFile('ultimo-codigo.txt', code, (err) => {
                if (err) console.error('Erro ao salvar último código:', err);
            });

            res.send('Código salvo com sucesso.');
        });
    });
});

app.get('/codigos', (req, res) => {
    fs.readFile('codigos-validos.txt', 'utf8', (err, data) => {
        if (err) return res.status(500).send('Erro ao ler o arquivo de códigos.');
        const codigos = data.split('\n').filter(Boolean).map(line => line.replace('Código: ', '').trim());
        res.send({ codigos });
    });
});

app.get('/ultimo-codigo', (req, res) => {
    lerUltimoCodigo((codigo) => {
        res.send({ ultimoCodigo: codigo });
    });
});

function verificarStatusCamera(code, callback) {
  const url = `https://cameras.riobranco.ac.gov.br/api/camera?code=${code}`;
  const req = request({ url, encoding: null }, (err, response, body) => {
    if (err) {
      console.error(`Erro na câmera ${code}:`, err.message);
      return callback('offline');
    }
    const tamanhoImagem = Buffer.byteLength(body);
    if (tamanhoImagem < 28 * 1024) callback('offline');
    else callback('online');
  });

  req.on('error', (error) => {
    console.error(`Request error na câmera ${code}:`, error.message);
    callback('offline');
  });
}

function gerarCodigosIntervalo(inicio, fim) {
  const codigos = [];
  for (let i = inicio; i <= fim; i++) {
    codigos.push(i.toString().padStart(6, '0'));
  }
  return codigos;
}

// Varredura com delay entre requisições para evitar erros por muitas conexões simultâneas
async function varrerStatusCamerasComDelay() {
  const codigos = gerarCodigosIntervalo(1000, 1500);
  const statusCameras = [];

  for (const codigo of codigos) {
    await new Promise(resolve => {
      verificarStatusCamera(codigo, (status) => {
        statusCameras.push({ codigo, status });
        resolve();
      });
    });
    await new Promise(r => setTimeout(r, 100)); // espera 100ms entre cada requisição
  }

  fs.writeFile('camera_status.json', JSON.stringify(statusCameras, null, 2), (err) => {
    if (err) console.error('Erro ao salvar status:', err);
    else console.log('Varredura completa e status atualizado.');
  });
}

// Rodar a varredura a cada 1 minuto
setInterval(varrerStatusCamerasComDelay, 60000);
// Executar a varredura assim que o servidor iniciar
varrerStatusCamerasComDelay();

app.get('/status-cameras', (req, res) => {
  fs.readFile('camera_status.json', 'utf8', (err, data) => {
    if (err) {
      return res.json([]); // Retorna array vazio se arquivo não existe ou erro
    }
    try {
      const status = JSON.parse(data);
      res.json(status);
    } catch {
      res.json([]);
    }
  });
});


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
