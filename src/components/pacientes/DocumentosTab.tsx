import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  leadId: string;
}

interface FormSubmission {
  id: string;
  form_type: string;
  form_name: string | null;
  dados: Record<string, any>;
  created_at: string;
  tally_submission_id: string | null;
}

export function DocumentosTab({ leadId }: Props) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (data) setSubmissions(data);
      setLoading(false);
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <FileText className="w-8 h-8 text-[var(--color-text-muted)] opacity-30" />
        <div className="text-center">
          <p className="text-sm text-[var(--color-text-muted)]">Nenhum formulário recebido</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 opacity-70">
            Os formulários Tally aparecerão aqui quando recebidos via webhook
          </p>
        </div>
      </div>
    );
  }

  // Group by form_type
  const grouped = submissions.reduce<Record<string, FormSubmission[]>>((acc, s) => {
    const key = s.form_name || s.form_type || 'Formulário';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {Object.entries(grouped).map(([groupName, forms]) => (
        <div key={groupName}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            {groupName}
          </h3>
          <div className="space-y-2">
            {forms.map(form => {
              const isExpanded = expandedId === form.id;
              const dadosEntries = Object.entries(form.dados || {}).filter(
                ([, v]) => v !== null && v !== '' && v !== undefined
              );

              return (
                <div
                  key={form.id}
                  className="border border-[var(--color-border-card)] rounded-[10px] bg-[var(--color-bg-card)] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : form.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-primary-light)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-main)] truncate">
                        {form.form_name || form.form_type || 'Formulário'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {format(new Date(form.created_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && dadosEntries.length > 0 && (
                    <div className="border-t border-[var(--color-border-card)] px-4 py-3 space-y-2">
                      {dadosEntries.map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-xs font-medium text-[var(--color-text-muted)] min-w-[120px] flex-shrink-0 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-[var(--color-text-main)] break-words">
                            {typeof value === 'boolean'
                              ? value ? 'Sim' : 'Não'
                              : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && dadosEntries.length === 0 && (
                    <div className="border-t border-[var(--color-border-card)] px-4 py-3">
                      <p className="text-xs text-[var(--color-text-muted)]">Sem dados adicionais</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
