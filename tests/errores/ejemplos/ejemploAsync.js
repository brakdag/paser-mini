// ejemploAsync.js
// Demo for debugging HTTP requests with native https and a processing function

const https = require('https');

function procesarDatos(response) {
  const title = response.title;
  const body = response.body;
  const userId = response.userId;

  console.log("Datos recibidos:", { userId, title });

  const wordCount = body.split(' ').length;
  const processed = {
    original: title,
    uppercased: title.toUpperCase(),
    wordCount,
    fetchedAt: new Date().toISOString()
  };

  console.log("Procesado:", processed);
}

function main() {
  console.log("Iniciando petición HTTP...");

  https.get('https://jsonplaceholder.typicode.com/posts/1', (res) => {
    let rawData = '';

    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
      const response = JSON.parse(rawData);
      procesarDatos(response);
    });
  }).on('error', console.error);
}

main();
