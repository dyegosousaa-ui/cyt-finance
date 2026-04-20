// ==========================================
// CYT FINANCE - VERSÃO LUXO (BOTÕES COMPACTOS & LOGS ATIVOS)
// ==========================================

// --- DADOS BASE COM SANEAMENTO OBRIGATÓRIO ---
let entradas, gastos, recorrentes, investimentos, dividas, cartoesTemp, cartoes, logs, perfil;
let meuGrafico = null;
let meuGraficoRosca = null;

function carregarDadosIniciais() {
    const getParse = key => JSON.parse(localStorage.getItem(key)) || [];
    
    const migrarArray = (chave, mapFn) => {
        let dados = getParse(chave);
        let novosDados = dados.map(mapFn);
        localStorage.setItem(chave, JSON.stringify(novosDados));
        return novosDados;
    };

    entradas = migrarArray('ent', d => ({ ...d, tipo: d.tipo || 'entrada', desc: d.desc || 'Sem Nome', valor: parseFloat(d.v !== undefined ? d.v : (d.valor || 0)) || 0, ano: parseInt(d.y !== undefined ? d.y : d.ano) || new Date().getFullYear(), mes: parseInt(d.m !== undefined ? d.m : d.mes) || new Date().getMonth(), dia: parseInt(d.dia) || 1 }));
    
    gastos = migrarArray('gas', d => ({ ...d, desc: d.desc || 'Sem Nome', valor: parseFloat(d.v !== undefined ? d.v : (d.valor || 0)) || 0, parcelas: parseInt(d.p !== undefined ? d.p : (d.parcelas || 1)) || 1, cartao: d.c !== undefined ? d.c : (d.cartao || ''), categoria: d.cat !== undefined ? d.cat : (d.categoria || 'Outros'), dia: parseInt(d.dia) || 1, ano: parseInt(d.y !== undefined ? d.y : d.ano) || new Date().getFullYear(), mes: parseInt(d.m !== undefined ? d.m : d.mes) || new Date().getMonth(), anoBase: parseInt(d.yBase !== undefined ? d.yBase : (d.anoBase !== undefined ? d.anoBase : d.ano)), mesBase: parseInt(d.mBase !== undefined ? d.mBase : (d.mesBase !== undefined ? d.mesBase : d.mes)), quitadas: Array.isArray(d.quitadas) ? d.quitadas : [] }));
    
    recorrentes = migrarArray('rec', d => ({ ...d, desc: d.desc || 'Sem Nome', valor: parseFloat(d.v !== undefined ? d.v : (d.valor || 0)) || 0, parcelas: parseInt(d.p !== undefined ? d.p : (d.parcelas || 0)) || 0, ano: parseInt(d.y !== undefined ? d.y : d.ano) || new Date().getFullYear(), mes: parseInt(d.m !== undefined ? d.m : d.mes) || new Date().getMonth(), dia: parseInt(d.dia) || 1, tipo: d.tipo || 'saida' }));
    
    investimentos = migrarArray('inv', d => ({ ...d, desc: d.desc || 'Sem Nome', categoria: d.cat !== undefined ? d.cat : (d.categoria || ''), valor: parseFloat(d.v !== undefined ? d.v : (d.valor || 0)) || 0, ano: parseInt(d.y !== undefined ? d.y : d.ano) || new Date().getFullYear(), mes: parseInt(d.m !== undefined ? d.m : d.mes) || new Date().getMonth(), dia: parseInt(d.dia) || 1 }));
    
    dividas = migrarArray('div', d => ({ ...d, tipo: d.tipo || 'divida', pessoa: d.pessoa || 'Desconhecido', desc: d.desc || '', valor: parseFloat(d.v !== undefined ? d.v : (d.valor || 0)) || 0, parcelas: parseInt(d.p !== undefined ? d.p : (d.parcelas || 1)) || 1, ano: parseInt(d.y !== undefined ? d.y : d.ano) || new Date().getFullYear(), mes: parseInt(d.m !== undefined ? d.m : d.mes) || new Date().getMonth(), dia: parseInt(d.dia) || 1, status: d.status || 'pendente', quitadas: Array.isArray(d.quitadas) ? d.quitadas : [] }));
    
    cartoesTemp = migrarArray('crt', c => {
        if (typeof c === 'string') return { nome: c, fechamento: 31, digitos: '' };
        return { nome: c.n !== undefined ? c.n : c.nome, fechamento: c.f !== undefined ? c.f : c.fechamento, digitos: c.d !== undefined ? c.d : (c.digitos || '') };
    });
    cartoes = cartoesTemp.map(c => { if (!c.digitos) c.digitos = ''; return c; });
    localStorage.setItem('crt', JSON.stringify(cartoes));
    logs = getParse('log');
    perfil = JSON.parse(localStorage.getItem('perfil')) || { nome: '', tel: '' };
}
carregarDadosIniciais(); 

// --- UTILITÁRIOS E MODAIS ---
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

function formatarMoeda(valor) {
    return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const Modal = {
    show: function(title, type, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('cytModal');
            if(!overlay) { alert(title); return resolve(true); }
            const titleEl = document.getElementById('cytModalTitle');
            const inputEl = document.getElementById('cytModalInput');
            const btnCancel = document.getElementById('cytModalCancel');
            const btnConfirm = document.getElementById('cytModalConfirm');

            titleEl.innerHTML = title.replace(/\n/g, '<br>');
            if(type === 'prompt') {
                inputEl.style.display = 'block'; inputEl.value = defaultValue; inputEl.focus();
                inputEl.onkeyup = (e) => { if(e.key === 'Enter') btnConfirm.click(); };
            } else { inputEl.style.display = 'none'; inputEl.onkeyup = null; }
            btnCancel.style.display = type === 'alert' ? 'none' : 'inline-block';
            overlay.classList.remove('escondido');

            const cleanup = () => { overlay.classList.add('escondido'); btnConfirm.onclick = null; btnCancel.onclick = null; };
            btnConfirm.onclick = () => { cleanup(); resolve(type === 'prompt' ? inputEl.value : true); };
            btnCancel.onclick = () => { cleanup(); resolve(false); };
        });
    },
    alert: async (msg) => await Modal.show(msg, 'alert'),
    confirm: async (msg) => await Modal.show(msg, 'confirm'),
    prompt: async (msg, defaultVal) => { const res = await Modal.show(msg, 'prompt', defaultVal); return res === false ? null : res; }
};

function normVal(v) {
    if (!v) return 0;
    let n = String(v).replace(/[^\d,\.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(n) || 0;
}

function normData(d) {
    if(!d) { let h = new Date(); return [h.getFullYear(), h.getMonth() + 1, h.getDate()]; }
    let parts = d.split('-'); let y = parseInt(parts[0]);
    if (y < 100) parts[0] = 2000 + y;
    return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
}

function formatarDataBR(y, m, d) { return `${String(d).padStart(2, '0')}/${String(parseInt(m) + 1).padStart(2, '0')}/${y}`; }

function log(m) {
    logs.unshift(`[${new Date().toLocaleString()}] ${m}`);
    localStorage.setItem('log', JSON.stringify(logs.slice(0, 50)));
    let box = document.getElementById('logs');
    if(box) box.innerHTML = logs.map(escapeHTML).join('<br>');
}

// --- INTERFACE E CONTROLES ---
function init() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    document.querySelectorAll('input[type="date"]').forEach(i => i.value = hoje.toISOString().split('T')[0]);

    // INJEÇÃO DE CSS DINÂMICO PARA REPARAR O MOBILE E MANTER BOTÕES PEQUENOS
    const extrasEstilo = document.createElement('style');
    extrasEstilo.innerHTML = `
        details > summary { list-style: none; outline: none; border: none; box-shadow: none; cursor: pointer; }
        details > summary::-webkit-details-marker { display: none; }
        
        .header-container { display: flex; align-items: center; justify-content: center; width: auto; height: 100%; margin: 0 auto; flex-wrap: wrap; }
        .header-logo { width: 70px; height: 70px; margin-right: 15px; vertical-align: middle; object-fit: contain; }
        
        .header-name-text {
            background: linear-gradient(45deg, #FFD700, #DAA520, #F0E68C, #FFD700);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.3);
            font-size: inherit;
            font-weight: inherit;
            line-height: inherit;
        }

        table { width: 100%; border-collapse: collapse; }
        .tab-content { width: 100%; box-sizing: border-box; overflow-x: hidden; }
        
        .item-lista { width: 100%; box-sizing: border-box; overflow-wrap: break-word; }
        .botoes-container { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; width: 100%; margin-top: 5px; }

        @media (max-width: 480px) {
            .header-logo { width: 85px; height: 85px; margin-right: 0px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
            .header-container { flex-direction: column; text-align: center; }
            table { display: block; overflow-x: auto; white-space: nowrap; }
            /* Os botões agora seguem o próprio estilo inline (width:auto, etc), sem esticar e estragar o visual */
        }
    `;
    document.head.appendChild(extrasEstilo);

    let boxRendaData = document.getElementById('dataRenda');
    if (boxRendaData && !document.getElementById('checkRendaRec')) {
        boxRendaData.insertAdjacentHTML('afterend', `
            <div style="margin-top:10px; display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <input type="checkbox" id="checkRendaRec" style="width:auto; margin:0;" onchange="document.getElementById('boxRendaAte').style.display = this.checked ? 'block' : 'none'">
                <label for="checkRendaRec" style="font-size:13px; font-weight:bold; color:var(--text-main);">🔁 Repetir mensalmente?</label>
            </div>
            <div id="boxRendaAte" style="display:none; margin-bottom:10px; padding:10px; background:var(--bg-body); border-radius:var(--radius-sm);">
                <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">Até qual mês? (Vazio = Infinito)</label>
                <input type="month" id="dataRendaAte" class="modal-input" style="padding:10px; width:100%; box-sizing:border-box;">
            </div>
        `);
    }

    let btnGerarBackup = document.querySelector('button[onclick="gerarBackup()"]');
    if (btnGerarBackup) {
        btnGerarBackup.style.backgroundColor = '#10b981';
        btnGerarBackup.style.borderColor = '#10b981';
        btnGerarBackup.style.color = '#ffffff';
    }

    document.addEventListener('click', function(e) {
        let insideCard = e.target.closest('.card');
        let isButton = e.target.closest('button');
        let isModal = e.target.closest('.modal-overlay');
        
        if (!insideCard && !isButton && !isModal) {
            document.querySelectorAll('.card').forEach(c => c.classList.add('escondido'));
        }
    });

    renderHeader(); renderCartoesSelect(); render();
}

function renderHeader() {
    let nameHeader = document.getElementById('headerName');
    if (nameHeader) {
        let baseName = 'CYT Finance';
        let formattedName = perfil.nome ? `${baseName} | ${perfil.nome.split(' ')[0]}` : baseName;
        nameHeader.innerHTML = `
            <div class="header-container">
                <img src="Logo DS.png" class="header-logo" alt="DS Logo">
                <span class="header-name-text">${escapeHTML(formattedName)}</span>
            </div>
        `;
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    if (!document.getElementById('tabGrafico').classList.contains('escondido')) desenharGrafico();
}

function renderGerenciarSalarios() {
    let form = document.getElementById('formSalario');
    if(!form) return;
    let box = document.getElementById('boxGerenciarSalarios');
    if(!box) {
        box = document.createElement('div'); box.id = 'boxGerenciarSalarios';
        box.style.marginTop = '20px'; box.style.borderTop = '1px solid var(--border-color)'; box.style.paddingTop = '15px';
        form.appendChild(box);
    }
    
    let html = '<h4 style="margin:0 0 10px 0; font-size:14px; color:var(--color-green);">Salários Ativos</h4>';
    let temSalario = false;
    
    recorrentes.forEach((r, idx) => {
        if(r.tipo === 'entrada') {
            temSalario = true;
            let info = r.parcelas > 0 ? ` (Até ${r.parcelas} meses)` : ' (♾️ Fixo)';
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-body); padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid var(--border-color);">
                    <div>
                        <strong style="font-size:13px; color:var(--text-main);">${escapeHTML(r.desc)}${info}</strong><br>
                        <span style="font-size:12px; color:var(--color-green); font-weight:bold;">${formatarMoeda(r.valor)}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-submit blue" style="width:auto; padding:5px 10px; font-size:11px;" onclick="editarDaquiPraFrente('rec', ${idx})">✏️ Editar Atual</button>
                        <button class="btn-submit red" style="width:auto; padding:5px 10px; font-size:11px;" onclick="apagarDaquiPraFrente('rec', ${idx}); renderGerenciarSalarios();">❌</button>
                    </div>
                </div>
            `;
        }
    });
    if(!temSalario) html += '<p style="font-size:12px; color:var(--text-muted);">Nenhum salário/renda fixa cadastrado no momento.</p>';
    box.innerHTML = html;
}

function abrir(id) {
    let el = document.getElementById(id);
    if (!el) return;
    let isOpen = !el.classList.contains('escondido');
    document.querySelectorAll('.card').forEach(c => c.classList.add('escondido'));
    if (!isOpen) {
        el.classList.remove('escondido');
        if (id === 'formSalario') renderGerenciarSalarios();
    }
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
        if (id === 'tabGrafico') desenharGrafico();
    }
}

function finalizarAcaoForm() {
    document.querySelectorAll('.card input[type="text"], .card input[type="number"], .card input[type="date"]').forEach(i => {
        if (i.id !== 'descSalario') i.value = '';
        if (i.type === 'date') i.value = new Date().toISOString().split('T')[0];
    });
    if(document.getElementById('checkRendaRec')) document.getElementById('checkRendaRec').checked = false;
    if(document.getElementById('boxRendaAte')) document.getElementById('boxRendaAte').style.display = 'none';
    if(document.getElementById('dataRendaAte')) document.getElementById('dataRendaAte').value = '';
    
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
    const p = (isCard && pInput) ? parseInt(pInput) : 1; 
    const cartao = isCard ? document.getElementById('cartaoGasto').value : '';
    const desc = document.getElementById('descGasto').value;
    
    if (!v || !desc) return await Modal.alert("Preencha o valor e a descrição.");
    
    const d = normData(document.getElementById('dataGasto').value);
    let yFirst = d[0]; let mFirst = d[1] - 1; let diaVal = d[2];
    
    if (isCard && cartao) {
        let cartaoObj = cartoes.find(c => c.nome === cartao);
        if (cartaoObj && diaVal >= cartaoObj.fechamento) { 
            mFirst += 1; if (mFirst > 11) { mFirst = 0; yFirst += 1; } 
        }
    }
    
    gastos.push({ desc, valor: v, parcelas: p, cartao: cartao, categoria: cat, dia: diaVal, ano: yFirst, mes: mFirst, anoBase: d[0], mesBase: d[1] - 1, quitadas: [] });
    localStorage.setItem('gas', JSON.stringify(gastos));
    log(`GASTO: ${desc} - ${formatarMoeda(v)}`);
    finalizarAcaoForm();
}

async function salvarEntrada(tipo) {
    const isSalario = tipo === 'salario';
    const v = normVal(document.getElementById(isSalario ? 'valorSalario' : 'valorRenda').value);
    const desc = document.getElementById(isSalario ? 'descSalario' : 'descRenda').value;
    if (!v || !desc) return await Modal.alert("Preencha o valor e a descrição corretamente.");
    
    const d = normData(document.getElementById(isSalario ? 'dataSalario' : 'dataRenda').value);
    
    let isRec = isSalario || (document.getElementById('checkRendaRec') && document.getElementById('checkRendaRec').checked);
    
    if (isRec) {
        let maxParcelas = 0;
        if (!isSalario) {
            let ate = document.getElementById('dataRendaAte').value;
            if (ate) {
                let parts = ate.split('-');
                let yAte = parseInt(parts[0]);
                let mAte = parseInt(parts[1]) - 1;
                maxParcelas = (yAte - d[0]) * 12 + (mAte - (d[1] - 1)) + 1;
                if (maxParcelas <= 0) maxParcelas = 1;
            }
        }
        recorrentes.push({ tipo: 'entrada', desc, valor: v, parcelas: maxParcelas, ano: d[0], mes: d[1] - 1, dia: d[2] });
        localStorage.setItem('rec', JSON.stringify(recorrentes));
        log(`ENTRADA FIXA/RECORRENTE: ${desc} - ${formatarMoeda(v)}`);
    } else {
        entradas.push({ tipo, desc, valor: v, ano: d[0], mes: d[1] - 1, dia: d[2] });
        localStorage.setItem('ent', JSON.stringify(entradas));
        log(`${isSalario ? 'SALÁRIO' : 'ENTRADA'}: ${desc} - ${formatarMoeda(v)}`);
    }
    finalizarAcaoForm();
}

async function salvarRecorrente() {
    const v = normVal(document.getElementById('valorRec').value);
    const desc = document.getElementById('descRec').value;
    const pInput = document.getElementById('limiteRec').value;
    const p = pInput ? parseInt(pInput) : 0; 
    if (!v || !desc) return await Modal.alert("Preencha os dados corretamente.");
    
    const d = normData(document.getElementById('dataRec').value);
    recorrentes.push({ tipo: 'saida', desc, valor: v, parcelas: p, ano: d[0], mes: d[1] - 1, dia: d[2] });
    localStorage.setItem('rec', JSON.stringify(recorrentes));
    log(`RECORRENTE: ${desc}`);
    finalizarAcaoForm();
}

async function salvarInvestimento() {
    const v = normVal(document.getElementById('valorInv').value);
    const desc = document.getElementById('descInv').value;
    const cat = document.getElementById('catInv').value;
    if (!v || !desc) return await Modal.alert("Preencha valor e descrição.");
    
    const d = normData(document.getElementById('dataInv').value);
    investimentos.push({ desc, categoria: cat, valor: v, ano: d[0], mes: d[1] - 1, dia: d[2] });
    localStorage.setItem('inv', JSON.stringify(investimentos));
    log(`INVESTIMENTO: ${desc}`);
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
    dividas.push({ tipo, pessoa, desc, valor: v, parcelas: parc, ano: d[0], mes: d[1] - 1, dia: d[2], status: 'pendente', quitadas: [] });
    localStorage.setItem('div', JSON.stringify(dividas));
    log(`REGISTRO INFORMAL: ${pessoa}`);
    finalizarAcaoForm();
}

function salvarPerfil() {
    perfil.nome = document.getElementById('perfilNome').value.trim();
    perfil.tel = document.getElementById('perfilTel').value.trim();
    localStorage.setItem('perfil', JSON.stringify(perfil));
    renderHeader();
}

// --- RENDERIZAÇÃO E CÁLCULO GERAL ---
function renderListasExtras() {
    let boxInv = document.getElementById('invGrid');
    if(boxInv) {
        boxInv.innerHTML = investimentos.length === 0 ? '<p style="color:var(--text-muted); font-size:13px;">Nenhum investimento.</p>' : '';
        investimentos.forEach((i, idx) => {
            boxInv.innerHTML += `<div class="item-lista"><span>[${formatarDataBR(i.ano, i.mes, i.dia)}] 🪙 ${escapeHTML(i.desc)} - ${formatarMoeda(i.valor)}</span>
            <div class="botoes-container"><button class="btn-submit red" style="width:auto;padding:6px 10px;font-size:11px;" onclick="apagarRegistro('inv', ${idx})">🗑️ Excluir</button></div></div>`;
        });
    }

    let boxDiv = document.getElementById('divGrid');
    if(boxDiv) {
        let hoje = new Date();
        let currY = hoje.getFullYear();
        let currM = hoje.getMonth();
        
        boxDiv.innerHTML = dividas.length === 0 ? '<p style="color:var(--text-muted); font-size:13px;">Nenhuma conta a pagar/receber.</p>' : '';
        dividas.forEach((d, idx) => {
            d.quitadas = Array.isArray(d.quitadas) ? d.quitadas : [];
            let p = parseInt(d.parcelas) || 1;
            
            if (d.status === 'pago' && d.quitadas.length === 0) {
                for (let j = 1; j <= p; j++) d.quitadas.push(j);
            }

            let diff = (currY - parseInt(d.ano)) * 12 + (currM - parseInt(d.mes));
            let parcAtual = diff >= 0 ? diff + 1 : 1; 
            if (parcAtual > p) parcAtual = p;

            let vTotal = parseFloat(d.valor) || 0;
            let vParc = vTotal / p;
            
            const cor = d.tipo === 'divida' ? 'var(--color-red)' : 'var(--color-green)';
            const titulo = d.tipo === 'divida' ? 'Devo pagar' : 'Vou receber';
            
            let isFinalizado = d.quitadas.length >= p;
            let jaPagoNesteMes = d.quitadas.includes(parcAtual);
            
            let statusText = isFinalizado ? '<span style="color:var(--color-green); font-size:11px; margin-left:5px;">[CONCLUÍDO]</span>' : 
                             jaPagoNesteMes ? '<span style="color:var(--color-blue); font-size:11px; margin-left:5px;">[MÊS OK]</span>' : 
                             '<span style="color:#f59e0b; font-size:11px; margin-left:5px;">[PENDENTE]</span>';

            let parcInfo = p > 1 ? `(Fatura ${parcAtual}/${p})` : '';
            
            const btnAcao = (!isFinalizado && !jaPagoNesteMes) ? `<button class="btn-submit green" style="width:auto;padding:6px 10px;font-size:11px;" onclick="confirmarPagamentoDivida(${idx}, ${parcAtual})">✅ Confirmar Parcela</button>` : '';

            boxDiv.innerHTML += `
                <div class="item-lista">
                    <span style="color:${cor}; font-size: 15px;">
                        <strong>${titulo}: ${escapeHTML(d.pessoa)}</strong> ${parcInfo}<br>
                        Valor Mensal: <b>${formatarMoeda(vParc)}</b> ${statusText}
                    </span>
                    <span style="color:var(--text-muted); font-size:12px; display:block; margin-top:5px;">Total Dívida: ${formatarMoeda(vTotal)} | ${escapeHTML(d.desc)}</span>
                    <div class="botoes-container">
                        ${btnAcao}
                        <button class="btn-submit red" style="width:auto;padding:6px 10px;font-size:11px;" onclick="apagarRegistro('div', ${idx})">🗑️ Excluir</button>
                    </div>
                </div>`;
        });
    }

    let boxLogs = document.getElementById('logs');
    if(boxLogs) {
        if(logs.length === 0) {
            boxLogs.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Nenhuma atividade registrada ainda.</span>';
        } else {
            boxLogs.innerHTML = logs.map(escapeHTML).join('<br>');
        }
    }
}

function render() {
    try {
        renderListasExtras();
        let hoje = new Date();
        let currY = hoje.getFullYear(); let currM = hoje.getMonth();
        
        let tbodyProj = document.querySelector('#tabProj tbody');
        let tbodyAnt = document.getElementById('tbodyAnt');
        if(tbodyProj) tbodyProj.innerHTML = '';
        if(tbodyAnt) tbodyAnt.innerHTML = '';
        
        let iterDate = new Date(currY - 2, 0, 1);
        let endDate = new Date(currY + 2, 11, 1); 
        
        let caixaAcumuladoTotal = 0;
        let dashEntradas = 0; let dashSaidas = 0;

        while (iterDate <= endDate) {
            let y = iterDate.getFullYear(); let m = iterDate.getMonth();
            let entM = 0; let gasM = 0;
            let isMesAtual = (y === currY && m === currM);
            let isMesFuturo = (y > currY) || (y === currY && m > currM);
            
            let entDetalhes = ''; let gasDetalhes = '';

            entradas.forEach(e => { 
                if (parseInt(e.ano) === y && parseInt(e.mes) === m) {
                    let v = parseFloat(e.valor) || 0;
                    entM += v; 
                    entDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">+ ${escapeHTML(e.desc)}: <b>${formatarMoeda(v)}</b></div>`;
                }
            });
            
            gastos.forEach(g => {
                let gY = parseInt(g.anoBase !== undefined ? g.anoBase : g.ano) || y;
                let gM = parseInt(g.mesBase !== undefined ? g.mesBase : g.mes) || m;
                let diff = (y - gY) * 12 + (m - gM);
                let p = parseInt(g.parcelas) || 1;
                if (diff >= 0 && diff < p) {
                    let vParc = (parseFloat(g.valor) || 0) / p;
                    let numParc = diff + 1;
                    if (!g.quitadas || !g.quitadas.includes(numParc)) {
                        gasM += vParc;
                        let infoParc = p > 1 ? ` (${numParc}/${p})` : '';
                        gasDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">- ${escapeHTML(g.desc)}${infoParc}: <b>${formatarMoeda(vParc)}</b></div>`;
                    }
                }
            });
            
            recorrentes.forEach(r => {
                let diff = (y - (parseInt(r.ano)||y)) * 12 + (m - (parseInt(r.mes)||m));
                let p = parseInt(r.parcelas) || 0;
                if (diff >= 0 && (p === 0 || diff < p)) {
                    let v = parseFloat(r.valor) || 0;
                    if (r.tipo === 'entrada') {
                        entM += v;
                        entDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">+ 🔁 ${escapeHTML(r.desc)}: <b>${formatarMoeda(v)}</b></div>`;
                    } else {
                        gasM += v;
                        gasDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">- 🔁 ${escapeHTML(r.desc)}: <b>${formatarMoeda(v)}</b></div>`;
                    }
                }
            });

            investimentos.forEach(i => {
                if (parseInt(i.ano) === y && parseInt(i.mes) === m) {
                    let v = parseFloat(i.valor) || 0;
                    gasM += v;
                    gasDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">🪙 ${escapeHTML(i.desc)}: <b>${formatarMoeda(v)}</b></div>`;
                }
            });

            dividas.forEach(d => {
                let diff = (y - (parseInt(d.ano)||y)) * 12 + (m - (parseInt(d.mes)||m));
                let p = parseInt(d.parcelas) || 1;
                
                if (diff >= 0 && diff < p) {
                    let numParc = diff + 1;
                    if (d.quitadas && d.quitadas.includes(numParc)) {
                        let vParc = (parseFloat(d.valor) || 0) / p;
                        if (d.tipo === 'credito') {
                            entM += vParc;
                            entDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">+ Recebido (${escapeHTML(d.pessoa)}): <b>${formatarMoeda(vParc)}</b></div>`;
                        } else {
                            gasM += vParc;
                            gasDetalhes += `<div style="padding:3px 0; border-bottom:1px solid #eee;">- Pago (${escapeHTML(d.pessoa)}): <b>${formatarMoeda(vParc)}</b></div>`;
                        }
                    }
                }
            });
            
            let s = entM - gasM;

            if (!isMesFuturo) {
                caixaAcumuladoTotal += s;
            }

            if (isMesAtual) {
                dashEntradas = entM; dashSaidas = gasM;
                document.getElementById('dashSaldo').innerText = formatarMoeda(caixaAcumuladoTotal);
                document.getElementById('dashEntradas').innerText = formatarMoeda(dashEntradas);
                document.getElementById('dashSaidas').innerText = formatarMoeda(dashSaidas);
            }

            let renderMin = new Date(currY - 1, currM, 1);
            let renderMax = new Date(currY + 2, currM, 1);
            
            if (iterDate >= renderMin && iterDate <= renderMax) {
                let mesNome = iterDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
                let colorS = s >= 0 ? 'var(--color-green)' : 'var(--color-red)';
                let colorC = caixaAcumuladoTotal >= 0 ? 'var(--color-blue)' : 'var(--color-red)';
                
                let tdEntrada = entDetalhes 
                    ? `<details><summary style="color:var(--color-green); font-weight:bold;">${formatarMoeda(entM)}</summary><div style="font-size:12px; color:var(--text-muted); margin-top:5px; font-weight:normal; line-height:1.4;">${entDetalhes}</div></details>` 
                    : `<span style="color:var(--color-green);">${formatarMoeda(entM)}</span>`;
                    
                let tdSaida = gasDetalhes 
                    ? `<details><summary style="color:var(--color-red); font-weight:bold;">${formatarMoeda(gasM)}</summary><div style="font-size:12px; color:var(--text-muted); margin-top:5px; font-weight:normal; line-height:1.4;">${gasDetalhes}</div></details>` 
                    : `<span style="color:var(--color-red);">${formatarMoeda(gasM)}</span>`;

                let tr = `<tr>
                    <td style="vertical-align:top;"><strong>${mesNome}</strong></td>
                    <td style="vertical-align:top;">${tdEntrada}</td>
                    <td style="vertical-align:top;">${tdSaida}</td>
                    <td style="color:${colorS}; vertical-align:top;"><strong>${formatarMoeda(s)}</strong></td>
                    <td style="color:${colorC}; font-weight:700; vertical-align:top;">${formatarMoeda(caixaAcumuladoTotal)}</td>
                </tr>`;
                if (iterDate >= new Date(currY, currM, 1)) { if(tbodyProj) tbodyProj.innerHTML += tr; } 
                else { if(tbodyAnt) tbodyAnt.innerHTML = tr + tbodyAnt.innerHTML; }
            }
            iterDate.setMonth(iterDate.getMonth() + 1);
        }
        renderHist(); 
    } catch (e) {
        console.error("ERRO CYT:", e);
    }
}

function renderHist() {
    try {
        let busca = document.getElementById('searchBar');
        let termo = busca ? String(busca.value || '').toLowerCase() : '';
        let histBox = document.getElementById('hist');
        if (!histBox) return;
        histBox.innerHTML = '';
        
        let unificado = [];
        
        entradas.forEach((item, i) => { 
            let descSafe = String(item.desc || 'Sem Nome').toLowerCase();
            let valSafe = String(item.valor || 0);
            if(descSafe.includes(termo) || valSafe.includes(termo)) {
                unificado.push({ ...item, type: 'ent', index: i, time: new Date(Number(item.ano)||0, Number(item.mes)||0, Number(item.dia)||1).getTime() }); 
            }
        });
        
        gastos.forEach((item, i) => {
            let descSafe = String(item.desc || 'Sem Nome').toLowerCase();
            let valSafe = String(item.valor || 0);
            if(descSafe.includes(termo) || valSafe.includes(termo)) {
                let anoVal = item.anoBase !== undefined ? item.anoBase : item.ano;
                let mesVal = item.mesBase !== undefined ? item.mesBase : item.mes;
                unificado.push({ ...item, type: 'gas', index: i, time: new Date(Number(anoVal)||0, Number(mesVal)||0, Number(item.dia)||1).getTime(), valAno: anoVal, valMes: mesVal });
            }
        });
        
        recorrentes.forEach((item, i) => { 
            let descSafe = String(item.desc || 'Sem Nome').toLowerCase();
            let valSafe = String(item.valor || 0);
            if(descSafe.includes(termo) || valSafe.includes(termo)) {
                unificado.push({ ...item, type: 'rec', index: i, time: new Date(Number(item.ano)||0, Number(item.mes)||0, Number(item.dia)||1).getTime() }); 
            }
        });

        unificado.sort((a, b) => b.time - a.time);

        let hoje = new Date();
        let currY = hoje.getFullYear();
        let currM = hoje.getMonth();

        if (unificado.length === 0) {
            histBox.innerHTML = '<p style="color:var(--text-muted)">Nenhum resultado.</p>';
            return;
        }

        unificado.forEach(item => {
            let anoReal = Number(item.valAno !== undefined ? item.valAno : item.ano) || 0;
            let mesReal = Number(item.valMes !== undefined ? item.valMes : item.mes) || 0;
            
            let mesesAtras = (currY - anoReal) * 12 + (currM - mesReal);
            
            let isRecorrenteLongo = item.type === 'rec' && (item.parcelas === 0 || item.parcelas > mesesAtras);
            let isParceladoLongo = item.type === 'gas' && item.parcelas > mesesAtras;
            let ativoNoPresente = (isRecorrenteLongo || isParceladoLongo) && mesesAtras >= 0;

            let cor = (item.type === 'ent' || (item.type === 'rec' && item.tipo === 'entrada')) ? 'var(--color-green)' : 'var(--color-red)';
            let sinal = cor === 'var(--color-green)' ? '+' : '-';
            
            let parcInfo = '';
            if (item.type === 'gas' && item.parcelas > 1) {
                let parcAtual = mesesAtras + 1;
                if (parcAtual < 1) parcAtual = 1; 
                if (parcAtual > item.parcelas) {
                    parcInfo = ` (Finalizado ${item.parcelas}/${item.parcelas}x)`;
                } else {
                    parcInfo = ` (Mês ${parcAtual}/${item.parcelas})`;
                }
            }
            if (item.type === 'rec') parcInfo = item.parcelas > 0 ? ` (Até ${item.parcelas}m)` : ' (♾️)';

            let btnAcao = '';
            
            // BOTÕES COM ESTILO INLINE RETORNADO PARA FICAREM PEQUENOS E COMPACTOS
            if (ativoNoPresente && mesesAtras >= 1) {
                btnAcao += `<button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarDaquiPraFrente('${item.type}', ${item.index})">✏️ Edita p/ Frente</button>`;
                btnAcao += `<button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarDaquiPraFrente('${item.type}', ${item.index})">🗑️ Anula p/ Frente</button>`;
            }
            
            btnAcao += `<button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistroGeral('${item.type}', ${item.index})">✏️ Editar Total</button>`;
            btnAcao += `<button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('${item.type}', ${item.index})">🗑️ Excluir Total</button>`;

            histBox.innerHTML += `<div class="item-lista">
                <span style="color:${cor}">${sinal} [${formatarDataBR(anoReal, mesReal, item.dia)}] ${escapeHTML(item.desc)}${parcInfo}: ${formatarMoeda(item.valor)}</span>
                <div class="botoes-container">${btnAcao}</div>
            </div>`;
        });
    } catch (e) {
        console.error("ERRO CYT AUDITORIA:", e);
        document.getElementById('hist').innerHTML = `<p style="color:var(--color-red); font-size:12px;">Modo Debug: Erro ao ler histórico. ${e.message}</p>`;
    }
}

// --- LÓGICAS DE EDIÇÃO E EXCLUSÃO ---
async function editarRegistroGeral(tipo, index) {
    let arr = tipo === 'ent' ? entradas : tipo === 'gas' ? gastos : recorrentes;
    let item = arr[index];
    let novoDesc = await Modal.prompt("Editar Descrição (Nome do registro):", item.desc);
    if (!novoDesc) return;
    let novoValorStr = await Modal.prompt("Editar Valor Total original:", item.valor.toString());
    if (!novoValorStr) return;
    let novoValor = normVal(novoValorStr);
    
    item.desc = novoDesc;
    item.valor = novoValor;
    localStorage.setItem(tipo, JSON.stringify(arr));
    render();
}

async function editarDaquiPraFrente(tipo, index) {
    let arr = tipo === 'gas' ? gastos : recorrentes;
    let item = arr[index];
    
    let novoDesc = await Modal.prompt("Editar Descrição (Para os próximos meses):", item.desc);
    if (!novoDesc) return;
    let novoValorStr = await Modal.prompt("Editar Valor (Para os próximos meses):", item.valor.toString());
    if (!novoValorStr) return;
    let novoValor = normVal(novoValorStr);
    if (!novoValor) return;

    let hoje = new Date();
    let baseAno = item.anoBase !== undefined ? item.anoBase : item.ano;
    let baseMes = item.mesBase !== undefined ? item.mesBase : item.mes;
    let mesesPassados = (hoje.getFullYear() - baseAno) * 12 + (hoje.getMonth() - baseMes);

    let newItem = JSON.parse(JSON.stringify(item));
    newItem.desc = novoDesc;
    newItem.valor = novoValor;
    newItem.ano = hoje.getFullYear();
    newItem.mes = hoje.getMonth();
    if(newItem.anoBase !== undefined) newItem.anoBase = newItem.ano;
    if(newItem.mesBase !== undefined) newItem.mesBase = newItem.mes;
    newItem.quitadas = [];
    
    if (item.parcelas > 0) {
        newItem.parcelas = item.parcelas - mesesPassados;
        if(newItem.parcelas <= 0) newItem.parcelas = 1;
    }
    
    if (mesesPassados <= 0) {
        item.desc = novoDesc;
        item.valor = novoValor;
    } else {
        item.parcelas = mesesPassados;
        arr.push(newItem);
    }
    
    localStorage.setItem(tipo, JSON.stringify(arr));
    render();
    if(tipo === 'rec' && document.getElementById('boxGerenciarSalarios')) renderGerenciarSalarios();
}

async function apagarDaquiPraFrente(tipo, index) {
    if (!await Modal.confirm("Anular os lançamentos daqui pra frente? (Isso preservará o passado nos seus relatórios antigos).")) return;
    let arr = tipo === 'gas' ? gastos : recorrentes;
    let item = arr[index];
    let hoje = new Date();
    let baseAno = item.anoBase !== undefined ? item.anoBase : item.ano;
    let baseMes = item.mesBase !== undefined ? item.mesBase : item.mes;
    let mesesPassados = (hoje.getFullYear() - baseAno) * 12 + (hoje.getMonth() - baseMes);
    
    if (mesesPassados <= 0) {
        arr.splice(index, 1);
    } else {
        item.parcelas = mesesPassados;
    }
    localStorage.setItem(tipo, JSON.stringify(arr));
    render();
    if(tipo === 'rec' && document.getElementById('boxGerenciarSalarios')) renderGerenciarSalarios();
}

async function apagarRegistro(tipo, index) {
    if (!await Modal.confirm("Excluir permanentemente toda a raiz deste registro?")) return;
    
    if (tipo === 'ent') { entradas.splice(index, 1); localStorage.setItem('ent', JSON.stringify(entradas)); }
    if (tipo === 'gas') { gastos.splice(index, 1); localStorage.setItem('gas', JSON.stringify(gastos)); }
    if (tipo === 'rec') { recorrentes.splice(index, 1); localStorage.setItem('rec', JSON.stringify(recorrentes)); }
    if (tipo === 'inv') { investimentos.splice(index, 1); localStorage.setItem('inv', JSON.stringify(investimentos)); }
    if (tipo === 'div') { dividas.splice(index, 1); localStorage.setItem('div', JSON.stringify(dividas)); }
    
    render();
}

// --- GRÁFICOS ---
function desenharGrafico() {
    if(typeof Chart === 'undefined') return;
    const ctxMes = document.getElementById('graficoMes');
    const ctxRosca = document.getElementById('graficoRosca');
    if(!ctxMes || !ctxRosca) return;

    const container = ctxMes.parentElement;
    container.style.display = 'flex'; 
    container.style.flexDirection = 'row'; 
    container.style.flexWrap = 'nowrap'; 
    container.style.gap = '20px';
    container.style.justifyContent = 'center'; 
    container.style.alignItems = 'center';
    container.style.width = '100%';
    container.style.overflowX = 'auto'; 
    
    ctxMes.style.flex = '1 1 50%'; 
    ctxMes.style.minWidth = '250px';
    ctxMes.style.maxHeight = '250px';

    ctxRosca.style.flex = '1 1 50%'; 
    ctxRosca.style.minWidth = '250px';
    ctxRosca.style.maxHeight = '250px';

    if(meuGrafico) meuGrafico.destroy();
    if(meuGraficoRosca) meuGraficoRosca.destroy();

    let hoje = new Date(); let m = hoje.getMonth(); let y = hoje.getFullYear();
    let entM = 0; let gasM = 0;
    
    entradas.forEach(e => { if(parseInt(e.ano) === y && parseInt(e.mes) === m) entM += parseFloat(e.valor)||0; });
    
    let categorias = {};
    gastos.forEach(g => { 
        let gY = parseInt(g.anoBase !== undefined ? g.anoBase : g.ano) || y;
        let gM = parseInt(g.mesBase !== undefined ? g.mesBase : g.mes) || m;
        let diff = (y - gY) * 12 + (m - gM);
        let p = parseInt(g.parcelas) || 1;
        if (diff >= 0 && diff < p && (!g.quitadas || !g.quitadas.includes(diff+1))) {
            let valor = (parseFloat(g.valor)||0) / p;
            gasM += valor;
            let cat = g.categoria || 'Outros';
            categorias[cat] = (categorias[cat] || 0) + valor;
        }
    });
    
    recorrentes.forEach(r => {
        let diff = (y - (parseInt(r.ano)||y)) * 12 + (m - (parseInt(r.mes)||m));
        let p = parseInt(r.parcelas) || 0;
        if (diff >= 0 && (p === 0 || diff < p)) {
            let val = parseFloat(r.valor)||0;
            if (r.tipo === 'entrada') { entM += val; } 
            else { gasM += val; categorias['Recorrente'] = (categorias['Recorrente'] || 0) + val; }
        }
    });

    meuGrafico = new Chart(ctxMes, {
        type: 'bar',
        data: { labels: ['Entradas', 'Saídas'], datasets: [{ label: 'Mês Atual', data: [entM, gasM], backgroundColor: ['#10b981', '#ef4444'] }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    meuGraficoRosca = new Chart(ctxRosca, {
        type: 'doughnut',
        data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias), backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#64748b', '#ea580c'] }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });
}

// --- SECUNDÁRIAS ---
async function confirmarPagamentoDivida(index, parcelaAtual) {
    if (!await Modal.confirm(`Confirmar que a parcela/fatura atual (Mês ${parcelaAtual}) foi concluída? O valor entrará no seu fluxo de caixa.`)) return;
    
    let d = dividas[index];
    d.quitadas = d.quitadas || [];
    
    if (!d.quitadas.includes(parcelaAtual)) {
        d.quitadas.push(parcelaAtual);
    }
    
    let p = parseInt(d.parcelas) || 1;
    if (d.quitadas.length >= p) {
        d.status = 'pago'; 
    }
    
    localStorage.setItem('div', JSON.stringify(dividas));
    render();
}

function renderCartoesSelect() {
    let sel = document.getElementById('cartaoGasto');
    if (sel) {
        sel.innerHTML = '<option value="">Sem Cartão</option>';
        cartoes.forEach(c => sel.innerHTML += `<option value="${escapeHTML(c.nome)}">${escapeHTML(c.nome)}</option>`);
    }
}

function addCartaoPerfil() {
    let n = document.getElementById('novoCartaoNome').value.trim();
    if (!n) return;
    cartoes.push({ nome: n, fechamento: 31, digitos: '' }); localStorage.setItem('crt', JSON.stringify(cartoes));
    renderCartoesSelect();
}

function gerarBackup() {
    const dados = { ent: localStorage.getItem('ent') || "[]", gas: localStorage.getItem('gas') || "[]", rec: localStorage.getItem('rec') || "[]", inv: localStorage.getItem('inv') || "[]", div: localStorage.getItem('div') || "[]", crt: localStorage.getItem('crt') || "[]", perfil: localStorage.getItem('perfil') || "{}", log: localStorage.getItem('log') || "[]" };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Backup_CYT.json`; a.click(); URL.revokeObjectURL(a.href);
    log(`BACKUP GERADO`); finalizarAcaoForm();
}

async function carregarBackup(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            ['ent', 'gas', 'rec', 'inv', 'div', 'crt', 'perfil', 'log'].forEach(chave => { if (d[chave]) localStorage.setItem(chave, typeof d[chave] === 'string' ? d[chave] : JSON.stringify(d[chave])); });
            await Modal.alert("✅ Backup restaurado! A página será recarregada."); location.reload();
        } catch (err) { await Modal.alert("❌ ERRO: Arquivo inválido."); }
    };
    reader.readAsText(file);
}

function processarImpressao() { window.print(); }
async function confirmarZerar() { if(await Modal.confirm("Atenção: Isso vai limpar TODO O SISTEMA. Deseja continuar?")) { localStorage.clear(); location.reload(); } }

window.onload = init;
