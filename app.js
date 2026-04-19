// --- DADOS BASE COM MIGRAÇÃO AUTOMÁTICA (Sem Perda de Dados) ---
let entradas, gastos, recorrentes, investimentos, dividas, cartoesTemp, cartoes, logs, perfil;
let meuGrafico = null;
let meuGraficoRosca = null;

function carregarDadosIniciais() {
    const getParse = key => JSON.parse(localStorage.getItem(key)) || [];
    
    // Função para atualizar as chaves de dados antigas para nomes semânticos
    const migrarArray = (chave, mapFn) => {
        let dados = getParse(chave);
        let precisaMigrar = dados.some(d => d.v !== undefined || d.y !== undefined || d.n !== undefined || d.p !== undefined);
        if (precisaMigrar) {
            let novosDados = dados.map(mapFn);
            localStorage.setItem(chave, JSON.stringify(novosDados));
            return novosDados;
        }
        return dados;
    };

    entradas = migrarArray('ent', d => ({ tipo: d.tipo, desc: d.desc, valor: d.v !== undefined ? d.v : d.valor, ano: d.y !== undefined ? d.y : d.ano, mes: d.m !== undefined ? d.m : d.mes, dia: d.dia }));
    
    gastos = migrarArray('gas', d => ({ 
        desc: d.desc, 
        valor: d.v !== undefined ? d.v : d.valor, 
        parcelas: d.p !== undefined ? d.p : d.parcelas, 
        cartao: d.c !== undefined ? d.c : d.cartao, 
        categoria: d.cat !== undefined ? d.cat : d.categoria, 
        dia: d.dia, 
        ano: d.y !== undefined ? d.y : d.ano, 
        mes: d.m !== undefined ? d.m : d.mes, 
        anoBase: d.yBase !== undefined ? d.yBase : (d.anoBase !== undefined ? d.anoBase : d.ano), 
        mesBase: d.mBase !== undefined ? d.mBase : (d.mesBase !== undefined ? d.mesBase : d.mes), 
        quitadas: d.quitadas || [] 
    }));

    recorrentes = migrarArray('rec', d => ({ desc: d.desc, valor: d.v !== undefined ? d.v : d.valor, parcelas: d.p !== undefined ? d.p : d.parcelas, ano: d.y !== undefined ? d.y : d.ano, mes: d.m !== undefined ? d.m : d.mes, dia: d.dia }));
    
    investimentos = migrarArray('inv', d => ({ desc: d.desc, categoria: d.cat !== undefined ? d.cat : d.categoria, valor: d.v !== undefined ? d.v : d.valor, ano: d.y !== undefined ? d.y : d.ano, mes: d.m !== undefined ? d.m : d.mes, dia: d.dia }));
    
    dividas = migrarArray('div', d => ({ tipo: d.tipo, pessoa: d.pessoa, desc: d.desc, valor: d.v !== undefined ? d.v : d.valor, parcelas: d.p !== undefined ? d.p : d.parcelas, ano: d.y !== undefined ? d.y : d.ano, mes: d.m !== undefined ? d.m : d.mes, dia: d.dia, status: d.status }));
    
    cartoesTemp = migrarArray('crt', c => {
        if (typeof c === 'string') return { nome: c, fechamento: 31, digitos: '' };
        return { nome: c.n !== undefined ? c.n : c.nome, fechamento: c.f !== undefined ? c.f : c.fechamento, digitos: c.d !== undefined ? c.d : (c.digitos || '') };
    });

    cartoes = cartoesTemp.map(c => {
        if (!c.digitos) c.digitos = ''; 
        return c;
    });
    localStorage.setItem('crt', JSON.stringify(cartoes));

    logs = getParse('log');
    perfil = JSON.parse(localStorage.getItem('perfil')) || { nome: '', tel: '' };
}
carregarDadosIniciais(); // Executa ao abrir o sistema

// --- FUNÇÃO DE SEGURANÇA CONTRA INJEÇÃO DE CÓDIGO (XSS) ---
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

// --- FORMATADOR E MOTOR DE MODAIS ---
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const Modal = {
    show: function(title, type, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('cytModal');
            const titleEl = document.getElementById('cytModalTitle');
            const inputEl = document.getElementById('cytModalInput');
            const btnCancel = document.getElementById('cytModalCancel');
            const btnConfirm = document.getElementById('cytModalConfirm');

            titleEl.innerHTML = title.replace(/\n/g, '<br>'); // Seguro, o título vem do próprio sistema
            
            if(type === 'prompt') {
                inputEl.style.display = 'block';
                inputEl.value = defaultValue;
                inputEl.focus();
                inputEl.onkeyup = (e) => { if(e.key === 'Enter') btnConfirm.click(); };
            } else {
                inputEl.style.display = 'none';
                inputEl.onkeyup = null;
            }

            if(type === 'alert') btnCancel.style.display = 'none';
            else btnCancel.style.display = 'inline-block';

            overlay.classList.remove('escondido');

            const cleanup = () => {
                overlay.classList.add('escondido');
                btnConfirm.onclick = null;
                btnCancel.onclick = null;
            };

            btnConfirm.onclick = () => {
                cleanup();
                if(type === 'prompt') resolve(inputEl.value);
                else resolve(true);
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(false);
            };
        });
    },
    alert: async (msg) => await Modal.show(msg, 'alert'),
    confirm: async (msg) => await Modal.show(msg, 'confirm'),
    prompt: async (msg, defaultVal) => {
        const res = await Modal.show(msg, 'prompt', defaultVal);
        return res === false ? null : res; 
    }
};

function init() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    const hoje = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(i => i.value = hoje);
    renderHeader();
    renderCartoesSelect();
    render();
}

function renderHeader() {
    let nameHeader = document.getElementById('headerName');
    if (nameHeader) {
        nameHeader.innerText = perfil.nome ? `CYT Finance | ${perfil.nome.split(' ')[0]}` : `CYT Finance`;
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    if (!document.getElementById('tabGrafico').classList.contains('escondido')) {
        if (typeof desenharGrafico === 'function') desenharGrafico();
    }
}

function abrir(id) {
    let el = document.getElementById(id);
    let isOpen = !el.classList.contains('escondido');
    document.querySelectorAll('.card').forEach(c => c.classList.add('escondido'));
    if (!isOpen) el.classList.remove('escondido');
}

function toggleTab(id) {
    let el = document.getElementById(id);
    let isOpen = !el.classList.contains('escondido');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('escondido'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (!isOpen) {
        el.classList.remove('escondido');
        let btnId = 'btn' + id.charAt(0).toUpperCase() + id.slice(1);
        let btnEl = document.getElementById(btnId);
        if(btnEl) btnEl.classList.add('active');
        if (id === 'tabGrafico' && typeof desenharGrafico === 'function') desenharGrafico();
    }
}

function normVal(v) {
    if (!v) return 0;
    let n = v.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(n) || 0;
}
function normData(d) {
    let parts = d.split('-'); let y = parseInt(parts[0]);
    if (y < 100) parts[0] = (2000 + y).toString();
    return parts;
}
function formatarDataBR(y, m, d) { return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`; }
function log(m) {
    logs.unshift(`[${new Date().toLocaleString()}] ${m}`);
    localStorage.setItem('log', JSON.stringify(logs.slice(0, 50)));
    let box = document.getElementById('logs');
    if(box) box.innerHTML = logs.map(escapeHTML).join('<br>');
}

// --- FUNÇÃO PARA LIMPAR TELA SEM RECARREGAR (Evitar Piscar a Tela) ---
function finalizarAcaoForm() {
    document.querySelectorAll('.card input[type="text"], .card input[type="number"], .card input[type="date"]').forEach(i => {
        if (i.id !== 'descSalario') i.value = '';
        if (i.type === 'date') i.value = new Date().toISOString().split('T')[0];
    });
    document.querySelectorAll('.card').forEach(c => c.classList.add('escondido'));
    render();
}

// --- SALVAMENTOS ---
function mudarTipoGasto(val) { document.getElementById('pBox').className = val === 'p' ? '' : 'escondido'; }

async function salvarGasto() {
    const v = normVal(document.getElementById('valorGasto').value);
    const pInput = document.getElementById('parcelasGasto').value;
    const isCard = document.getElementById('tipoGasto').value === 'p';
    const cat = document.getElementById('catGasto').value; 
    const p = isCard ? parseInt(pInput) : 1;
    const cartao = isCard ? document.getElementById('cartaoGasto').value : '';
    const desc = document.getElementById('descGasto').value;
    if (!v || !desc) return await Modal.alert("Preencha o valor e a descrição.");
    const d = normData(document.getElementById('dataGasto').value);
    let yFirst = parseInt(d[0]); let mFirst = parseInt(d[1]) - 1; let diaVal = parseInt(d[2]);
    
    if (isCard && cartao) {
        let cartaoObj = cartoes.find(c => c.nome === cartao);
        if (cartaoObj && diaVal >= cartaoObj.fechamento) { mFirst += 1; if (mFirst > 11) { mFirst = 0; yFirst += 1; } }
    }
    
    gastos.push({ desc, valor: v, parcelas: p, cartao: cartao, categoria: cat, dia: diaVal, ano: yFirst, mes: mFirst, anoBase: parseInt(d[0]), mesBase: parseInt(d[1]) - 1, quitadas: [] });
    localStorage.setItem('gas', JSON.stringify(gastos));
    log(`GASTO: ${desc} - ${formatarMoeda(v)}`);
    finalizarAcaoForm();
}

async function salvarEntrada(tipo) {
    const isSalario = tipo === 'salario';
    const v = normVal(document.getElementById(isSalario ? 'valorSalario' : 'valorRenda').value);
    const desc = isSalario ? document.getElementById('descSalario').value : document.getElementById('descRenda').value;
    if (!v || !desc) return await Modal.alert("Preencha os dados.");
    const d = normData(document.getElementById(isSalario ? 'dataSalario' : 'dataRenda').value);
    
    entradas.push({ tipo, desc, valor: v, ano: parseInt(d[0]), mes: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('ent', JSON.stringify(entradas));
    log(`ENTRADA: ${desc} - ${formatarMoeda(v)}`);
    finalizarAcaoForm();
}

async function salvarRecorrente() {
    const v = normVal(document.getElementById('valorRec').value);
    const desc = document.getElementById('descRec').value;
    const pInput = document.getElementById('limiteRec').value;
    const p = pInput ? parseInt(pInput) : 0; 
    if (!v || !desc) return await Modal.alert("Preencha os dados.");
    const d = normData(document.getElementById('dataRec').value);
    
    recorrentes.push({ desc, valor: v, parcelas: p, ano: parseInt(d[0]), mes: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('rec', JSON.stringify(recorrentes));
    finalizarAcaoForm();
}

async function salvarInvestimento() {
    const v = normVal(document.getElementById('valorInv').value);
    const desc = document.getElementById('descInv').value;
    const cat = document.getElementById('catInv').value;
    if (!v || !desc) return await Modal.alert("Preencha valor e descrição.");
    const d = normData(document.getElementById('dataInv').value);
    
    investimentos.push({ desc, categoria: cat, valor: v, ano: parseInt(d[0]), mes: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('inv', JSON.stringify(investimentos));
    log(`INVESTIMENTO: ${desc} - ${formatarMoeda(v)}`);
    finalizarAcaoForm();
}

async function salvarDivida() {
    const tipo = document.getElementById('tipoDivida').value;
    const pessoa = document.getElementById('pessoaDivida').value;
    const v = normVal(document.getElementById('valorDivida').value);
    const parc = parseInt(document.getElementById('parcelasDivida').value) || 1;
    const desc = document.getElementById('descDivida').value;
    if (!v || !pessoa) return await Modal.alert("Preencha valor e pessoa.");
    const d = normData(document.getElementById('dataDivida').value);
    
    dividas.push({ tipo, pessoa, desc, valor: v, parcelas: parc, ano: parseInt(d[0]), mes: parseInt(d[1]) - 1, dia: parseInt(d[2]), status: 'pendente' });
    localStorage.setItem('div', JSON.stringify(dividas));
    finalizarAcaoForm();
}

function salvarPerfil() {
    perfil.nome = document.getElementById('perfilNome').value.trim();
    perfil.tel = document.getElementById('perfilTel').value.trim();
    localStorage.setItem('perfil', JSON.stringify(perfil));
    renderHeader();
}

// --- EDIÇÃO AVANÇADA COM MODAIS ---
async function editarRegistro(tipoArray, index) {
    let arr, storageKey;
    if (tipoArray === 'ent') { arr = entradas; storageKey = 'ent'; }
    if (tipoArray === 'gas') { arr = gastos; storageKey = 'gas'; }
    if (tipoArray === 'rec') { arr = recorrentes; storageKey = 'rec'; }
    if (tipoArray === 'inv') { arr = investimentos; storageKey = 'inv'; }
    if (tipoArray === 'div') { arr = dividas; storageKey = 'div'; }
    
    let item = arr[index];
    
    let novoDesc = await Modal.prompt("Editar Descrição:", item.desc);
    if (novoDesc === null) return; 
    
    if (item.pessoa !== undefined) {
        let novaPessoa = await Modal.prompt("Editar Nome da Pessoa:", item.pessoa);
        if (novaPessoa !== null) item.pessoa = novaPessoa.trim() || item.pessoa;
    }

    let novoValor = await Modal.prompt("Editar Valor Total:", item.valor.toFixed(2));
    if (novoValor === null) return;

    let yB = item.anoBase !== undefined ? item.anoBase : item.ano;
    let mB = item.mesBase !== undefined ? item.mesBase : item.mes;
    let dataAtual = `${yB}-${String(mB + 1).padStart(2, '0')}-${String(item.dia).padStart(2, '0')}`;
    let novaData = await Modal.prompt("Editar Data (YYYY-MM-DD):", dataAtual);

    item.desc = novoDesc.trim() || item.desc;
    item.valor = normVal(novoValor) || item.valor;

    if (novaData && novaData !== dataAtual) {
        let d = normData(novaData);
        let nY = parseInt(d[0]);
        let nM = parseInt(d[1]) - 1;
        let nD = parseInt(d[2]);

        if(item.anoBase !== undefined) {
            item.anoBase = nY;
            item.mesBase = nM;
            if(item.cartao && item.parcelas > 0) { 
                let cartaoObj = cartoes.find(c => c.nome === item.cartao);
                let yFirst = nY; let mFirst = nM;
                if (cartaoObj && nD >= cartaoObj.fechamento) { mFirst += 1; if (mFirst > 11) { mFirst = 0; yFirst += 1; } }
                item.ano = yFirst; item.mes = mFirst; item.dia = nD;
            } else {
                item.ano = nY; item.mes = nM; item.dia = nD;
            }
        } else {
            item.ano = nY; item.mes = nM; item.dia = nD;
        }
    }
    
    localStorage.setItem(storageKey, JSON.stringify(arr));
    log(`EDIÇÃO: Registro alterado com sucesso.`);
    finalizarAcaoForm();
}

async function processarPagamento(index) {
    const g = gastos[index];
    let hoje = new Date();

    if (g.parcelas <= 1) {
        let vPago = normVal(await Modal.prompt(`Saldo: ${formatarMoeda(g.valor)}\nQual valor você pagou hoje?`, g.valor.toFixed(2)));
        if (vPago <= 0) return;
        gastos.push({ desc: `[Quitação] ${g.desc}`, valor: vPago, parcelas: 1, cartao: '', categoria: g.categoria, ano: hoje.getFullYear(), mes: hoje.getMonth(), dia: hoje.getDate(), anoBase: hoje.getFullYear(), mesBase: hoje.getMonth(), quitadas: [] });
        if (g.valor - vPago <= 0) gastos.splice(index, 1);
        else g.valor -= vPago;
    } else {
        g.quitadas = g.quitadas || [];
        let vParc = g.valor / g.parcelas;
        
        let acao = await Modal.prompt(`ALVO: ${g.desc}\n\n[1] ANTECIPAR MÊS (Sai do Caixa)\n[2] APAGAR MÊS (Isentar)\n[3] AMORTIZAR GERAL\n\nDigite 1, 2 ou 3:`, "");

        if (acao === '1' || acao === '2') {
            let listaTexto = "";
            let parcelasValidas = [];
            let baseY = g.anoBase !== undefined ? g.anoBase : g.ano;
            let baseM = g.mesBase !== undefined ? g.mesBase : g.mes;

            for (let i = 1; i <= g.parcelas; i++) {
                if (!g.quitadas.includes(i)) {
                    let dataParc = new Date(baseY, baseM + i - 1, 1);
                    let mesNome = dataParc.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
                    listaTexto += `[ ${i} ] = ${mesNome}\n`;
                    parcelasValidas.push(i);
                }
            }

            if (parcelasValidas.length === 0) return await Modal.alert("Não há parcelas disponíveis.");

            let input = await Modal.prompt(`MESES DISPONÍVEIS:\n${listaTexto}\nDigite os NÚMEROS (ex: 2, 3) ou TUDO:`, "");
            if (!input) return;

            let parcelasSelecionadas = [];
            if (input.trim().toUpperCase() === 'TUDO') parcelasSelecionadas = parcelasValidas;
            else parcelasSelecionadas = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && parcelasValidas.includes(n));

            if (parcelasSelecionadas.length === 0) return await Modal.alert("Seleção inválida.");

            if (acao === '1') {
                let vPago = parcelasSelecionadas.length * vParc;
                let confirma = await Modal.confirm(`Descontar HOJE do caixa: ${formatarMoeda(vPago)}?\n(Parcelas: ${parcelasSelecionadas.join(', ')})`);
                if (!confirma) return;
                gastos.push({ desc: `[Antecipou Parc. ${parcelasSelecionadas.join(',')}] ${g.desc}`, valor: vPago, parcelas: 1, cartao: '', categoria: g.categoria, ano: hoje.getFullYear(), mes: hoje.getMonth(), dia: hoje.getDate(), anoBase: hoje.getFullYear(), mesBase: hoje.getMonth(), quitadas: [] });
            } else {
                let confirma = await Modal.confirm(`Anular permanentemente as parcelas: ${parcelasSelecionadas.join(', ')}?\nO caixa atual NÃO será afetado.`);
                if (!confirma) return;
            }

            g.quitadas.push(...parcelasSelecionadas);
        } else if (acao === '3') {
            let vPago = normVal(await Modal.prompt(`Saldo restante: ${formatarMoeda(g.valor)}\nInjetar hoje para abater:`, g.valor.toFixed(2)));
            if (vPago <= 0) return;
            gastos.push({ desc: `[Amortizou] ${g.desc}`, valor: vPago, parcelas: 1, cartao: '', categoria: g.categoria, ano: hoje.getFullYear(), mes: hoje.getMonth(), dia: hoje.getDate(), anoBase: hoje.getFullYear(), mesBase: hoje.getMonth(), quitadas: [] });
            if (g.valor - vPago <= 0) gastos.splice(index, 1);
            else g.valor -= vPago;
        } else {
            return;
        }
    }
    
    localStorage.setItem('gas', JSON.stringify(gastos));
    finalizarAcaoForm();
}

async function apagarRegistro(tipoArray, index) {
    if (!await Modal.confirm("Excluir permanentemente este registro em todas as instâncias?")) return;
    if (tipoArray === 'ent') { entradas.splice(index, 1); localStorage.setItem('ent', JSON.stringify(entradas)); }
    if (tipoArray === 'gas') { gastos.splice(index, 1); localStorage.setItem('gas', JSON.stringify(gastos)); }
    if (tipoArray === 'rec') { recorrentes.splice(index, 1); localStorage.setItem('rec', JSON.stringify(recorrentes)); }
    if (tipoArray === 'inv') { investimentos.splice(index, 1); localStorage.setItem('inv', JSON.stringify(investimentos)); }
    if (tipoArray === 'div') { dividas.splice(index, 1); localStorage.setItem('div', JSON.stringify(dividas)); }
    finalizarAcaoForm();
}

async function confirmarPagamentoDivida(index) {
    if (!await Modal.confirm("Confirmar entrada/saída de caixa HOJE?")) return;
    let hoje = new Date();
    dividas[index].status = 'pago';
    dividas[index].ano = hoje.getFullYear();
    dividas[index].mes = hoje.getMonth();
    dividas[index].dia = hoje.getDate();
    localStorage.setItem('div', JSON.stringify(dividas));
    log(`PAGAMENTO CONFIRMADO: ${dividas[index].desc}`);
    finalizarAcaoForm();
}

function renderCartoesSelect() {
    let inNome = document.getElementById('perfilNome');
    let inTel = document.getElementById('perfilTel');
    if (inNome && perfil.nome) inNome.value = perfil.nome;
    if (inTel && perfil.tel) inTel.value = perfil.tel;
    
    let sel = document.getElementById('cartaoGasto');
    if (sel) {
        sel.innerHTML = '<option value="">Sem Cartão / Outros</option>';
        cartoes.forEach(c => sel.innerHTML += `<option value="${escapeHTML(c.nome)}">${escapeHTML(c.nome)} (Fecha dia ${c.fechamento})</option>`);
    }
    let lista = document.getElementById('listaCartoesPerfil');
    if (!lista) return;
    let html = '';
    cartoes.forEach((c, index) => {
        html += `<div style="display:flex; justify-content:space-between; padding:10px; border:1px solid var(--border-color); margin-bottom:8px;">
            <span><strong>${escapeHTML(c.nome)}</strong> (Final ${escapeHTML(c.digitos)} | Dia ${c.fechamento})</span>
            <button class="btn-submit red" style="width:auto; padding:5px 10px; font-size:11px;" onclick="cartoes.splice(${index},1); localStorage.setItem('crt', JSON.stringify(cartoes)); renderCartoesSelect();">X</button>
        </div>`;
    });
    lista.innerHTML = html || '<div style="font-size:13px; color:var(--text-muted);">Sem cartões.</div>';
}

function addCartaoPerfil() {
    let n = document.getElementById('novoCartaoNome').value.trim();
    let d = document.getElementById('novoCartaoDigitos').value.trim();
    let f = parseInt(document.getElementById('novoCartaoFechamento').value) || 31;
    if (!n) return;
    cartoes.push({ nome: n, fechamento: f, digitos: d }); 
    localStorage.setItem('crt', JSON.stringify(cartoes));
    document.getElementById('novoCartaoNome').value = ''; 
    document.getElementById('novoCartaoDigitos').value = ''; 
    document.getElementById('novoCartaoFechamento').value = '';
    renderCartoesSelect();
}

function renderListasExtras() {
    let boxInv = document.getElementById('invGrid');
    if(boxInv) {
        let h = '';
        investimentos.forEach((i, idx) => {
            h += `<div class="item-lista"><span>[${formatarDataBR(i.ano, i.mes, i.dia)}] 🪙 ${escapeHTML(i.desc)} - ${formatarMoeda(i.valor)}</span>
            <button class="btn-submit red" style="width:auto;padding:6px 12px;font-size:11px;" onclick="apagarRegistro('inv', ${idx})">X</button></div>`;
        });
        boxInv.innerHTML = h || '<p style="color:var(--text-muted); font-size:13px;">Nenhum investimento.</p>';
    }

    let boxDiv = document.getElementById('divGrid');
    if(boxDiv) {
        let h = '';
        dividas.forEach((d, idx) => {
            let cor = d.tipo === 'divida' ? 'var(--color-red)' : 'var(--color-green)';
            let titulo = d.tipo === 'divida' ? 'Devo pagar' : 'Vou receber';
            let txtStatus = d.status === 'pendente' ? `<span style="color:#f59e0b; font-size:11px; font-weight:bold;">[PENDENTE]</span>` : `<span style="color:var(--color-green); font-size:11px; font-weight:bold;">[PAGO]</span>`;
            let btnConfirmar = d.status === 'pendente' ? `<button class="btn-submit green" style="width:auto;padding:6px 12px;font-size:11px; margin-right:5px;" onclick="confirmarPagamentoDivida(${idx})">✅ Confirmar</button>` : '';
            h += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:${cor};"><strong>${titulo}: ${escapeHTML(d.pessoa)}</strong> - ${formatarMoeda(d.valor)} ${txtStatus}<br><small>${escapeHTML(d.desc)}</small></span>
                <div style="display:flex;">
                    ${btnConfirmar}
                    <button class="btn-submit red" style="width:auto;padding:6px 12px;font-size:11px;" onclick="apagarRegistro('div', ${idx})">🗑️ Excluir</button>
                </div>
            </div>`;
        });
        boxDiv.innerHTML = h || '<p style="color:var(--text-muted); font-size:13px;">Nenhuma conta a pagar/receber.</p>';
    }
}

// --- RENDERIZAÇÃO DE ALTA PERFORMANCE O(N) ---
function render() {
    renderListasExtras();

    let hoje = new Date();
    
    // Procura o registro mais antigo da sua base para fazer um saldo geral histórico preciso
    let minAno = hoje.getFullYear() - 1;
    let minMes = hoje.getMonth();
    const checkMin = (y, m) => { if(y < minAno || (y === minAno && m < minMes)) { minAno = y; minMes = m; } };
    
    entradas.forEach(e => checkMin(e.ano, e.mes));
    gastos.forEach(g => checkMin(g.anoBase, g.mesBase));
    recorrentes.forEach(r => checkMin(r.ano, r.mes));
    investimentos.forEach(i => checkMin(i.ano, i.mes));
    dividas.forEach(d => checkMin(d.ano, d.mes));
    
    let iterDate = new Date(minAno, minMes, 1);
    let endDate = new Date(hoje.getFullYear() + 1, hoje.getMonth() + 11, 1);
    
    let projectionMap = {};
    
    // Cria um mapa limpo de meses para evitar layout thrashing e laços repetitivos
    while (iterDate <= endDate) {
        let key = `${iterDate.getFullYear()}-${iterDate.getMonth()}`;
        projectionMap[key] = { ent: 0, gas: 0, ano: iterDate.getFullYear(), mes: iterDate.getMonth() };
        iterDate.setMonth(iterDate.getMonth() + 1);
    }

    // Popula o Mapa de Projeção Dinamicamente O(N)
    entradas.forEach(e => {
        let key = `${e.ano}-${e.mes}`;
        if(projectionMap[key]) projectionMap[key].ent += e.valor;
    });

    gastos.forEach(g => {
        for(let i=0; i<g.parcelas; i++) {
            if (g.quitadas && g.quitadas.includes(i + 1)) continue;
            let d = new Date(g.ano, g.mes + i, 1);
            let vParc = g.valor / g.parcelas;
            let key = `${d.getFullYear()}-${d.getMonth()}`;
            if(projectionMap[key]) projectionMap[key].gas += vParc;
        }
    });

    recorrentes.forEach(r => {
        let maxParc = r.parcelas ? r.parcelas : 120;
        for(let i=0; i<maxParc; i++) {
            let d = new Date(r.ano, r.mes + i, 1);
            let key = `${d.getFullYear()}-${d.getMonth()}`;
            if(projectionMap[key]) projectionMap[key].gas += r.valor;
        }
    });

    investimentos.forEach(i => {
        let key = `${i.ano}-${i.mes}`;
        if(projectionMap[key]) projectionMap[key].gas += i.valor;
    });

    dividas.forEach(d => {
        if(d.status === 'pago') {
            for(let i=0; i<d.parcelas; i++) {
                let dt = new Date(d.ano, d.mes + i, 1);
                let vParc = d.valor / d.parcelas;
                let key = `${dt.getFullYear()}-${dt.getMonth()}`;
                if(projectionMap[key]) {
                    if(d.tipo === 'credito') projectionMap[key].ent += vParc;
                    else projectionMap[key].gas += vParc;
                }
            }
        }
    });

    let dashEntradas = 0; let dashSaidas = 0; let caixaAcumuladoTotal = 0;
    let htmlProj = ''; let htmlAnt = '';

    // Ordenação cronológica correta
    let keys = Object.keys(projectionMap).sort((a,b) => {
        let [ya, ma] = a.split('-'); let [yb, mb] = b.split('-');
        return (parseInt(ya) - parseInt(yb)) || (parseInt(ma) - parseInt(mb));
    });

    keys.forEach(key => {
        let obj = projectionMap[key];
        let isMesAtual = (obj.ano === hoje.getFullYear() && obj.mes === hoje.getMonth());
        
        let s = obj.ent - obj.gas;
        caixaAcumuladoTotal += s; // Atualização perfeita do Caixa baseada em 100% da sua história!

        if (isMesAtual) {
            dashEntradas = obj.ent;
            dashSaidas = obj.gas;
            let elDashSaldo = document.getElementById('dashSaldo');
            if(elDashSaldo) elDashSaldo.innerText = formatarMoeda(caixaAcumuladoTotal);
            let elDashEntradas = document.getElementById('dashEntradas');
            if(elDashEntradas) elDashEntradas.innerText = formatarMoeda(dashEntradas);
            let elDashSaidas = document.getElementById('dashSaidas');
            if(elDashSaidas) elDashSaidas.innerText = formatarMoeda(dashSaidas);
        }

        // Limitamos a exibição HTML ao recorte tradicional (12 pra trás, 12 pra frente) para a tela não ficar gigante
        let d = new Date(obj.ano, obj.mes, 1);
        if (d >= new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)) {
            let mesNome = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
            let colorS = s >= 0 ? 'var(--color-green)' : 'var(--color-red)';
            let colorC = caixaAcumuladoTotal >= 0 ? 'var(--color-blue)' : 'var(--color-red)';
            let tr = `<tr>
                <td><strong>${mesNome}</strong></td>
                <td style="color:var(--color-green);">${formatarMoeda(obj.ent)}</td>
                <td style="color:var(--color-red);">${formatarMoeda(obj.gas)}</td>
                <td style="color:${colorS};"><strong>${formatarMoeda(s)}</strong></td>
                <td style="color:${colorC}; font-weight:700;">${formatarMoeda(caixaAcumuladoTotal)}</td>
            </tr>`;

            if (d >= new Date(hoje.getFullYear(), hoje.getMonth(), 1)) {
                htmlProj += tr;
            } else {
                htmlAnt = tr + htmlAnt; // Inverte o histórico (mais recente no topo)
            }
        }
    });

    // Injeção limpa de DOM (Sem thrashing de Layout)
    let tbodyProj = document.querySelector('#tabProj tbody');
    let tbodyAnt = document.getElementById('tbodyAnt');
    if(tbodyProj) tbodyProj.innerHTML = htmlProj;
    if(tbodyAnt) tbodyAnt.innerHTML = htmlAnt;
    
    let boxLogs = document.getElementById('logs');
    if(boxLogs) boxLogs.innerHTML = logs.map(escapeHTML).join('<br>');
    renderHist();
}

function renderHist() {
    let busca = document.getElementById('searchBar');
    let termo = busca ? busca.value.toLowerCase() : '';
    let html = '';
    
    entradas.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.valor.toString().includes(termo)) {
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:var(--color-green);">+ [${formatarDataBR(item.ano, item.mes, item.dia)}] ${escapeHTML(item.desc)}: ${formatarMoeda(item.valor)}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('ent', ${i})">✏️ Editar</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('ent', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });

    gastos.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.valor.toString().includes(termo)) {
            let parcInfo = item.parcelas > 1 ? ` (${item.parcelas}x)` : '';
            let quitadasInfo = (item.quitadas && item.quitadas.length > 0) ? ` <span style="font-size:11px; color:#f59e0b; font-weight:bold;">[Filtros Ativos nas Parc: ${item.quitadas.join(', ')}]</span>` : '';
            let catInfo = item.categoria ? ` <span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:5px;">${escapeHTML(item.categoria)}</span>` : '';
            let exibirBotaoPagar = (item.parcelas > 1 && (!item.quitadas || item.quitadas.length < item.parcelas));
            
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:var(--color-red);">- [${formatarDataBR(item.anoBase, item.mesBase, item.dia)}] ${escapeHTML(item.desc)}${parcInfo}: ${formatarMoeda(item.valor)}${catInfo}${quitadasInfo}</span>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('gas', ${i})">✏️ Editar</button>
                    <button class="btn-submit" style="background:#8b5cf6; width:auto;padding:4px 10px;font-size:11px;" onclick="processarPagamento(${i})">${exibirBotaoPagar ? 'Antecipar / Quitar' : '💲Pagar/Amortizar'}</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('gas', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });

    let histBox = document.getElementById('hist');
    if(histBox) histBox.innerHTML = html || '<p style="color:var(--text-muted);">Nenhum resultado.</p>';
}

function gerarBackup() {
    const dados = { ent: localStorage.getItem('ent') || "[]", gas: localStorage.getItem('gas') || "[]", rec: localStorage.getItem('rec') || "[]", inv: localStorage.getItem('inv') || "[]", div: localStorage.getItem('div') || "[]", crt: localStorage.getItem('crt') || "[]", perfil: localStorage.getItem('perfil') || "{}", log: localStorage.getItem('log') || "[]" };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Backup_CYT_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    log(`BACKUP GERADO na sua máquina.`);
    finalizarAcaoForm();
}

async function carregarBackup(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            ['ent', 'gas', 'rec', 'inv', 'div', 'crt', 'perfil', 'log'].forEach(chave => {
                if (d[chave]) localStorage.setItem(chave, typeof d[chave] === 'string' ? d[chave] : JSON.stringify(d[chave]));
            });
            await Modal.alert("✅ Backup restaurado com sucesso. A página será recarregada para aplicar."); 
            location.reload(); // Nesse único caso o reload é necessário para popular toda a classe inicial.
        } catch (err) { 
            await Modal.alert("❌ ERRO FATAL: Arquivo corrompido."); 
        }
    };
    reader.readAsText(file);
}

function confirmarZerar() {
    Modal.confirm("Atenção: Isso vai limpar TODO O SISTEMA. Deseja continuar?").then(res => {
        if(res) {
            localStorage.clear();
            location.reload();
        }
    });
}

window.onload = init;
