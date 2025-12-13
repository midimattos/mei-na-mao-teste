// Constantes e Limite do MEI
const LIMITE_MEI_ANUAL = 81000.00;

// URL: SUBSTITUA ESTE VALOR PELA SUA URL REAL DE PUBLICAÇÃO DO APPS SCRIPT
const FIREBASE_VALIDATION_URL = 'https://script.google.com/macros/s/AKfycbwdX-kNzh58oF2Vz0H0FW6rx_eSofYV4016Yq2mUXB1dl1dn3xI1Afl4xTsSxD9oO9Xgw/exec'; 

// Cores fixas para categorias de despesas (para o gráfico)
const CORES_DESPESAS = {
    'Material': '#FF5733',
    'Aluguel': '#33FF57',
    'Marketing': '#3357FF',
    'Impostos': '#FF33A1',
    'Outras_Despesas': '#FFC300'
};

// Elementos DOM
const modalRegistro = document.getElementById('modal-registro');
const formTransacao = document.getElementById('form-transacao');
const modalTitulo = document.getElementById('modal-titulo');
const tipoTransacaoInput = document.getElementById('tipo-transacao');
const categoriaSelect = document.getElementById('categoria');

const modalExtrato = document.getElementById('modal-extrato');
const extratoBody = document.getElementById('extrato-body');
const filtroMes = document.getElementById('filtro-mes');
const filtroCategoria = document.getElementById('filtro-categoria');
const btnVerExtrato = document.getElementById('btn-ver-extrato');

// Elementos de Identificação
const formIdentificacao = document.getElementById('form-identificacao');
const codinomeInput = document.getElementById('codinome');
const identificacaoAtualP = document.getElementById('identificacao-atual');

// Elementos de Licença
const modalLicenca = document.getElementById('modal-licenca');
const formLicenca = document.getElementById('form-licenca');
const chaveLicencaInput = document.getElementById('chave-licenca');
const msgLicencaP = document.getElementById('msg-licenca');


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

    // Se nunca foi validada OU já expirou
    if (!validade || validade <= hoje) {
        // Se o usuário está online, exige revalidação imediata
        if (isOnline) {
            bloquearApp(true, "Licença expirada. Por favor, insira sua chave e revalide (necessita de internet).");
            return false;
        } 
        // Se está offline e expirou (não pode validar, mas precisa saber)
        else if (validade && validade <= hoje) {
            bloquearApp(false, "Conecte-se à internet para revalidar e liberar todas as funcionalidades.");
            return false; // Não permite uso total
        }
    }
    
    // Se a licença está válida
    bloquearApp(false);
    return true; 
}

function bloquearApp(mostrarModal, mensagem = "") {
    // Apenas mostra/esconde o modal de licença
    modalLicenca.style.display = mostrarModal ? 'flex' : 'none';
    
    // Mostra mensagem de erro, se houver
    msgLicencaP.textContent = mensagem;

    // Bloqueia as ações do FOOTER e Extrato se o modal estiver visível
    const isLocked = mostrarModal || (carregarValidadeLicenca() <= new Date() && !navigator.onLine);

    document.getElementById('btn-receita').disabled = isLocked;
    document.getElementById('btn-despesa').disabled = isLocked;
    document.getElementById('btn-ver-extrato').disabled = isLocked;
    
    // Ajuste de visibilidade do modal
    if (mostrarModal) {
        // Se o modal de licença aparecer, todos os outros desaparecem
        document.getElementById('modal-registro').style.display = 'none';
        document.getElementById('modal-extrato').style.display = 'none';
    }
}

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
        
        // --- CHAMADA AO APPS SCRIPT ---
        const response = await fetch(FIREBASE_VALIDATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: chave })
        });

        // O Apps Script não retorna status HTTP 400/500, então verificamos o JSON
        const result = await response.json();
        
        if (result.status === 'success' && result.validUntil) {
            const dataValidade = new Date(result.validUntil);
            
            salvarValidadeLicenca(dataValidade);
            alert(`Licença validada com sucesso até ${dataValidade.toLocaleDateString('pt-BR')}.`);
            
            // Desbloqueia e recarrega a dashboard
            bloquearApp(false);
            
            // Recarrega o app para rodar a lógica de inicialização completa
            location.reload(); 
            
        } else if (result.status === 'blocked') {
            msgLicencaP.textContent = 'Esta licença foi bloqueada por exceder o limite de uso.';
        } else if (result.status === 'invalid') {
            msgLicencaP.textContent = 'Chave de licença inválida. Verifique o código.';
        } else {
            msgLicencaP.textContent = 'Erro de comunicação ou chave inválida. Tente novamente.';
        }

    } catch (error) {
        console.error('Erro na comunicação com a API de licença:', error);
        msgLicencaP.textContent = 'Erro de comunicação. Tente novamente mais tarde.';
    } finally {
        document.getElementById('btn-validar-licenca').textContent = "Validar e Desbloquear";
    }
}


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

// Inicialização (CORRIGIDA: Roda a checagem primeiro)
document.addEventListener('DOMContentLoaded', () => {
    // A primeira coisa a rodar é a checagem de licença
    const licencaValida = checarLicenca(); 
    
    // O restante do código SÓ deve rodar se a licença for válida
    if (licencaValida) {
        const codinomeInicial = carregarIdentificacao();
        exibirIdentificacao(codinomeInicial);
        atualizarDashboard();
    }
});