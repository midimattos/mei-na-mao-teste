// api/validate.js (Servidor Vercel - Proxy)
import fetch from 'node-fetch';

// ATENÇÃO: SUBSTITUA PELA URL COMPLETA E FUNCIONAL DO APPS SCRIPT
// Use a URL que retornou status: success no seu teste.
const APPS_SCRIPT_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSkLiXo6QDyTK9RSDN4FaK1j-o2jcLSKsgIvS0FwrCvUkBzBPSJQtX5CXEOioolNEEojFYKk1PVw2Vw08XmgoQdX_ZuIoCNA68nuLV_cKASBi7m7dJgR6iZlwTmW9ybRj5C3LkQ5DHVVSDsixYowCjY2ICaH0s7Vhwrf51KQYSlHJFakRrPkCS3A8p4qTEqqK7L7IY0YjGJCZ7gqRpH1neu99BBLKdVGb2v0n26PhWYQnsx3Cospu2BioLSX3t1m8ADSJEfDEISY2VRR0QGAQymSMXGDAJL7RKU_K_XKUH5FBoLaETn0Hq9-jc7ZDMX5rZ7V6QiyvaBlib=MkrCYWNN_TXBky8rueTMwqSsnofwKPirTS'; 

export default async function handler(request, response) {
  // A Vercel/Netlify precisa usar o body parser para ler o JSON
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const { licenseKey } = JSON.parse(request.body);
    
    // Chamada real para o Apps Script
    const proxyResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey })
    });

    const result = await proxyResponse.json();
    
    // O Vercel retorna a resposta do Google Sheets para o seu PWA sem problemas de CORS
    return response.status(200).json(result);

  } catch (error) {
    console.error('Proxy Error:', error);
    return response.status(500).json({ status: 'error', message: 'Erro no servidor proxy.' });
  }
}