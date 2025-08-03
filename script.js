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
        }
    };

    // ========== EVENT LISTENERS ==========
    dom.nav.addEventListener('click', (e) => e.target.closest('button')?.dataset.secao && showSection(e.target.closest('button').dataset.secao));
    Object.values(dom.forms).forEach(form => form?.addEventListener('submit', handleFormSubmit));
    dom.lists.patients.addEventListener('click', handlePatientListClick);
    dom.lists.schedules.addEventListener('click', handleScheduleListClick);
    
    Object.values(dom.modals).forEach(modal => {
        if(modal) {
            modal.addEventListener('click', (e) => e.target === modal && closeModal(modal));
            modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
        }
    });
    
    // Máscaras e ViaCEP
    document.getElementById('telefone-paciente').addEventListener('input', applyPhoneMask);
    document.getElementById('editar-telefone-paciente').addEventListener('input', applyPhoneMask);
    setupCepListener('');
    setupCepListener('editar-');
    
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
    let v = event.target.value.replace(/\D/g,'').slice(0,11);
    if (v.length >= 7) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length >= 3) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    event.target.value = v;
}

function setupCepListener(prefix) {
    document.getElementById(`${prefix}cep-paciente`)?.addEventListener('blur', (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
            if (!data.erro) {
                document.getElementById(`${prefix}logradouro-paciente`).value = data.logradouro;
                document.getElementById(`${prefix}bairro-paciente`).value = data.bairro;
                document.getElementById(`${prefix}cidade-paciente`).value = data.localidade;
                document.getElementById(`${prefix}estado-paciente`).value = data.uf;
                document.getElementById(`${prefix}numero-paciente`).focus();
            } else showToast('CEP não encontrado', 'error');
        }).catch(() => showToast('Erro ao buscar CEP', 'error'));
    });
}

function formatDate(dateString) {
    if (!dateString) return 'Data não informada';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
}

function toInputDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

// ========== LÓGICA DE EVENTOS ==========
function handleFormSubmit(event) {
    event.preventDefault();
    const formId = event.target.id;
    switch(formId) {
        case 'form-paciente': savePatient(event.target); break;
        case 'form-editar-paciente': savePatientEdit(event.target); break;
        case 'form-agendamento': saveSchedule(event.target); break;
        case 'form-editar-agendamento': saveScheduleEdit(event.target); break;
        case 'form-pagamento': savePayment(event.target); break;
    }
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
function savePatient(form) {
    const nome = form.querySelector('#nome-paciente').value.trim();
    if (!nome) return showToast('O nome é obrigatório', 'error');
    const newPatient = {
        id: Date.now(),
        nome,
        nascimento: form.querySelector('#nascimento-paciente').value,
        profissao: form.querySelector('#profissao-paciente').value.trim(),
        telefone: form.querySelector('#telefone-paciente').value.trim(),
        endereco: {
            cep: form.querySelector('#cep-paciente').value.trim(), logradouro: form.querySelector('#logradouro-paciente').value.trim(),
            numero: form.querySelector('#numero-paciente').value.trim(), bairro: form.querySelector('#bairro-paciente').value.trim(),
            cidade: form.querySelector('#cidade-paciente').value.trim(), estado: form.querySelector('#estado-paciente').value.trim(),
        },
        obs: form.querySelector('#obs-paciente').value.trim()
    };
    const patients = getDB('patients');
    patients.push(newPatient);
    setDB('patients', patients);
    showToast('Paciente salvo com sucesso!', 'success');
    form.reset();
    loadPatients();
}

function loadPatients() {
    const patients = getDB('patients').sort((a,b) => a.nome.localeCompare(b.nome));
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
    const { nome, nascimento, profissao, telefone, endereco, obs } = patient;
    const content = `
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Nascimento:</strong> ${nascimento ? new Date(nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Não informado'}</p>
        <p><strong>Profissão:</strong> ${profissao || 'Não informado'}</p>
        <p><strong>Telefone:</strong> ${telefone || 'Não informado'}</p>
        <p><strong>Endereço:</strong> ${endereco && endereco.logradouro ? `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}-${endereco.estado}` : 'Não informado'}</p>
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
    select.innerHTML = '<option value="">Selecione um paciente</option>';
    getDB('patients').sort((a,b) => a.nome.localeCompare(b.nome)).forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
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
    const upcoming = getDB('schedules')
        .filter(s => new Date(s.date) >= new Date())
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
    
    const newTransaction = {
        id: Date.now(),
        scheduleId: schedule.id,
        patientId: schedule.patientId,
        patientName: schedule.patientName,
        paymentDate: new Date().toISOString(),
        amount: amount,
        method: form.querySelector('#pagamento-metodo').value,
    };
    
    setDB('transactions', [...getDB('transactions'), newTransaction]);
    setDB('schedules', getDB('schedules').filter(s => s.id !== scheduleId));

    showToast('Pagamento registrado com sucesso!', 'success');
    closeModal(document.getElementById('modal-pagamento'));
    form.reset();
    loadSectionData(document.querySelector('main section:not(.hidden)').id);
}

function loadFinancial() {
    const transactions = getDB('transactions');
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const monthlyTotal = transactions
        .filter(t => {
            const tDate = new Date(t.paymentDate);
            return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('total-pago').textContent = monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const list = document.getElementById('lista-financeiro');
    list.innerHTML = transactions.length === 0 ? '<p>Nenhuma transação registrada.</p>' : transactions
        .sort((a,b) => new Date(b.paymentDate) - new Date(a.paymentDate))
        .map(t => `
        <div class="item-lista">
            <div class="info"><strong>${t.patientName}</strong><small>Pagamento em ${formatDate(t.paymentDate)}</small></div>
            <div class="info" style="text-align: right;"><strong>${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><small>Método: ${t.method}</small></div>
        </div>
    `).join('');
}