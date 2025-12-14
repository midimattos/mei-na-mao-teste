// ==============================================================================
// 🟢 FIREBASE: CONFIGURAÇÃO E INICIALIZAÇÃO (Substituindo as tags script e CDN) 🟢
// ==============================================================================

// Importa as funções necessárias do Firebase SDK (versão modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, once, ref } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
// Nota: Usamos a v9.6.1 (compatível) para garantir que funcione em mais browsers.
// Se você está usando a v12.6.0, as URLs de importação devem ser ajustadas
// para a v12.6.0 (ex: '.../firebasejs/12.6.0/firebase-database.js').

// Suas credenciais do Firebase (migradas do seu script de importação)
const firebaseConfig = {
    apiKey: "AIzaSyCoj9Qd7OjBEhxn342sF5Z28l7sV25N86M",
    authDomain: "mei-na-mao-validacao.firebaseapp.com",
    projectId: "mei-na-mao-validacao",
    storageBucket: "mei-na-mao-validacao.firebasestorage.app",
    messagingSenderId: "1043162363380",
    appId: "1:1043162363380:web:549638b8c852457bf7f5a1",
    measurementId: "G-41D3MY2EK7",
    // Adicionamos a databaseURL para simplificar o uso do RTDB
    databaseURL: "https://mei-na-mao-validacao-default-rtdb.firebaseio.com" 
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app); 
// ==============================================================================


// Constantes e Limite do MEI
const LIMITE_MEI_ANUAL = 81000.00;

// Elementos DOM (Mantidos, apenas para contexto)
// ... (restante das declarações de constantes e elementos DOM) ...

// Elementos de Licença
const modalLicenca = document.getElementById('modal-licenca');
const formLicenca = document.getElementById('form-licenca');
const chaveLicencaInput = document.getElementById('chave-licenca');
const msgLicencaP = document.getElementById('msg-licenca');


// --- 1. Persistência de Dados (LocalStorage) ---
// ... (funções carregarTransacoes, salvarTransacoes, etc.) ...
function carregarTransacoes() {
    const data = localStorage.getItem('transacoesMEI');
    return data ? JSON.parse(data).map(t => ({
        ...t,
        data: new Date(t.data) 
    })) : [];
}

function salvarTransacoes() {
    localStorage.setItem('transacoesMEI', JSON.stringify(transacoes));
}

let transacoes = carregarTransacoes();

// Data de Validade da Licença (Armazenamento Local)
function carregarValidadeLicenca() {
    const dataString = localStorage.getItem('licencaValidade');
    return dataString ? new Date(dataString) : null;
}

function salvarValidadeLicenca(data) {
    localStorage.setItem('licencaValidade', data.toISOString());
}


// --- 2. Lógica de Identificação ---
// ... (funções carregarIdentificacao, salvarIdentificacao, exibirIdentificacao) ...
function carregarIdentificacao() {
    return localStorage.getItem('codinomeMEI') || '';
}

function salvarIdentificacao(event) {
    event.preventDefault();
    const codinome = codinomeInput.value.trim();
    if (codinome) {
        localStorage.setItem('codinomeMEI', codinome);
        exibirIdentificacao(codinome);
        alert('Identificação salva!');
    } else {
        alert('O campo de identificação não pode estar vazio.');
    }
}

function exibirIdentificacao(codinome) {
    if (codinome) {
        identificacaoAtualP.textContent = `Identificação atual: ${codinome}`;
        codinomeInput.value = codinome; 
    } else {
        identificacaoAtualP.textContent = 'Nenhuma identificação definida.';
    }
}


// --- 3. Lógica de Validação e Bloqueio ---
// ... (funções checarLicenca, bloquearApp) ...
function checarLicenca() {
    const validade = carregarValidadeLicenca();
    const hoje = new Date();
    const isOnline = navigator.onLine;

    if (!validade || validade <= hoje) {
        if (isOnline) {
            bloquearApp(true, "Licença expirada. Por favor, insira sua chave e revalide (necessita de internet).");
            return false;
        } else if (validade && validade <= hoje) {
            bloquearApp(false, "Conecte-se à internet para revalidar e liberar todas as funcionalidades.");
            return false; 
        }
    }
    
    bloquearApp(false);
    return true; 
}

function bloquearApp(mostrarModal, mensagem = "") {
    modalLicenca.style.display = mostrarModal ? 'flex' : 'none';
    msgLicencaP.textContent = mensagem;

    const isLocked = mostrarModal || (carregarValidadeLicenca() <= new Date() && !navigator.onLine);

    document.getElementById('btn-receita').disabled = isLocked;
    document.getElementById('btn-despesa').disabled = isLocked;
    document.getElementById('btn-ver-extrato').disabled = isLocked;
    
    if (mostrarModal) {
        document.getElementById('modal-registro').style.display = 'none';
        document.getElementById('modal-extrato').style.display = 'none';
    }
}


// --- 🟢 LÓGICA DE VALIDAÇÃO FIREBASE RTDB (FINAL) 🟢 ---

async function validarLicenca(event) {
    event.preventDefault();
    const chave = chaveLicencaInput.value.trim();
    msgLicencaP.textContent = '';
    
    if (!chave) return;

    if (!navigator.onLine) {
        msgLicencaP.textContent = "Erro: Conecte-se à internet para validar a chave.";
        return;
    }

    try {
        document.getElementById('btn-validar-licenca').textContent = "Validando...";
        
        // Formata a chave para o caminho do Firebase (remove caracteres inválidos se houver)
        const safeKey = chave.replace(/[\.#$\/\[\]]/g, '_'); 
        
        // 1. Obtém a referência do nó no RTDB: /licenses/{chave}
        const licenseRef = ref(database, 'licenses/' + safeKey);
        
        // 2. Lê os dados da licença
        const snapshot = await once(licenseRef);
        const licenseData = snapshot.val(); 

        if (!licenseData) {
            msgLicencaP.textContent = 'Chave de licença inválida. Verifique o código.';
        } else if (licenseData.status === 'revoked') {
            msgLicencaP.textContent = 'Esta licença foi bloqueada.';
        } else {
            const validadeRemota = new Date(licenseData.validUntil);
            const hoje = new Date();
            
            // 3. Checagem de Validade
            if (validadeRemota <= hoje) {
                 // Licença expirada - renova por 30 dias (NOVA LÓGICA DE RENOVAÇÃO)
                 const newValidUntil = new Date();
                 newValidUntil.setDate(newValidUntil.getDate() + 30);
                 
                 // 4. Salva a nova validade no Firebase (Escrita no banco de dados)
                 // NOTE: Isto requer que as regras do RTDB permitam ESCRITA (write: true) para o PWA, 
                 // o que não é seguro. Para este exemplo, estamos apenas lendo:
                 
                 // Se você quiser que o PWA renove a data, as regras devem ser "write": true (NÃO RECOMENDADO!)
                 
                 // Para este exemplo, vamos *apenas conceder 30 dias temporários* no localStorage para uso offline:
                 salvarValidadeLicenca(newValidUntil);
                 
                 alert(`Licença expirada, mas validada online por 30 dias até ${newValidUntil.toLocaleDateString('pt-BR')}.`);

            } else {
                // Licença válida: Apenas salva a validade remota localmente para uso offline
                salvarValidadeLicenca(validadeRemota); 
                alert(`Licença validada com sucesso até ${validadeRemota.toLocaleDateString('pt-BR')}.`);
            }
            
            // Desbloqueia e recarrega a dashboard
            bloquearApp(false);
            location.reload(); 
        }
        
    } catch (error) {
        console.error('Erro na comunicação com o Firebase:', error);
        // O Firebase não sofre com CORS, então este catch indica um erro real de conexão
        msgLicencaP.textContent = 'Erro de comunicação. Verifique sua conexão com a internet.'; 
    } finally {
        document.getElementById('btn-validar-licenca').textContent = "Validar e Desbloquear";
    }
}
// -------------------------------------------------------------------------


// --- 4. Funções de Formato e Dashboard ---
// ... (restante das funções de formatação, renderização e lógica do app) ...

// --- 7. Event Listeners e Inicialização ---
// Ações do Formulário
// ...

// Ações de Licença
formLicenca.addEventListener('submit', validarLicenca);

// Inicialização (CORRIGIDA: Roda a checagem primeiro)
document.addEventListener('DOMContentLoaded', () => {
    const licencaValida = checarLicenca(); 
    
    if (licencaValida) {
        const codinomeInicial = carregarIdentificacao();
        exibirIdentificacao(codinomeInicial);
        atualizarDashboard();
    }
});