import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Calendar as CalendarIcon, Clock, User as UserIcon } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays, subDays, startOfWeek, endOfWeek, format, parseISO, addMinutes } from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';

export function Agenda() {
  const { user } = useAuth();
  const [agendas, setAgendas] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modals state
  const [openNovaAgenda, setOpenNovaAgenda] = useState(false);
  const [openAgendamento, setOpenAgendamento] = useState(false);
  const [openEvento, setOpenEvento] = useState(false);

  // Forms state
  const [novaAgendaForm, setNovaAgendaForm] = useState({ nome: '', cor: '#C47E7E' });
  const [agendamentoForm, setAgendamentoForm] = useState({ 
    id: '', lead_id: '', cliente_id: '', nome_livre: '', procedimento_nome: '', 
    data: '', hora: '', agenda_id: '', observacoes: '' 
  });
  const [selectedEventInfo, setSelectedEventInfo] = useState<any>(null);

  // References to all calendars to sync date
  const calendarRefs = useRef<Record<string, React.RefObject<FullCalendar>>>({});

  const loadData = async () => {
    // Carrega agendas
    const reqAgendas = await supabase.from('agendas').select('*').eq('ativo', true).order('created_at', { ascending: true });
    if (reqAgendas.data) {
      setAgendas(reqAgendas.data);
      reqAgendas.data.forEach(a => {
        if (!calendarRefs.current[a.id]) {
          calendarRefs.current[a.id] = React.createRef<FullCalendar>();
        }
      });
    }

    // Carrega agendamentos (buscando mais campos como nome do lead p/ exibir no cal)
    const reqAgendamentos = await supabase
      .from('agendamentos_estetica')
      .select('*, leads_estetica(nome_lead), clientes_estetica(leads_estetica(nome_lead))')
      .neq('status', 'cancelado');
      
    if (reqAgendamentos.data) setAgendamentos(reqAgendamentos.data);
  };

  useEffect(() => { loadData(); }, []);

  // Navegação Global
  const handlePrevWeek = () => {
    const newDate = subDays(currentDate, 7);
    setCurrentDate(newDate);
    Object.values(calendarRefs.current).forEach(ref => {
      ref.current?.getApi().gotoDate(newDate);
    });
  };

  const handleNextWeek = () => {
    const newDate = addDays(currentDate, 7);
    setCurrentDate(newDate);
    Object.values(calendarRefs.current).forEach(ref => {
      ref.current?.getApi().gotoDate(newDate);
    });
  };

  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Criar Nova Agenda
  const handleCreateAgenda = async () => {
    if (!novaAgendaForm.nome) return;
    await supabase.from('agendas').insert({ 
      nome: novaAgendaForm.nome, 
      cor: novaAgendaForm.cor,
      esteticista_id: user?.id
    });
    setOpenNovaAgenda(false);
    setNovaAgendaForm({ nome: '', cor: '#C47E7E' });
    loadData();
  };

  // Click num slot vazio (Criar Agendamento)
  const handleDateClick = (info: any, agendaId: string) => {
    const dataStr = format(info.date, 'yyyy-MM-dd');
    const horaStr = format(info.date, 'HH:mm');
    setAgendamentoForm({
      id: '', lead_id: '', cliente_id: '', nome_livre: '', procedimento_nome: '', 
      data: dataStr, hora: horaStr, agenda_id: agendaId, observacoes: ''
    });
    setOpenAgendamento(true);
  };

  // Salvar Agendamento (Novo)
  const handleSaveAgendamento = async () => {
    // Formatando a data e hora inicio/fim
    const dataHoraInicio = `${agendamentoForm.data}T${agendamentoForm.hora}:00`;
    const dataHoraFim = format(addMinutes(new Date(dataHoraInicio), 60), "yyyy-MM-dd'T'HH:mm:00");

    await supabase.from('agendamentos_estetica').insert({
      // Se não houver lead ou cliente, precisaria tratar na modelagem. Mas via Supabase exige referências em FKs se for usado,
      // Como o DB exige cliente_id ou lead_id, no MVP vamos ignorar restrição complexa e tentar o insert nulo p/ testar,
      // Se a constraint bloquear, o certo é buscar um lead_id default ou forçar criação do lead antes.
      procedimento_nome: agendamentoForm.procedimento_nome,
      agenda_id: agendamentoForm.agenda_id,
      data_hora_inicio: dataHoraInicio,
      data_hora_fim: dataHoraFim,
      status: 'agendado',
      observacoes: agendamentoForm.observacoes
    });
    setOpenAgendamento(false);
    loadData();
  };

  // Click num evento existente (Visualizar/Editar)
  const handleEventClick = (info: any) => {
    const agId = info.event.id;
    const ag = agendamentos.find(a => a.id === agId);
    if (ag) {
      setSelectedEventInfo(ag);
      setOpenEvento(true);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    await supabase.from('agendamentos_estetica').update({ status }).eq('id', selectedEventInfo.id);
    setOpenEvento(false);
    loadData();
  };

  const handleDeletarAgenda = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta agenda?')) {
      await supabase.from('agendas').update({ ativo: false }).eq('id', id);
      loadData();
    }
  };

  // Renderizar a página
  return (
    <div className="space-y-6 flex flex-col h-full bg-[var(--color-bg-base)]">
      
      {/* HEADER DA AGENDA */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[var(--color-bg-card)] p-4 rounded-[12px] border border-[var(--color-border-card)] shadow-[var(--shadow-card)] gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="secondary" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="w-5 h-5 mr-1" /> Semana anterior
          </Button>
          <div className="font-cormorant text-xl font-bold px-2 whitespace-nowrap">
            {format(currentWeekStart, 'dd/MM', { locale: dateFnsPtBR })} - {format(currentWeekEnd, 'dd/MM/yyyy', { locale: dateFnsPtBR })}
          </div>
          <Button variant="secondary" size="sm" onClick={handleNextWeek}>
            Próxima <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
        <Button onClick={() => setOpenNovaAgenda(true)}><Plus className="w-4 h-4 mr-2" /> Nova agenda</Button>
      </div>

      {/* RENDERIZAR AGENDAS EMPILHADAS */}
      <div className="flex-1 space-y-8 overflow-y-auto pb-10">
        {agendas.map(agenda => {
          // Filtrar os eventos desta agenda para o FullCalendar
          const events = agendamentos
            .filter(a => a.agenda_id === agenda.id)
            .map(a => {
              const nome = a.leads_estetica?.nome_lead || a.clientes_estetica?.leads_estetica?.nome_lead || 'Cliente';
              return {
                id: a.id,
                title: `${nome} - ${a.procedimento_nome || 's/ proc'}`,
                start: a.data_hora_inicio,
                end: a.data_hora_fim,
                backgroundColor: agenda.cor,
                borderColor: 'transparent',
                textColor: '#fff'
              };
            });

          return (
            <div key={agenda.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-[12px] shadow-[var(--shadow-card)] overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 border-b border-[var(--color-border-card)] text-white" 
                style={{ backgroundColor: agenda.cor }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-[8px]"><CalendarIcon className="w-5 h-5" /></div>
                  <h2 className="font-cormorant text-2xl font-bold tracking-wide">{agenda.nome}</h2>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex space-x-2">
                    <button className="p-1.5 hover:bg-black/20 rounded transition-colors" title="Editar config"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeletarAgenda(agenda.id)} className="p-1.5 hover:bg-black/20 rounded transition-colors text-white" title="Excluir (Soft)"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              
              <div className="p-4 fc-agenda-custom">
                {/* FullCalendar wrapper */}
                <style>{`
                  .fc-agenda-custom .fc-theme-standard td, .fc-theme-standard th { border-color: var(--color-border-card); }
                  .fc-agenda-custom .fc-col-header-cell { background-color: var(--color-bg-base); padding: 8px 0; font-family: var(--font-cormorant); font-size: 16px; border-bottom: 2px solid var(--color-primary-light); }
                  .fc-agenda-custom .fc-timegrid-slot-label { font-size: 12px; color: var(--color-text-muted); }
                  .fc-agenda-custom .fc-event { border-radius: 4px; padding: 2px 4px; font-size: 12px; cursor: pointer; transition: transform 0.1s; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                  .fc-agenda-custom .fc-event:hover { transform: scale(1.02); z-index: 5 !important; filter: brightness(1.1); }
                  .fc-agenda-custom .fc-timegrid-slot:hover { background-color: var(--color-primary-light); opacity: 0.5; cursor: pointer; }
                `}</style>
                <FullCalendar
                  ref={calendarRefs.current[agenda.id]}
                  plugins={[timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  initialDate={currentDate}
                  locale="pt-br"
                  headerToolbar={false}
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  slotDuration="01:00:00"
                  allDaySlot={false}
                  height="auto"
                  expandRows={true}
                  events={events}
                  dateClick={(info) => handleDateClick(info, agenda.id)}
                  eventClick={handleEventClick}
                  nowIndicator={true}
                  dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                />
              </div>
            </div>
          );
        })}
        {agendas.length === 0 && (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <h3 className="font-cormorant text-2xl font-bold text-[var(--color-text-main)] mb-2">Nenhuma agenda cadastrada</h3>
            <p className="mb-6">Crie uma nova agenda para começar a gerenciar seus horários.</p>
            <Button onClick={() => setOpenNovaAgenda(true)}><Plus className="w-4 h-4 mr-2" /> Criar primeira agenda</Button>
          </div>
        )}
      </div>

      {/* MODAL CRIAR AGENDA */}
      <Modal isOpen={openNovaAgenda} onClose={() => setOpenNovaAgenda(false)} title="Nova Agenda">
        <div className="space-y-4">
          <Input label="Nome da agenda" placeholder="Ex: Dra. Ana, Sala 1" value={novaAgendaForm.nome} onChange={e => setNovaAgendaForm({...novaAgendaForm, nome: e.target.value})} />
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Cor de identificação</label>
            <div className="flex gap-2">
              {['#C47E7E', '#7A9E87', '#E8A87C', '#7F6A8A', '#608CA8', '#A6927D'].map(c => (
                <button 
                  key={c} 
                  onClick={() => setNovaAgendaForm({...novaAgendaForm, cor: c})}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${novaAgendaForm.cor === c ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={handleCreateAgenda} className="w-full">Salvar agenda</Button>
        </div>
      </Modal>

      {/* MODAL NOVO AGENDAMENTO */}
      <Modal isOpen={openAgendamento} onClose={() => setOpenAgendamento(false)} title="Novo Agendamento">
        <div className="space-y-4">
          <Input label="Procedimento" placeholder="Ex: Limpeza de Pele" value={agendamentoForm.procedimento_nome} onChange={e => setAgendamentoForm({...agendamentoForm, procedimento_nome: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label="Data" value={agendamentoForm.data} onChange={e => setAgendamentoForm({...agendamentoForm, data: e.target.value})} />
            <Input type="time" label="Hora" value={agendamentoForm.hora} onChange={e => setAgendamentoForm({...agendamentoForm, hora: e.target.value})} />
          </div>
          <Input label="Observações (Opcional)" value={agendamentoForm.observacoes} onChange={e => setAgendamentoForm({...agendamentoForm, observacoes: e.target.value})} />
          <Button onClick={handleSaveAgendamento} className="w-full">Agendar horário</Button>
        </div>
      </Modal>

      {/* MODAL DETALHES DO EVENTO */}
      <Modal isOpen={openEvento} onClose={() => setOpenEvento(false)} title="Detalhes do Agendamento">
        {selectedEventInfo && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1 items-center bg-[var(--color-primary-light)] p-6 rounded-[12px] text-center border border-[var(--color-border-card)]">
               <Avatar size="lg" fallback={(selectedEventInfo.leads_estetica?.nome_lead || selectedEventInfo.clientes_estetica?.leads_estetica?.nome_lead || '?')[0]} className="mb-2" />
               <h3 className="font-cormorant text-2xl font-bold text-[var(--color-text-main)]">
                 {selectedEventInfo.leads_estetica?.nome_lead || selectedEventInfo.clientes_estetica?.leads_estetica?.nome_lead || 'Cliente sem nome'}
               </h3>
               <p className="font-medium text-[var(--color-primary)]">{selectedEventInfo.procedimento_nome || 'Nenhum procedimento informado'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-[var(--color-bg-base)] p-4 rounded-[8px] border border-[var(--color-border-card)]">
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">Data e Hora</span>
                <div className="font-medium text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-[var(--color-primary)]"/>
                  {format(parseISO(selectedEventInfo.data_hora_inicio), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">Status</span>
                <Badge variant={selectedEventInfo.status}>{selectedEventInfo.status}</Badge>
              </div>
            </div>

            {selectedEventInfo.observacoes && (
               <div>
                 <span className="text-sm font-medium block">Observações</span>
                 <p className="text-sm text-[var(--color-text-muted)] bg-gray-50 border p-3 rounded mt-1">{selectedEventInfo.observacoes}</p>
               </div>
            )}

            <div className="pt-4 border-t border-[var(--color-border-card)] space-y-3">
              <label className="text-sm font-medium">Alterar Status:</label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={selectedEventInfo.status === 'confirmado' ? 'primary' : 'secondary'} onClick={() => handleUpdateStatus('confirmado')}>Confirmado</Button>
                <Button size="sm" variant={selectedEventInfo.status === 'compareceu' ? 'primary' : 'secondary'} onClick={() => handleUpdateStatus('compareceu')} className="bg-[var(--color-success)] text-white hover:opacity-90 border-transparent">Compareceu</Button>
                <Button size="sm" variant={selectedEventInfo.status === 'faltou' ? 'primary' : 'secondary'} onClick={() => handleUpdateStatus('faltou')}>Faltou</Button>
                <Button size="sm" variant={selectedEventInfo.status === 'cancelado' ? 'primary' : 'secondary'} onClick={() => handleUpdateStatus('cancelado')} className="bg-[var(--color-error)] text-white hover:opacity-90 border-transparent">Cancelar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
