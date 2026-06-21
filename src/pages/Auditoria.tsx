import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../hooks/useRealtime';
import { ScrollText, ChevronDown, ChevronRight, ChevronLeft, Search } from 'lucide-react';

const PAGE_SIZE = 25;

interface AuditRow {
  log_id: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  record_id: string | null;
  detalhes: Record<string, unknown> | null;
  tabela: string | null;
  modulo: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  created_at: string;
  display_email: string;
  total_count: number;
}

const MODULO_COLORS: Record<string, { bg: string; text: string }> = {
  'LGPD':       { bg: '#FEF3C7', text: '#92400E' },
  'Permissões': { bg: '#EDE9FE', text: '#5B21B6' },
  'Config':     { bg: '#F0FDF4', text: '#166534' },
  'CRM':        { bg: '#DBEAFE', text: '#1E40AF' },
  'Pacientes':  { bg: '#FCE7F3', text: '#9D174D' },
  'Agenda':     { bg: '#ECFDF5', text: '#065F46' },
  'Sistema':    { bg: '#F3F4F6', text: '#374151' },
};

function moduloLabel(row: AuditRow): string {
  if (row.modulo) {
    const MAP: Record<string, string> = {
      permissoes: 'Permissões', configuracoes: 'Config',
      agenda: 'Agenda', pacientes: 'Pacientes', crm: 'CRM',
    };
    return MAP[row.modulo] ?? row.modulo;
  }
  const a = row.action ?? '';
  if (a.startsWith('cpf_') || a.includes('consentimento') || a.includes('anonimizar') || a.includes('exportar')) return 'LGPD';
  if (a.includes('apagar_paciente') || a.includes('arquivar_paciente')) return 'LGPD';
  if (a.includes('lead') || a.includes('conversa')) return 'CRM';
  if (a.includes('agendamento') || a.includes('agenda')) return 'Agenda';
  if (a.includes('paciente') || a.includes('anotac')) return 'Pacientes';
  return 'Sistema';
}

function ModuloChip({ label }: { label: string }) {
  const c = MODULO_COLORS[label] ?? MODULO_COLORS['Sistema'];
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <pre style={{
      fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6,
      padding: '8px 10px', margin: 0, maxHeight: 200, overflow: 'auto',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#334155',
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px',
  borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, color: 'var(--ink)',
  borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)',
  fontSize: 13, color: 'var(--ink)', background: 'var(--white)', outline: 'none',
};

export function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_get_audit_log', {
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
        p_search: search || null,
        p_modulo: null,
        p_data_inicio: dataInicio || null,
        p_data_fim: dataFim || null,
      });
      if (error) throw error;
      const rows = (data as AuditRow[]) ?? [];
      setRows(rows);
      setTotal(rows[0]?.total_count ?? 0);
    } catch (err) {
      console.error('Auditoria erro:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, dataInicio, dataFim]);

  useEffect(() => { void load(); }, [load]);
  // Realtime: novas ações de auditoria aparecem sem F5.
  useRealtime(['audit_log'], () => { void load(); });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setSearchInput('');
    setDataInicio('');
    setDataFim('');
    setPage(1);
  }

  const hasFilters = search || dataInicio || dataFim;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ScrollText size={20} style={{ color: 'var(--sage-dark)', flexShrink: 0 }} />
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Auditoria</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, marginLeft: 30 }}>
        Registro de todas as ações realizadas no sistema.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            placeholder="Buscar ação ou usuário..."
            style={{ ...inputStyle, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dataInicio}
            onChange={e => { setDataInicio(e.target.value); setPage(1); }}
            style={inputStyle} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>até</span>
          <input type="date" value={dataFim}
            onChange={e => { setDataFim(e.target.value); setPage(1); }}
            style={inputStyle} />
        </div>

        <button onClick={applySearch}
          style={{ padding: '8px 16px', background: 'var(--sage-dark)', color: '#fff', border: 'none', borderRadius: 'var(--r-xs)', fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
          Filtrar
        </button>

        {hasFilters && (
          <button onClick={clearFilters}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'var(--white)', borderRadius: 'var(--r-xs)', fontSize: 13, cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Carregando...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Nenhum registro{hasFilters ? ' para os filtros aplicados' : ' encontrado'}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32, paddingRight: 4 }} />
                  <th style={thStyle}>Quando</th>
                  <th style={thStyle}>Ator</th>
                  <th style={thStyle}>Ação</th>
                  <th style={thStyle}>Módulo</th>
                  <th style={thStyle}>Tabela</th>
                  <th style={thStyle}>Registro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const modulo = moduloLabel(row);
                  const isExpanded = expanded.has(row.log_id);
                  const hasDetails = !!(row.detalhes || row.valor_anterior || row.valor_novo);
                  return (
                    <React.Fragment key={row.log_id}>
                      <tr
                        onClick={() => hasDetails && toggleExpand(row.log_id)}
                        style={{ cursor: hasDetails ? 'pointer' : 'default', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (hasDetails) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                      >
                        <td style={{ ...tdStyle, width: 32, paddingRight: 4, color: 'var(--muted)' }}>
                          {hasDetails && (isExpanded
                            ? <ChevronDown size={13} />
                            : <ChevronRight size={13} />
                          )}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>
                          {formatDate(row.created_at)}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 180, fontSize: 12 }} title={row.display_email}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.display_email}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--ink)' }}>
                          {row.action}
                        </td>
                        <td style={tdStyle}>
                          <ModuloChip label={modulo} />
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--muted)', fontSize: 12 }}>
                          {row.tabela ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                          {row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}
                        </td>
                      </tr>

                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 16px 14px 48px', background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                            {row.detalhes && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: 5 }}>DETALHES</div>
                                <JsonBlock data={row.detalhes} />
                              </div>
                            )}
                            {row.valor_anterior && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: 5 }}>ANTES</div>
                                <JsonBlock data={row.valor_anterior} />
                              </div>
                            )}
                            {row.valor_novo && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: 5 }}>DEPOIS</div>
                                <JsonBlock data={row.valor_novo} />
                              </div>
                            )}
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

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''} · página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', background: page <= 1 ? 'var(--bg)' : 'var(--white)', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: 'var(--muted)', opacity: page <= 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', background: page >= totalPages ? 'var(--bg)' : 'var(--white)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: 'var(--muted)', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
