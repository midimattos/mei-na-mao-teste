// ==============================================================================
// 🟢 FIREBASE: CONFIGURAÇÃO E INICIALIZAÇÃO (MÓDULO V9+) 🟢
// ==============================================================================

// Importa as funções necessárias do Firebase SDK (versão modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { get, getDatabase, ref } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCoj9Qd7OjBEhxn342sF5Z28l7sV25N86M",
    authDomain: "mei-na-mao-validacao.firebaseapp.com",
    projectId: "mei-na-mao-validacao",
    storageBucket: "mei-na-mao-validacao.firebasestorage.app",
    messagingSenderId: "1043162363380",
    appId: "1:1043162363380:web:549638b8c852457bf7f5a1",
    measurementId: "G-41D3MY2EK7",
    databaseURL: "https://mei-na-mao-validacao-default-rtdb.firebaseio.com" 
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app); 
// ==============================================================================


// Constantes e Limite do MEI
const LIMITE_MEI_ANUAL = 81000.00;

// Cores fixas para categorias de despesas (para o gráfico)
const CORES_DESPESAS = {
    'Material': '#FF5733',
    'Aluguel': '#33FF57',
    'Marketing': '#3357FF',
    'Impostos': '#FF33A1',
    'Outras_Despesas': '#FFC300'
};

// 🔴 CORREÇÃO DE ESCOPO: Declarar variáveis DOM com 'let' no topo do módulo
let modalRegistro, formTransacao, modalTitulo, tipoTransacaoInput, categoriaSelect;
let modalExtrato, extratoBody, filtroMes, filtroCategoria, btnVerExtrato;
let formIdentificacao, codinomeInput, identificacaoAtualP; 
let modalLicenca, formLicenca, chaveLicencaInput, msgLicencaP;


// --- 1. Persistência de Dados (LocalStorage) ---

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
    // 🟢 Correção: As variáveis DOM agora são inicializadas no DOMContentLoaded
    if (codinome) {
        identificacaoAtualP.textContent = `Identificação atual: ${codinome}`;
        codinomeInput.value = codinome; 
    } else {
        identificacaoAtualP.textContent = 'Nenhuma identificação definida.';
    }
}


// --- 3. Lógica de Validação e Bloqueio ---

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


// --- 🟢 LÓGICA DE VALIDAÇÃO FIREBASE RTDB 🟢 ---

// ... (resto do código)

// --- 🟢 LÓGICA DE VALIDAÇÃO FIREBASE RTDB 🟢 ---

async function validarLicenca(event) {
    event.preventDefault();
    const chave = chaveLicencaInput.value.trim();
    msgLicencaP.textContent = '';
    
    if (!chave) return;

    if (!navigator.onLine) {
        msgLicencaP.textContent = "Erro: Conecte-se à internet para validar a chave.";
        return;
    }
    
    // 🛑 NOVO: Obter ID do usuário (codinome)
    const userId = carregarIdentificacao();
    if (!userId) {
        msgLicencaP.textContent = 'Erro: Defina uma identificação (codinome) primeiro (na seção "Sua Identificação").';
        return;
    }

    try {
        document.getElementById('btn-validar-licenca').textContent = "Validando...";
        
        const safeKey = chave.replace(/[\.#$\/\[\]]/g, '_'); 
        const licenseRef = ref(database, 'licenses/' + safeKey);
        
        const snapshot = await get(licenseRef); 
        const licenseData = snapshot.val(); 

        if (!licenseData) {
            msgLicencaP.textContent = 'Chave de licença inválida. Verifique o código.';
        } else if (licenseData.status === 'revoked') {
            msgLicencaP.textContent = 'Esta licença foi bloqueada.';
        } else if (licenseData.consumedBy && licenseData.consumedBy !== userId) { 
            // 🛑 NOVO: Chave já usada por outro usuário
            msgLicencaP.textContent = `Chave já utilizada por outro usuário: ${licenseData.consumedBy}.`;
        } else {
            // Licença é válida E não está consumida (ou está consumida por este mesmo usuário)
            const validadeRemota = new Date(licenseData.validUntil);
            const hoje = new Date();
            
            let newValidUntil;

            // 3. Checagem de Validade
            if (validadeRemota <= hoje) {
                 // Licença expirada - concede 30 dias temporários
                 newValidUntil = new Date();
                 newValidUntil.setDate(newValidUntil.getDate() + 30);
                 
                 alert(`Licença expirada, mas validada online por 30 dias até ${newValidUntil.toLocaleDateString('pt-BR')}.`);

            } else {
                // Licença válida
                newValidUntil = validadeRemota;
                alert(`Licença validada com sucesso até ${newValidUntil.toLocaleDateString('pt-BR')}.`);
            }
            
            salvarValidadeLicenca(newValidUntil); 

            // 🛑 NOVO: Grava o consumo no Firebase (vinculando a chave ao codinome)
            await update(licenseRef, {
                consumedBy: userId,
                consumedDate: new Date().toISOString()
            });
            
            // Desbloqueia e recarrega a dashboard
            bloquearApp(false);
            location.reload(); 
        }
        
    } catch (error) {
        console.error('Erro na comunicação com o Firebase:', error);
        msgLicencaP.textContent = 'Erro de comunicação. Verifique sua conexão com a internet.'; 
    } finally {
        document.getElementById('btn-validar-licenca').textContent = "Validar e Desbloquear";
    }
}
// -------------------------------------------------------------------------
// -------------------------------------------------------------------------


// --- 4. Funções de Formato e Dashboard ---

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderizarGraficoDespesas(transacoesMes) {
    const despesasMes = transacoesMes.filter(t => t.tipo === 'despesa');
    let totalDespesas = despesasMes.reduce((soma, t) => soma + t.valor, 0);

    const despesasPorCategoria = despesasMes.reduce((acc, t) => {
        if (!acc[t.categoria]) {
            acc[t.categoria] = 0;
        }
        acc[t.categoria] += t.valor;
        return acc;
    }, {});

    const containerGrafico = document.getElementById('grafico-pizza-container');
    const legendaUl = document.getElementById('legenda-despesas');
    let conicGradient = '';
    let startAngle = 0;
    
    containerGrafico.style.background = 'conic-gradient(#eee 0% 100%)';
    legendaUl.innerHTML = '';
    
    if (totalDespesas === 0) {
        legendaUl.innerHTML = '<li class="legenda-item">Sem despesas registradas neste mês.</li>';
        return;
    }

    for (const categoria in despesasPorCategoria) {
        const valor = despesasPorCategoria[categoria];
        const percentual = (valor / totalDespesas) * 100;
        const cor = CORES_DESPESAS[categoria] || '#900C3F'; 
        const endAngle = startAngle + percentual;

        conicGradient += `${cor} ${startAngle}% ${endAngle}%, `;
        
        const li = document.createElement('li');
        li.className = 'legenda-item';
        const categoriaNome = categoria.replace('_', ' '); 
        li.innerHTML = `
            <span style="display: flex; align-items: center;">
                <span class="legenda-cor" style="background-color: ${cor};"></span>
                ${categoriaNome}
            </span>
            <span>${formatarMoeda(valor)} (${percentual.toFixed(1)}%)</span>
        `;
        legendaUl.appendChild(li);

        startAngle = endAngle;
    }

    conicGradient = conicGradient.slice(0, -2);
    containerGrafico.style.background = `conic-gradient(${conicGradient})`;
}

function atualizarDashboard() {
    // 🔴 CORREÇÃO FINAL GARANTIDA: Declaração de 'hoje' no topo da função.
    const hoje = new Date(); 
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const transacoesMes = transacoes.filter(t => 
        t.data.getMonth() === mesAtual && t.data.getFullYear() === anoAtual
    );
    const transacoesAno = transacoes.filter(t => 
        t.data.getFullYear() === anoAtual
    );

    let receitaMes = 0;
    let despesaMes = 0;

    transacoesMes.forEach(t => {
        if (t.tipo === 'receita') {
            receitaMes += t.valor;
        } else {
            despesaMes += t.valor;
        }
    });

    const lucroMes = receitaMes - despesaMes;

    let faturamentoAnual = 0;
    transacoesAno.forEach(t => {
        if (t.tipo === 'receita') {
            faturamentoAnual += t.valor;
        }
    });

    // Atualiza os KPIs
    document.getElementById('receita-mes').textContent = formatarMoeda(receitaMes);
    document.getElementById('despesa-mes').textContent = formatarMoeda(despesaMes);
    document.getElementById('lucro-mes').textContent = formatarMoeda(lucroMes);

    // Atualiza o Guardrail do MEI
    const porcentagemAnual = (faturamentoAnual / LIMITE_MEI_ANUAL) * 100;
    const porcentagemFormatada = Math.min(100, porcentagemAnual); 
    
    const progressElement = document.getElementById('faturamento-progresso');
    progressElement.style.width = `${porcentagemFormatada}%`;
    document.getElementById('faturamento-info').textContent = 
        `${formatarMoeda(faturamentoAnual)} / ${formatarMoeda(LIMITE_MEI_ANUAL)} (${porcentagemAnual.toFixed(1)}%)`;
        
    if (porcentagemAnual > 70 && porcentagemAnual <= 90) {
        progressElement.style.backgroundColor = '#FFC107'; // Amarelo
    } else if (porcentagemAnual > 90) {
        progressElement.style.backgroundColor = '#D32F2F'; // Vermelho
    } else {
        progressElement.style.backgroundColor = '#4CAF50'; // Verde
    }

    // Atualiza o mês no header 
    const nomeMes = hoje.toLocaleString('pt-BR', { month: 'long' });
    document.getElementById('mes-atual').textContent = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${anoAtual}`;

    renderizarGraficoDespesas(transacoesMes);
}


// --- 5. Lógica do Formulário (Modal) ---

function abrirFormulario(tipo) {
    formTransacao.reset();
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data').value = hoje;

    tipoTransacaoInput.value = tipo;
    const isReceita = tipo === 'receita';
    
    modalTitulo.textContent = isReceita ? 'Registrar Nova RECEITA' : 'Registrar Nova DESPESA';
    modalTitulo.className = isReceita ? 'modal-receita' : 'modal-despesa';
    
    const categoriasReceita = document.querySelectorAll('.receita-opt');
    const categoriasDespesa = document.querySelectorAll('.despesa-opt');

    categoriasReceita.forEach(opt => opt.style.display = isReceita ? 'block' : 'none');
    categoriasDespesa.forEach(opt => opt.style.display = isReceita ? 'none' : 'block');

    modalRegistro.style.display = 'flex';
}

function fecharFormulario() {
    modalRegistro.style.display = 'none';
}

function salvarTransacao(event) {
    event.preventDefault(); 

    const tipo = tipoTransacaoInput.value;
    const valor = parseFloat(document.getElementById('valor').value); 
    const descricao = document.getElementById('descricao').value;
    const data = new Date(document.getElementById('data').value + 'T00:00:00'); 
    const categoria = categoriaSelect.value;
    
    if (!tipo || isNaN(valor) || valor <= 0 || !descricao || !data || !categoria) {
        alert('Por favor, preencha todos os campos corretamente e com um valor positivo.');
        return;
    }

    const novaTransacao = {
        tipo,
        valor,
        descricao,
        data,
        categoria,
        id: Date.now() 
    };

    transacoes.push(novaTransacao);
    
    salvarTransacoes(); 
    atualizarDashboard(); 
    fecharFormulario(); 
}


// --- 6. Lógica do Extrato Detalhado e Exportação ---

function abrirExtrato() {
    popularFiltros();
    filtrarEExibirExtrato();
    modalExtrato.style.display = 'flex';
}

function fecharExtrato() {
    modalExtrato.style.display = 'none';
}

function popularFiltros() {
    // Categorias
    const todasAsCategorias = transacoes.map(t => t.categoria)
                                         .filter((value, index, self) => self.indexOf(value) === index);
    
    filtroCategoria.innerHTML = '<option value="">Todas as Categorias</option>';
    todasAsCategorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.replace('_', ' ');
        filtroCategoria.appendChild(option);
    });

    // Meses
    const mesesExistentes = transacoes.map(t => `${t.data.getFullYear()}-${t.data.getMonth()}`)
                                     .filter((value, index, self) => self.indexOf(value) === index)
                                     .sort((a, b) => new Date(b) - new Date(a)); 

    filtroMes.innerHTML = '<option value="">Todos os Meses</option>';
    mesesExistentes.forEach(mesAno => {
        const [ano, mes] = mesAno.split('-');
        const dataReferencia = new Date(ano, mes, 1);
        const nomeMes = dataReferencia.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = mesAno;
        option.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        filtroMes.appendChild(option);
    });
}

function filtrarEExibirExtrato() {
    const mesFiltro = filtroMes.value;
    const categoriaFiltro = filtroCategoria.value;

    let transacoesFiltradas = transacoes.sort((a, b) => b.data - a.data); 

    // Aplica filtros
    if (mesFiltro) {
        const [ano, mes] = mesFiltro.split('-');
        transacoesFiltradas = transacoesFiltradas.filter(t => 
            t.data.getFullYear() == ano && t.data.getMonth() == mes
        );
    }

    if (categoriaFiltro) {
        transacoesFiltradas = transacoesFiltradas.filter(t => t.categoria === categoriaFiltro);
    }
    
    // Renderiza a Tabela
    extratoBody.innerHTML = '';
    
    if (transacoesFiltradas.length === 0) {
        extratoBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma transação encontrada.</td></tr>';
        return;
    }

    transacoesFiltradas.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = t.tipo === 'receita' ? 'receita-linha' : 'despesa-linha';
        
        tr.innerHTML = `
            <td>${t.data.toLocaleDateString('pt-BR')}</td>
            <td>${t.descricao}</td>
            <td>${t.categoria.replace('_', ' ')}</td>
            <td>${t.tipo === 'receita' ? '+' : '-'} ${formatarMoeda(t.valor)}</td>
            <td>
                <button class="btn-deletar" data-id="${t.id}" title="Excluir">🗑️</button>
            </td>
        `;
        extratoBody.appendChild(tr);
    });
}

function deletarTransacao(id) {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        transacoes = transacoes.filter(t => t.id !== Number(id)); 
        salvarTransacoes();
        atualizarDashboard(); 
        filtrarEExibirExtrato(); 
    }
}

function exportarCSV() {
    // Cabeçalho CSV com separador ponto e vírgula
    let csv = "Tipo;Data;Valor;Categoria;Descricao\n";

    transacoes.forEach(t => {
        // Usa vírgula como separador decimal para o formato brasileiro
        const valorFormatado = t.valor.toFixed(2).replace('.', ','); 
        const linha = [
            t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1),
            t.data.toLocaleDateString('pt-BR'),
            valorFormatado,
            t.categoria.replace('_', ' '),
            // Envolve a descrição em aspas duplas para lidar com vírgulas internas
            `"${t.descricao.replace(/"/g, '""')}"` 
        ].join(';');

        csv += linha + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'backup_mei_na_mao.csv'); // Renomeado para Backup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- 7. Event Listeners e Inicialização ---

document.addEventListener('DOMContentLoaded', () => {
    
    // 🔴 1. INICIALIZAÇÃO TARDIA DOS ELEMENTOS DOM DENTRO DO ESCOPO DOMContentLoaded
    // Isso resolve o ReferenceError causado pelo type="module"
    modalRegistro = document.getElementById('modal-registro');
    formTransacao = document.getElementById('form-transacao');
    modalTitulo = document.getElementById('modal-titulo');
    tipoTransacaoInput = document.getElementById('tipo-transacao');
    categoriaSelect = document.getElementById('categoria');

    modalExtrato = document.getElementById('modal-extrato');
    extratoBody = document.getElementById('extrato-body');
    filtroMes = document.getElementById('filtro-mes');
    filtroCategoria = document.getElementById('filtro-categoria');
    btnVerExtrato = document.getElementById('btn-ver-extrato');

    formIdentificacao = document.getElementById('form-identificacao');
    codinomeInput = document.getElementById('codinome');
    identificacaoAtualP = document.getElementById('identificacao-atual'); // Variável crítica

    modalLicenca = document.getElementById('modal-licenca');
    formLicenca = document.getElementById('form-licenca');
    chaveLicencaInput = document.getElementById('chave-licenca');
    msgLicencaP = document.getElementById('msg-licenca');

    // 2. LÓGICA DE INICIALIZAÇÃO
    const licencaValida = checarLicenca(); 
    
    if (licencaValida) {
        const codinomeInicial = carregarIdentificacao();
        exibirIdentificacao(codinomeInicial);
        atualizarDashboard();
    }
    
    // 3. EVENT LISTENERS (AGORA QUE O DOM E AS VARIÁVEIS ESTÃO PRONTAS)
    
    // Ações do Formulário
    document.getElementById('btn-receita').addEventListener('click', () => abrirFormulario('receita'));
    document.getElementById('btn-despesa').addEventListener('click', () => abrirFormulario('despesa'));
    document.getElementById('btn-cancelar').addEventListener('click', fecharFormulario);
    formTransacao.addEventListener('submit', salvarTransacao);

    // Ações do Extrato
    btnVerExtrato.addEventListener('click', abrirExtrato);
    document.getElementById('btn-fechar-extrato').addEventListener('click', fecharExtrato);
    filtroMes.addEventListener('change', filtrarEExibirExtrato);
    filtroCategoria.addEventListener('change', filtrarEExibirExtrato);
    document.getElementById('btn-exportar').addEventListener('click', exportarCSV);

    // Deletar transação
    extratoBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-deletar')) {
            deletarTransacao(e.target.dataset.id);
        }
    });

    // Ações de Identificação
    formIdentificacao.addEventListener('submit', salvarIdentificacao);

    // Ações de Licença
    formLicenca.addEventListener('submit', validarLicenca);

});