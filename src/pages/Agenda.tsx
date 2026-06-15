import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  format, parseISO, isSameDay, isSameMonth, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, addWeeks, addDays, eachDayOfInterval, getHours,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays, Loader2, X } from 'lucide-react';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';

type View = 'mes' | 'semana' | 'dia' | 'lista';

const HORA_INI = 7;
const HORA_FIM = 21; // exclusivo
const HORAS = Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => HORA_INI + i);
const CORES_PADRAO = ['#C47E7E', '#7E9CC4', '#7EC49C', '#C4B27E', '#A07EC4', '#C47EA8'];

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', compareceu: 'Compareceu',
  faltou: 'Faltou', cancelado: 'Cancelado', reagendado: 'Reagendado',
};

function dt(ag: any): Date { return parseISO(ag.data_hora_inicio); }
function isCancelado(ag: any) { return ag.status === 'cancelado' || ag.status === 'cancelou_agendamento'; }

export function Agenda() {
  const { canEdit } = useAuth();
  const podeEditar = canEdit('modulo:agenda');

  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [profFiltro, setProfFiltro] = useState<string>('todas');
  const [agendas, setAgendas] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLead, setOpenLead] = useState(false);
  const [showNova, setShowNova] = useState(false);

  // Intervalo visível conforme a visão
  const range = useMemo(() => {
    if (view === 'dia') return { start: cursor, end: cursor };
    if (view === 'semana') return { start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) };
    // mês (e lista) → grade de semanas completas
    return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) };
  }, [view, cursor]);

  const loadAgendas = async () => {
    const { data } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true).order('nome');
    if (data) setAgendas(data);
  };

  const loadAgendamentos = async () => {
    setLoading(true);
    const start = new Date(range.start); start.setHours(0, 0, 0, 0);
    const end = new Date(range.end); end.setHours(23, 59, 59, 999);
    let q = supabase
      .from('agendamentos')
      .select('*, agendas(nome, cor), leads:lead_id(*)')
      .gte('data_hora_inicio', start.toISOString())
      .lte('data_hora_inicio', end.toISOString())
      .order('data_hora_inicio', { ascending: true });
    if (profFiltro !== 'todas') q = q.eq('agenda_id', profFiltro);
    const { data } = await q;
    setAgendamentos(data || []);
    setLoading(false);
  };

  useEffect(() => { loadAgendas(); }, []);

  useEffect(() => {
    loadAgendamentos();
    // Realtime: reflete mudanças do agente/Cal.com
    const ch = supabase
      .channel('agenda-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => loadAgendamentos())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [range.start.getTime(), range.end.getTime(), profFiltro]);

  const abrirLead = (ag: any) => {
    if (!ag.leads) return;
    setSelectedLead(ag.leads);
    setOpenLead(true);
  };

  const navegar = (dir: -1 | 1) => {
    if (view === 'dia') setCursor(c => addDays(c, dir));
    else if (view === 'semana') setCursor(c => addWeeks(c, dir));
    else setCursor(c => addMonths(c, dir));
  };

  const tituloPeriodo = useMemo(() => {
    if (view === 'dia') return format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'semana') {
      const s = startOfWeek(cursor, { weekStartsOn: 0 });
      const e = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  }, [view, cursor]);

  // agendamentos de um dia (ordenados)
  const doDia = (day: Date) => agendamentos
    .filter(a => isSameDay(dt(a), day))
    .sort((a, b) => dt(a).getTime() - dt(b).getTime());

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg)', minHeight: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)' }}>
          Agenda
        </div>

        {/* Navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => navegar(-1)} style={navBtn}><ChevronLeft size={16} /></button>
          <button onClick={() => setCursor(new Date())} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: '12px', fontWeight: 600 }}>Hoje</button>
          <button onClick={() => navegar(1)} style={navBtn}><ChevronRight size={16} /></button>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize', minWidth: '160px' }}>
          {tituloPeriodo}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Seletor de visão */}
          <div style={{ display: 'flex', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
            {([['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia'], ['lista', 'Lista']] as [View, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: view === v ? 'var(--sage-dark)' : 'transparent',
                  color: view === v ? 'white' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filtro profissional */}
          <select
            value={profFiltro}
            onChange={e => setProfFiltro(e.target.value)}
            style={{ border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '6px 10px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <option value="todas">Todos os profissionais</option>
            {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>

          {podeEditar && (
            <button onClick={() => setShowNova(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={14} /> Nova agenda
            </button>
          )}
        </div>
      </div>

      {/* Legenda de cores dos profissionais */}
      {agendas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          {agendas.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--muted)' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: a.cor || 'var(--sage)' }} />
              {a.nome}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '8px', color: 'var(--muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <>
          {view === 'mes' && <VisaoMes cursor={cursor} range={range} doDia={doDia} onEvento={abrirLead} onDia={(d: Date) => { setCursor(d); setView('dia'); }} />}
          {view === 'semana' && <VisaoSemana range={range} doDia={doDia} onEvento={abrirLead} />}
          {view === 'dia' && <VisaoDia cursor={cursor} agendas={agendas} profFiltro={profFiltro} doDia={doDia} onEvento={abrirLead} />}
          {view === 'lista' && <VisaoLista range={range} agendamentos={agendamentos} onEvento={abrirLead} />}
        </>
      )}

      <LeadDetailsModal isOpen={openLead} onClose={() => setOpenLead(false)} leadId={selectedLead?.id} onUpdate={loadAgendamentos} />
      {showNova && <NovaAgendaModal coresUsadas={agendas.map(a => a.cor)} onClose={() => setShowNova(false)} onSaved={() => { setShowNova(false); loadAgendas(); }} />}
    </div>
  );
}

// ── Chip de evento ──────────────────────────────────────────────────────────
function Chip({ ag, onClick, compact }: { ag: any; onClick: () => void; compact?: boolean }) {
  const cor = ag.agendas?.cor || 'var(--sage)';
  const cancel = isCancelado(ag);
  return (
    <button
      onClick={onClick}
      title={`${format(dt(ag), 'HH:mm')} · ${ag.nome_lead || ag.leads?.nome_lead || 'Paciente'} · ${ag.agendas?.nome || ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px', width: '100%', textAlign: 'left',
        padding: compact ? '2px 5px' : '4px 7px', borderRadius: '5px', border: 'none', cursor: 'pointer',
        background: cancel ? 'transparent' : `${cor}22`, borderLeft: `3px solid ${cor}`,
        fontSize: compact ? '10.5px' : '11.5px', fontFamily: 'inherit', color: 'var(--ink)',
        opacity: cancel ? 0.5 : 1, textDecoration: cancel ? 'line-through' : 'none', marginBottom: '3px',
        overflow: 'hidden', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 600, color: cor, flexShrink: 0 }}>{format(dt(ag), 'HH:mm')}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ag.nome_lead || ag.leads?.nome_lead || 'Paciente'}</span>
    </button>
  );
}

// ── Visão Mês ───────────────────────────────────────────────────────────────
function VisaoMes({ cursor, range, doDia, onEvento, onDia }: any) {
  const dias = eachDayOfInterval({ start: range.start, end: range.end });
  const semanas: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {labels.map(l => (
          <div key={l} style={{ padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)' }}>{l}</div>
        ))}
      </div>
      {semanas.map((semana, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {semana.map(day => {
            const eventos = doDia(day);
            const foraMes = !isSameMonth(day, cursor);
            return (
              <div
                key={day.toISOString()}
                style={{ minHeight: '104px', padding: '5px 6px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: foraMes ? 'var(--bg)' : 'var(--white)', opacity: foraMes ? 0.55 : 1 }}
              >
                <button
                  onClick={() => onDia(day)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', marginBottom: '3px',
                    borderRadius: '50%', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                    background: isToday(day) ? 'var(--sage-dark)' : 'transparent', color: isToday(day) ? 'white' : 'var(--ink)',
                  }}
                >
                  {format(day, 'd')}
                </button>
                {eventos.slice(0, 3).map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} compact />)}
                {eventos.length > 3 && (
                  <button onClick={() => onDia(day)} style={{ fontSize: '10px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0 5px' }}>
                    +{eventos.length - 3} mais
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Visão Semana ────────────────────────────────────────────────────────────
function VisaoSemana({ range, doDia, onEvento }: any) {
  const dias = eachDayOfInterval({ start: range.start, end: range.end });
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Cabeçalho dos dias */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        <div />
        {dias.map((d: Date) => (
          <div key={d.toISOString()} style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' }}>{format(d, 'EEE', { locale: ptBR })}</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: isToday(d) ? 'var(--sage-dark)' : 'var(--ink)' }}>{format(d, 'd')}</div>
          </div>
        ))}
      </div>
      {/* Grade de horas */}
      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        {HORAS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: '46px' }}>
            <div style={{ padding: '4px 6px', fontSize: '10.5px', color: 'var(--muted)', textAlign: 'right' }}>{String(h).padStart(2, '0')}:00</div>
            {dias.map((d: Date) => {
              const eventos = doDia(d).filter((a: any) => getHours(dt(a)) === h);
              return (
                <div key={d.toISOString()} style={{ borderLeft: '1px solid var(--border)', padding: '3px' }}>
                  {eventos.map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} compact />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visão Dia ───────────────────────────────────────────────────────────────
// Com 'todas', uma coluna por profissional (agendas isoladas). Senão, coluna única.
function VisaoDia({ cursor, agendas, profFiltro, doDia, onEvento }: any) {
  const colunas = profFiltro === 'todas' ? agendas : agendas.filter((a: any) => a.id === profFiltro);
  const eventos = doDia(cursor);
  const cols = colunas.length > 0 ? colunas : [{ id: '__none__', nome: 'Sem profissional', cor: 'var(--sage)' }];

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${cols.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
        <div />
        {cols.map((c: any) => (
          <div key={c.id} style={{ padding: '8px', textAlign: 'center', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: c.cor || 'var(--sage)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{c.nome}</span>
          </div>
        ))}
      </div>
      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        {HORAS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${cols.length}, 1fr)`, borderBottom: '1px solid var(--border)', minHeight: '50px' }}>
            <div style={{ padding: '4px 6px', fontSize: '10.5px', color: 'var(--muted)', textAlign: 'right' }}>{String(h).padStart(2, '0')}:00</div>
            {cols.map((c: any) => {
              const evs = eventos.filter((a: any) => getHours(dt(a)) === h && (c.id === '__none__' ? true : a.agenda_id === c.id));
              return (
                <div key={c.id} style={{ borderLeft: '1px solid var(--border)', padding: '3px' }}>
                  {evs.map((ag: any) => <Chip key={ag.id} ag={ag} onClick={() => onEvento(ag)} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visão Lista ─────────────────────────────────────────────────────────────
function VisaoLista({ agendamentos, onEvento }: any) {
  if (!agendamentos.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px', gap: '10px' }}>
        <CalendarDays size={40} style={{ opacity: 0.2, color: 'var(--muted)' }} />
        <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--muted)' }}>Nenhum agendamento no período</p>
      </div>
    );
  }
  const grupos: { label: string; date: Date; items: any[] }[] = [];
  agendamentos.forEach((ag: any) => {
    const d = dt(ag);
    const g = grupos.find(x => isSameDay(x.date, d));
    if (g) g.items.push(ag);
    else grupos.push({ label: format(d, "EEEE, dd 'de' MMMM", { locale: ptBR }), date: d, items: [ag] });
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {grupos.map(g => (
        <div key={g.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>{g.label}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {g.items.map((ag: any) => {
              const cor = ag.agendas?.cor || 'var(--sage)';
              return (
                <button key={ag.id} onClick={() => onEvento(ag)} style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', borderLeft: `3px solid ${cor}`, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cor, width: '46px' }}>{format(dt(ag), 'HH:mm')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{ag.nome_lead || ag.leads?.nome_lead || 'Paciente'}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      {ag.procedimento_nome || ag.leads?.procedimento_interesse || '—'}{ag.agendas?.nome ? ` · ${ag.agendas.nome}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: isCancelado(ag) ? 'var(--rose-light)' : 'var(--sage-xlight)', color: isCancelado(ag) ? 'var(--rose-text)' : 'var(--sage-dark)' }}>
                    {STATUS_LABEL[ag.status] || ag.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal Nova Agenda (novo profissional) ───────────────────────────────────
function NovaAgendaModal({ coresUsadas, onClose, onSaved }: { coresUsadas: string[]; onClose: () => void; onSaved: () => void }) {
  const proxCor = CORES_PADRAO.find(c => !coresUsadas.includes(c)) || CORES_PADRAO[0];
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(proxCor);
  const [calcomLink, setCalcomLink] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from('agendas').insert({ nome: nome.trim(), cor, calcom_link: calcomLink || null, ativo: true });
    setSalvando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }} onClick={() => !salvando && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', maxWidth: '420px', padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-cormorant" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>Nova agenda (profissional)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Nome do profissional</label>
            <input value={nome} onChange={e => setNome(e.target.value)} style={inp} placeholder="Dra. Maria" />
          </div>
          <div>
            <label style={lbl}>Cor</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CORES_PADRAO.map(c => (
                <button key={c} onClick={() => setCor(c)} style={{ width: '28px', height: '28px', borderRadius: '7px', background: c, border: cor === c ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Link do Cal.com (opcional)</label>
            <input value={calcomLink} onChange={e => setCalcomLink(e.target.value)} style={inp} placeholder="https://cal.com/..." />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || !nome.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--sage-dark)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', opacity: salvando || !nome.trim() ? 0.6 : 1 }}>
            {salvando && <Loader2 size={13} className="animate-spin" />} Criar agenda
          </button>
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'var(--white)', color: 'var(--ink)', cursor: 'pointer' };
const lbl: React.CSSProperties = { fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none', boxSizing: 'border-box' };
