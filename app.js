// --- DADOS BASE ---
let entradas = JSON.parse(localStorage.getItem('ent')) || [];
let gastos = JSON.parse(localStorage.getItem('gas')) || [];
let recorrentes = JSON.parse(localStorage.getItem('rec')) || [];
let investimentos = JSON.parse(localStorage.getItem('inv')) || [];
let dividas = JSON.parse(localStorage.getItem('div')) || [];
let cartoesTemp = JSON.parse(localStorage.getItem('crt')) || [];
let cartoes = cartoesTemp.map(c => {
    if (typeof c === 'string') return { n: c, f: 31, d: '' };
    if (!c.d) c.d = ''; 
    return c;
});
localStorage.setItem('crt', JSON.stringify(cartoes));
let logs = JSON.parse(localStorage.getItem('log')) || [];
let perfil = JSON.parse(localStorage.getItem('perfil')) || { nome: '', tel: '' };
let meuGrafico = null;
let meuGraficoRosca = null;

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

            titleEl.innerHTML = title.replace(/\n/g, '<br>');
            
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
        desenharGrafico();
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
        if (id === 'tabGrafico') desenharGrafico();
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
    if(box) box.innerHTML = logs.join('<br>');
}

// --- SALVAMENTOS ASSÍNCRONOS ---
function mudarTipoGasto(val) { document.getElementById('pBox').className = val === 'p' ? '' : 'escondido'; }

async function salvarGasto() {
    const v = normVal(document.getElementById('valorGasto').value);
    const pInput = document.getElementById('parcelasGasto').value;
    const isCard = document.getElementById('tipoGasto').value === 'p';
    const cat = document.getElementById('catGasto').value; // Categoria Capturada
    const p = isCard ? parseInt(pInput) : 1;
    const cartao = isCard ? document.getElementById('cartaoGasto').value : '';
    const desc = document.getElementById('descGasto').value;
    if (!v || !desc) return await Modal.alert("Preencha o valor e a descrição.");
    const d = normData(document.getElementById('dataGasto').value);
    let yFirst = parseInt(d[0]); let mFirst = parseInt(d[1]) - 1; let diaVal = parseInt(d[2]);
    if (isCard && cartao) {
        let cartaoObj = cartoes.find(c => c.n === cartao);
        if (cartaoObj && diaVal >= cartaoObj.f) { mFirst += 1; if (mFirst > 11) { mFirst = 0; yFirst += 1; } }
    }
    gastos.push({ desc, v, p, c: cartao, cat: cat, dia: diaVal, y: yFirst, m: mFirst, yBase: parseInt(d[0]), mBase: parseInt(d[1]) - 1, quitadas: [] });
    localStorage.setItem('gas', JSON.stringify(gastos));
    log(`GASTO: ${desc} - ${formatarMoeda(v)}`);
    location.reload();
}

async function salvarEntrada(tipo) {
    const isSalario = tipo === 'salario';
    const v = normVal(document.getElementById(isSalario ? 'valorSalario' : 'valorRenda').value);
    const desc = isSalario ? document.getElementById('descSalario').value : document.getElementById('descRenda').value;
    if (!v || !desc) return await Modal.alert("Preencha os dados.");
    const d = normData(document.getElementById(isSalario ? 'dataSalario' : 'dataRenda').value);
    entradas.push({ tipo, desc, v, y: parseInt(d[0]), m: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('ent', JSON.stringify(entradas));
    location.reload();
}

async function salvarRecorrente() {
    const v = normVal(document.getElementById('valorRec').value);
    const desc = document.getElementById('descRec').value;
    const pInput = document.getElementById('limiteRec').value;
    const p = pInput ? parseInt(pInput) : 0; 
    if (!v || !desc) return await Modal.alert("Preencha os dados.");
    const d = normData(document.getElementById('dataRec').value);
    recorrentes.push({ desc, v, p, y: parseInt(d[0]), m: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('rec', JSON.stringify(recorrentes));
    location.reload();
}

async function salvarInvestimento() {
    const v = normVal(document.getElementById('valorInv').value);
    const desc = document.getElementById('descInv').value;
    const cat = document.getElementById('catInv').value;
    if (!v || !desc) return await Modal.alert("Preencha valor e descrição.");
    const d = normData(document.getElementById('dataInv').value);
    investimentos.push({ desc, cat, v, y: parseInt(d[0]), m: parseInt(d[1]) - 1, dia: parseInt(d[2]) });
    localStorage.setItem('inv', JSON.stringify(investimentos));
    log(`INVESTIMENTO: ${desc} - ${formatarMoeda(v)}`);
    location.reload();
}

async function salvarDivida() {
    const tipo = document.getElementById('tipoDivida').value;
    const pessoa = document.getElementById('pessoaDivida').value;
    const v = normVal(document.getElementById('valorDivida').value);
    const parc = parseInt(document.getElementById('parcelasDivida').value) || 1;
    const desc = document.getElementById('descDivida').value;
    if (!v || !pessoa) return await Modal.alert("Preencha valor e pessoa.");
    const d = normData(document.getElementById('dataDivida').value);
    dividas.push({ tipo, pessoa, desc, v, p: parc, y: parseInt(d[0]), m: parseInt(d[1]) - 1, dia: parseInt(d[2]), status: 'pendente' });
    localStorage.setItem('div', JSON.stringify(dividas));
    location.reload();
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

    let novoValor = await Modal.prompt("Editar Valor Total:", item.v.toFixed(2));
    if (novoValor === null) return;

    let yB = item.yBase !== undefined ? item.yBase : item.y;
    let mB = item.mBase !== undefined ? item.mBase : item.m;
    let dataAtual = `${yB}-${String(mB + 1).padStart(2, '0')}-${String(item.dia).padStart(2, '0')}`;
    let novaData = await Modal.prompt("Editar Data (YYYY-MM-DD):", dataAtual);

    item.desc = novoDesc.trim() || item.desc;
    item.v = normVal(novoValor) || item.v;

    if (novaData && novaData !== dataAtual) {
        let d = normData(novaData);
        let nY = parseInt(d[0]);
        let nM = parseInt(d[1]) - 1;
        let nD = parseInt(d[2]);

        if(item.yBase !== undefined) {
            item.yBase = nY;
            item.mBase = nM;
            if(item.c && item.p > 0) { 
                let cartaoObj = cartoes.find(c => c.n === item.c);
                let yFirst = nY; let mFirst = nM;
                if (cartaoObj && nD >= cartaoObj.f) { mFirst += 1; if (mFirst > 11) { mFirst = 0; yFirst += 1; } }
                item.y = yFirst; item.m = mFirst; item.dia = nD;
            } else {
                item.y = nY; item.m = nM; item.dia = nD;
            }
        } else {
            item.y = nY; item.m = nM; item.dia = nD;
        }
    }
    
    localStorage.setItem(storageKey, JSON.stringify(arr));
    log(`EDIÇÃO: Registro alterado com sucesso.`);
    location.reload();
}

async function processarPagamento(index) {
    const g = gastos[index];
    let hoje = new Date();

    if (g.p <= 1) {
        let vPago = normVal(await Modal.prompt(`Saldo: ${formatarMoeda(g.v)}\nQual valor você pagou hoje?`, g.v.toFixed(2)));
        if (vPago <= 0) return;
        gastos.push({ desc: `[Quitação] ${g.desc}`, v: vPago, p: 1, c: '', cat: g.cat, y: hoje.getFullYear(), m: hoje.getMonth(), dia: hoje.getDate(), yBase: hoje.getFullYear(), mBase: hoje.getMonth(), quitadas: [] });
        if (g.v - vPago <= 0) gastos.splice(index, 1);
        else g.v -= vPago;
    } else {
        g.quitadas = g.quitadas || [];
        let vParc = g.v / g.p;
        
        let acao = await Modal.prompt(`ALVO: ${g.desc}\n\n[1] ANTECIPAR MÊS (Sai do Caixa)\n[2] APAGAR MÊS (Isentar)\n[3] AMORTIZAR GERAL\n\nDigite 1, 2 ou 3:`, "");

        if (acao === '1' || acao === '2') {
            let listaTexto = "";
            let parcelasValidas = [];
            let baseY = g.yBase !== undefined ? g.yBase : g.y;
            let baseM = g.mBase !== undefined ? g.mBase : g.m;

            for (let i = 1; i <= g.p; i++) {
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
                gastos.push({ desc: `[Antecipou Parc. ${parcelasSelecionadas.join(',')}] ${g.desc}`, v: vPago, p: 1, c: '', cat: g.cat, y: hoje.getFullYear(), m: hoje.getMonth(), dia: hoje.getDate(), yBase: hoje.getFullYear(), mBase: hoje.getMonth(), quitadas: [] });
            } else {
                let confirma = await Modal.confirm(`Anular permanentemente as parcelas: ${parcelasSelecionadas.join(', ')}?\nO caixa atual NÃO será afetado.`);
                if (!confirma) return;
            }

            g.quitadas.push(...parcelasSelecionadas);
        } else if (acao === '3') {
            let vPago = normVal(await Modal.prompt(`Saldo restante: ${formatarMoeda(g.v)}\nInjetar hoje para abater:`, g.v.toFixed(2)));
            if (vPago <= 0) return;
            gastos.push({ desc: `[Amortizou] ${g.desc}`, v: vPago, p: 1, c: '', cat: g.cat, y: hoje.getFullYear(), m: hoje.getMonth(), dia: hoje.getDate(), yBase: hoje.getFullYear(), mBase: hoje.getMonth(), quitadas: [] });
            if (g.v - vPago <= 0) gastos.splice(index, 1);
            else g.v -= vPago;
        } else {
            return;
        }
    }
    
    localStorage.setItem('gas', JSON.stringify(gastos));
    location.reload();
}

async function apagarRegistro(tipoArray, index) {
    if (!await Modal.confirm("Excluir permanentemente este registro em todas as instâncias?")) return;
    if (tipoArray === 'ent') { entradas.splice(index, 1); localStorage.setItem('ent', JSON.stringify(entradas)); }
    if (tipoArray === 'gas') { gastos.splice(index, 1); localStorage.setItem('gas', JSON.stringify(gastos)); }
    if (tipoArray === 'rec') { recorrentes.splice(index, 1); localStorage.setItem('rec', JSON.stringify(recorrentes)); }
    if (tipoArray === 'inv') { investimentos.splice(index, 1); localStorage.setItem('inv', JSON.stringify(investimentos)); }
    if (tipoArray === 'div') { dividas.splice(index, 1); localStorage.setItem('div', JSON.stringify(dividas)); }
    location.reload();
}

async function confirmarPagamentoDivida(index) {
    if (!await Modal.confirm("Confirmar entrada/saída de caixa HOJE?")) return;
    let hoje = new Date();
    dividas[index].status = 'pago';
    dividas[index].y = hoje.getFullYear();
    dividas[index].m = hoje.getMonth();
    dividas[index].dia = hoje.getDate();
    localStorage.setItem('div', JSON.stringify(dividas));
    log(`PAGAMENTO CONFIRMADO: ${dividas[index].desc}`);
    location.reload();
}

function renderCartoesSelect() {
    let inNome = document.getElementById('perfilNome');
    let inTel = document.getElementById('perfilTel');
    if (inNome && perfil.nome) inNome.value = perfil.nome;
    if (inTel && perfil.tel) inTel.value = perfil.tel;
    
    let sel = document.getElementById('cartaoGasto');
    if (sel) {
        sel.innerHTML = '<option value="">Sem Cartão / Outros</option>';
        cartoes.forEach(c => sel.innerHTML += `<option value="${c.n}">${c.n} (Fecha dia ${c.f})</option>`);
    }
    let lista = document.getElementById('listaCartoesPerfil');
    if (!lista) return;
    let html = '';
    cartoes.forEach((c, index) => {
        html += `<div style="display:flex; justify-content:space-between; padding:10px; border:1px solid var(--border-color); margin-bottom:8px;">
            <span><strong>${c.n}</strong> (Final ${c.d} | Dia ${c.f})</span>
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
    cartoes.push({ n, f, d }); localStorage.setItem('crt', JSON.stringify(cartoes));
    document.getElementById('novoCartaoNome').value = ''; document.getElementById('novoCartaoDigitos').value = ''; document.getElementById('novoCartaoFechamento').value = '';
    renderCartoesSelect();
}

function renderListasExtras() {
    let boxInv = document.getElementById('invGrid');
    if(boxInv) {
        let h = '';
        investimentos.forEach((i, idx) => {
            h += `<div class="item-lista"><span>[${formatarDataBR(i.y, i.m, i.dia)}] 🪙 ${i.desc} - ${formatarMoeda(i.v)}</span>
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
                <span style="color:${cor};"><strong>${titulo}: ${d.pessoa}</strong> - ${formatarMoeda(d.v)} ${txtStatus}<br><small>${d.desc}</small></span>
                <div style="display:flex;">
                    ${btnConfirmar}
                    <button class="btn-submit red" style="width:auto;padding:6px 12px;font-size:11px;" onclick="apagarRegistro('div', ${idx})">🗑️ Excluir</button>
                </div>
            </div>`;
        });
        boxDiv.innerHTML = h || '<p style="color:var(--text-muted); font-size:13px;">Nenhum registro pendente.</p>';
    }
}

// --- O MOTOR CENTRAL (C/ DASHBOARD) ---
function render() {
    renderListasExtras();
    const isMobile = window.innerWidth < 480;
    
    let tbodyProj = document.querySelector('#tabProj tbody');
    let tbodyAnt = document.querySelector('#tbodyAnt');
    if (tbodyProj) tbodyProj.innerHTML = '';
    if (tbodyAnt) tbodyAnt.innerHTML = '';

    let hoje = new Date();
    let dataMinima = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    [...entradas, ...gastos, ...recorrentes, ...investimentos, ...dividas].forEach(item => {
        let d = new Date(item.y, item.m, 1);
        if (d < dataMinima) dataMinima = d;
    });

    let caixaAcumuladoTotal = 0;
    let iterDate = new Date(dataMinima);
    let dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 24, 1);

    // Variáveis do Dashboard (Mês Atual)
    let dashEntradas = 0;
    let dashSaidas = 0;

    while (iterDate < dataFim) {
        let y = iterDate.getFullYear();
        let m = iterDate.getMonth();
        let isMesAtual = (y === hoje.getFullYear() && m === hoje.getMonth());

        let entM = 0; let detalhesEntHTML = '';
        let gasM = 0; let detalhesGasHTML = '';

        entradas.forEach(e => {
            if (e.m === m && e.y === y) {
                entM += e.v;
                detalhesEntHTML += `<div class="detalhe-linha">+ Dia ${e.dia}: ${e.desc} (${formatarMoeda(e.v)})</div>`;
            }
        });

        gastos.forEach(g => {
            let diff = (y - g.y) * 12 + (m - g.m);
            if (diff >= 0 && diff < g.p) {
                let numParc = diff + 1;
                let vParc = g.v / g.p;
                
                if (g.quitadas && g.quitadas.includes(numParc)) {
                    detalhesGasHTML += `<div class="detalhe-linha" style="text-decoration:line-through; color:var(--text-muted);">- Dia ${g.dia}: ${g.desc} (${numParc}/${g.p}) [ISENTADA/PAGA]</div>`;
                } else {
                    gasM += vParc;
                    let infoParc = g.p > 1 ? ` (${numParc}/${g.p})` : '';
                    detalhesGasHTML += `<div class="detalhe-linha">- Dia ${g.dia}: ${g.desc} ${infoParc} (${formatarMoeda(vParc)})</div>`;
                }
            }
        });

        recorrentes.forEach(r => {
            let diff = (y - r.y) * 12 + (m - r.m);
            if (diff >= 0 && (!r.p || diff < r.p)) {
                gasM += r.v;
                let infoP = r.p ? ` (${diff + 1}/${r.p})` : '';
                detalhesGasHTML += `<div class="detalhe-linha">- Dia ${r.dia}: [Fixo] ${r.desc}${infoP} (${formatarMoeda(r.v)})</div>`;
            }
        });

        investimentos.forEach(i => {
            if (i.y === y && i.m === m) {
                gasM += i.v;
                detalhesGasHTML += `<div class="detalhe-linha">- Dia ${i.dia}: [Investimento] ${i.desc} (${formatarMoeda(i.v)})</div>`;
            }
        });

        dividas.forEach(d => {
            if (d.status === 'pago') {
                let diff = (y - d.y) * 12 + (m - d.m);
                if (diff >= 0 && diff < d.p) {
                    let vParc = d.v / d.p;
                    let infoParc = d.p > 1 ? ` (${diff + 1}/${d.p})` : '';
                    if (d.tipo === 'credito') {
                        entM += vParc;
                        detalhesEntHTML += `<div class="detalhe-linha">+ Dia ${d.dia}: [Recebido] ${d.pessoa}${infoParc} (${formatarMoeda(vParc)})</div>`;
                    } else {
                        gasM += vParc;
                        detalhesGasHTML += `<div class="detalhe-linha">- Dia ${d.dia}: [Pago] ${d.pessoa}${infoParc} (${formatarMoeda(vParc)})</div>`;
                    }
                }
            }
        });

        if (isMobile && entM === 0 && gasM === 0) {
            iterDate.setMonth(iterDate.getMonth() + 1);
            continue;
        }

        let s = entM - gasM;
        caixaAcumuladoTotal += s;

        // Alimentar Dashboard
        if (isMesAtual) {
            dashEntradas = entM;
            dashSaidas = gasM;
            document.getElementById('dashSaldo').innerText = formatarMoeda(caixaAcumuladoTotal);
            document.getElementById('dashEntradas').innerText = formatarMoeda(dashEntradas);
            document.getElementById('dashSaidas').innerText = formatarMoeda(dashSaidas);
            
            // Cor do Saldo
            document.getElementById('dashSaldo').className = caixaAcumuladoTotal < 0 ? 'red' : 'blue';
        }

        let corS = s < 0 ? 'var(--color-red)' : 'var(--color-green)';
        let corC = caixaAcumuladoTotal < 0 ? 'var(--color-red-strong)' : 'var(--color-green-strong)';

        let tdEnt = entM > 0 ? `<details style="margin:0;border:none;box-shadow:none;background:transparent;"><summary style="padding:0;color:var(--text-main);">${formatarMoeda(entM)}</summary><div>${detalhesEntHTML}</div></details>` : formatarMoeda(0);
        let tdGas = gasM > 0 ? `<details style="margin:0;border:none;box-shadow:none;background:transparent;"><summary style="padding:0;color:var(--color-red);">${formatarMoeda(gasM)}</summary><div>${detalhesGasHTML}</div></details>` : formatarMoeda(0);

        let trHTML = `<tr>
            <td style="text-transform:capitalize; font-weight: 700; line-height: 1.3;">
                ${iterDate.toLocaleString('pt-BR', { month: 'long' })}<br>
                <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">${iterDate.getFullYear()}</span>
            </td>
            <td>${tdEnt}</td>
            <td>${tdGas}</td>
            <td style="color:${corS}; font-weight: 700;">${formatarMoeda(s)}</td>
            <td style="color:${corC}; font-weight: 700;">${formatarMoeda(caixaAcumuladoTotal)}</td>
        </tr>`;

        if (iterDate < new Date(hoje.getFullYear(), hoje.getMonth(), 1)) {
            if (tbodyAnt) tbodyAnt.innerHTML += trHTML;
        } else {
            if (tbodyProj) tbodyProj.innerHTML += trHTML;
        }

        iterDate.setMonth(iterDate.getMonth() + 1);
    }
    
    let boxLogs = document.getElementById('logs');
    if(boxLogs) boxLogs.innerHTML = logs.join('<br>');
    renderHist();
}

function renderHist() {
    let busca = document.getElementById('searchBar');
    let termo = busca ? busca.value.toLowerCase() : '';
    let html = '';

    entradas.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.v.toString().includes(termo)) {
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:var(--color-green);">+ [${formatarDataBR(item.y, item.m, item.dia)}] ${item.desc}: ${formatarMoeda(item.v)}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('ent', ${i})">✏️ Editar</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('ent', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });

    gastos.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.v.toString().includes(termo)) {
            let parcInfo = item.p > 1 ? ` (${item.p}x)` : '';
            let quitadasInfo = (item.quitadas && item.quitadas.length > 0) ? ` <span style="font-size:11px; color:#f59e0b; font-weight:bold;">[Filtros Ativos nas Parc: ${item.quitadas.join(', ')}]</span>` : '';
            let catInfo = item.cat ? ` <span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:5px;">${item.cat}</span>` : '';
            let exibirBotaoPagar = (item.p > 1 && (!item.quitadas || item.quitadas.length < item.p));

            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:var(--color-red);">- [${formatarDataBR(item.yBase !== undefined ? item.yBase : item.y, item.mBase !== undefined ? item.mBase : item.m, item.dia)}] ${item.desc}${parcInfo}: ${formatarMoeda(item.v)}${catInfo}${quitadasInfo}</span>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('gas', ${i})">✏️ Editar</button>
                    ${exibirBotaoPagar ? `<button class="btn-submit green" style="width:auto;padding:4px 10px;font-size:11px;" onclick="processarPagamento(${i})">⚙️ Gerenciar Parcelas</button>` : ''}
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('gas', ${i})">🗑️ Excluir Base</button>
                </div>
            </div>`;
        }
    });

    recorrentes.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.v.toString().includes(termo)) {
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:var(--color-blue);">↻ [${formatarDataBR(item.y, item.m, item.dia)}] ${item.desc}: ${formatarMoeda(item.v)} /mês</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('rec', ${i})">✏️ Editar</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('rec', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });

    investimentos.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.v.toString().includes(termo)) {
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:#ea580c;">🪙 [${formatarDataBR(item.y, item.m, item.dia)}] ${item.desc}: ${formatarMoeda(item.v)}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('inv', ${i})">✏️ Editar</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('inv', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });

    dividas.forEach((item, i) => {
        if(item.desc.toLowerCase().includes(termo) || item.pessoa.toLowerCase().includes(termo) || item.v.toString().includes(termo)) {
            let cor = item.tipo === 'divida' ? 'var(--color-red)' : 'var(--color-green)';
            html += `<div class="item-lista" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <span style="color:${cor};">🤝 [${formatarDataBR(item.y, item.m, item.dia)}] ${item.pessoa} - ${item.desc}: ${formatarMoeda(item.v)}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-submit blue" style="width:auto;padding:4px 10px;font-size:11px;" onclick="editarRegistro('div', ${i})">✏️ Editar</button>
                    <button class="btn-submit red" style="width:auto;padding:4px 10px;font-size:11px;" onclick="apagarRegistro('div', ${i})">🗑️ Excluir</button>
                </div>
            </div>`;
        }
    });
    
    let box = document.getElementById('hist');
    if(box) box.innerHTML = html || '<p style="color:var(--text-muted);">Nenhum resultado.</p>';
}

// --- IMPRESSÃO BLINDADA ---
function processarImpressao() {
    let valInicio = document.getElementById('printInicio').value;
    let valFim = document.getElementById('printFim').value;
    if (!valInicio || !valFim) return alert("Selecione o período.");
    let dateInicio = new Date(valInicio + "-02");
    let dateFim = new Date(valFim + "-02");
    if (dateInicio > dateFim) return alert("A data Final deve ser maior que a Inicial.");
    if (((dateFim.getFullYear() - dateInicio.getFullYear()) * 12 + (dateFim.getMonth() - dateInicio.getMonth())) >= 12) return alert("Limite de 12 meses ultrapassado.");
    
    gerarHtmlImpressaoCustom(dateInicio, dateFim);
    setTimeout(() => { window.print(); }, 300);
}

function gerarHtmlImpressaoCustom(dateInicio, dateFim) {
    let area = document.getElementById('areaImpressao');
    let txtPeriodo = `${String(dateInicio.getMonth()+1).padStart(2,'0')}/${dateInicio.getFullYear()} a ${String(dateFim.getMonth()+1).padStart(2,'0')}/${dateFim.getFullYear()}`;
    
    let html = `
        <div style="font-family: sans-serif; color: #000; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="font-family: 'Playfair Display', serif; font-weight: 700; font-size: 32px; letter-spacing: 0.5px; background: linear-gradient(135deg, #c5a059 0%, #8c6222 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                    CYT Finance
                </div>
                <div style="text-align: right;">
                    <h2 style="font-size: 22px; margin: 0; color: #0f172a; text-transform: uppercase;">Relatório Estratégico</h2>
                    <p style="font-size: 14px; margin: 5px 0 0 0; color: #64748b; font-weight: 600;">Período Analisado: ${txtPeriodo}</p>
                </div>
            </div>
            
            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                <thead>
                    <tr>
                        <th style="border-bottom:2px solid #000; padding:8px;">MÊS/ANO</th>
                        <th style="border-bottom:2px solid #000; padding:8px;">ENTRADAS</th>
                        <th style="border-bottom:2px solid #000; padding:8px;">SAÍDAS</th>
                        <th style="border-bottom:2px solid #000; padding:8px;">RESULTADO</th>
                        <th style="border-bottom:2px solid #000; padding:8px;">CAIXA</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let dTemp = new Date(dateInicio.getFullYear(), dateInicio.getMonth(), 1);
    let dFinal = new Date(dateFim.getFullYear(), dateFim.getMonth(), 1);
    let mesesParaImprimir = [];
    while (dTemp <= dFinal) { mesesParaImprimir.push(new Date(dTemp)); dTemp.setMonth(dTemp.getMonth() + 1); }

    let caixaTotal = 0;
    let hoje = new Date();
    let dataMinima = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    [...entradas, ...gastos, ...recorrentes, ...investimentos, ...dividas].forEach(item => {
        let d = new Date(item.y, item.m, 1); if (d < dataMinima) dataMinima = d;
    });
    if (dateInicio < dataMinima) dataMinima = new Date(dateInicio.getFullYear(), dateInicio.getMonth(), 1);
    
    let iter = new Date(dataMinima);
    while (iter <= mesesParaImprimir[mesesParaImprimir.length - 1]) {
        let y = iter.getFullYear(); let m = iter.getMonth();
        let entM = 0; let gasM = 0;
        
        entradas.forEach(e => { if (e.y === y && e.m === m) entM += e.v; });
        gastos.forEach(g => { 
            let diff = (y - g.y)*12 + (m - g.m); 
            if(diff>=0 && diff<g.p) {
                let numParc = diff + 1;
                if (!g.quitadas || !g.quitadas.includes(numParc)) gasM += (g.v/g.p);
            } 
        });
        recorrentes.forEach(r => { let diff = (y - r.y)*12 + (m - r.m); if(diff>=0 && (!r.p || diff<r.p)) gasM += r.v; });
        investimentos.forEach(i => { if (i.y === y && i.m === m) gasM += i.v; });
        dividas.forEach(d => {
            if (d.status === 'pago') {
                let diff = (y - d.y)*12 + (m - d.m);
                if(diff>=0 && diff<d.p) { if(d.tipo==='credito') entM += (d.v/d.p); else gasM += (d.v/d.p); }
            }
        });

        let s = entM - gasM; caixaTotal += s;
        let isImprimir = mesesParaImprimir.some(d => d.getFullYear() === y && d.getMonth() === m);
        
        if (isImprimir) {
            html += `
                <tr>
                    <td style="border-bottom:1px solid #ccc; padding:8px; text-transform:capitalize; font-weight:600;">${iter.toLocaleString('pt-BR',{month:'short', year:'numeric'})}</td>
                    <td style="border-bottom:1px solid #ccc; padding:8px; color: #047857;">${formatarMoeda(entM)}</td>
                    <td style="border-bottom:1px solid #ccc; padding:8px; color: #b91c1c;">${formatarMoeda(gasM)}</td>
                    <td style="border-bottom:1px solid #ccc; padding:8px; font-weight:bold; color:${s<0?'#b91c1c':'#047857'}">${formatarMoeda(s)}</td>
                    <td style="border-bottom:1px solid #ccc; padding:8px; font-weight:bold;">${formatarMoeda(caixaTotal)}</td>
                </tr>
            `;
        }
        iter.setMonth(iter.getMonth() + 1);
    }
    html += `</tbody></table></div>`;
    area.innerHTML = html;
}

// --- GRÁFICOS (BARRAS + ROSCA) ---
function desenharGrafico() {
    const canvas = document.getElementById('graficoMes');
    const canvasRosca = document.getElementById('graficoRosca');
    if (!canvas || !canvasRosca) return;
    
    if (meuGrafico) meuGrafico.destroy();
    if (meuGraficoRosca) meuGraficoRosca.destroy();

    const seletor = document.getElementById('filtroGrafico');
    const tipo = seletor ? seletor.value : 'diario';
    
    let labels = []; let dataValues = []; let bgColors = [];
    const h = new Date(); const yH = h.getFullYear(); const mH = h.getMonth();

    // VARIÁVEIS PARA O GRÁFICO DE ROSCA (Apenas Mês Atual)
    let catTotals = { "Casa": 0, "Transporte": 0, "Alimentação": 0, "Saúde": 0, "Lazer": 0, "Educação": 0, "Outros": 0 };

    if (tipo === 'diario') {
        let dias = new Date(yH, mH + 1, 0).getDate();
        for (let i = 1; i <= dias; i++) {
            let eDia = 0; let gDia = 0;
            entradas.forEach(e => { if(e.y===yH && e.m===mH && e.dia===i) eDia+=e.v; });
            gastos.forEach(g => { 
                let diff = (yH - g.y)*12 + (mH - g.m); 
                if(diff>=0 && diff<g.p && g.dia===i) {
                    let numParc = diff + 1;
                    if (!g.quitadas || !g.quitadas.includes(numParc)) {
                        let valorParcela = (g.v/g.p);
                        gDia += valorParcela;
                        let cat = g.cat || "Outros";
                        if(catTotals[cat] !== undefined) catTotals[cat] += valorParcela; else catTotals["Outros"] += valorParcela;
                    }
                } 
            });
            recorrentes.forEach(r => { 
                let diff = (yH - r.y)*12 + (mH - r.m); 
                if(diff>=0 && (!r.p || diff<r.p) && r.dia===i) {
                    gDia += r.v;
                    catTotals["Outros"] += r.v; // Recorrentes entram em Outros por padrão
                } 
            });
            investimentos.forEach(inv => { if(inv.y===yH && inv.m===mH && inv.dia===i) gDia+=inv.v; });
            dividas.forEach(d => {
                if (d.status === 'pago') {
                    let diff = (yH - d.y)*12 + (mH - d.m);
                    if(diff>=0 && diff<d.p && d.dia===i) { 
                        let vP = (d.v/d.p);
                        if(d.tipo==='credito') eDia += vP; 
                        else { gDia += vP; catTotals["Outros"] += vP; }
                    }
                }
            });
            let saldo = eDia - gDia;
            labels.push(i.toString()); dataValues.push(saldo); bgColors.push(saldo >= 0 ? '#10b981' : '#ef4444');
        }
    } else {
        for (let i = 11; i >= 0; i--) {
            let d = new Date(yH, mH - i, 1);
            let yC = d.getFullYear(); let mC = d.getMonth();
            let eMes = 0; let gMes = 0;
            entradas.forEach(e => { if(e.y===yC && e.m===mC) eMes+=e.v; });
            gastos.forEach(g => { 
                let diff = (yC - g.y)*12 + (mC - g.m); 
                if(diff>=0 && diff<g.p) {
                    let numParc = diff + 1;
                    if (!g.quitadas || !g.quitadas.includes(numParc)) {
                        let valorParcela = (g.v/g.p);
                        gMes += valorParcela;
                        // Alimenta Rosca apenas se o loop estiver no mês atual
                        if(yC === yH && mC === mH) {
                            let cat = g.cat || "Outros";
                            if(catTotals[cat] !== undefined) catTotals[cat] += valorParcela; else catTotals["Outros"] += valorParcela;
                        }
                    }
                } 
            });
            recorrentes.forEach(r => { 
                let diff = (yC - r.y)*12 + (mC - r.m); 
                if(diff>=0 && (!r.p || diff<r.p)) {
                    gMes += r.v;
                    if(yC === yH && mC === mH) catTotals["Outros"] += r.v;
                } 
            });
            investimentos.forEach(inv => { if(inv.y===yC && inv.m===mC) gMes+=inv.v; });
            dividas.forEach(div => {
                if (div.status === 'pago') {
                    let diff = (yC - div.y)*12 + (mC - div.m);
                    if(diff>=0 && diff<div.p) { 
                        let vP = (div.v/div.p);
                        if(div.tipo==='credito') eMes += vP; 
                        else { gMes += vP; if(yC === yH && mC === mH) catTotals["Outros"] += vP; }
                    }
                }
            });
            let saldo = eMes - gMes;
            labels.push(d.toLocaleString('pt-BR', {month:'short'}).toUpperCase()); dataValues.push(saldo); bgColors.push(saldo >= 0 ? '#10b981' : '#ef4444');
        }
    }

    const isDark = document.body.classList.contains('dark-theme');
    
    // Gráfico de Barras Principal
    meuGrafico = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderRadius: 3 }] },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { grid: { color: isDark ? '#334155' : '#e2e8f0' }, ticks: { color: isDark ? '#f8fafc' : '#1e293b' } }, x: { grid: { display: false }, ticks: { color: isDark ? '#f8fafc' : '#1e293b' } } }
        }
    });

    // Filtra categorias vazias para o Gráfico de Rosca
    let roscaLabels = []; let roscaData = [];
    let roscaColors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];
    Object.keys(catTotals).forEach(cat => {
        if(catTotals[cat] > 0) { roscaLabels.push(cat); roscaData.push(catTotals[cat]); }
    });

    if(roscaData.length > 0) {
        meuGraficoRosca = new Chart(canvasRosca.getContext('2d'), {
            type: 'doughnut',
            data: { labels: roscaLabels, datasets: [{ data: roscaData, backgroundColor: roscaColors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isDark ? '#f8fafc' : '#1e293b' } } } }
        });
    }
}

// --- BACKUP E AUDITORIA ---
function gerarBackup() {
    const dados = { ent: localStorage.getItem('ent') || "[]", gas: localStorage.getItem('gas') || "[]", rec: localStorage.getItem('rec') || "[]", inv: localStorage.getItem('inv') || "[]", div: localStorage.getItem('div') || "[]", crt: localStorage.getItem('crt') || "[]", perfil: localStorage.getItem('perfil') || "{}", log: localStorage.getItem('log') || "[]" };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Backup_CYT_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    log(`BACKUP GERADO na sua máquina.`);
}

function carregarBackup(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            ['ent', 'gas', 'rec', 'inv', 'div', 'crt', 'perfil', 'log'].forEach(chave => {
                if (d[chave]) localStorage.setItem(chave, typeof d[chave] === 'string' ? d[chave] : JSON.stringify(d[chave]));
            });
            alert("✅ Backup restaurado com sucesso. A página será recarregada."); location.reload();
        } catch (err) { alert("❌ ERRO FATAL: Arquivo corrompido."); }
    };
    reader.readAsText(file);
}

async function confirmarZerar() {
    if (await Modal.confirm("🚨 ATENÇÃO: Perderás TODAS as informações lançadas. Certeza absoluta?")) {
        localStorage.clear();
        location.reload();
    }
}

init();
