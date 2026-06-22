import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Check, Send, ClipboardList, History, AlertTriangle, CalendarCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { HistoricoModal, type HistItem } from './HistoricoModal';

interface Props {
  pacienteId: string;
  leadId?: string;
  nomePaciente?: string;
}

export function ResumoConsultaSection({ pacienteId, leadId, nomePaciente }: Props) {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [historico, setHistorico] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Campo: Data de retorno esperado
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [retornoEsperado, setRetornoEsperado] = useState('');
  const [editandoRetorno, setEditandoRetorno] = useState(false);
  const [salvandoRetorno, setSalvandoRetorno] = useState(false);
  const [retornoSalvo, setRetornoSalvo] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: anotacoes }, { data: config }, { data: ciclo }] = await Promise.all([
      supabase
        .from('anotacoes_paciente')
        .select('id, conteudo, autor_nome, editado_em, created_at')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'resumo_consulta')
        .order('created_at', { ascending: false }),
      supabase.from('clinic_config').select('nota_webhook_url').single(),
      supabase
        .from('ciclos_jornada_paciente')
        .select('id, retorno_esperado_em')
        .eq('paciente_id', pacienteId)
        .not('retorno_esperado_em', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (anotacoes) setHistorico(anotacoes);
    if (config?.nota_webhook_url) setWebhookUrl(config.nota_webhook_url);
    if (ciclo) {
      setCicloId(ciclo.id);
      setRetornoEsperado(ciclo.retorno_esperado_em || '');
    } else {
      setCicloId(null);
      setRetornoEsperado('');
    }
    setLoading(false);
  };

  // Clique no botão: sempre pede dupla confirmação antes de salvar/enviar (item 4).
  const onClicarSalvar = () => {
    if (!texto.trim() || !user) return;
    setConfirmOpen(true);
  };

  const salvarEEnviar = async () => {
    if (!texto.trim() || !user) return;
    setConfirmOpen(false);
    setSalvando(true);

    await supabase.from('anotacoes_paciente').insert({
      paciente_id: pacienteId,
      autor_id: user.id,
      autor_nome: user.nome || user.email || 'Profissional',
      tipo: 'resumo_consulta',
      conteudo: texto.trim(),
    });

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paciente_id: pacienteId,
            lead_id: leadId || null,
            nome_paciente: nomePaciente || '',
            nota: texto.trim(),
            profissional: user.nome || user.email || '',
            data: new Date().toISOString(),
            retorno_esperado_em: retornoEsperado || null,
          }),
        });
      } catch (_) { /* falha de rede no webhook não bloqueia o salvamento */ }
    }

    setTexto('');
    setSalvando(false);
    carregarDados();
  };

  const salvarRetorno = async () => {
    if (!user) return;
    setSalvandoRetorno(true);
    try {
      let id = cicloId;
      if (id) {
        await supabase.from('ciclos_jornada_paciente')
          .update({ retorno_esperado_em: retornoEsperado || null, updated_at: new Date().toISOString() })
          .eq('id', id);
      } else {
        const { data: novo } = await supabase.from('ciclos_jornada_paciente')
          .insert({ paciente_id: pacienteId, lead_id: leadId || null, retorno_esperado_em: retornoEsperado || null, criado_por: user.id })
          .select('id').single();
        if (novo) { id = novo.id; setCicloId(novo.id); }
      }
      if (retornoEsperado) {
        await supabase.from('agente_eventos').insert({
          tipo: 'retorno_planejado',
          lead_id: leadId || null,
          payload: { paciente_id: pacienteId, retorno_esperado_em: retornoEsperado, ciclo_id: id },
        });
      }
      setEditandoRetorno(false);
      setRetornoSalvo(true);
      setTimeout(() => setRetornoSalvo(false), 3000);
    } finally {
      setSalvandoRetorno(false);
    }
  };

  const onEditar = async (id: string, conteudo: string) => {
    await supabase.from('anotacoes_paciente').update({
      conteudo, editado_em: new Date().toISOString(), editado_por: user?.id,
    }).eq('id', id);
    await carregarDados();
  };

  const onApagar = async (id: string) => {
    await supabase.from('anotacoes_paciente').delete().eq('id', id);
    await carregarDados();
  };

  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <ClipboardList size={13} style={{ color: 'var(--sage-dark)' }} />
        Resumo da consulta
        {webhookUrl && (
          <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 500, letterSpacing: 0, textTransform: 'none', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', padding: '2px 8px', borderRadius: '20px' }}>
            Será enviado ao paciente
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Novo resumo
          </label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Descreva o que foi discutido e recomendado na consulta..."
            rows={6}
            style={{ padding: '10px 12px', border: '1px solid var(--border-md)', borderRadius: '10px', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', resize: 'none', outline: 'none', background: 'var(--white)', lineHeight: 1.5 }}
          />
          <button
            onClick={onClicarSalvar}
            disabled={!texto.trim() || salvando}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', opacity: (!texto.trim() || salvando) ? 0.5 : 1 }}
          >
            {salvando ? <Loader2 size={13} className="animate-spin" /> : webhookUrl ? <Send size={13} /> : <Check size={13} />}
            {webhookUrl ? 'Salvar e enviar ao paciente' : 'Salvar resumo'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Histórico ({historico.length})
            </label>
            {historico.length > 0 && (
              <button onClick={() => setShowHist(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, color: 'var(--sage-dark)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <History size={13} /> Ver histórico
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--muted)' }} />
            </div>
          ) : historico.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '8px', textAlign: 'center' }}>
              <ClipboardList size={20} style={{ color: 'var(--border-md)' }} />
              <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Nenhum resumo salvo ainda</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {historico.map(r => (
                <div key={r.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.conteudo}
                  </p>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.autor_nome}</span>
                    <span>{format(new Date(r.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dupla confirmação antes de enviar ao paciente */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} bare className="max-w-sm mx-4">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--champ-light)' }}>
            <AlertTriangle className="w-6 h-6" style={{ color: 'var(--champ-text)' }} />
          </div>
          <h3 className="font-display mb-2" style={{ fontSize: '19px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
            {webhookUrl ? 'Enviar resumo ao paciente?' : 'Salvar resumo?'}
          </h3>
          <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
            {webhookUrl
              ? 'Deseja realmente enviar o resumo para o paciente? Reveja o texto antes de confirmar — a mensagem será disparada via WhatsApp.'
              : 'Deseja realmente salvar este resumo no prontuário do paciente? Reveja o texto antes de confirmar.'}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmOpen(false)} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px]" style={{ border: '1px solid var(--border-md)', color: 'var(--ink)', background: 'transparent' }}>
              Cancelar
            </button>
            <button onClick={salvarEEnviar} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px]" style={{ background: 'var(--sage-dark)', color: '#fff' }}>
              {webhookUrl ? 'Confirmar e enviar' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      <HistoricoModal
        open={showHist}
        onClose={() => setShowHist(false)}
        titulo="Histórico de resumos"
        itens={historico}
        onEditar={onEditar}
        onApagar={onApagar}
      />

      {/* Data de retorno esperado */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <CalendarCheck size={13} style={{ color: 'var(--sage-dark)' }} />
          Data de retorno esperado
          {retornoSalvo && (
            <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 500, letterSpacing: 0, textTransform: 'none', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', padding: '2px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={10} /> Data de retorno salva
            </span>
          )}
        </div>

        {!editandoRetorno && retornoEsperado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '7px 12px', background: 'var(--champ-light)', borderRadius: '8px', border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarCheck size={13} style={{ color: 'var(--champ-text)' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>
                {format(parseISO(retornoEsperado), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            <button
              onClick={() => setEditandoRetorno(true)}
              style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sage-dark)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px' }}
            >
              Editar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={retornoEsperado}
              onChange={e => setRetornoEsperado(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', outline: 'none', background: 'var(--white)' }}
            />
            <button
              onClick={salvarRetorno}
              disabled={salvandoRetorno}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '7px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: salvandoRetorno ? 0.7 : 1 }}
            >
              {salvandoRetorno ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Salvar data
            </button>
            {editandoRetorno && (
              <button
                onClick={() => setEditandoRetorno(false)}
                style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
            )}
          </div>
        )}

        <p style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '7px', lineHeight: 1.5 }}>
          {retornoEsperado
            ? 'WF07 disparará 3 dias antes desta data com convite de retorno.'
            : 'Opcional. Sem data, o agente usa o fluxo padrão de reativação (D+60 / D+180).'}
        </p>
      </div>
    </div>
  );
}
