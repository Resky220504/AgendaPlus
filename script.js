document.addEventListener('DOMContentLoaded', () => {
    // ========== ELEMENTOS DO DOM ==========
    const dom = {
        nav: document.getElementById('nav-principal'),
        sections: document.querySelectorAll('main section'),
        modals: {
            viewPatient: document.getElementById('modal-visualizar-paciente'),
            editPatient: document.getElementById('modal-editar-paciente'),
            editSchedule: document.getElementById('modal-editar-agendamento'),
            payment: document.getElementById('modal-pagamento'),
        },
        forms: {
            newPatient: document.getElementById('form-paciente'),
            editPatient: document.getElementById('form-editar-paciente'),
            newSchedule: document.getElementById('form-agendamento'),
            editSchedule: document.getElementById('form-editar-agendamento'),
            payment: document.getElementById('form-pagamento'),
        },
        lists: {
            patients: document.getElementById('lista-pacientes'),
            schedules: document.getElementById('lista-agendamentos'),
            upcoming: document.getElementById('proximos-agendamentos'),
            financial: document.getElementById('lista-financeiro'),
        },
        filters: {
            method: document.getElementById('filtro-metodo'),
            dateStart: document.getElementById('filtro-data-inicio'),
            dateEnd: document.getElementById('filtro-data-fim'),
            apply: document.getElementById('aplicar-filtros'),
            clear: document.getElementById('limpar-filtros')
        }
    };

    // ========== EVENT LISTENERS ==========
    dom.nav.addEventListener('click', (e) => e.target.closest('button')?.dataset.secao && showSection(e.target.closest('button').dataset.secao));
    Object.values(dom.forms).forEach(form => form?.addEventListener('submit', handleFormSubmit));
    dom.lists.patients.addEventListener('click', handlePatientListClick);
    dom.lists.schedules.addEventListener('click', handleScheduleListClick);
    dom.lists.upcoming.addEventListener('click', handleScheduleListClick); // Para futuros botões
    
    Object.values(dom.modals).forEach(modal => {
        if(modal) {
            modal.addEventListener('click', (e) => e.target === modal && closeModal(modal));
            modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
        }
    });
    
    // Máscaras e ViaCEP
    ['telefone-paciente', 'editar-telefone-paciente'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', applyPhoneMask);
    });
    document.getElementById('cep-paciente')?.addEventListener('blur', (e) => fetchAddress(e.target.value, ''));
    document.getElementById('editar-cep-paciente')?.addEventListener('blur', (e) => fetchAddress(e.target.value, 'editar-'));
    
    // Filtros financeiros
    dom.filters.apply?.addEventListener('click', loadFinancial);
    dom.filters.clear?.addEventListener('click', () => {
        dom.filters.method.value = '';
        dom.filters.dateStart.value = '';
        dom.filters.dateEnd.value = '';
        loadFinancial();
    });
    
    // ========== INICIAÇÃO ==========
    showSection('inicio');
});

// ========== BANCO DE DADOS LOCAL ==========
const getDB = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// ========== FUNÇÕES DE UI (INTERFACE) ==========
function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(sec => sec.classList.toggle('hidden', sec.id !== sectionId));
    document.querySelectorAll('#nav-principal button').forEach(btn => btn.classList.toggle('active', btn.dataset.secao === sectionId));
    loadSectionData(sectionId);
}

function loadSectionData(sectionId) {
    switch(sectionId) {
        case 'inicio': loadUpcomingSchedules(); break;
        case 'pacientes': loadPatients(); break;
        case 'agenda': loadSchedules(); loadPatientSelect(); break;
        case 'financeiro': loadFinancial(); break;
    }
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }, 10);
}

const openModal = (modal) => modal.classList.add('active');
const closeModal = (modal) => modal.classList.remove('active');

function applyPhoneMask(event) {
    let v = event.target.value.replace(/\D/g,'');
    if (v.length > 10) { // Celular com 9º dígito
        v = v.replace(/^(\d\d)(\d{5})(\d{4}).*/,"($1) $2-$3");
    } else if (v.length > 5) { // Telefone fixo
        v = v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/,"($1) $2-$3");
    } else if (v.length > 2) {
        v = v.replace(/^(\d\d)(\d{0,5}).*/,"($1) $2");
    } else {
        v = v.replace(/^(\d*)/, "($1");
    }
    event.target.value = v;
}

async function fetchAddress(cepValue, prefix) {
    const cep = cepValue.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            document.getElementById(`${prefix}logradouro-paciente`).value = data.logradouro;
            document.getElementById(`${prefix}bairro-paciente`).value = data.bairro;
            document.getElementById(`${prefix}cidade-paciente`).value = data.localidade;
            document.getElementById(`${prefix}estado-paciente`).value = data.uf;
            document.getElementById(`${prefix}numero-paciente`).focus();
        } else {
            showToast('CEP não encontrado', 'error');
        }
    } catch (error) {
        showToast('Erro ao buscar CEP', 'error');
    }
}

function formatDate(dateString, options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) {
    if (!dateString) return 'Data não informada';
    return new Date(dateString).toLocaleDateString('pt-BR', options);
}

function toInputDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ========== LÓGICA DE EVENTOS ==========
function handleFormSubmit(event) {
    event.preventDefault();
    const formId = event.target.id;
    const actions = {
        'form-paciente': () => savePatient(new FormData(event.target), event.target),
        'form-editar-paciente': () => savePatientEdit(new FormData(event.target), event.target),
        'form-agendamento': () => saveSchedule(event.target),
        'form-editar-agendamento': () => saveScheduleEdit(event.target),
        'form-pagamento': () => savePayment(event.target)
    };
    actions[formId]?.();
}

function handlePatientListClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const id = parseInt(button.closest('.item-lista').dataset.id);
    if (button.classList.contains('btn-visualizar')) viewPatient(id);
    if (button.classList.contains('btn-editar')) openPatientEditModal(id);
    if (button.classList.contains('btn-excluir')) deletePatient(id);
}

function handleScheduleListClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const id = parseInt(button.closest('.item-lista').dataset.id);
    if (button.classList.contains('btn-finalizar')) openPaymentModal(id);
    if (button.classList.contains('btn-editar')) openScheduleEditModal(id);
    if (button.classList.contains('btn-excluir')) deleteSchedule(id);
}

// ========== LÓGICA DE PACIENTES ==========
function savePatient(formData, form) {
    const nome = formData.get('nome-paciente')?.trim();
    if (!nome) return showToast('O nome é obrigatório', 'error');
    const newPatient = {
        id: Date.now(),
        nome,
        nascimento: formData.get('nascimento-paciente'),
        profissao: formData.get('profissao-paciente')?.trim(),
        telefone: formData.get('telefone-paciente')?.trim(),
        endereco: {
            cep: formData.get('cep-paciente')?.trim(), logradouro: formData.get('logradouro-paciente')?.trim(),
            numero: formData.get('numero-paciente')?.trim(), bairro: formData.get('bairro-paciente')?.trim(),
            cidade: formData.get('cidade-paciente')?.trim(), estado: formData.get('estado-paciente')?.trim(),
        },
        obs: formData.get('obs-paciente')?.trim()
    };
    const patients = getDB('patients');
    patients.push(newPatient);
    setDB('patients', patients);
    showToast('Paciente salvo com sucesso!', 'success');
    form.reset();
    loadPatients();
}

function loadPatients() {
    const patients = getDB('patients').sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const list = document.getElementById('lista-pacientes');
    list.innerHTML = patients.length === 0 ? '<p>Nenhum paciente cadastrado.</p>' : patients.map(p => `
        <div class="item-lista" data-id="${p.id}">
            <div class="info"><strong>${p.nome}</strong><small>${p.telefone || 'Sem telefone'}</small></div>
            <div class="acoes">
                <button class="btn btn-visualizar" title="Visualizar"><i class="fas fa-eye"></i></button>
                <button class="btn btn-editar" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn btn-excluir" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function viewPatient(id) {
    const patient = getDB('patients').find(p => p.id === id);
    if (!patient) return;
    const { nome, nascimento, profissao, telefone, endereco = {}, obs } = patient;
    const content = `
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Nascimento:</strong> ${nascimento ? formatDate(nascimento, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'}) : 'Não informado'}</p>
        <p><strong>Profissão:</strong> ${profissao || 'Não informado'}</p>
        <p><strong>Telefone:</strong> ${telefone || 'Não informado'}</p>
        <p><strong>Endereço:</strong> ${endereco.logradouro ? `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}-${endereco.estado}` : 'Não informado'}</p>
        <p><strong>Observações:</strong> ${obs || 'Nenhuma'}</p>
    `;
    document.getElementById('modal-visualizar-corpo').innerHTML = content;
    openModal(document.getElementById('modal-visualizar-paciente'));
}

function openPatientEditModal(id) {
    const patient = getDB('patients').find(p => p.id === id);
    if (!patient) return;
    const modal = document.getElementById('modal-editar-paciente');
    const form = modal.querySelector('form');
    const endereco = patient.endereco || {};
    form.querySelector('#editar-id-paciente').value = patient.id;
    form.querySelector('#editar-nome-paciente').value = patient.nome || '';
    form.querySelector('#editar-nascimento-paciente').value = patient.nascimento || '';
    form.querySelector('#editar-profissao-paciente').value = patient.profissao || '';
    form.querySelector('#editar-telefone-paciente').value = patient.telefone || '';
    form.querySelector('#editar-cep-paciente').value = endereco.cep || '';
    form.querySelector('#editar-logradouro-paciente').value = endereco.logradouro || '';
    form.querySelector('#editar-numero-paciente').value = endereco.numero || '';
    form.querySelector('#editar-bairro-paciente').value = endereco.bairro || '';
    form.querySelector('#editar-cidade-paciente').value = endereco.cidade || '';
    form.querySelector('#editar-estado-paciente').value = endereco.estado || '';
    form.querySelector('#editar-obs-paciente').value = patient.obs || '';
    applyPhoneMask({ target: form.querySelector('#editar-telefone-paciente') }); // Formata o telefone ao abrir
    openModal(modal);
}

function savePatientEdit(form) {
    const id = parseInt(form.querySelector('#editar-id-paciente').value);
    const patients = getDB('patients');
    const index = patients.findIndex(p => p.id === id);
    if (index === -1) return showToast('Paciente não encontrado.', 'error');

    patients[index] = {
        id,
        nome: form.querySelector('#editar-nome-paciente').value.trim(),
        nascimento: form.querySelector('#editar-nascimento-paciente').value,
        profissao: form.querySelector('#editar-profissao-paciente').value.trim(),
        telefone: form.querySelector('#editar-telefone-paciente').value.trim(),
        endereco: {
            cep: form.querySelector('#editar-cep-paciente').value.trim(), logradouro: form.querySelector('#editar-logradouro-paciente').value.trim(),
            numero: form.querySelector('#editar-numero-paciente').value.trim(), bairro: form.querySelector('#editar-bairro-paciente').value.trim(),
            cidade: form.querySelector('#editar-cidade-paciente').value.trim(), estado: form.querySelector('#editar-estado-paciente').value.trim(),
        },
        obs: form.querySelector('#editar-obs-paciente').value.trim()
    };

    setDB('patients', patients);
    showToast('Paciente atualizado com sucesso!', 'success');
    closeModal(document.getElementById('modal-editar-paciente'));
    loadPatients();
    loadPatientSelect(); // Atualiza a lista de pacientes nos selects
}

function deletePatient(id) {
    if (!confirm('ATENÇÃO: Excluir um paciente também removerá TODOS os seus agendamentos e registros financeiros. Deseja continuar?')) return;
    setDB('patients', getDB('patients').filter(p => p.id !== id));
    setDB('schedules', getDB('schedules').filter(s => s.patientId !== id));
    setDB('transactions', getDB('transactions').filter(t => t.patientId !== id));
    showToast('Paciente e todos os seus dados foram excluídos.', 'success');
    loadSectionData(document.querySelector('main section:not(.hidden)').id);
}

// ========== LÓGICA DE AGENDAMENTOS ==========
function loadPatientSelect() {
    const select = document.getElementById('select-paciente-agenda');
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione um paciente</option>';
    getDB('patients').sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
    select.value = currentVal;
}

function saveSchedule(form) {
    const patientId = parseInt(form.querySelector('#select-paciente-agenda').value);
    const date = form.querySelector('#data-agendamento').value;
    if (!patientId || !date) return showToast('Selecione um paciente e uma data.', 'error');
    
    const patient = getDB('patients').find(p => p.id === patientId);
    const newSchedule = { id: Date.now(), patientId, patientName: patient.nome, date };
    const schedules = getDB('schedules');
    schedules.push(newSchedule);
    setDB('schedules', schedules);
    showToast('Agendamento salvo com sucesso!', 'success');
    form.reset();
    loadSchedules();
    loadUpcomingSchedules();
}

function loadSchedules() {
    const schedules = getDB('schedules').sort((a,b) => new Date(a.date) - new Date(b.date));
    const list = document.getElementById('lista-agendamentos');
    list.innerHTML = schedules.length === 0 ? '<p>Nenhum horário agendado.</p>' : schedules.map(s => `
        <div class="item-lista" data-id="${s.id}">
            <div class="info"><strong>${s.patientName}</strong><small>${formatDate(s.date)}</small></div>
            <div class="acoes">
                <button class="btn btn-finalizar" title="Finalizar Atendimento"><i class="fas fa-check"></i></button>
                <button class="btn btn-editar" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn btn-excluir" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function loadUpcomingSchedules() {
    const now = new Date();
    const upcoming = getDB('schedules')
        .filter(s => new Date(s.date) >= now)
        .sort((a,b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    const list = document.getElementById('proximos-agendamentos');
    list.innerHTML = upcoming.length === 0 ? '<p>Nenhum próximo agendamento.</p>' : upcoming.map(s => `
        <div class="item-lista">
            <div class="info"><strong>${s.patientName}</strong><small>${formatDate(s.date)}</small></div>
        </div>
    `).join('');
}

function openScheduleEditModal(id) {
    const schedule = getDB('schedules').find(s => s.id === id);
    if (!schedule) return;
    const modal = document.getElementById('modal-editar-agendamento');
    modal.querySelector('#editar-id-agendamento').value = schedule.id;
    modal.querySelector('#editar-data-agendamento').value = toInputDateTime(schedule.date);
    openModal(modal);
}

function saveScheduleEdit(form) {
    const id = parseInt(form.querySelector('#editar-id-agendamento').value);
    const newDate = form.querySelector('#editar-data-agendamento').value;
    const schedules = getDB('schedules');
    const index = schedules.findIndex(s => s.id === id);
    if (index === -1) return showToast('Agendamento não encontrado.', 'error');
    
    schedules[index].date = newDate;
    setDB('schedules', schedules);
    showToast('Agendamento atualizado com sucesso!', 'success');
    closeModal(document.getElementById('modal-editar-agendamento'));
    loadSchedules();
    loadUpcomingSchedules();
}

function deleteSchedule(id) {
    if (!confirm('Deseja cancelar este agendamento?')) return;
    setDB('schedules', getDB('schedules').filter(s => s.id !== id));
    showToast('Agendamento cancelado.', 'success');
    loadSchedules();
    loadUpcomingSchedules();
}

// ========== LÓGICA FINANCEIRA ==========
function openPaymentModal(scheduleId) {
    const modal = document.getElementById('modal-pagamento');
    modal.querySelector('#pagamento-id-agendamento').value = scheduleId;
    openModal(modal);
}

function savePayment(form) {
    const scheduleId = parseInt(form.querySelector('#pagamento-id-agendamento').value);
    const schedule = getDB('schedules').find(s => s.id === scheduleId);
    if (!schedule) return showToast('Agendamento não encontrado.', 'error');

    const amount = parseFloat(form.querySelector('#pagamento-valor').value);
    if (isNaN(amount) || amount <= 0) return showToast('Por favor, insira um valor válido.', 'error');
    
    const paymentMethod = form.querySelector('#pagamento-metodo').value;
    if (!paymentMethod) return showToast('Selecione uma forma de pagamento.', 'error');
    
    const newTransaction = {
        id: Date.now(),
        scheduleId: schedule.id,
        patientId: schedule.patientId,
        patientName: schedule.patientName,
        paymentDate: new Date().toISOString(),
        amount: amount,
        method: paymentMethod,
    };
    
    const transactions = getDB('transactions');
    transactions.push(newTransaction);
    setDB('transactions', transactions);
    
    setDB('schedules', getDB('schedules').filter(s => s.id !== scheduleId));

    showToast('Pagamento registrado com sucesso!', 'success');
    closeModal(document.getElementById('modal-pagamento'));
    form.reset();
    
    // Recarrega todas as seções afetadas
    if(document.getElementById('agenda')?.classList.contains('active')) loadSchedules();
    if(document.getElementById('inicio')?.classList.contains('active')) loadUpcomingSchedules();
    if(document.getElementById('financeiro')?.classList.contains('active')) loadFinancial();
    
}

function loadFinancial() {
    const allTransactions = getDB('transactions');
    const now = new Date();

    // Calcula o total do mês atual independentemente dos filtros
    const currentMonthTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.paymentDate);
        return transactionDate.getMonth() === now.getMonth() && transactionDate.getFullYear() === now.getFullYear();
    });
    const totalMonth = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    // Nota: Certifique-se que no seu HTML o ID é 'total-pago-mes'
    document.getElementById('total-pago-mes').textContent = formatCurrency(totalMonth);

    // Aplica filtros para a lista de transações
    let filteredTransactions = [...allTransactions];
    
    // Filtro por método
    const filterMethod = dom.filters.method.value;
    if (filterMethod) {
        // Compara os textos em minúsculas e sem espaços extras para evitar erros
        filteredTransactions = filteredTransactions.filter(t => 
            t.method && t.method.trim().toLowerCase() === filterMethod.toLowerCase()
        );
    }
    
    // Filtro por data de início (com validação)
    const startDateValue = dom.filters.dateStart.value;
    if (startDateValue) {
        const startDate = new Date(startDateValue);
        if (!isNaN(startDate.getTime())) {
            startDate.setUTCHours(0, 0, 0, 0);
            filteredTransactions = filteredTransactions.filter(t => new Date(t.paymentDate) >= startDate);
        }
    }
    
    // Filtro por data de fim (com validação)
    const endDateValue = dom.filters.dateEnd.value;
    if (endDateValue) {
        const endDate = new Date(endDateValue);
        if (!isNaN(endDate.getTime())) {
            endDate.setUTCHours(23, 59, 59, 999);
            filteredTransactions = filteredTransactions.filter(t => new Date(t.paymentDate) <= endDate);
        }
    }

    filteredTransactions.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    // Exibe a lista de transações filtrada
    const list = document.getElementById('lista-financeiro');
    list.innerHTML = filteredTransactions.length === 0 
        ? '<p>Nenhuma transação encontrada para os filtros aplicados.</p>'
        : filteredTransactions.map(t => `
            <div class="item-lista">
                <div class="info">
                    <strong>${t.patientName}</strong>
                    <small>Pagamento em ${formatDate(t.paymentDate)}</small>
                </div>
                <div class="info" style="text-align: right;">
                    <strong>${formatCurrency(t.amount)}</strong>
                    <small>Método: ${t.method}</small>
                </div>
            </div>
        `).join('');
}