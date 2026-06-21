import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../hooks/useRealtime';
import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Gift, Cake, Megaphone, Archive, Plus, Loader2, Lock, Sparkles, X, RotateCcw, Calendar, Pencil, Trash2, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Tab = 'aniversarios' | 'acoes';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function Eventos() {
  const { config } = useClinic();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('aniversarios');

  const liberado = Boolean(config?.eventos_enabled);
  const podeVer = can('feature:eventos');

  if (!podeVer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '10px', textAlign: 'center' }}>
        <Lock size={36} style={{ opacity: 0.25, color: 'var(--muted)' }} />
        <p className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', color: 'var(--ink)' }}>Sem acesso ao módulo Eventos</p>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Fale com o administrador da clínica para liberar o acesso.</p>
      </div>
    );
  }

  if (!liberado) return <UpgradeGate />;

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gift size={20} style={{ color: 'var(--sage-dark)' }} /> Eventos
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
          {([['aniversarios', 'Aniversariantes'], ['acoes', 'Ações do mês']] as [Tab, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: tab === v ? 'var(--sage-dark)' : 'transparent', color: tab === v ? 'white' : 'var(--muted)' }}>
              {v === 'aniversarios' ? <Cake size={13} /> : <Megaphone size={13} />} {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'aniversarios' ? <Aniversariantes /> : <AcoesDoMes />}
    </div>
  );
}

// ── Tela de upgrade (sem o plano) ────────────────────────────────────────────
function UpgradeGate() {
  const { config } = useClinic();
  const wa = config?.heroic_leap_whatsapp || '5511999999999';
  const msg = encodeURIComponent('Olá! Gostaria de solicitar a liberação do Módulo Eventos no sistema da clínica.');

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', minHeight: '100%' }}>
      <div style={{ maxWidth: '460px', textAlign: 'center', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px 32px', boxShadow: 'var(--shadow)' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <Gift size={28} style={{ color: 'var(--sage-dark)' }} />
        </div>
        <h2 className="font-display" style={{ fontSize: '22px', fontStyle: 'italic', color: 'var(--ink)', marginBottom: '8px' }}>Módulo Eventos</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '22px' }}>
          Envie mensagens de parabéns aos aniversariantes do mês e crie campanhas sazonais que o agente menciona naturalmente no atendimento. Um recurso premium da Heroic Leap.
        </p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px', fontSize: '13px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', borderRadius: 'var(--r-xs)', textDecoration: 'none', fontFamily: 'inherit' }}
        >
          <Sparkles size={14} /> Solicitar liberação
        </a>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '12px' }}>Entraremos em contato via WhatsApp para liberar o módulo.</p>
      </div>
    </div>
  );
}

// ── Aniversariantes do mês ───────────────────────────────────────────────────
// Painel read-only: mostra quem são os aniversariantes e o status do disparo do mês.
// O n8n dispara automaticamente (agendado) e chama eventos-dispatch?action=registrar_disparo.
function Aniversariantes() {
  const { config, refreshConfig } = useClinic();
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const agora = new Date();
  const mesAtual = agora.getMonth(); // 0-11
  const mesChave = `${agora.getFullYear()}-${String(mesAtual + 1).padStart(2, '0')}`;

  // Status do último disparo (salvo pelo n8n via registrar_disparo)
  const dispatch: { mes?: string; enviado_em?: string; total?: number } | null =
    (config as any)?.aniversario_last_dispatch ?? null;
  const disparadoEsteMes = dispatch?.mes === mesChave;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pacientes')
      .select('id, leads:lead_id(id, nome_lead, whatsapp_lead, data_nascimento, arquivado)');
    const lista = (data || [])
      .map((p: any) => p.leads)
      .filter((l: any) => l && l.data_nascimento && !l.arquivado)
      .filter((l: any) => {
        const m = parseInt(String(l.data_nascimento).slice(5, 7), 10) - 1;
        return m === mesAtual;
      })
      .sort((a: any, b: any) => String(a.data_nascimento).slice(8, 10).localeCompare(String(b.data_nascimento).slice(8, 10)));
    setItens(lista);
    setLoading(false);
  };

  const atualizar = async () => {
    setAtualizando(true);
    await refreshConfig();
    setAtualizando(false);
  };

  useEffect(() => { load(); }, []);
  // Realtime: aniversariantes do mês atualizam sem F5.
  useRealtime(['pacientes', 'leads'], load);

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Status do disparo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', background: disparadoEsteMes ? 'var(--sage-xlight)' : 'var(--white)', border: `1px solid ${disparadoEsteMes ? 'var(--sage-light)' : 'var(--border)'}`, borderRadius: '10px', padding: '12px 14px' }}>
        {disparadoEsteMes
          ? <CheckCircle2 size={16} style={{ color: 'var(--sage-dark)', flexShrink: 0 }} />
          : <Cake size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          {disparadoEsteMes ? (
            <span style={{ fontSize: '12.5px', color: 'var(--sage-dark)', fontWeight: 600 }}>
              Disparado em {format(new Date(dispatch!.enviado_em!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {dispatch!.total != null ? ` — ${dispatch!.total} paciente${dispatch!.total !== 1 ? 's' : ''}` : ''}
            </span>
          ) : (
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
              Nenhum disparo registrado em <strong>{MESES[mesAtual]}</strong> — o n8n dispara automaticamente no dia configurado.
            </span>
          )}
        </div>
        <button
          onClick={atualizar}
          disabled={atualizando}
          title="Atualizar status"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex' }}
        >
          <RefreshCw size={14} className={atualizando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Card da lista */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cake size={15} style={{ color: 'var(--sage-dark)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Aniversariantes de {MESES[mesAtual]}</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted)' }}>{itens.length} paciente{itens.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : itens.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px', gap: '8px' }}>
            <Cake size={36} style={{ opacity: 0.2, color: 'var(--muted)' }} />
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Nenhum aniversariante neste mês.</p>
          </div>
        ) : (
          <div>
            {itens.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '50%', background: 'var(--sage-light)', color: 'var(--sage-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{String(l.data_nascimento).slice(8, 10)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{l.nome_lead || 'Paciente'}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{l.whatsapp_lead || 'sem WhatsApp'}</div>
                </div>
                {disparadoEsteMes && (
                  <span title="Mensagem enviada este mês" style={{ display: 'flex', flexShrink: 0 }}><CheckCircle2 size={15} style={{ color: 'var(--sage-dark)', opacity: 0.6 }} /></span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '10px', lineHeight: 1.6 }}>
        O n8n dispara as mensagens automaticamente e registra o status acima. Configure o agendamento e a mensagem no fluxo de Aniversário do n8n.
      </p>
    </div>
  );
}

// ── Ações do mês (campanhas) ─────────────────────────────────────────────────
function AcoesDoMes() {
  const { user, canEdit } = useAuth();
  const podeEditar = canEdit('feature:eventos:disparos');
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [apagando, setApagando] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('clinic_campaigns').select('*').order('status').order('data_inicio', { ascending: false, nullsFirst: false });
    setCampanhas(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // Realtime: campanhas atualizam sem F5.
  useRealtime(['clinic_campaigns'], load);

  const ativas = useMemo(() => campanhas.filter(c => c.status === 'ativa'), [campanhas]);
  const arquivadas = useMemo(() => campanhas.filter(c => c.status === 'arquivada'), [campanhas]);

  const arquivar = async (c: any) => {
    await supabase.from('clinic_campaigns').update({ status: 'arquivada', updated_at: new Date().toISOString() }).eq('id', c.id);
    load();
  };
  const reutilizar = (c: any) => { setEditando({ titulo: c.titulo, oferta: c.oferta, descricao: c.descricao, data_inicio: '', data_fim: '', _reuse: true }); setShowForm(true); };
  const apagar = async () => {
    if (!confirmDel) return;
    setApagando(true);
    await supabase.from('clinic_campaigns').delete().eq('id', confirmDel.id);
    setApagando(false); setConfirmDel(null);
    load();
  };

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, flex: 1 }}>
          Campanhas sazonais <strong>não são envio em massa</strong> — quando ativas, alimentam o contexto do agente, que menciona a promoção naturalmente no atendimento. Ao fim do período, arquive (não exclui) para histórico e reuso.
        </p>
        {podeEditar && (
          <button onClick={() => { setEditando(null); setShowForm(true); }} style={{ ...btnPrimary, flexShrink: 0 }}><Plus size={14} /> Nova ação</button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /></div>
      ) : (
        <>
          <SecaoCampanhas titulo="Ativas" itens={ativas} vazio="Nenhuma campanha ativa." podeEditar={podeEditar} onArquivar={arquivar} onApagar={setConfirmDel} onEditar={(c: any) => { setEditando(c); setShowForm(true); }} />
          {arquivadas.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <SecaoCampanhas titulo="Arquivadas" itens={arquivadas} vazio="" arquivada podeEditar={podeEditar} onReutilizar={reutilizar} onApagar={setConfirmDel} />
            </div>
          )}
        </>
      )}

      {confirmDel && (
        <div style={modalOverlay} onClick={() => !apagando && setConfirmDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '400px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flexShrink: 0, width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--rose-light)', color: 'var(--rose-text)' }}><AlertTriangle size={16} /></div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Apagar "{confirmDel.titulo}"?</p>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>Esta ação é permanente. Se quiser manter para histórico/reuso, use Arquivar.</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setConfirmDel(null)} disabled={apagando} style={btnGhost}>Cancelar</button>
              <button onClick={apagar} disabled={apagando} style={{ ...btnPrimary, background: 'var(--rose-text)' }}>{apagando && <Loader2 size={13} className="animate-spin" />} Apagar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && podeEditar && (
        <CampanhaForm
          inicial={editando}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSaved={() => { setShowForm(false); setEditando(null); load(); }}
          userId={user?.id || null}
        />
      )}
    </div>
  );
}

function SecaoCampanhas({ titulo, itens, vazio, arquivada, podeEditar, onArquivar, onReutilizar, onEditar, onApagar }: any) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>{titulo}</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      {itens.length === 0 ? (
        vazio ? <p style={{ fontSize: '12.5px', color: 'var(--muted)', padding: '8px 0' }}>{vazio}</p> : null
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {itens.map((c: any) => (
            <div key={c.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', opacity: arquivada ? 0.72 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{c.titulo}</span>
                    {c.oferta && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '2px 8px', borderRadius: '20px' }}>{c.oferta}</span>}
                  </div>
                  {c.descricao && <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>{c.descricao}</p>}
                  {(c.data_inicio || c.data_fim) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--muted)', marginTop: '6px' }}>
                      <Calendar size={11} />
                      {c.data_inicio ? format(parseISO(c.data_inicio), 'dd/MM/yy', { locale: ptBR }) : '—'} até {c.data_fim ? format(parseISO(c.data_fim), 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </div>
                  )}
                </div>
                {podeEditar && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!arquivada && <button onClick={() => onEditar(c)} title="Editar" style={miniBtn}><Pencil size={13} /></button>}
                    {!arquivada && <button onClick={() => onArquivar(c)} title="Arquivar" style={miniBtn}><Archive size={14} /></button>}
                    {arquivada && <button onClick={() => onReutilizar(c)} title="Reutilizar" style={miniBtn}><RotateCcw size={14} /></button>}
                    <button onClick={() => onApagar(c)} title="Apagar" style={{ ...miniBtn, color: 'var(--rose-text)' }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampanhaForm({ inicial, onClose, onSaved, userId }: { inicial: any; onClose: () => void; onSaved: () => void; userId: string | null }) {
  const editId = inicial && !inicial._reuse ? inicial.id : null;
  const [titulo, setTitulo] = useState(inicial?.titulo || '');
  const [oferta, setOferta] = useState(inicial?.oferta || '');
  const [descricao, setDescricao] = useState(inicial?.descricao || '');
  const [dataInicio, setDataInicio] = useState(inicial?.data_inicio || '');
  const [dataFim, setDataFim] = useState(inicial?.data_fim || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!titulo.trim()) { setErro('Informe o título da campanha.'); return; }
    setSalvando(true); setErro(null);
    const payload: any = {
      titulo: titulo.trim(), oferta: oferta.trim() || null, descricao: descricao.trim() || null,
      data_inicio: dataInicio || null, data_fim: dataFim || null, updated_at: new Date().toISOString(),
    };
    let res;
    if (editId) res = await supabase.from('clinic_campaigns').update(payload).eq('id', editId);
    else res = await supabase.from('clinic_campaigns').insert({ ...payload, status: 'ativa', created_by: userId });
    setSalvando(false);
    if (res.error) { setErro('Erro: ' + res.error.message); return; }
    onSaved();
  };

  return (
    <div style={modalOverlay} onClick={() => !salvando && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-cormorant" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>{editId ? 'Editar ação' : 'Nova ação do mês'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
        </div>
        {erro && <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>{erro}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Mês da Mulher" style={inp} /></div>
          <div><label style={lbl}>Oferta (curto)</label><input value={oferta} onChange={e => setOferta(e.target.value)} placeholder="Ex: 20% em faciais" style={inp} /></div>
          <div><label style={lbl}>Descrição (o agente usa este texto)</label><textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="Ex: Durante março, faciais com 20% de desconto. Válido para novos e antigos pacientes." style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><label style={lbl}>Início</label><input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Fim</label><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inp} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={salvando} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>{salvando && <Loader2 size={13} className="animate-spin" />} {editId ? 'Salvar' : 'Criar ação'}</button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none', boxSizing: 'border-box' };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' };
const modalBox: React.CSSProperties = { background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', padding: '22px', maxHeight: '88vh', overflowY: 'auto' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--sage-dark)', color: 'white', cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' };
const miniBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' };
