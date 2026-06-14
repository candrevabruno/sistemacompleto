import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../ui/Modal';
import { Pencil, Trash2, Check, X, Loader2, History } from 'lucide-react';

export interface HistItem {
  id: string;
  conteudo: string;
  autor_nome: string;
  created_at: string;
  editado_em?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  titulo: string;
  itens: HistItem[];
  /** Edita o conteúdo de um item. Parent cuida da persistência (+audit se aplicável). */
  onEditar: (id: string, conteudo: string) => Promise<void>;
  /** Apaga um item. Parent cuida da persistência (+audit se aplicável). */
  onApagar: (id: string) => Promise<void>;
}

/**
 * Modal de histórico reutilizável (item 2 da ETAPA): lista TODOS os registros do
 * mais recente ao mais antigo, com data/hora/autor, e permite editar e apagar
 * cada item individualmente.
 */
export function HistoricoModal({ open, onClose, titulo, itens, onEditar, onApagar }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const iniciarEdicao = (item: HistItem) => {
    setEditId(item.id);
    setEditTexto(item.conteudo);
    setConfirmDel(null);
  };

  const salvarEdicao = async (id: string) => {
    if (!editTexto.trim()) return;
    setBusyId(id);
    await onEditar(id, editTexto.trim());
    setBusyId(null);
    setEditId(null);
    setEditTexto('');
  };

  const apagar = async (id: string) => {
    setBusyId(id);
    await onApagar(id);
    setBusyId(null);
    setConfirmDel(null);
  };

  return (
    <Modal isOpen={open} onClose={onClose} bare className="max-w-lg mx-4">
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-display flex items-center gap-2" style={{ fontSize: '19px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
          <History className="w-4 h-4" style={{ color: 'var(--sage-dark)' }} /> {titulo}
        </h3>
        <button onClick={onClose} style={{ color: 'var(--muted)' }}><X className="w-5 h-5" /></button>
      </div>

      <div className="p-5 space-y-2.5 max-h-[65vh] overflow-y-auto">
        {itens.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Nenhum registro ainda.</p>
        ) : itens.map(item => {
          const editando = editId === item.id;
          const confirmando = confirmDel === item.id;
          return (
            <div key={item.id} className="rounded-[10px] border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              {editando ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editTexto}
                    onChange={e => setEditTexto(e.target.value)}
                    rows={4}
                    className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid var(--border-md)', background: 'var(--white)', color: 'var(--ink)', resize: 'none', lineHeight: 1.5 }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => salvarEdicao(item.id)}
                      disabled={!editTexto.trim() || busyId === item.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[6px] disabled:opacity-50"
                      style={{ background: 'var(--sage-dark)', color: '#fff' }}
                    >
                      {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
                    </button>
                    <button onClick={() => setEditId(null)} className="text-xs px-3 py-1.5 rounded-[6px]" style={{ border: '1px solid var(--border-md)', color: 'var(--muted)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--ink)', lineHeight: 1.5 }}>{item.conteudo}</p>
                  <div className="flex items-center justify-between gap-2 mt-2.5">
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {item.autor_nome} · {format(new Date(item.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
                      {item.editado_em && <span className="ml-1 opacity-70">(editado)</span>}
                    </span>
                    {confirmando ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: 'var(--rose-text)' }}>Apagar?</span>
                        <button onClick={() => apagar(item.id)} disabled={busyId === item.id} className="text-[11px] font-medium px-2 py-1 rounded-[5px]" style={{ background: 'var(--rose-light)', color: 'var(--rose-text)' }}>
                          {busyId === item.id ? '...' : 'Sim'}
                        </button>
                        <button onClick={() => setConfirmDel(null)} className="text-[11px] px-2 py-1 rounded-[5px]" style={{ color: 'var(--muted)' }}>Não</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button onClick={() => iniciarEdicao(item)} title="Editar" className="p-1 rounded transition-colors hover:bg-[var(--border)]" style={{ color: 'var(--muted)' }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDel(item.id)} title="Apagar" className="p-1 rounded transition-colors hover:bg-[var(--rose-light)]" style={{ color: 'var(--muted)' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
