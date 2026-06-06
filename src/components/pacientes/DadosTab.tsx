import React, { useEffect, useState } from 'react';
import { Loader2, Send, Save, Phone, User, Stethoscope } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClinic } from '../../contexts/ClinicContext';

interface Props {
  lead: any;
  pacienteId: string | null;
}

export function DadosTab({ lead, pacienteId }: Props) {
  const { config } = useClinic();
  const [nota, setNota] = useState('');
  const [resumo, setResumo] = useState('');
  const [savingNota, setSavingNota] = useState(false);
  const [savingResumo, setSavingResumo] = useState(false);
  const [notaSaved, setNotaSaved] = useState(false);
  const [resumoSaved, setResumoSaved] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    supabase
      .from('pacientes')
      .select('nota, resumo')
      .eq('id', pacienteId)
      .single()
      .then(({ data }) => {
        if (data) {
          setNota(data.nota || '');
          setResumo(data.resumo || '');
        }
      });
  }, [pacienteId]);

  async function salvarNota() {
    if (!pacienteId) return;
    setSavingNota(true);
    try {
      await supabase
        .from('pacientes')
        .update({ nota, nota_updated_at: new Date().toISOString() })
        .eq('id', pacienteId);

      if (config?.nota_webhook_url) {
        await fetch(config.nota_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            nome: lead.nome_lead,
            whatsapp: lead.whatsapp_lead,
            procedimento: lead.procedimento_interesse,
            nota,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {}); // webhook failure doesn't block saving
      }

      setNotaSaved(true);
      setTimeout(() => setNotaSaved(false), 3000);
    } finally {
      setSavingNota(false);
    }
  }

  async function salvarResumo() {
    if (!pacienteId) return;
    setSavingResumo(true);
    try {
      await supabase
        .from('pacientes')
        .update({ resumo })
        .eq('id', pacienteId);
      setResumoSaved(true);
      setTimeout(() => setResumoSaved(false), 3000);
    } finally {
      setSavingResumo(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Contato */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Informações de Contato
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Nome</p>
              <p className="text-sm text-[var(--color-text-main)] font-medium">
                {lead.nome_lead || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">WhatsApp</p>
              <p className="text-sm text-[var(--color-text-main)] font-medium font-mono">
                {lead.whatsapp_lead || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Procedimento</p>
              <p className="text-sm text-[var(--color-text-main)] font-medium">
                {lead.procedimento_interesse || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-card)]" />

      {/* Nota para IA */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-main)]">Nota para IA</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Ao salvar, dispara automação via n8n e envia mensagem ao paciente pelo WhatsApp.
            </p>
          </div>
          <button
            onClick={salvarNota}
            disabled={savingNota || !pacienteId}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[8px] transition-all ${
              notaSaved
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40'
            }`}
          >
            {savingNota ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : notaSaved ? (
              '✓ Enviado'
            ) : (
              <>
                <Send className="w-4 h-4" />
                Salvar e Enviar
              </>
            )}
          </button>
        </div>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Escreva a nota clínica que será processada pela IA e enviada ao paciente..."
          rows={5}
          className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>

      {/* Resumo do médico */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-main)]">Resumo do Profissional</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Notas pessoais do profissional — não são enviadas ao paciente.
            </p>
          </div>
          <button
            onClick={salvarResumo}
            disabled={savingResumo || !pacienteId}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[8px] transition-all ${
              resumoSaved
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-main)] border border-[var(--color-border-card)] hover:border-[var(--color-primary)] disabled:opacity-40'
            }`}
          >
            {savingResumo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : resumoSaved ? (
              '✓ Salvo'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar
              </>
            )}
          </button>
        </div>
        <textarea
          value={resumo}
          onChange={e => setResumo(e.target.value)}
          placeholder="Observações clínicas, evolução do tratamento, pontos de atenção..."
          rows={5}
          className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
    </div>
  );
}
