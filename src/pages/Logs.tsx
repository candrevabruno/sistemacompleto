import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { Activity, ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react';

interface IntegrationLog {
  id: string;
  servico: string;
  nivel: 'info' | 'warn' | 'error';
  origem: string;
  mensagem: string | null;
  payload_resumo: Record<string, unknown> | null;
  criado_em: string;
}

type SemaforoStatus = 'verde' | 'amarelo' | 'vermelho' | 'cinza';

interface ServicoConfig {
  id: string;
  label: string;
  descricao: string;
  configAtiva: boolean;
}

const NIVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  info:  { bg: '#DCFCE7', text: '#166534', label: 'Info'  },
  warn:  { bg: '#FEF9C3', text: '#854D0E', label: 'Aviso' },
  error: { bg: '#FEE2E2', text: '#991B1B', label: 'Erro'  },
};

const SEMAFORO_CONFIG: Record<SemaforoStatus, { cor: string; label: string; desc: string }> = {
  verde:    { cor: '#22C55E', label: 'Funcionando',          desc: 'Ativo nas últimas 24h sem erros' },
  amarelo:  { cor: '#EAB308', label: 'Sem atividade recente', desc: 'Configurado, mas sem registros nas últimas 24h' },
  vermelho: { cor: '#EF4444', label: 'Erros recentes',        desc: 'Erros registrados na última hora' },
  cinza:    { cor: '#9CA3AF', label: 'Sem dados',             desc: 'Nenhum registro de monitoramento ainda' },
};

function computeSemaforo(servicoId: string, configAtiva: boolean, logs: IntegrationLog[]): SemaforoStatus {
  const sl = logs.filter(l => l.servico === servicoId);
  if (sl.length === 0) return configAtiva ? 'amarelo' : 'cinza';

  const now = Date.now();
  const h1  = now - 60 * 60 * 1000;
  const h24 = now - 24 * 60 * 60 * 1000;

  if (sl.some(l => l.nivel === 'error' && new Date(l.criado_em).getTime() > h1)) return 'vermelho';
  if (sl.some(l => l.nivel === 'info'  && new Date(l.criado_em).getTime() > h24)) return 'verde';
  return 'amarelo';
}

function SemaforoCard({ servico, status }: { servico: ServicoConfig; status: SemaforoStatus }) {
  const s = SEMAFORO_CONFIG[status];
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.cor, flexShrink: 0, marginTop: 3,
        boxShadow: status !== 'cinza' ? `0 0 0 3px ${s.cor}33` : 'none' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{servico.label}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: s.cor }}>{s.label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
      </div>
    </div>
  );
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <pre style={{ fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 10px', margin: 0, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#334155' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

export function Logs() {
  const { config } = useClinic();
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterServico, setFilterServico] = useState('');
  const [filterNivel, setFilterNivel] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const servicos: ServicoConfig[] = [
    { id: 'calcom',      label: 'Agenda (Cal.com)',    descricao: 'Sincronização de agendamentos', configAtiva: true },
    { id: 'evolution',   label: 'WhatsApp (Evolution)', descricao: 'Webhooks de mensagens',         configAtiva: !!(config?.whatsapp_provider === 'evolution' && config?.evolution_server_url) },
    { id: 'meta',        label: 'WhatsApp (Meta)',      descricao: 'Webhooks de mensagens',         configAtiva: !!(config?.whatsapp_provider === 'meta' && config?.meta_phone_number_id) },
    { id: 'n8n_eventos', label: 'Eventos (n8n)',        descricao: 'Disparos de aniversário e ações', configAtiva: !!(config?.aniversario_webhook_url) },
    { id: 'n8n_intake',  label: 'Automações (n8n)',     descricao: 'Consentimento, CSAT, NPS',       configAtiva: true },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('integration_log')
        .select('*')
        .gte('criado_em', desde)
        .order('criado_em', { ascending: false })
        .limit(300);
      if (error) throw error;
      setLogs((data as IntegrationLog[]) ?? []);
    } catch (err) {
      console.error('Logs erro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = logs.filter(l => {
    if (filterServico && l.servico !== filterServico) return false;
    if (filterNivel && l.nivel !== filterNivel) return false;
    if (search && !l.mensagem?.toLowerCase().includes(search.toLowerCase()) && !l.origem.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const inputStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: 13, color: 'var(--ink)', background: 'var(--white)', outline: 'none' };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Activity size={20} style={{ color: 'var(--sage-dark)', flexShrink: 0 }} />
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Saúde das Integrações</h1>
        <button onClick={load} title="Atualizar" style={{ marginLeft: 'auto', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', background: 'var(--white)', cursor: 'pointer', color: 'var(--muted)' }}>
          <RefreshCw size={13} style={{ display: 'block' }} />
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, marginLeft: 30 }}>
        Semáforo derivado dos últimos 7 dias de logs. Atualizado a cada acesso.
      </p>

      {/* Semaphore cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 32 }}>
        {servicos.map(s => (
          <SemaforoCard key={s.id} servico={s} status={computeSemaforo(s.id, s.configAtiva, logs)} />
        ))}
      </div>

      {/* Log table */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, marginRight: 8 }}>Logs recentes</h2>

        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft: 26, width: 160 }} />
        </div>

        <select value={filterServico} onChange={e => setFilterServico(e.target.value)} style={inputStyle}>
          <option value="">Todos os serviços</option>
          {servicos.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)} style={inputStyle}>
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warn">Aviso</option>
          <option value="error">Erro</option>
        </select>

        {(search || filterServico || filterNivel) && (
          <button onClick={() => { setSearch(''); setFilterServico(''); setFilterNivel(''); }}
            style={{ ...inputStyle, cursor: 'pointer', color: 'var(--muted)' }}>
            Limpar
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''} (últimos 7 dias)
        </span>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Nenhum log ainda. Os registros aparecerão aqui assim que as integrações forem utilizadas.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32, paddingRight: 4 }} />
                  <th style={thStyle}>Quando</th>
                  <th style={thStyle}>Serviço</th>
                  <th style={thStyle}>Nível</th>
                  <th style={thStyle}>Origem</th>
                  <th style={thStyle}>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const isExpanded = expanded.has(log.id);
                  const hasPayload = !!log.payload_resumo;
                  const nivelStyle = NIVEL_COLORS[log.nivel] ?? NIVEL_COLORS.info;
                  const servicoLabel = servicos.find(s => s.id === log.servico)?.label ?? log.servico;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => hasPayload && toggleExpand(log.id)}
                        style={{ cursor: hasPayload ? 'pointer' : 'default' }}
                        onMouseEnter={e => { if (hasPayload) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                      >
                        <td style={{ ...tdStyle, width: 32, paddingRight: 4, color: 'var(--muted)' }}>
                          {hasPayload && (isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>{formatDate(log.criado_em)}</td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{servicoLabel}</td>
                        <td style={tdStyle}>
                          <span style={{ background: nivelStyle.bg, color: nivelStyle.text, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500 }}>
                            {nivelStyle.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--muted)', fontSize: 12, fontFamily: 'monospace' }}>{log.origem}</td>
                        <td style={{ ...tdStyle, fontSize: 12, maxWidth: 320 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.mensagem ?? '—'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && hasPayload && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 16px 12px 48px', background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: 5 }}>PAYLOAD</div>
                              <JsonBlock data={log.payload_resumo!} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
